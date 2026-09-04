<?php
/**
 * Per-platform Script SEO/AEO quality gate.
 *
 * Deterministic, no DB/network access. Evaluates one generated social script
 * against the Content Item Source of Truth and returns separate SEO/AEO gates.
 */

const SCRIPT_GATE_PASS_SCORE = 80;
const SCRIPT_GATE_WARN_SCORE = 70;

const SCRIPT_PLATFORMS = [
    'facebook', 'instagram', 'tiktok', 'youtube', 'lineoa', 'linkedin', 'twitter',
];

const SCRIPT_SEO_WEIGHTS = [
    'topic_relevance'       => ['weight' => 20, 'tier' => 'required'],
    'keyword_relevance'     => ['weight' => 15, 'tier' => 'required'],
    'hook_title'            => ['weight' => 15, 'tier' => 'required'],
    'completeness'          => ['weight' => 15, 'tier' => 'required'],
    'discoverability'       => ['weight' => 15, 'tier' => 'required'],
    'keyword_naturalness'   => ['weight' => 10, 'tier' => 'required'],
    'unsupported_facts'     => ['weight' => 10, 'tier' => 'required'],
];

const SCRIPT_AEO_WEIGHTS = [
    'direct_value'      => ['weight' => 20, 'tier' => 'required'],
    'search_intent'     => ['weight' => 15, 'tier' => 'required'],
    'answer_structure'  => ['weight' => 15, 'tier' => 'required'],
    'entity_clarity'    => ['weight' => 15, 'tier' => 'required'],
    'snippet_readiness' => ['weight' => 15, 'tier' => 'required'],
    'question_match'   => ['weight' => 10, 'tier' => 'required'],
    'factual_grounding' => ['weight' => 10, 'tier' => 'required'],
];

function script_make_rule(array $weights, string $key, string $status, string $message): array {
    $meta = $weights[$key] ?? ['weight' => 0, 'tier' => 'required'];
    $level = match ($status) {
        'passed' => 'pass',
        'needs_improvement' => 'warn',
        'failed' => 'fail',
        'n/a' => 'skip',
        default => 'pending',
    };
    $score = match ($status) {
        'passed' => $meta['weight'],
        'needs_improvement' => (int)round($meta['weight'] / 2),
        default => 0,
    };
    return [
        'key' => $key,
        'level' => $level,
        'status' => $status,
        'tier' => $meta['tier'],
        'weight' => $meta['weight'],
        'score' => $score,
        'critical' => false,
        'message' => $message,
    ];
}

function script_normalized_score(array $rules): int {
    $earned = 0;
    $possible = 0;
    foreach ($rules as $rule) {
        $status = $rule['status'] ?? 'skip';
        if (in_array($status, ['pending', 'n/a', 'skip'], true)) continue;
        $earned += (int)($rule['score'] ?? 0);
        $possible += (int)($rule['weight'] ?? 0);
    }
    return $possible > 0 ? (int)round(100 * $earned / $possible) : 0;
}

function script_gate_status(array $eval): string {
    foreach (($eval['rules'] ?? []) as $rule) {
        if (($rule['tier'] ?? 'required') === 'required' && ($rule['status'] ?? '') === 'failed') return 'failed';
    }
    $score = (int)($eval['score'] ?? 0);
    if ($score < SCRIPT_GATE_WARN_SCORE) return 'failed';
    if ($score < SCRIPT_GATE_PASS_SCORE) return 'needs_improvement';
    return 'passed';
}

function script_plain_text(string $text): string {
    $text = html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    return trim(preg_replace('/\s+/u', ' ', $text));
}

function script_contains(string $haystack, string $needle): bool {
    if ($needle === '' || $haystack === '') return false;
    return mb_stripos($haystack, $needle) !== false;
}

