<?php
/**
 * Prompt construction สำหรับ AI generate เนื้อหาแคมเปญอีเมล
 * (`api/email-campaigns.php?action=generate-content` และ `?action=ai-plan`)
 *
 * แยกออกมาเป็น pure function เพื่อให้ทดสอบได้โดยไม่ต้องแตะ DB/AI — ต่างจาก
 * `content-plan-prompt.php` (ของ Content module) ตรงที่ campaign prompt ต้อง
 * inject ข้อมูลสินค้า (name/description/usp) เข้าไปโดยตรง ซึ่งของเดิมไม่เคยทำ
 */

/** ข้อความอธิบายสินค้าหนึ่งตัว สำหรับใส่ใน system prompt */
function campaign_ai_format_product(array $product): string
{
    $lines = ["ชื่อสินค้า: " . trim((string)($product['name'] ?? ''))];
    if (!empty($product['description'])) $lines[] = "คำอธิบาย: " . trim((string)$product['description']);
    if (!empty($product['usp']))         $lines[] = "จุดขาย (USP): " . trim((string)$product['usp']);
    if (!empty($product['price']))       $lines[] = "ราคา: " . trim((string)$product['price']);
    return implode("\n", $lines);
}

/** รวมสินค้าหลายตัวเป็น section เดียวสำหรับ system prompt — คืน '' ถ้าไม่มีสินค้าเลย */
function campaign_ai_products_section(array $products): string
{
    if (!$products) return '';
    $blocks = array_map('campaign_ai_format_product', $products);
    return "## สินค้า/บริการที่ต้องเขียนถึง\n" . implode("\n\n", $blocks) .
        "\n\nเขียนเนื้อหาแคมเปญอีเมลโดยเน้นสินค้าที่ระบุไว้ข้างต้นเท่านั้น ห้ามพูดถึงสินค้าอื่นที่ไม่ได้ระบุ";
}

/**
 * Section บอก AI ให้เลือก template — ถ้า $currentTemplateId มีค่า (ผู้ใช้เลือกไว้ก่อน
 * แล้ว) ต้องสั่งไม่ให้เปลี่ยน ให้ AI แค่เขียนเนื้อหาให้เข้ากับ template นั้น
 *
 * $templates: array ของ ['id' => string, 'nameTH' => string]
 */
function campaign_ai_template_section(array $templates, ?string $currentTemplateId = null): string
{
    if (!$templates) return '';

    if ($currentTemplateId !== null && $currentTemplateId !== '') {
        return "## Template ที่ใช้อยู่แล้ว (ห้ามเปลี่ยน)\nผู้ใช้เลือก template \"{$currentTemplateId}\" ไว้แล้ว ให้ตอบ \"template_id\":\"{$currentTemplateId}\" กลับมาเหมือนเดิมเสมอ ห้ามเปลี่ยนเป็นตัวอื่น";
    }

    $lines = array_map(
        static fn(array $t): string => "- {$t['id']}: {$t['nameTH']}",
        $templates
    );
    return "## เลือก Template\nเลือก template ที่เข้ากับเนื้อหาที่กำลังจะเขียนมากที่สุด 1 รายการ จากลิสต์นี้ " .
        "(ตอบ \"template_id\" เป็น id ตรงตัวจากลิสต์ ห้ามคิด id ขึ้นเองเด็ดขาด):\n" . implode("\n", $lines);
}

/**
 * System prompt สำหรับ generate เนื้อหาแคมเปญ 1 ฉบับ
 *
 * $args:
 *   - products (array ของ product row)
 *   - tone ('friendly'|'formal'|'educational'|'storytelling'|'auto' — 'auto' ให้ AI
 *     อนุมานโทนเองจากสินค้า/หัวข้อ แทนที่จะ fix เป็นค่าใดค่าหนึ่ง)
 *   - angle_instruction (optional, ใช้ตอน batch generate เพื่อให้แต่ละฉบับมีมุมต่างกัน)
 *   - templates (array ของ ['id','nameTH'] — ถ้าไม่ส่งมา จะไม่มี section เลือก template)
 *   - current_template_id (nullable — มีค่า = ผู้ใช้เลือกไว้แล้ว ห้าม AI เปลี่ยน)
 *   - include_schedule_suggestion (bool, default false — true เฉพาะ generate เดี่ยว
 *     ที่ต้องการให้ AI แนะนำ suggested_scheduled_at ด้วย; batch ไม่ใช้เพราะ Phase 1
 *     ตัดสินใจเวลาให้แล้ว)
 */
