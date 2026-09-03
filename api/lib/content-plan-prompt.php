<?php
/**
 * Prompt construction สำหรับ `brand-content.php?action=generate-plan`
 *
 * แยกออกมาเป็น pure function เพื่อให้ทดสอบได้ว่า
 *   - Direct Content Creation (`generation_mode=direct`) ไม่มีบริบทวัน/สัปดาห์หลุดเข้า prompt
 *   - Content Plan (mode อื่น/ไม่ระบุ) ยังคงพฤติกรรม weekly/day เดิมทุกตัวอักษร
 *
 * ไฟล์นี้ไม่มี side effect และไม่แตะ DB/AI — ทุกฟังก์ชันรับ input คืน string/array
 */

/** ลำดับวันของ Content Plan รายสัปดาห์ (label, order) */
const CONTENT_PLAN_DAY_DEFS = [
    ['จันทร์', 1], ['อังคาร', 2], ['พุธ', 3], ['พฤหัสบดี', 4], ['ศุกร์', 5],
    ['เสาร์', 6], ['อาทิตย์', 7],
];

/** `generation_mode` จาก request body → เป็น Direct Creation หรือไม่ */
function content_plan_is_direct(mixed $generationMode): bool
{
    return strtolower(trim((string)($generationMode ?? ''))) === 'direct';
}

/**
 * จำนวน item ที่จะสร้าง
 *
 * Direct mode = 1 item เสมอ และ `days` ไม่มีผล (ห้ามใช้ `days` เป็นตัวขับ weekly logic)
 * Plan mode  = legacy: 1-7 จาก `days` (ค่า default ส่งมาจากผู้เรียก)
 */
function content_plan_item_count(bool $isDirect, mixed $daysParam): int
{
    if ($isDirect) return 1;
    return min(7, max(1, (int)$daysParam));
}

/**
 * รายการ [day_label, day_order] ต่อ item
 *
 * Direct mode คืน metadata กลาง `['', 0]` ซึ่งใช้เพื่อ storage compatibility เท่านั้น
 * และต้องไม่ถูกส่งเข้า prompt
 */
function content_plan_day_defs(bool $isDirect, int $itemCount): array
{
    if ($isDirect) return [['', 0]];

    $days = [];
    for ($di = 0; $di < $itemCount; $di++) {
        if ($di < count(CONTENT_PLAN_DAY_DEFS)) {
            $days[] = CONTENT_PLAN_DAY_DEFS[$di];
        } else {
            $days[] = ['วันที่ ' . ($di + 1), $di + 1];
        }
    }
    return $days;
}

/** วันที่กำหนดเผยแพร่: Direct mode ไม่มีวัน จึงเป็น null */
function content_plan_scheduled_date(bool $isDirect, string $weekStart, int $dayOrder): ?string
{
    if ($isDirect) return null;
    return date('Y-m-d', strtotime($weekStart . ' + ' . ($dayOrder - 1) . ' days'));
}

/** DATE INSTRUCTION สำหรับ plan ที่ยาวกว่าสัปดาห์ — คืน '' เมื่อไม่เข้าเงื่อนไข */
function content_plan_date_instruction(string $planType, ?string $planStart, ?string $planEnd): string
{
    if (!in_array($planType, ['monthly', 'quarterly', 'yearly'], true)) return '';
    return "## DATE INSTRUCTION\nAssign each post to a specific date within the plan range (start: {$planStart}, end: {$planEnd}). Use the \"scheduled_date\" field with format YYYY-MM-DD. Spread posts evenly across the plan period.";
}

/** System section ที่บอก AI ว่านี่คือ single-item direct request — คืน '' เมื่อไม่ใช่ direct */
function content_plan_direct_guard(bool $isDirect): string
{
    if (!$isDirect) return '';
    return "## DIRECT CONTENT CREATION\nThis is a single-item direct content request. Do not interpret it as a weekly or content-plan request. Do not introduce any day-of-week, week-start, weekly planning, or scheduling framing unless explicitly present in the user's topic.\nThe Original User Topic/Seed is the source of truth and must be preserved as the subject of the generated content.";
}

/**
 * OUTPUT RULE + JSON schema
 *
 * Direct mode ใช้ตัวอย่าง schema ที่ `day_label` ว่างและ `day_order` เป็น 0
 * เพื่อไม่ให้ชื่อวัน (เช่น `วันจันทร์`) หลุดเข้า prompt
 */
function content_plan_output_rule(bool $isDirect): string
{
    $header = <<<'PROMPT'
## CRITICAL LANGUAGE RULE
ตอบเป็นภาษาไทยเท่านั้น (Thai script only). ห้ามใช้ภาษาจีน เกาหลี ญี่ปุ่น (CJK) โดยเด็ดขาด. English is allowed ONLY for image_brief field and technical terms.

## OUTPUT RULE — STRICTLY JSON ONLY
Your ENTIRE response must be ONE valid JSON object and nothing else.
- Do NOT write any explanation, reasoning, preamble, or commentary.
- Do NOT use markdown code fences (```json).
- Do NOT write sentences before or after the JSON.
- Start your response with { and end with }

Required JSON schema (all fields mandatory):
PROMPT;

    $tail = '"platform":"facebook","topic":"หัวข้อภาษาไทย","caption":"แคปชั่นภาษาไทย 3+ บรรทัด พร้อม #hashtag","image_brief":"Detailed English image prompt for DALL-E/Flux: scene, lighting, style, colors."}';

    if ($isDirect) {
        return $header . "\n" . '{"day_label":"","day_order":0,' . $tail
            . "\n\n" . '`day_label` ต้องเป็น string ว่าง และ `day_order` ต้องเป็น 0 — สองค่านี้เป็น metadata สำหรับ storage เท่านั้น ไม่ใช่คำสั่งเกี่ยวกับเนื้อหา และ `scheduled_date` ถูกกำหนดโดย backend';
    }

    return $header . "\n" . '{"day_label":"วันจันทร์","day_order":1,' . $tail;
}

/**
 * User message ต่อ 1 AI call
 *
 * `$args` รับ: source_topic, trigger_command, week_start, day_label, day_order, platforms_str
 */
function content_plan_user_message(bool $isDirect, array $args): string
{
    $platformsStr = trim((string)($args['platforms_str'] ?? ''));
    $reminder     = 'REMINDER: Output ONLY the JSON object. Start with { and end with }. No other text.';
    $lines        = [];

    if ($isDirect) {
        $lines[] = 'Original User Topic/Seed: ' . (string)($args['source_topic'] ?? '');
        if ($platformsStr !== '') {
            $lines[] = 'Platform เป้าหมาย (ช่องทางเผยแพร่): ' . $platformsStr;
        }
        $lines[] = 'สร้าง content เดี่ยวจากหัวข้อนี้โดยตรง ห้ามเพิ่มบริบทวันหรือสัปดาห์';
        $lines[] = $reminder;
        return implode("\n", $lines);
    }

    $lines[] = (string)($args['trigger_command'] ?? '');
    $lines[] = 'สัปดาห์เริ่มต้น: ' . (string)($args['week_start'] ?? '');
    $lines[] = 'สร้างโพสต์สำหรับวัน' . (string)($args['day_label'] ?? '') . ' (วันที่ ' . (int)($args['day_order'] ?? 0) . ' ของสัปดาห์)';
    if ($platformsStr !== '') {
        $lines[] = 'Platform เป้าหมาย (ช่องทางเผยแพร่): ' . $platformsStr;
    }
    $lines[] = $reminder;
    return implode("\n", $lines);
}
