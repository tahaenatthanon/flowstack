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

/**
 * Platform ที่ต้องการ Script + Script Sections เสมอ (video-native platform)
 * ไม่ว่า Content Type ของ Content Item จะเป็น article หรือ video — นี่คือ
 * single source of truth ตัวเดียวที่ generate-article ใช้ตัดสินว่าจะขอ
 * script_sections จาก AI ไหม (แยกจาก $isVideo ที่คุมแค่วิธีเขียน Core Article)
 * ต้องตรงกับ VIDEO_SCRIPT_PLATFORMS ใน src/components/content/types.ts
 */
const VIDEO_SCRIPT_PLATFORMS = ['tiktok', 'youtube'];

/**
 * Platform ที่เลือกไว้มี platform วิดีโอ (TikTok/YouTube) อยู่หรือไม่
 *
 * ใช้แทนการเช็ค $isVideo (Content Type) เพื่อตัดสินว่าจะขอ script_sections
 * จาก AI หรือไม่ — Content Type คุมแค่วิธีเขียน Core Article เท่านั้น
 * ส่วนนี้คุมเฉพาะ Platform Output shape ตามที่ platform ต้องการจริง
 */
function content_needs_script_sections(array $selectedPlatforms): bool
{
    $normalized = array_map(static fn($p): string => strtolower(trim((string)$p)), $selectedPlatforms);
    return count(array_intersect($normalized, VIDEO_SCRIPT_PLATFORMS)) > 0;
}

/**
 * กฎของ article_content.scripts[platform] (platform-post-text): scripts คือ "ข้อความโพสต์" ที่ระบบโพสต์
 * ลง platform นั้นตรงๆ โดยเติม "หัวข้อ" ของคอนเทนต์ไว้บรรทัดแรกให้เอง — ใช้ทั้ง prompt วิดีโอและบทความ
 */
const SCRIPTS_POST_READY_RULE = 'Post Text Rule (scripts): แต่ละ scripts[platform] คือ "ข้อความโพสต์" ที่จะถูกโพสต์ลง platform นั้นทันทีโดยไม่แก้ไข — '
    . 'ห้ามมีคำกำกับต้นบรรทัด (เช่น "Post caption:", "Caption:", "CTA:", "Hook:", "Scene 1:", "Intro:", "Outro:") '
    . 'ห้ามมีบรรทัดพาดหัว/ชื่อเรื่อง เพราะระบบเติมหัวข้อของคอนเทนต์ไว้บรรทัดแรกให้เอง ให้ขึ้นต้นด้วยเนื้อหาเลย '
    . 'ห้ามเขียนเป็นบทวิดีโอแยกฉากหรือบทพูด (บทพูดของวิดีโออยู่ใน visuals[].narration แล้ว) '
    . 'ห้ามคัดลอก "แคปชั่น" ที่ให้มาในบริบททั้งก้อน — ใช้เป็นแค่ข้อมูลอ้างอิงเนื้อหา แล้วเขียนข้อความของแต่ละ platform ใหม่ '
    . 'ให้ต่างกันตามลักษณะ platform (ความยาว โทน การเปิดเรื่อง CTA hashtag) ห้ามใช้ข้อความเดียวกันหรือเกือบเหมือนกันในหลาย platform '
    // twitter: ข้อความถูกเติมหัวข้อ (ยาวได้ถึง ~100 ตัวอักษร) ไว้ด้านบน เพดานรวม 280 — AI ไม่รู้ความยาวหัวข้อ
    // ตอนเขียน จึงกำหนดเพดานของตัวข้อความเองที่ 180 (ทดสอบจริง: หัวข้อ 72 + ข้อความ 266 = 340 เกินเพดาน)
    . 'twitter: ตัวข้อความต้องไม่เกิน 180 ตัวอักษร (ระบบเติมหัวข้อไว้ด้านบนและเพดานรวมของ X คือ 280)';

/**
 * ตัวอย่างค่าของ scripts ใน JSON schema ที่ส่งให้ AI — เป็นคำอธิบายภาษาไทย ไม่มีรูปแบบ "Label:"
 * (AI มักลอกรูปแบบตัวอย่าง ถ้าตัวอย่างมีคำกำกับ ผลลัพธ์ก็จะมีคำกำกับ)
 * @return array<string,string> platform => ตัวอย่าง
 */