function script_topic_terms(array $item): array {
    $terms = [];
    foreach ([
        $item['topic'] ?? '',
        $item['title'] ?? '',
        $item['primary_keyword'] ?? '',
    ] as $value) {
        $value = trim((string)$value);
        if ($value !== '') $terms[] = $value;
    }

    $keywords = $item['meta_keywords'] ?? '';
    if (is_array($keywords)) {
        foreach ($keywords as $keyword) if (is_string($keyword) && trim($keyword) !== '') $terms[] = trim($keyword);
    } else {
        foreach (preg_split('/\s*,\s*/u', (string)$keywords) as $keyword) {
            if (trim($keyword) !== '') $terms[] = trim($keyword);
        }
    }

    $brief = is_array($item['research_brief'] ?? null) ? $item['research_brief'] : null;
    if ($brief) {
        foreach ([$brief['primary_keyword'] ?? ''] as $keyword) {
            if (trim((string)$keyword) !== '') $terms[] = trim((string)$keyword);
        }
        foreach (($brief['secondary_keywords'] ?? []) as $entry) {
            $keyword = is_string($entry) ? $entry : ($entry['keyword'] ?? '');
            if (trim((string)$keyword) !== '') $terms[] = trim((string)$keyword);
        }
    }

    $terms = array_values(array_unique(array_filter($terms, static fn($v) => mb_strlen($v) >= 2)));
    usort($terms, static fn($a, $b) => mb_strlen($b) <=> mb_strlen($a));
    return array_slice($terms, 0, 12);
}

function script_primary_keyword(array $item): string {
    $primary = trim((string)($item['primary_keyword'] ?? ''));
    if ($primary !== '') return $primary;
    $keywords = trim((string)($item['meta_keywords'] ?? ''));
    if ($keywords !== '') return trim((preg_split('/\s*,\s*/u', $keywords)[0] ?? ''));
    $brief = is_array($item['research_brief'] ?? null) ? $item['research_brief'] : null;
    return $brief ? trim((string)($brief['primary_keyword'] ?? '')) : '';
}

function script_hashtag_count(string $text): int {
    return preg_match_all('/(?<!\p{L})#[\p{L}\p{N}_-]+/u', $text, $m) ?: 0;
}

function script_intent_signals(string $intent): array {
    return match (strtolower(trim($intent))) {
        'commercial' => ['เปรียบเทียบ','รีวิว','ดีที่สุด','คุ้มค่า','best','review','vs','เทียบ','แนะนำ'],
        'transactional' => ['ซื้อ','สมัคร','ราคา','สั่งซื้อ','โปรโมชั่น','ส่วนลด','buy','price','order','จอง'],
        'navigational' => ['เว็บไซต์','ล็อกอิน','login','official','เข้าสู่ระบบ','download','ดาวน์โหลด'],
        default => ['คือ','วิธี','ทำไม','อย่างไร','ขั้นตอน','how','what','why','guide','แนวทาง'],
    };
}

function script_questionish(string $text): bool {
    $text = trim($text);
    if ($text === '') return false;
    if (preg_match('/[?？]/u', $text)) return true;
    foreach (['วิธี', 'ทำไม', 'เมื่อไร', 'เท่าไร', 'ใคร', 'ที่ไหน', 'คืออะไร', 'อะไร', 'อย่างไร', 'ไหม', 'หรือไม่', 'หรือเปล่า'] as $q) {
        if (mb_stripos($text, $q) !== false) return true;
    }
    return (bool)preg_match('/\b(what|why|how|when|where|who|which|can|does|is|are)\b/i', $text);
}

