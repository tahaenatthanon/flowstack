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
 * System prompt สำหรับ generate เนื้อหาแคมเปญ 1 ฉบับ
 *
 * $args: products (array ของ product row), tone, angle_instruction (optional,
 * ใช้ตอน batch generate เพื่อให้แต่ละฉบับมีมุมนำเสนอต่างกัน)
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
    $parts[] = "## โทนการเขียน\n" . ($toneMap[$tone] ?? $toneMap['friendly']);

    if (!empty($args['angle_instruction'])) {
        $parts[] = "## มุมนำเสนอสำหรับฉบับนี้\n" . (string)$args['angle_instruction'];
    }

    $parts[] = <<<'PROMPT'
## CRITICAL LANGUAGE RULE
ตอบเป็นภาษาไทยเท่านั้น (Thai script only). ห้ามใช้ภาษาจีน เกาหลี ญี่ปุ่น (CJK) โดยเด็ดขาด.

## OUTPUT RULE — STRICTLY JSON ONLY
ตอบกลับเป็น JSON object เดียวเท่านั้น ห้ามมีคำอธิบาย ห้ามใช้ markdown code fence
เริ่มด้วย { และจบด้วย }

Required JSON schema:
{"subject":"หัวข้ออีเมลภาษาไทย กระชับ ดึงดูดให้เปิดอ่าน (40-60 ตัวอักษร)","name":"ชื่อแคมเปญภายในสั้นๆ ภาษาไทย","body_html":"เนื้อหาอีเมลเต็ม เป็น HTML string (ใช้ <p>,<h2>,<strong>,<a> ได้) มี CTA ชัดเจน"}
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
 */
function campaign_ai_extract_json(string $content): ?array
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
            if (is_array($candidate) && isset($candidate['body_html'])) return $candidate;
        }
        $pos++;
    }
    return null;
}