function campaign_ai_system_prompt(array $args): string
{
    $parts = [];
    $productsSection = campaign_ai_products_section($args['products'] ?? []);
    if ($productsSection !== '') $parts[] = $productsSection;

    $tone = (string)($args['tone'] ?? 'friendly');
    $toneMap = [
        'friendly'     => 'เป็นกันเอง อบอุ่น เข้าถึงง่าย',
        'formal'       => 'เป็นทางการ สุภาพ น่าเชื่อถือ',
        'educational'  => 'ให้ความรู้ อธิบายเหตุผล ชัดเจนเป็นขั้นตอน',
        'storytelling' => 'เล่าเรื่อง มีจังหวะดึงดูด ชวนติดตาม',
    ];
    if ($tone === 'auto' || !isset($toneMap[$tone])) {
        $parts[] = "## โทนการเขียน\nเลือกโทนการเขียนที่เหมาะสมที่สุดเอง (เป็นกันเอง/เป็นทางการ/ให้ความรู้/เล่าเรื่อง หรือผสมกัน) โดยพิจารณาจากสินค้าและหัวข้อที่ให้ไว้";
    } else {
        $parts[] = "## โทนการเขียน\n" . $toneMap[$tone];
    }

    if (!empty($args['angle_instruction'])) {
        $parts[] = "## มุมนำเสนอสำหรับฉบับนี้\n" . (string)$args['angle_instruction'];
    }

    $templateSection = campaign_ai_template_section($args['templates'] ?? [], $args['current_template_id'] ?? null);
    if ($templateSection !== '') $parts[] = $templateSection;

    $scheduleField = '';
    if (!empty($args['include_schedule_suggestion'])) {
        $scheduleField = ',"suggested_scheduled_at":"วันเวลาที่แนะนำให้ส่ง format YYYY-MM-DD HH:MM:SS เป็นเวลาในอนาคตที่เหมาะกับเนื้อหานี้ (เช่น เนื้อหาเร่งด่วนแนะนำเวลาใกล้ เนื้อหาทั่วไปแนะนำเช้าวันทำการถัดไป)"';
    }

    $parts[] = <<<PROMPT
## CRITICAL LANGUAGE RULE
ตอบเป็นภาษาไทยเท่านั้น (Thai script only). ห้ามใช้ภาษาจีน เกาหลี ญี่ปุ่น (CJK) โดยเด็ดขาด.

## OUTPUT RULE — STRICTLY JSON ONLY
ตอบกลับเป็น JSON object เดียวเท่านั้น ห้ามมีคำอธิบาย ห้ามใช้ markdown code fence
เริ่มด้วย { และจบด้วย }

Required JSON schema:
{"subject":"หัวข้ออีเมลภาษาไทย กระชับ ดึงดูดให้เปิดอ่าน (40-60 ตัวอักษร)","name":"ชื่อแคมเปญภายในสั้นๆ ภาษาไทย","body_html":"เนื้อหาอีเมลเต็ม เป็น HTML string (ใช้ <p>,<h2>,<strong>,<a> ได้) มี CTA ชัดเจน","template_id":"id ของ template ที่เลือก ตรงตามลิสต์ด้านบน"{$scheduleField}}
PROMPT;

    return implode("\n\n", $parts);
}

/**
 * User message ต่อ 1 AI call
 *
 * ถ้ามี $sourceTopic (ผู้ใช้กรอกหัวข้ออีเมลไว้ก่อนแล้ว) ให้ใช้เป็น source of
 * truth เหมือน Direct mode ของ Content module — AI ต้องเขียนเนื้อหาให้ตรงกับ
 * หัวข้อนี้ และห้ามคิดหัวข้อ (`subject`) ใหม่มาแทนที่ (ฝั่ง caller จะเป็นคน
 * ตัดสินใจไม่ overwrite subject/name เดิม ไม่ใช่หน้าที่ของ prompt)
 */