function script_evaluate_seo(string $platform, string $script, array $item): array {
    $text = script_plain_text($script);
    $terms = script_topic_terms($item);
    $primary = script_primary_keyword($item);
    $lower = mb_strtolower($text);
    $rules = [];

    // Topic relevance: at least one authoritative topic term must be present.
    $topicHits = 0;
    foreach ($terms as $term) if (script_contains($text, $term)) $topicHits++;
    if ($topicHits >= 1) $rules[] = script_make_rule(SCRIPT_SEO_WEIGHTS, 'topic_relevance', 'passed', "สคริปต์สอดคล้องกับหัวข้อ/Source of Truth ({$topicHits} term)");
    else $rules[] = script_make_rule(SCRIPT_SEO_WEIGHTS, 'topic_relevance', 'failed', 'ไม่พบหัวข้อหรือคำหลักจาก Content Item ในสคริปต์');

    // Keyword relevance is n/a when no keyword/research was supplied.
    if ($primary === '') {
        $rules[] = script_make_rule(SCRIPT_SEO_WEIGHTS, 'keyword_relevance', 'n/a', 'ไม่มี primary keyword ให้ตรวจ');
    } elseif (script_contains($text, $primary)) {
        $rules[] = script_make_rule(SCRIPT_SEO_WEIGHTS, 'keyword_relevance', 'passed', "พบ primary keyword \"{$primary}\" ในสคริปต์");
    } else {
        $rules[] = script_make_rule(SCRIPT_SEO_WEIGHTS, 'keyword_relevance', 'failed', "ไม่พบ primary keyword \"{$primary}\" ในสคริปต์");
    }

    // Platform-specific hook/title requirement.
    $hasHook = match ($platform) {
        'youtube' => preg_match('/\b(?:title|intro|hook|เปิดเรื่อง|เกริ่น)\b/iu', $text) === 1,
        'tiktok', 'instagram' => preg_match('/\b(?:hook|เปิด|3\s*วิ|reels)\b/iu', $text) === 1,
        'twitter' => mb_strlen($text) >= 30,
        default => mb_strlen($text) >= 30,
    };
    if ($hasHook) $rules[] = script_make_rule(SCRIPT_SEO_WEIGHTS, 'hook_title', 'passed', 'มี hook/title opening ที่เหมาะกับ platform');
    else $rules[] = script_make_rule(SCRIPT_SEO_WEIGHTS, 'hook_title', 'needs_improvement', 'ควรเพิ่ม hook/title opening ที่ชัดเจนสำหรับ platform นี้');

    $minChars = match ($platform) {
        'twitter' => 20,
        'lineoa' => 40,
        'youtube' => 120,
        'instagram', 'tiktok' => 60,
        default => 50,
    };
    if (mb_strlen($text) >= $minChars) $rules[] = script_make_rule(SCRIPT_SEO_WEIGHTS, 'completeness', 'passed', "สคริปต์มีเนื้อหาครบพอสำหรับ {$platform}");
    elseif (mb_strlen($text) >= (int)floor($minChars / 2)) $rules[] = script_make_rule(SCRIPT_SEO_WEIGHTS, 'completeness', 'needs_improvement', "สคริปต์ยังสั้น ควรเพิ่มรายละเอียด/คุณค่าที่ส่งมอบ");
    else $rules[] = script_make_rule(SCRIPT_SEO_WEIGHTS, 'completeness', 'failed', 'สคริปต์สั้นเกินไปและไม่มีสาระเพียงพอ');

    $needsHashtag = in_array($platform, ['instagram', 'tiktok', 'facebook', 'youtube'], true);
    if ($needsHashtag) {
        $hashtags = script_hashtag_count($text);
        if ($hashtags >= 1) $rules[] = script_make_rule(SCRIPT_SEO_WEIGHTS, 'discoverability', 'passed', "มี hashtag/keyword cue สำหรับ {$platform} ({$hashtags})");
        else $rules[] = script_make_rule(SCRIPT_SEO_WEIGHTS, 'discoverability', 'needs_improvement', "ควรเพิ่ม hashtag/keyword cue ที่เหมาะกับ {$platform}");
    } elseif (in_array($platform, ['twitter', 'linkedin', 'lineoa'], true)) {
        if ($primary !== '' && script_contains($text, $primary)) $rules[] = script_make_rule(SCRIPT_SEO_WEIGHTS, 'discoverability', 'passed', 'มี keyword cue ที่ค้นหาได้ในข้อความ');
        else $rules[] = script_make_rule(SCRIPT_SEO_WEIGHTS, 'discoverability', 'needs_improvement', 'ควรเพิ่ม keyword cue ที่เหมาะกับ platform');
    } else {
        $rules[] = script_make_rule(SCRIPT_SEO_WEIGHTS, 'discoverability', 'passed', 'platform นี้ไม่บังคับ hashtag');
    }

    $wordCount = max(1, count(preg_split('/\s+/u', $text)));
    $occurrences = $primary !== '' ? substr_count($lower, mb_strtolower($primary)) : 0;
    $density = $occurrences / $wordCount;
    if ($primary === '' || $occurrences <= 4 || $density <= 0.08) $rules[] = script_make_rule(SCRIPT_SEO_WEIGHTS, 'keyword_naturalness', 'passed', 'ใช้ keyword อย่างเป็นธรรมชาติ ไม่พบ keyword stuffing');
    elseif ($density <= 0.15) $rules[] = script_make_rule(SCRIPT_SEO_WEIGHTS, 'keyword_naturalness', 'needs_improvement', 'keyword ปรากฏถี่เกินไป ควรลดการย้ำคำ');
    else $rules[] = script_make_rule(SCRIPT_SEO_WEIGHTS, 'keyword_naturalness', 'failed', 'พบ keyword stuffing ชัดเจน');

    // The evaluator cannot prove external facts. It only fails when the script explicitly
    // claims to have sources/citations that are absent from the supplied Source of Truth.
    $hasResearch = is_array($item['research_brief'] ?? null);
    $hasSource = !empty($item['knowledge_base']) || !empty($item['brand_context']) || $hasResearch;
    $claimsSource = preg_match('/(?:อ้างอิง|แหล่งข้อมูล|source|according to|จากงานวิจัย|ผลวิจัย)/iu', $text) === 1;
    if ($claimsSource && !$hasSource) $rules[] = script_make_rule(SCRIPT_SEO_WEIGHTS, 'unsupported_facts', 'failed', 'สคริปต์อ้างแหล่งข้อมูล/งานวิจัย แต่ไม่มี Source of Truth รองรับ');
    else $rules[] = script_make_rule(SCRIPT_SEO_WEIGHTS, 'unsupported_facts', 'passed', 'ผ่านการตรวจข้อเท็จจริงตามข้อมูลที่ระบบมี (ไม่พบการอ้างแหล่งที่ไม่มีอยู่)');

    $score = script_normalized_score($rules);
    return ['score' => $score, 'gate' => script_gate_status(['score' => $score, 'rules' => $rules]), 'rules' => $rules];
}