function platform_post_text_examples(array $platforms): array
{
    $examples = [];
    foreach ($platforms as $platform) {
        $examples[$platform] = match ($platform) {
            'tiktok'    => 'แคปชั่น TikTok สั้น 1-3 บรรทัด ดึงความสนใจทันที ต่อด้วย #แฮชแท็ก',
            'youtube'   => 'คำอธิบายคลิป YouTube: สรุปว่าคลิปนี้ได้อะไร 2-4 ประโยค ชวนกดติดตาม และ #แฮชแท็ก',
            'instagram' => 'ข้อความโพสต์ Instagram กระชับ มี hook ประโยคแรก ชวนทำ action และ #แฮชแท็ก',
            'facebook'  => 'ข้อความโพสต์ Facebook เปิดด้วยประโยคที่เข้าใจทันที เนื้อหาเป็นย่อหน้าสั้น/bullet และชวนทักหรือคลิก',
            'linkedin'  => 'ข้อความโพสต์ LinkedIn น้ำเสียงมืออาชีพ ให้คุณค่าเชิงวิชาชีพ ปิดด้วยชวนพูดคุย',
            'twitter'   => 'ข้อความสั้น คม ชัด ไม่เกิน 180 ตัวอักษร',
            'lineoa'    => 'ข้อความ broadcast สั้น อ่านง่าย พร้อมสิ่งที่อยากให้ผู้ติดตามทำต่อ',
            default     => 'ข้อความโพสต์ที่เหมาะกับธรรมชาติของ platform นี้',
        };
    }
    return $examples;
}

/** แนวทางต่อ platform ของข้อความโพสต์ (บรรทัด guidance ใน prompt) */
function platform_post_text_guidance(string $platform): string
{
    return match ($platform) {
        'youtube'   => '- [youtube] คำอธิบายคลิป: สรุปเนื้อหาเป็นลำดับ เข้าใจง่าย และ CTA ที่เหมาะกับ YouTube (ไม่ใช่บทพูดของคลิป)',
        'facebook'  => '- [facebook] เปิดด้วยประโยคที่เข้าใจทันที และน้ำเสียงที่เหมาะกับ Facebook',
        'instagram' => '- [instagram] แคปชั่นที่ดึงดูดและกระชับ',
        'tiktok'    => '- [tiktok] แคปชั่นสั้น ดึงความสนใจตั้งแต่ประโยคแรก พร้อม hashtag (ไม่ใช่บทวิดีโอแยกฉาก)',
        'lineoa'    => '- [lineoa] ข้อความสั้น กระชับ อ่านง่าย และ CTA ที่ชัดเจน',
        'linkedin'  => '- [linkedin] professional tone และเนื้อหาที่ให้คุณค่าเชิงวิชาชีพ',
        'twitter'   => '- [twitter] ข้อความสั้น คม ชัด ไม่ยืดเยื้อ',
        default     => '- [' . $platform . '] ปรับข้อความตามธรรมชาติของ platform',
    };
}

/** `generation_mode` จาก request body → เป็น Direct Creation หรือไม่ */
function content_plan_is_direct(mixed $generationMode): bool
{
    return strtolower(trim((string)($generationMode ?? ''))) === 'direct';
}

/**
 * request ของ generate-plan มีแหล่งข้อมูลให้ AI อย่างน้อยหนึ่งอย่างหรือไม่
 *
 * ใช้ทั้ง Direct mode และ legacy Content Plan mode — หัวข้อ, Trigger, Skill และ
 * Knowledge Base ล้วนให้บริบท AI ได้ จึงนับเท่ากัน ไม่บังคับหัวข้อเป็นช่องเดียว
 * (change content-campaign-optional-topic-sources)
 */