function campaign_ai_user_message(?string $sourceTopic): string
{
    $topic = trim((string)($sourceTopic ?? ''));
    $lines = [];
    if ($topic !== '') {
        $lines[] = 'หัวข้ออีเมลที่ผู้ใช้กำหนดไว้แล้ว (SOURCE OF TRUTH — เขียนเนื้อหาให้ตรงกับหัวข้อนี้): ' . $topic;
    } else {
        $lines[] = 'ผู้ใช้ยังไม่ได้กำหนดหัวข้อ — ให้คิดหัวข้ออีเมลที่ดึงดูดเองจากข้อมูลสินค้าที่ให้ไว้';
    }
    $lines[] = 'REMINDER: ตอบเป็น JSON object เดียวเท่านั้น เริ่มด้วย { และจบด้วย }';
    return implode("\n", $lines);
}

/**
 * ตรวจว่า template_id ที่ AI ตอบมามีอยู่จริงในลิสต์ที่ส่งไปให้เลือกไหม
 * คืน id ที่ valid หรือ id แรกในลิสต์เป็น fallback (ไม่คืน null เพราะ system
 * ต้องการให้มี template เสมอ — ดู "AI Always Selects A Template" ใน spec)
 * คืน null เฉพาะกรณีลิสต์ที่ส่งเข้ามาว่างเปล่าจริงๆ เท่านั้น
 */
function campaign_ai_validate_template_id(?string $candidateId, array $templates): ?string
{
    if (!$templates) return null;
    $validIds = array_column($templates, 'id');
    if ($candidateId !== null && in_array($candidateId, $validIds, true)) {
        return $candidateId;
    }
    return $validIds[0];
}

/** ตรวจว่าเป็นวันเวลาที่ parse ได้และอยู่ในอนาคต (เทียบกับเวลาปัจจุบัน) */
function campaign_ai_is_future_datetime(?string $datetime): bool
{
    $value = trim((string)$datetime);
    if ($value === '') return false;
    $ts = strtotime($value);
    return $ts !== false && $ts > time();
}

/**
 * System prompt สำหรับ Phase 1 ของ batch planning — วางแผนหัวข้อ + เวลาส่ง
 * ของทุกฉบับในชุดพร้อมกัน (เห็นภาพรวมทั้งชุด) เพื่อการันตีว่าไม่ซ้ำกันเอง
 */
function campaign_ai_batch_plan_prompt(array $args): string
{
    $parts = [];
    $productsSection = campaign_ai_products_section($args['products'] ?? []);
    if ($productsSection !== '') $parts[] = $productsSection;

    $count = (int)($args['count'] ?? 1);
    $parts[] = "## งานที่ต้องทำ\nวางแผนอีเมลแคมเปญ {$count} ฉบับ สำหรับสินค้าข้างต้น โดยแต่ละฉบับต้องมี:\n" .
        "- หัวข้อ/มุมนำเสนอที่แตกต่างกันชัดเจน ไม่ซ้ำกันเอง เรียงเป็นซีรีส์ที่สมเหตุสมผล " .
        "(เช่น เกริ่นนำ → ขยายจุดขาย → กรณีศึกษา → ข้อเสนอ → เร่งด่วนปิดท้าย ปรับตามจำนวนฉบับจริง)\n" .
        "- เวลาส่ง (send_time) ที่กระจายหลากหลาย ไม่ซ้ำกันทุกฉบับ เลือกจากช่วงเวลาที่คนเปิดอีเมลเยอะ (เช้า/เที่ยง/บ่าย/เย็นของวันทำการ) ให้เหมาะกับโทนของแต่ละหัวข้อ (เช่น หัวข้อเร่งด่วนอาจส่งใกล้เที่ยง)";

    $parts[] = <<<'PROMPT'
## CRITICAL LANGUAGE RULE
ตอบเป็นภาษาไทยเท่านั้น (Thai script only) สำหรับ topic. ห้ามใช้ภาษาจีน เกาหลี ญี่ปุ่น (CJK) โดยเด็ดขาด.

## OUTPUT RULE — STRICTLY JSON ONLY
ตอบกลับเป็น JSON object เดียวเท่านั้น ห้ามมีคำอธิบาย ห้ามใช้ markdown code fence
เริ่มด้วย { และจบด้วย }

Required JSON schema (items ต้องมีจำนวนเท่ากับที่ขอเป๊ะ):
{"items":[{"topic":"หัวข้อภาษาไทยของฉบับนี้ (ประโยคสั้นๆ ใช้เป็นโจทย์ให้เขียนเนื้อหาเต็มต่อ)","send_time":"HH:MM ในรูปแบบ 24 ชั่วโมง เช่น 09:15"}]}
PROMPT;

    return implode("\n\n", $parts);
}