function script_evaluate_aeo(string $platform, string $script, array $item): array {
    $text = script_plain_text($script);
    $primary = script_primary_keyword($item);
    $terms = script_topic_terms($item);
    $brief = is_array($item['research_brief'] ?? null) ? $item['research_brief'] : null;
    $intent = $brief ? trim((string)($brief['intent'] ?? '')) : '';
    $rules = [];

    $direct = mb_strlen($text) >= 40 && ($primary === '' || script_contains($text, $primary) || ($terms && script_contains($text, $terms[0])));
    if ($direct) $rules[] = script_make_rule(SCRIPT_AEO_WEIGHTS, 'direct_value', 'passed', 'สคริปต์ให้คุณค่า/คำตอบหลักตั้งแต่ต้น');
    elseif (mb_strlen($text) >= 40) $rules[] = script_make_rule(SCRIPT_AEO_WEIGHTS, 'direct_value', 'needs_improvement', 'มีเนื้อหาแต่ควรตอบประเด็นหลักให้เร็วขึ้น');
    else $rules[] = script_make_rule(SCRIPT_AEO_WEIGHTS, 'direct_value', 'failed', 'สคริปต์สั้นหรือยังไม่มีคำตอบ/คุณค่าหลัก');

    if (!$intent) {
        $rules[] = script_make_rule(SCRIPT_AEO_WEIGHTS, 'search_intent', 'n/a', 'ไม่มี Research intent ให้ตรวจ');
    } else {
        $own = 0; $other = 0;
        foreach (['commercial','transactional','navigational','informational'] as $candidate) {
            foreach (script_intent_signals($candidate) as $signal) {
                $hits = substr_count(mb_strtolower($text), mb_strtolower($signal));
                if (strtolower($intent) === $candidate) $own += $hits; else $other += $hits;
            }
        }
        if ($own >= 1 && $own >= $other) $rules[] = script_make_rule(SCRIPT_AEO_WEIGHTS, 'search_intent', 'passed', "สอดคล้องกับ search intent {$intent}");
        elseif ($other > $own) $rules[] = script_make_rule(SCRIPT_AEO_WEIGHTS, 'search_intent', 'failed', "สัญญาณของ intent อื่นมากกว่า {$intent}");
        else $rules[] = script_make_rule(SCRIPT_AEO_WEIGHTS, 'search_intent', 'needs_improvement', "ควรเพิ่มเนื้อหาที่ตอบ search intent {$intent} ให้ชัดขึ้น");
    }

    $hasAnswerCue = preg_match('/(?:คือ|ได้แก่|หมายถึง|สามารถ|วิธี|ขั้นตอน|สรุป|คำตอบ|เพราะ|ดังนั้น|คือการ)/iu', $text) === 1;
    if ($hasAnswerCue || script_questionish($text)) $rules[] = script_make_rule(SCRIPT_AEO_WEIGHTS, 'answer_structure', 'passed', 'มีโครงสร้างคำตอบ/เหตุผลที่ Answer Engine อ่านได้');
    elseif (mb_strlen($text) >= 80) $rules[] = script_make_rule(SCRIPT_AEO_WEIGHTS, 'answer_structure', 'needs_improvement', 'ควรจัดคำตอบให้ชัดเจนขึ้นด้วยประโยคสรุปหรือขั้นตอน');
    else $rules[] = script_make_rule(SCRIPT_AEO_WEIGHTS, 'answer_structure', 'failed', 'ไม่พบโครงสร้างคำตอบที่ชัดเจน');

    $entity = $terms[0] ?? '';
    if ($entity !== '' && script_contains($text, $entity)) $rules[] = script_make_rule(SCRIPT_AEO_WEIGHTS, 'entity_clarity', 'passed', "ระบุหัวข้อ/เอนทิตีหลักชัดเจน: {$entity}");
    else $rules[] = script_make_rule(SCRIPT_AEO_WEIGHTS, 'entity_clarity', 'failed', 'ไม่พบชื่อหัวข้อหรือเอนทิตีหลักในสคริปต์');

    $snippet = mb_strlen($text) >= 40 && mb_strlen($text) <= 1000 && preg_match('/(?:คือ|ได้แก่|หมายถึง|วิธี|ขั้นตอน|สรุป|คำตอบ)/iu', $text);
    if ($snippet) $rules[] = script_make_rule(SCRIPT_AEO_WEIGHTS, 'snippet_readiness', 'passed', 'มีข้อความตอบแบบกระชับที่พร้อมให้ระบบค้นหาดึงไปใช้');
    elseif (mb_strlen($text) >= 40) $rules[] = script_make_rule(SCRIPT_AEO_WEIGHTS, 'snippet_readiness', 'needs_improvement', 'ควรเพิ่มประโยคคำตอบสั้น กระชับ และชัดเจน');
    else $rules[] = script_make_rule(SCRIPT_AEO_WEIGHTS, 'snippet_readiness', 'failed', 'เนื้อหาไม่พร้อมสำหรับการดึงคำตอบ');

    if (script_questionish($text)) {
        $rules[] = script_make_rule(SCRIPT_AEO_WEIGHTS, 'question_match', 'passed', 'มีคำถาม/คำตอบหรือรูปแบบตอบข้อสงสัยที่ชัดเจน');
    } elseif ($brief && !empty($brief['paa'])) {
        $rules[] = script_make_rule(SCRIPT_AEO_WEIGHTS, 'question_match', 'needs_improvement', 'มี PAA จาก Research แต่สคริปต์ยังไม่แสดงรูปแบบคำถาม/คำตอบชัดเจน');
    } else {
        $rules[] = script_make_rule(SCRIPT_AEO_WEIGHTS, 'question_match', 'n/a', 'ไม่มีคำถาม/PAA ที่จำเป็นต้องตรวจ');
    }

    $hasSource = !empty($item['knowledge_base']) || !empty($item['brand_context']) || $brief;
    $claimsExternal = preg_match('/(?:อ้างอิง|แหล่งข้อมูล|source|according to|งานวิจัย|สถิติ)/iu', $text) === 1;
    if ($claimsExternal && !$hasSource) $rules[] = script_make_rule(SCRIPT_AEO_WEIGHTS, 'factual_grounding', 'failed', 'มีการอ้างข้อเท็จจริง/แหล่งข้อมูลโดยไม่มี Source of Truth');
    else $rules[] = script_make_rule(SCRIPT_AEO_WEIGHTS, 'factual_grounding', 'passed', 'ไม่มีการอ้างข้อเท็จจริงที่ระบบตรวจพบว่าไม่มีแหล่งรองรับ');

    $score = script_normalized_score($rules);
    return ['score' => $score, 'gate' => script_gate_status(['score' => $score, 'rules' => $rules]), 'rules' => $rules];
}

