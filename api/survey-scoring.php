<?php
// api/survey-scoring.php
// Included by surveys.php, survey-responses.php, survey-public.php
// NOT a standalone endpoint.
//
// ── Scoring model (rewritten 2026-05-13) ────────────────────────────────────
//
//   For each question i:
//     normalized_i ∈ [0,1]  = (answer_value_numeric / max_score)
//     effective_w_i (%)     = (weight_i / Σ weights) × 100   ← always sums to 100
//     contribution_i (%)    = normalized_i × effective_w_i
//
//   total_base (%)  = Σ contribution_i               ∈ [0, 100]
//   bonus (%)       = Σ critical_bonus when triggered (additive, capped so total ≤ 100)
//   percentage      = min(100, total_base + bonus)
//
// Why this is better than the old formula:
//   - Σ weights doesn't have to be 100 — we normalize internally (NO MAGIC: explicit).
//   - Each question's max contribution is its effective weight %.
//   - Adding a question reduces every other question's weight proportionally
//     (instead of inflating the divisor).
//   - multiple_choice options can have any score in [0, max_score];
//     migration 2026_05_13_130000_backfill_option_scores fills missing scores
//     using ascending interpolation.

declare(strict_types=1);

/**
 * Convert an answer_value string to a numeric value (raw, NOT yet ÷ max_score).
 *  yes_no:          "yes" → 1.0, otherwise 0.0
 *  scale_1_5:       "1".."5" → 1.0..5.0 (out of range → 0)
 *  multiple_choice: look up option's `score` from options_json (default 0 if missing)
 *  text:            always 0 (no score contribution)
 */
function answerToNumeric(string $value, string $type, ?array $question = null): float {
    if ($type === 'yes_no') {
        return $value === 'yes' ? 1.0 : 0.0;
    }
    if ($type === 'scale_1_5') {
        $n = (float)$value;
        return ($n >= 1 && $n <= 5) ? $n : 0.0;
    }
    if ($type === 'multiple_choice' && $question && !empty($question['options_json'])) {
        $options = $question['options_json'];
        if (is_string($options)) {
            $options = json_decode($options, true) ?? [];
        }
        if (is_array($options)) {
            foreach ($options as $opt) {
                $optValue = $opt['value'] ?? '';
                if ((string)$optValue === (string)$value) {
                    return (float)($opt['score'] ?? 0);
                }
            }
        }
    }
    return 0.0;
}

/**
 * @param array $answers  [ ['question_id'=>string, 'answer_value'=>string], ... ]
 * @param array $questions [ ['id'=>string, 'question_type'=>string, 'weight'=>float,
 *                            'is_critical'=>int, 'critical_bonus'=>float, 'max_score'=>float,
 *                            'options_json'=>string|null], ... ]
 * @return array{
 *   score: float,                            // 0..100 — same number as percentage
 *   max: float,                              // always 100.0 (kept for FE compat)
 *   percentage: float,                       // 0..100
 *   priority: string,                        // 'low' | 'medium' | 'high' | 'critical'
 *   per_question: array<string,float>,       // question_id => percentage points contributed
 *   weights_effective: array<string,float>,  // question_id => effective weight in %
 *   bonus: float                             // bonus pp actually applied (already in score)
 * }
 */
function calculateScore(array $answers, array $questions): array {
    // ── Step 1: normalize weights so they sum to 100 ─────────────────────────
    $totalRawWeight = 0.0;
    foreach ($questions as $q) {
        $w = (float)($q['weight'] ?? 1.0);
        if ($w < 0) $w = 0;
        $totalRawWeight += $w;
    }

    $effectiveWeights = [];
    if ($totalRawWeight > 0) {
        foreach ($questions as $q) {
            $w = (float)($q['weight'] ?? 1.0);
            $effectiveWeights[$q['id']] = ($w / $totalRawWeight) * 100.0;
        }
    } else {
        // All weights zero → divide evenly
        $n = max(1, count($questions));
        foreach ($questions as $q) {
            $effectiveWeights[$q['id']] = 100.0 / $n;
        }
    }

    // ── Step 2: index questions by id for fast lookup ────────────────────────
    $qMap = [];
    foreach ($questions as $q) $qMap[$q['id']] = $q;

    $perQuestion = [];
    foreach ($questions as $q) $perQuestion[$q['id']] = 0.0;

    // ── Step 3: compute contributions ────────────────────────────────────────
    $totalBase = 0.0;
    $bonus     = 0.0;
    foreach ($answers as $a) {
        $qid = $a['question_id'] ?? null;
        if (!$qid || !isset($qMap[$qid])) continue;
        $q      = $qMap[$qid];
        $maxScr = (float)($q['max_score'] ?? 1.0);
        $effW   = $effectiveWeights[$qid] ?? 0.0;

        $numeric = answerToNumeric((string)($a['answer_value'] ?? ''), $q['question_type'], $q);
        $ratio   = $maxScr > 0 ? max(0.0, min(1.0, $numeric / $maxScr)) : 0.0;
        $contribution = $ratio * $effW;

        $perQuestion[$qid] = round($contribution, 2);
        $totalBase        += $contribution;

        // Critical bonus rules:
        //   - yes_no "yes" triggers
        //   - scale_1_5 ≥ 4 triggers (top 40% of scale)
        //   - multiple_choice triggers when ratio ≥ 0.8 (top option chosen)
        if ((int)($q['is_critical'] ?? 0) === 1) {
            $triggered = false;
            if      ($q['question_type'] === 'yes_no'          && $a['answer_value'] === 'yes')   $triggered = true;
            elseif  ($q['question_type'] === 'scale_1_5'       && (float)$a['answer_value'] >= 4) $triggered = true;
            elseif  ($q['question_type'] === 'multiple_choice' && $ratio >= 0.8)                  $triggered = true;
            if ($triggered) $bonus += (float)($q['critical_bonus'] ?? 0);
        }
    }

    $baseClamped = min(100.0, $totalBase);
    $percentage  = min(100.0, $baseClamped + $bonus);
    $bonusApplied = $percentage - $baseClamped;

    $priority = 'low';
    if      ($percentage >= 80) $priority = 'critical';
    elseif  ($percentage >= 60) $priority = 'high';
    elseif  ($percentage >= 40) $priority = 'medium';

    foreach ($effectiveWeights as $k => $v) $effectiveWeights[$k] = round($v, 2);

    return [
        'score'             => round($percentage, 2),
        'max'               => 100.00,
        'percentage'        => round($percentage, 2),
        'priority'          => $priority,
        'per_question'      => $perQuestion,
        'weights_effective' => $effectiveWeights,
        'bonus'             => round($bonusApplied, 2),
    ];
}