function content_plan_has_any_topic_source(array $triggerIds, string $triggerCommand, string $sourceTopic, array $skillIds = [], array $brandContextIds = []): bool
{
    return (bool)$triggerIds || $triggerCommand !== '' || $sourceTopic !== ''
        || (bool)$skillIds || (bool)$brandContextIds;
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

/**
 * `content_items.source_topic` ที่จะบันทึกสำหรับ item หนึ่งตัว
 *
 * มี Topic ที่ผู้ใช้พิมพ์เอง (Direct mode) → ใช้ค่านั้นตรงตัว เหมือนกันทุก item
 * ไม่มี Topic ที่ผู้ใช้พิมพ์ (legacy Content Plan — AI คิดหัวข้อเอง) → แช่แข็ง
 * topic ที่ AI สร้างให้ item นั้นโดยเฉพาะ ณ ตอนสร้าง เพื่อให้ยังทำหน้าที่ป้องกัน
 * Research ไม่ให้ seed จาก title/topic ที่ถูกแก้ไขภายหลังได้เหมือนเดิม
 */
function content_plan_item_source_topic(string $requestSourceTopic, ?string $itemTopic): string
{
    $requestSourceTopic = trim($requestSourceTopic);
    if ($requestSourceTopic !== '') return $requestSourceTopic;
    return trim((string)($itemTopic ?? ''));
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
 * `$args` รับ: source_topic, trigger_command, trigger_commands, week_start, day_label, day_order, platforms_str
 * Topic เป็น Source of Truth; Trigger/Skill เป็น instructions และห้ามแทนที่ Topic
 *
 * Branch non-direct (legacy Content Plan) ไม่พึ่ง caller ว่าจะเตรียม source_topic
 * ที่ไม่ว่างมาให้เสมอ — ฟังก์ชัน resolve เอง: source_topic (trim แล้ว) ก่อน ถ้าว่าง
 * จึงใช้ trigger command ตัวแรกที่ไม่ว่างจาก trigger_commands/trigger_command
 * ถ้า resolve แล้วยังว่างสนิททุกแหล่ง จะไม่พิมพ์บรรทัด "Original User Topic/Seed"
 * เลย (ไม่มี placeholder ใดมาแทน) เพื่อไม่ให้ AI ได้รับบรรทัด label ที่ไม่มีเนื้อหา
 */
function content_plan_user_message(bool $isDirect, array $args): string
{
    $platformsStr = trim((string)($args['platforms_str'] ?? ''));
    $reminder     = 'REMINDER: Output ONLY the JSON object. Start with { and end with }. No other text.';
    $lines        = [];

    $triggerCommands = $args['trigger_commands'] ?? [];
    if (!is_array($triggerCommands)) $triggerCommands = [];
    if (!$triggerCommands && !empty($args['trigger_command'])) $triggerCommands = [(string)$args['trigger_command']];

    if ($isDirect) {
        // หัวข้อไม่บังคับแล้ว (มี Trigger/Skill/KB แทนได้) — ไม่พิมพ์บรรทัด SOURCE OF TRUTH ว่างให้ AI สับสน
        $directTopic = trim((string)($args['source_topic'] ?? ''));
        if ($directTopic !== '') {
            $lines[] = 'Original User Topic/Seed (SOURCE OF TRUTH): ' . $directTopic;
        }
        if ($triggerCommands) {
            $lines[] = 'Trigger Instructions (apply all selected Triggers; do not replace the Topic): ' . implode(' | ', $triggerCommands);
        }
        if ($platformsStr !== '') {
            $lines[] = 'Platform เป้าหมาย (ช่องทางเผยแพร่): ' . $platformsStr;
        }
        $lines[] = 'สร้าง content เดี่ยวจากหัวข้อนี้โดยตรง ห้ามเพิ่มบริบทวันหรือสัปดาห์';
        $lines[] = $reminder;
        return implode("\n", $lines);
    }

    // Resolve เอง แทนที่จะเชื่อว่า caller เตรียม source_topic ที่ไม่ว่างมาให้เสมอ —
    // ไม่มี source_topic (legacy: AI คิดหัวข้อเอง) จึงใช้ trigger command ตัวแรกที่ไม่ว่าง
    $topicText = trim((string)($args['source_topic'] ?? ''));
    if ($topicText === '') {
        foreach ($triggerCommands as $tc) {
            $tc = trim((string)$tc);
            if ($tc !== '') { $topicText = $tc; break; }
        }
    }
    if ($topicText !== '') {
        $lines[] = 'Original User Topic/Seed (SOURCE OF TRUTH): ' . $topicText;
    }
    if ($triggerCommands) {
        $lines[] = 'Trigger Instructions (apply all selected Triggers; do not replace the Topic): ' . implode(' | ', $triggerCommands);
    }
    $lines[] = 'สัปดาห์เริ่มต้น: ' . (string)($args['week_start'] ?? '');
    $lines[] = 'สร้างโพสต์สำหรับวัน' . (string)($args['day_label'] ?? '') . ' (วันที่ ' . (int)($args['day_order'] ?? 0) . ' ของสัปดาห์)';
    if ($platformsStr !== '') {
        $lines[] = 'Platform เป้าหมาย (ช่องทางเผยแพร่): ' . $platformsStr;
    }
    $lines[] = $reminder;
    return implode("\n", $lines);
}