/**
 * Evaluate every selected script independently.
 * @return array{platforms:array, passed:bool}
 */
function script_quality_evaluate(array $scripts, array $selectedPlatforms, array $item): array {
    $out = [];
    foreach ($selectedPlatforms as $platform) {
        $script = trim((string)($scripts[$platform] ?? ''));
        if ($script === '') {
            $failed = [
                'key' => 'script_present', 'level' => 'fail', 'status' => 'failed',
                'tier' => 'required', 'weight' => 100, 'score' => 0, 'critical' => true,
                'message' => "ไม่มี script สำหรับ {$platform}",
            ];
            $out[$platform] = [
                'seo' => ['score' => 0, 'gate' => 'failed', 'rules' => [$failed]],
                'aeo' => ['score' => 0, 'gate' => 'failed', 'rules' => [$failed]],
                'passed' => false,
            ];
            continue;
        }
        $seo = script_evaluate_seo($platform, $script, $item);
        $aeo = script_evaluate_aeo($platform, $script, $item);
        $out[$platform] = [
            'seo' => $seo,
            'aeo' => $aeo,
            'passed' => $seo['gate'] === 'passed' && $aeo['gate'] === 'passed',
        ];
    }

    $allPassed = true;
    foreach ($out as $result) {
        if (empty($result['passed'])) { $allPassed = false; break; }
    }
    return ['platforms' => $out, 'passed' => $allPassed];
}