/** User message สำหรับ Phase 1 — ย้ำจำนวนฉบับที่ต้องการอีกครั้ง */
function campaign_ai_batch_plan_user_message(int $count): string
{
    return "วางแผน {$count} ฉบับตามที่ระบุใน system prompt\nREMINDER: ตอบเป็น JSON object เดียวเท่านั้น เริ่มด้วย { และจบด้วย } มี \"items\" เป็น array ที่มีความยาว {$count} รายการพอดี";
}

/**
 * Whitelist sanitizer เดียวกับแนวคิดใน brand-content.php::sanitizeAIOutput —
 * เก็บเฉพาะ ASCII พิมพ์ได้ + อักษรไทย ตัดภาษาอื่น (จีน/เกาหลี/ญี่ปุ่น/ฯลฯ) ทิ้ง
 */
function campaign_ai_sanitize_output(string $text): string
{
    return preg_replace(
        '/[^\x09\x0A\x0D\x20-\x7E\x{00A0}-\x{00FF}\x{2013}\x{2014}\x{2018}-\x{2026}\x{0E00}-\x{0E7F}]/u',
        '',
        $text
    ) ?? $text;
}

/**
 * ดึง JSON object ตัวแรกที่ถูกต้องออกจากข้อความที่ AI ตอบกลับมา (กันกรณีมี
 * ข้อความอื่นแทรกหรือ code fence ติดมาด้วย) — คืน null ถ้าไม่พบเลย
 *
 * $requiredKey: key ที่ต้องมีเพื่อถือว่าเป็น candidate ที่ถูกต้อง (ต่างกันตามชนิด
 * คำตอบ — 'body_html' สำหรับ generate เนื้อหา 1 ฉบับ, 'items' สำหรับ Phase 1
 * batch planning ที่ตอบกลับเป็น list)
 */
function campaign_ai_extract_json(string $content, string $requiredKey = 'body_html'): ?array
{
    $j = trim(preg_replace(['/^```(?:json)?\s*/m', '/\s*```\s*$/m'], '', $content));
    $j = campaign_ai_sanitize_output($j);

    $obj = json_decode($j, true);
    if (is_array($obj)) return $obj;

    $len = strlen($j);
    $pos = 0;
    while (($pos = strpos($j, '{', $pos)) !== false) {
        $depth = 0; $inStr = false; $esc = false; $end = -1;
        for ($i = $pos; $i < $len; $i++) {
            $c = $j[$i];
            if ($esc)                             { $esc = false; continue; }
            if ($c === '\\' && $inStr)            { $esc = true;  continue; }
            if ($c === '"')                       { $inStr = !$inStr; continue; }
            if ($inStr)                           { continue; }
            if ($c === '{')                       { $depth++; }
            elseif ($c === '}' && --$depth === 0) { $end = $i; break; }
        }
        if ($end > $pos) {
            $candidate = json_decode(substr($j, $pos, $end - $pos + 1), true);
            if (is_array($candidate) && isset($candidate[$requiredKey])) return $candidate;
        }
        $pos++;
    }
    return null;
}