function script_quality_check_platform(array $content, string $platform, ?array $researchBrief = null): array {
    $platform = strtolower(trim($platform));
    if (!in_array($platform, SCRIPT_PLATFORMS, true)) {
        return [
            'seo' => ['score' => 100, 'gate' => 'passed', 'rules' => []],
            'aeo' => ['score' => 100, 'gate' => 'passed', 'rules' => []],
            'passed' => true,
            'skipped' => true,
        ];
    }

    $article = $content['article_content'] ?? null;
    if (is_string($article)) $article = json_decode($article, true);
    if (!is_array($article)) $article = [];
    $scripts = is_array($article['scripts'] ?? null) ? $article['scripts'] : [];
    $brief = $researchBrief ?? (is_array($content['research_brief'] ?? null) ? $content['research_brief'] : null);
    $item = array_merge($content, ['research_brief' => $brief]);
    $result = script_quality_evaluate($scripts, [$platform], $item);
    return $result['platforms'][$platform] ?? [
        'seo' => ['score' => 0, 'gate' => 'failed', 'rules' => []],
        'aeo' => ['score' => 0, 'gate' => 'failed', 'rules' => []],
        'passed' => false,
    ];
}

function script_quality_selected_platforms(array $content): array {
    $raw = $content['platforms'] ?? null;
    if (is_array($raw)) {
        $platforms = $raw;
    } elseif (is_string($raw) && trim($raw) !== '') {
        $decoded = json_decode($raw, true);
        $platforms = is_array($decoded) ? $decoded : preg_split('/\\s*,\\s*/', $raw);
    } else {
        $platforms = preg_split('/\\s*,\\s*/', (string)($content['platform'] ?? ''));
    }
    return array_values(array_unique(array_filter(array_map(
        static fn($p): string => strtolower(trim((string)$p)), $platforms
    ))));
}

function script_quality_publish_check(array $content, string $platform, ?array $researchBrief = null): array {
    $platform = strtolower(trim($platform));
    $selected = script_quality_selected_platforms($content);
    if (!in_array($platform, $selected, true)) {
        return ['blocked' => true, 'reason' => "แพลตฟอร์ม {$platform} ไม่ได้ถูกเลือกไว้ใน Content Item"];
    }
    if (!in_array($platform, SCRIPT_PLATFORMS, true)) {
        return ['blocked' => false, 'reason' => null];
    }
    $quality = script_quality_check_platform($content, $platform, $researchBrief);
    if (!empty($quality['passed'])) return ['blocked' => false, 'reason' => null, 'quality' => $quality];
    $reasons = [];
    foreach (['seo' => 'Script SEO', 'aeo' => 'Script AEO'] as $key => $label) {
        $failed = array_filter($quality[$key]['rules'] ?? [], static fn(array $r): bool => ($r['status'] ?? '') === 'failed');
        if ($failed) $reasons[] = $label . ': ' . implode('; ', array_map(static fn(array $r): string => $r['message'] ?? '', $failed));
    }
    if (!$reasons) $reasons[] = "Script {$platform} SEO/AEO score ยังไม่ถึง 80 (SEO {$quality['seo']['score']}/100, AEO {$quality['aeo']['score']}/100)";
    return ['blocked' => true, 'reason' => implode("\\n", $reasons), 'quality' => $quality];
}

function script_quality_generation_requirements(array $platforms): string {
    $lines = [
        '- สร้าง script เฉพาะ platform ที่อยู่ใน Selected Platforms เท่านั้น ห้ามสร้าง platform อื่น',
        '- แต่ละ platform ต้องมีเนื้อหาที่ปรับให้เหมาะกับ platform นั้น ไม่ copy ข้าม platform แบบตรง ๆ',
        '- Topic, user seed, Research Brief, Brand Context และ Knowledge Base เป็น Source of Truth; ห้ามเดาข้อเท็จจริงเพื่อให้ผ่าน checklist',
        '- ทุก script ต้องมี topic relevance, keyword relevance เมื่อมี keyword, hook/title, เนื้อหาครบพอ, discoverability และใช้ keyword อย่างเป็นธรรมชาติ',
        '- ทุก script ต้องให้ value/answer โดยตรง, ระบุ entity/topic ชัด, จัดคำตอบให้อ่านง่าย และพร้อมสำหรับ Answer Engine',
        '- ถ้ามี Research ให้ตอบ search intent และ PAA ที่เกี่ยวข้อง; ถ้าไม่มี Research ห้ามสร้างข้อมูล Research ขึ้นมาเอง',
        '- หากมีคำถาม ให้ตอบคำถามนั้นอย่างชัดเจน ไม่ใช้บทนำลอย ๆ',
        '- ห้ามอ้างงานวิจัย สถิติ แหล่งข้อมูล หรือข้อเท็จจริงภายนอกที่ไม่ได้อยู่ใน Source of Truth',
    ];

    foreach ($platforms as $platform) {
        $lines[] = match ($platform) {
            'youtube' => '- [youtube] เน้น title/intro/hook ที่ค้นหาได้, อธิบายหัวข้อเป็นลำดับ และ CTA ที่เหมาะกับ YouTube',
            'facebook' => '- [facebook] เน้น opening caption ที่เข้าใจทันที, topic keyword และ hashtag เมื่อเหมาะสม',
            'instagram' => '- [instagram] เน้น Reels/caption hook, keyword และ hashtag ที่เกี่ยวข้อง ไม่ยัด keyword',
            'tiktok' => '- [tiktok] เน้น hook 3 วินาทีแรก, keyword/hashtag และ value ที่เข้าใจเร็ว',
            'lineoa' => '- [lineoa] เน้นข้อความสั้น กระชับ อ่านง่าย และ CTA ที่ชัดเจน',
            'linkedin' => '- [linkedin] เน้น professional value, entity/topic clarity และ keyword ที่เป็นธรรมชาติ',
            'twitter' => '- [twitter] เน้นข้อความสั้น คม ชัด topic/keyword และไม่ยืดเยื้อ',
            default => '- [' . $platform . '] ปรับสคริปต์ตามธรรมชาติของ platform',
        };
    }
    return implode("\n", $lines);
}
