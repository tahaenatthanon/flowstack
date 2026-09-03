<?php
/**
 * SEO checklist — ประเมินคุณภาพ SEO ของคอนเทนต์ก่อนเผยแพร่ (Phase 4)
 *
 * seo_evaluate()  : ฟังก์ชันบริสุทธิ์ (ไม่แตะ DB/network) คืนคะแนน + ผลตรวจแต่ละกฎ
 * seo_gate_check(): อ่านการตั้งค่าเกตจาก content_global_settings แล้วตัดสินว่าจะบล็อกหรือไม่
 *
 * เรียกใช้ร่วมกันจาก 4 เส้นทางเผยแพร่ (send_now, cron scheduler, ?action=publish,
 * ?action=cron-publish) และ endpoint ?action=seo-checklist สำหรับ UI สด
 *
 * ระดับกฎ (level):
 *   pass = ผ่านเกณฑ์
 *   fail = ละเมิดเกณฑ์ → ใช้บล็อกได้เมื่อเปิดเกต
 *   pending = ยังไม่มีข้อมูลให้ตรวจ (ไม่หักคะแนนและไม่บล็อก)
 *   warn = ควรปรับปรุงแต่ไม่บล็อก (เช่น og_image ว่าง)
 *   skip = ไม่ประเมิน (ไม่มีเนื้อหาบทความ — เช่น โพสต์โซเชียล caption ล้วน)
 */

// Shared thresholds used by both seo_evaluate() and AI generation prompts.
const SEO_TITLE_MAX = 60;
const META_DESC_MIN = 120;
const META_DESC_MAX = 160;
const WORD_COUNT_MIN = 500;
const H2_MIN = 1;
const H1_MAX = 1;
const SEO_GEN_MAX_ATTEMPTS = 3;
const SEO_KEYWORD_DENSITY_MAX = 0.04; // 4% — เกินนี้ถือว่า keyword stuffing
const SEO_GATE_PASS_SCORE = 90;
const SEO_GATE_WARN_SCORE = 80;

// Research-rule coverage thresholds (fraction of research items that must be covered).
const SEO_RELATED_MIN  = 0.6; // related_keywords: ≥0.6 passed, =0 failed
const SEO_TOPIC_MIN    = 0.7; // topic_coverage: ≥0.7 passed
const SEO_TOPIC_FAIL   = 0.3; // topic_coverage: <0.3 failed
const SEO_PAA_MIN      = 0.5; // paa_questions: ≥0.5 passed, =0 failed
const SEO_GAP_MIN      = 0.5; // content_gap: ≥0.5 passed, =0 failed

// Weight catalog for the 15-rule SEO checklist. Total weight = 100.
// `critical` rules block the publish gate even when total score meets threshold.
const SEO_WEIGHTS = [
    'seo_title'                 => ['weight' => 8,  'critical' => true],
    'meta_description'          => ['weight' => 8,  'critical' => true],
    'slug'                      => ['weight' => 6,  'critical' => false],
    'h1'                        => ['weight' => 6,  'critical' => true],
    'heading_structure'         => ['weight' => 7,  'critical' => false],
    'content_length'            => ['weight' => 8,  'critical' => true],
    'search_intent'             => ['weight' => 8,  'critical' => false],
    'primary_keyword_placement' => ['weight' => 8,  'critical' => true],
    'keyword_stuffing'          => ['weight' => 7,  'critical' => false],
    'related_keywords'          => ['weight' => 6,  'critical' => false],
    'topic_coverage'            => ['weight' => 8,  'critical' => false],
    'paa_questions'             => ['weight' => 6,  'critical' => false],
    'content_gap'               => ['weight' => 6,  'critical' => false],
    'structured_data'           => ['weight' => 5,  'critical' => true],
    'internal_linking'          => ['weight' => 3,  'critical' => false],
];

// Video-only rule (not part of the 15-article weight sum).
const SEO_WEIGHT_HASHTAGS = 5;

// Critical rule keys (derived, kept explicit for clarity).
const SEO_CRITICAL_RULES = ['seo_title', 'meta_description', 'h1', 'content_length', 'primary_keyword_placement', 'structured_data'];

/**
 * สร้าง rule object ด้วยโครงสร้างผลลัพธ์ใหม่ (additive: level ยังคงอยู่เป็น alias)
 *
 * @return array{key:string, level:string, status:string, weight:int, score:int, critical:bool, message:string}
 */
function seo_make_rule(string $key, string $status, string $message, ?int $weightOverride = null): array {
    $meta     = SEO_WEIGHTS[$key] ?? null;
    $weight   = $weightOverride ?? ($meta['weight'] ?? 0);
    $critical = ($meta['critical'] ?? false) || in_array($key, SEO_CRITICAL_RULES, true);
    $levelMap = ['passed' => 'pass', 'needs_improvement' => 'warn', 'failed' => 'fail', 'pending' => 'pending', 'skip' => 'skip'];
    $level    = $levelMap[$status] ?? 'pending';
    $score    = match ($status) {
        'passed'            => $weight,
        'needs_improvement' => (int) round($weight / 2),
        default             => 0, // failed / pending / skip
    };
    return [
        'key'      => $key,
        'level'    => $level,
        'status'   => $status,
        'weight'   => $weight,
        'score'    => $score,
        'critical' => $critical,
        'message'  => $message,
    ];
}

/**
 * คำนวณคะแนนรวมแบบ normalized: ตัด pending/skip ออกจากทั้งเศษและส่วน แล้ว normalize กลับเป็น 100
 */
function seo_normalized_score(array $rules): int {
    $earned = 0;
    $possible = 0;
    foreach ($rules as $r) {
        $status = $r['status'] ?? $r['level'] ?? 'skip';
        if ($status === 'pending' || $status === 'skip') continue;
        $earned   += (int)($r['score'] ?? 0);
        $possible += (int)($r['weight'] ?? 0);
    }
    if ($possible <= 0) return 0;
    return (int) round(100 * $earned / $possible);
}

/**
 * กำหนดสถานะ SEO Quality Gate จากคะแนนรวม + critical rules
 *
 * @param array $eval ผลลัพธ์จาก seo_evaluate() รูป ['score' => int, 'rules' => array]
 * @return string 'passed' | 'needs_improvement' | 'failed'
 */
function seo_gate_status(array $eval): string {
    $score = (int)($eval['score'] ?? 0);
    $rules = $eval['rules'] ?? [];
    foreach ($rules as $r) {
        $status = $r['status'] ?? $r['level'] ?? '';
        if (!empty($r['critical']) && $status === 'failed') return 'failed';
    }
    if ($score < SEO_GATE_WARN_SCORE) return 'failed';
    if ($score < SEO_GATE_PASS_SCORE) return 'needs_improvement';
    return 'passed';
}

/** ดึงข้อความล้วนจาก HTML (decode entities + strip tags + normalize whitespace) */
function seo_plain_text(string $html): string {
    $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    return trim(preg_replace('/\s+/u', ' ', $text));
}

/** นับจำนวนครั้งที่ keyword ปรากฏ (ไม่สนตัวพิมพ์, multibyte) */
function seo_count_occurrences(string $haystack, string $needle): int {
    if ($needle === '' || $haystack === '') return 0;
    return (int) mb_substr_count(mb_strtolower($haystack), mb_strtolower($needle));
}

/** ดึงรายการ secondary keywords จาก research brief */
function seo_brief_secondary_keywords(array $brief): array {
    $out = [];
    foreach (($brief['secondary_keywords'] ?? []) as $entry) {
        if (is_string($entry)) $out[] = trim($entry);
        elseif (is_array($entry) && !empty($entry['keyword'])) $out[] = trim((string)$entry['keyword']);
    }
    return array_values(array_filter($out, fn($k) => $k !== ''));
}

/** ดึงรายการหัวข้อ outline จาก research brief */
function seo_brief_outline(array $brief): array {
    $out = [];
    foreach (($brief['outline'] ?? []) as $entry) {
        if (is_string($entry)) $out[] = trim($entry);
        elseif (is_array($entry) && !empty($entry['heading'])) $out[] = trim((string)$entry['heading']);
    }
    return array_values(array_filter($out, fn($k) => $k !== ''));
}

/** ดึงรายการคำถาม PAA จาก research brief */
function seo_brief_paa(array $brief): array {
    $out = [];
    foreach (($brief['paa'] ?? []) as $entry) {
        if (is_string($entry)) $out[] = trim($entry);
        elseif (is_array($entry) && !empty($entry['question'])) $out[] = trim((string)$entry['question']);
    }
    return array_values(array_filter($out, fn($k) => $k !== ''));
}

/** ดึงรายการ content gaps จาก research brief */
function seo_brief_gaps(array $brief): array {
    $out = [];
    foreach (($brief['content_gaps'] ?? []) as $entry) {
        if (is_string($entry)) $out[] = trim($entry);
        elseif (is_array($entry)) $out[] = trim((string)($entry['text'] ?? $entry['gap'] ?? ''));
    }
    return array_values(array_filter($out, fn($k) => $k !== ''));
}

/**
 * Map search intent → signal terms (best-effort heuristic สำหรับ search_intent rule).
 * signal terms ใช้ตรวจความสอดคล้องระหว่าง content กับ intent จริง
 */
function seo_intent_signals(string $intent): array {
    return match (strtolower(trim($intent))) {
        'commercial'    => ['เปรียบเทียบ', 'รีวิว', 'ดีที่สุด', 'คุ้มค่า', 'best', 'review', 'vs', 'เทียบ', 'แนะนำ'],
        'transactional' => ['ซื้อ', 'สมัคร', 'ราคา', 'สั่งซื้อ', 'โปรโมชั่น', 'ส่วนลด', 'buy', 'price', 'order', 'จอง'],
        'navigational'  => ['เข้าเว็บ', 'เว็บไซต์', 'ล็อกอิน', 'login', 'official', 'เข้าสู่ระบบ', 'download', 'ดาวน์โหลด'],
        default         => ['คือ', 'วิธี', 'ทำไม', 'อย่างไร', 'ขั้นตอน', 'how', 'what', 'why', 'guide', 'แนวทาง'], // informational
    };
}

/**
 * นับจำนวน signal terms ที่ปรากฏในข้อความ (แยกตาม intent)
 *
 * @return array{intent:int, other:int} จำนวน signal ของ intent ที่ระบุ vs signal ของ intent อื่นทั้งหมด
 */
function seo_intent_match(string $text, string $intent): array {
    $signals = seo_intent_signals($intent);
    $own  = 0;
    $other = 0;
    $all = ['commercial', 'transactional', 'navigational', 'informational'];
    foreach ($all as $i) {
        $count = 0;
        foreach (seo_intent_signals($i) as $term) {
            $count += seo_count_occurrences($text, $term);
        }
        if (strtolower(trim($intent)) === $i) {
            $own += $count;
        } else {
            $other += $count;
        }
    }
    return ['intent' => $own, 'other' => $other];
}

/**
 * Return generation requirements derived from the same thresholds/rules used by
 * seo_evaluate(). This keeps the AI prompt and evaluator in sync.
 *
 * @return array<int,array{key:string,requirement:string}>
 */
function seo_generation_requirements(string $type): array {
    $isVideo = strtolower(trim($type)) === 'video';

    $text = [
        'seo_title'                 => "SEO title ต้องไม่เกิน " . SEO_TITLE_MAX . " ตัวอักษร",
        'meta_description'          => "meta description ต้องยาว " . META_DESC_MIN . "–" . META_DESC_MAX . " ตัวอักษร",
        'slug'                      => 'slug ต้องเป็นตัวพิมพ์เล็ก ใช้เฉพาะ a-z, 0-9 และขีด (-) และห้ามมีขีดติดกัน/ขึ้นต้น/ลงท้าย',
        'h1'                        => 'ห้ามใส่ H1 ซ้ำเกิน 1 ตัวในเนื้อหา (สงวนให้ชื่อบทความ)',
        'heading_structure'         => 'ต้องมีหัวข้อ H2 อย่างน้อย ' . H2_MIN . ' หัวข้อ และจัดลำดับ H2/H3 อย่างเป็นเหตุเป็นผล',
        'content_length'            => 'เนื้อหาต้องมีอย่างน้อย ' . WORD_COUNT_MIN . ' คำตามตัวนับของระบบ',
        'search_intent'             => 'เนื้อหาต้องสอดคล้องกับ search intent จาก research brief (เมื่อมี)',
        'primary_keyword_placement' => 'ใส่คีย์เวิร์ดหลักใน title, ย่อหน้าแรก และหัวข้อ อย่างเป็นธรรมชาติ',
        'keyword_stuffing'          => 'อย่าใส่คีย์เวิร์ดหนาแน่นเกิน (keyword stuffing) — ใช้อย่างเป็นธรรมชาติ ไม่เกิน ' . (int)(SEO_KEYWORD_DENSITY_MAX * 100) . '% ของจำนวนคำ',
        'related_keywords'          => 'ใส่คีย์เวิร์ดรองจาก research ให้ครบถ้วน (เมื่อมี)',
        'topic_coverage'            => 'ครอบคลุมหัวข้อตาม outline จาก research (เมื่อมี)',
        'paa_questions'             => 'ตอบคำถาม People Also Ask จาก research (เมื่อมี)',
        'content_gap'               => 'เติมช่องว่างเนื้อหา (content gaps) จาก research (เมื่อมี)',
        'structured_data'           => 'structured data ต้องเป็น JSON ที่ถูกต้องและมี @context กับ @type',
        'internal_linking'          => 'ใส่ internal link อย่างน้อย 1 ลิงก์ (เป็นคำแนะนำ ไม่ใช่ fail)',
    ];

    // เรียงตามน้ำหนักมาก → น้อย
    $ordered = array_keys(SEO_WEIGHTS);
    usort($ordered, static fn($a, $b) => SEO_WEIGHTS[$b]['weight'] <=> SEO_WEIGHTS[$a]['weight']);

    $requirements = [];
    foreach ($ordered as $key) {
        $requirements[] = ['key' => $key, 'requirement' => $text[$key]];
    }
    if ($isVideo) {
        $requirements[] = ['key' => 'hashtags', 'requirement' => 'วิดีโอต้องมี hashtag อย่างน้อย 1 รายการ'];
    }
    return $requirements;
}

/**
 * ประเมิน SEO ของคอนเทนต์ (15 ข้อ + weighted scoring)
 *
 * @param array $item ฟิลด์ที่ใช้: seo_title, slug, meta_description, meta_keywords,
 *                    structured_data, og_image, article_content (JSON string หรือ array), title,
 *                    research_brief (optional array จาก AI Research)
 * @return array{score:int, gate:string, rules:array<array{key:string, level:string, status:string, weight:int, score:int, critical:bool, message:string}>}
 */
function seo_evaluate(array $item): array {
    $rules = [];
    $type = strtolower(trim((string)($item['type'] ?? 'article')));
    $isVideo = $type === 'video';

    $seoTitle   = trim((string)($item['seo_title'] ?? ''));
    $slug       = trim((string)($item['slug'] ?? ''));
    $metaDesc   = trim((string)($item['meta_description'] ?? ''));
    $structuredValue = $item['structured_data'] ?? '';
    $structured = is_array($structuredValue)
        ? json_encode($structuredValue, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        : trim((string)$structuredValue);
    $fallbackTitle = trim((string)($item['title'] ?? ''));

    // คีย์เวิร์ดหลัก = token แรกของ meta_keywords
    $keywords = array_values(array_filter(array_map(
        'trim',
        explode(',', (string)($item['meta_keywords'] ?? ''))
    ), fn($k) => $k !== ''));
    $primaryKw = $keywords[0] ?? '';

    // Research brief (optional) — ขับกฎ intent/related/topic/PAA/gap
    $brief = $item['research_brief'] ?? null;
    if (!is_array($brief)) $brief = null;

    // แยก HTML บทความจาก article_content (JSON {title, html, excerpt})
    $art = null;
    if (is_array($item['article_content'] ?? null)) {
        $art = $item['article_content'];
    } elseif (!empty($item['article_content'])) {
        $decoded = json_decode((string)$item['article_content'], true);
        $art = is_array($decoded) ? $decoded : null;
    }
    $html    = trim((string)($art['html'] ?? ''));
    $hasBody = $html !== '';
    $plainText = $hasBody ? seo_plain_text($html) : '';
    $headingsText = $hasBody ? seo_headings_text($html) : '';

    // Video: สร้าง "เนื้อหา" สำหรับวัดผลจาก scripts/script_sections/visuals/description
    // (Video ไม่ skip — วัดผลด้วย source ที่ต่างจาก article ตาม design)
    $videoText = '';
    $videoSectionLabels = [];
    $videoLinks = [];
    if ($isVideo && is_array($art)) {
        $videoParts = [];
        foreach (($art['scripts'] ?? []) as $script) {
            if (is_string($script) && trim($script) !== '') $videoParts[] = trim($script);
        }
        if (is_array($art['script_sections'] ?? null)) {
            foreach ($art['script_sections'] as $label => $txt) {
                if (is_string($txt) && trim($txt) !== '') {
                    $videoParts[] = trim($txt);
                    if (is_string($label)) $videoSectionLabels[] = trim($label);
                }
            }
        }
        if (is_array($art['visuals'] ?? null)) {
            foreach ($art['visuals'] as $v) {
                if (is_string($v) && trim($v) !== '') $videoParts[] = trim($v);
            }
        }
        $desc = trim((string)($art['description'] ?? ($art['excerpt'] ?? '')));
        if ($desc !== '') $videoParts[] = $desc;
        $videoText = implode("\n\n", $videoParts);
        // ลิงก์ภายในสำหรับ video — จาก description (ข้อความที่มี URL)
        if ($desc !== '') {
            $videoLinks = preg_match_all('/(?:https?:\/\/|\/)[^\s"\'<>]+/i', $desc, $ml) ? $ml[0] : [];
        }
    }

    // เนื้อหา/หัวข้อที่ใช้ค้นหาคีย์เวิร์ดและวัดผล ขึ้นกับ type
    if ($isVideo) {
        $bodyText     = $videoText;
        $hasContent   = $videoText !== '';
        $headingsText = $hasContent ? implode(' ', $videoSectionLabels) : '';
        $bodyForCount = $videoText; // จำนวนคำจาก script
        $firstPara    = $hasContent ? mb_substr(seo_plain_text($videoText), 0, 200) : '';
    } else {
        $bodyText     = $plainText;
        $hasContent   = $hasBody;
        $headingsText = $hasBody ? seo_headings_text($html) : '';
        $bodyForCount = $html; // ใช้ html เดิมสำหรับ word count
        $firstPara    = $hasBody ? seo_first_paragraph($html) : '';
    }

    // ข้อความที่ใช้ค้นหาคีย์เวิร์ดรวม (title + meta + เนื้อหา)
    $searchText = implode(' ', array_filter([$seoTitle, $fallbackTitle, $metaDesc, $bodyText, $headingsText], fn($s) => $s !== ''));

    // ── 1. seo_title 1–60 ───────────────────────────────────────────────────
    $len = mb_strlen($seoTitle);
    if ($seoTitle === '') {
        $rules[] = seo_make_rule('seo_title', 'pending', 'ยังไม่ได้กรอก SEO title');
    } elseif ($len > SEO_TITLE_MAX) {
        $rules[] = seo_make_rule('seo_title', 'failed', "SEO title ยาวเกิน " . SEO_TITLE_MAX . " ตัวอักษร (ปัจจุบัน {$len})");
    } else {
        $rules[] = seo_make_rule('seo_title', 'pass', "SEO title มีความยาวเหมาะสม ({$len} ตัวอักษร)");
    }

    // ── 2. meta_description 120–160 ─────────────────────────────────────────
    $dlen = mb_strlen($metaDesc);
    if ($metaDesc === '') {
        $rules[] = seo_make_rule('meta_description', 'pending', 'ยังไม่ได้กรอกคำอธิบาย meta');
    } elseif ($dlen < META_DESC_MIN) {
        $rules[] = seo_make_rule('meta_description', 'failed', "คำอธิบาย meta สั้นเกินไป ({$dlen} ตัวอักษร ควร " . META_DESC_MIN . "–" . META_DESC_MAX . ")");
    } elseif ($dlen > META_DESC_MAX) {
        $rules[] = seo_make_rule('meta_description', 'failed', "คำอธิบาย meta ยาวเกินไป ({$dlen} ตัวอักษร ควร " . META_DESC_MIN . "–" . META_DESC_MAX . ")");
    } else {
        $rules[] = seo_make_rule('meta_description', 'pass', "คำอธิบาย meta มีความยาวเหมาะสม ({$dlen} ตัวอักษร)");
    }

    // ── 3. slug ตัวพิมพ์เล็ก-ขีดคั่น ─────────────────────────────────────────
    if ($slug === '') {
        $rules[] = seo_make_rule('slug', 'pending', 'ยังไม่ได้กำหนด slug');
    } elseif (!preg_match('/^[a-z0-9]+(-[a-z0-9]+)*$/', $slug)) {
        $rules[] = seo_make_rule('slug', 'failed', 'slug ต้องเป็นตัวพิมพ์เล็กและคั่นด้วยขีด (a-z, 0-9, -)');
    } else {
        $rules[] = seo_make_rule('slug', 'pass', 'slug ถูกต้อง');
    }

    // ── 4. h1 (per-type) ────────────────────────────────────────────────────
    if ($isVideo) {
        // Video: title เป็น h1 หนึ่งตัวเสมอ
        $rules[] = seo_make_rule('h1', 'passed', 'วิดีโอใช้ชื่อเรื่องเป็น H1 หนึ่งตัว');
    } elseif (!$hasContent) {
        $rules[] = seo_make_rule('h1', 'pending', 'ไม่มีเนื้อหาบทความ จึงยังตรวจ H1 ไม่ได้');
    } elseif (preg_match_all('/<h1[\s>]/i', $html, $matches) > H1_MAX) {
        $count = count($matches[0]);
        $rules[] = seo_make_rule('h1', 'failed', "เนื้อหามีแท็ก H1 ซ้ำ {$count} ตัว (อนุญาตเฉพาะ H1 ของชื่อบทความ 1 ตัวแรก)");
    } else {
        $rules[] = seo_make_rule('h1', 'passed', 'มีแท็ก H1 ของชื่อบทความไม่เกิน 1 ตัว');
    }

    // ── 5. heading_structure (per-type) ─────────────────────────────────────
    if ($isVideo) {
        $secCount = count($videoSectionLabels);
        if ($secCount >= 2) {
            $rules[] = seo_make_rule('heading_structure', 'passed', "วิดีโอมีโครงสร้าง section {$secCount} ส่วน (opening/bridge/twist/ending)");
        } elseif ($secCount >= 1) {
            $rules[] = seo_make_rule('heading_structure', 'needs_improvement', "วิดีโอมีโครงสร้าง section เพียง {$secCount} ส่วน (ควรมี opening/bridge/twist/ending ครบ)");
        } else {
            $rules[] = seo_make_rule('heading_structure', 'failed', 'วิดีโอไม่มีโครงสร้าง script section ที่ชัดเจน');
        }
    } elseif (!$hasContent) {
        $rules[] = seo_make_rule('heading_structure', 'pending', 'ไม่มีเนื้อหาบทความ จึงยังตรวจหัวข้อไม่ได้');
    } elseif (preg_match('/<h2[\s>]/i', $html)) {
        $rules[] = seo_make_rule('heading_structure', 'passed', 'มีหัวข้อ H2 ในเนื้อหา');
    } else {
        $rules[] = seo_make_rule('heading_structure', 'failed', 'เนื้อหาไม่มีหัวข้อ H2 เลย');
    }

    // ── 6. content_length (per-type) ────────────────────────────────────────
    if (!$hasContent) {
        $rules[] = seo_make_rule('content_length', 'pending', $isVideo ? 'วิดีโอไม่มี script/description ให้วัดจำนวนคำ' : 'ไม่มีเนื้อหาบทความ จึงข้ามการนับจำนวนคำ');
    } else {
        $wc = seo_word_count($bodyForCount);
        if ($wc < WORD_COUNT_MIN) {
            $rules[] = seo_make_rule('content_length', 'failed', "เนื้อหาสั้นเกินไป (~{$wc} คำ ควร ≥ " . WORD_COUNT_MIN . ")");
        } else {
            $rules[] = seo_make_rule('content_length', 'passed', "จำนวนคำเพียงพอ (~{$wc} คำ)");
        }
    }

    // ── 7. search_intent (research-dependent, ทั้ง article และ video) ───────
    // Hybrid: heuristic (deterministic) ตัดสินความสอดคล้องระหว่าง content กับ intent จริง
    if (!$brief || empty($brief['intent'])) {
        $rules[] = seo_make_rule('search_intent', 'pending', 'ยังไม่มี research brief / search intent จึงข้ามการตรวจ');
    } else {
        $intent = trim((string)$brief['intent']);
        $match  = seo_intent_match($searchText, $intent);
        if ($match['intent'] >= 1 && $match['intent'] >= $match['other']) {
            $rules[] = seo_make_rule('search_intent', 'passed', "เนื้อหาสอดคล้องกับ search intent \"{$intent}\" (signal {$match['intent']} จุด)");
        } elseif ($match['other'] > $match['intent']) {
            $rules[] = seo_make_rule('search_intent', 'failed', "เนื้อหาขัดกับ search intent \"{$intent}\" — พบ signal ของ intent อื่นมากกว่า ({$match['other']} vs {$match['intent']})");
        } else {
            $rules[] = seo_make_rule('search_intent', 'needs_improvement', "ยังไม่ชัดเจนว่าเนื้อหาสอดคล้องกับ search intent \"{$intent}\" — เพิ่มเนื้อหาที่ตอบโจทย์ intent นี้");
        }
    }

    // ── 8. primary_keyword_placement (title + first para + headings) ────────
    if ($primaryKw === '') {
        $rules[] = seo_make_rule('primary_keyword_placement', 'pending', 'ยังไม่ได้กำหนดคีย์เวิร์ดหลัก (meta_keywords ว่าง)');
    } else {
        $checks = 1;
        $hits = 0;
        if (seo_contains($seoTitle, $primaryKw) || seo_contains($fallbackTitle, $primaryKw)) $hits++;
        if ($hasContent) {
            $checks++;
            if (seo_contains($firstPara, $primaryKw)) $hits++;
            $checks++;
            if (seo_contains($headingsText, $primaryKw)) $hits++;
        }
        if ($hits === $checks) {
            $rules[] = seo_make_rule('primary_keyword_placement', 'passed', "คีย์เวิร์ดหลัก \"{$primaryKw}\" อยู่ในตำแหน่งสำคัญครบถ้วน");
        } elseif ($hits >= (int) ceil($checks / 2)) {
            $rules[] = seo_make_rule('primary_keyword_placement', 'needs_improvement', "คีย์เวิร์ดหลัก \"{$primaryKw}\" อยู่ในตำแหน่งสำคัญ {$hits}/{$checks} ตำแหน่ง");
        } else {
            $rules[] = seo_make_rule('primary_keyword_placement', 'failed', "คีย์เวิร์ดหลัก \"{$primaryKw}\" ปรากฏในตำแหน่งสำคัญเพียง {$hits}/{$checks} ตำแหน่ง");
        }
    }

    // ── 9. keyword_stuffing (per-type) ──────────────────────────────────────
    if (!$hasContent || $primaryKw === '') {
        $rules[] = seo_make_rule('keyword_stuffing', 'pending', 'ยังไม่มีเนื้อหาหรือคีย์เวิร์ดหลักให้ตรวจความหนาแน่น');
    } else {
        $totalWords = seo_word_count($bodyForCount);
        $occurrences = seo_count_occurrences($bodyText, $primaryKw);
        $density = $totalWords > 0 ? $occurrences / $totalWords : 0;
        if ($density > SEO_KEYWORD_DENSITY_MAX) {
            $rules[] = seo_make_rule('keyword_stuffing', 'failed', "คีย์เวิร์ดหลักหนาแน่นเกินไป (~" . (int) round($density * 100) . "% ควรต่ำกว่า " . (int)(SEO_KEYWORD_DENSITY_MAX * 100) . "%)");
        } else {
            $rules[] = seo_make_rule('keyword_stuffing', 'passed', 'ความถี่คีย์เวิร์ดหลักอยู่ในระดับธรรมชาติ');
        }
    }

    // ── 10. related_keywords (research-dependent) ───────────────────────────
    if (!$brief || empty(seo_brief_secondary_keywords($brief))) {
        $rules[] = seo_make_rule('related_keywords', 'pending', 'ยังไม่มี secondary keywords จาก research จึงข้ามการตรวจ');
    } else {
        $secondary = seo_brief_secondary_keywords($brief);
        $found = 0;
        foreach ($secondary as $kw) {
            if (seo_contains($searchText, $kw)) $found++;
        }
        $ratio = count($secondary) > 0 ? $found / count($secondary) : 0;
        if ($ratio >= SEO_RELATED_MIN) {
            $rules[] = seo_make_rule('related_keywords', 'passed', "ครอบคลุมคีย์เวิร์ดรองจาก research {$found}/" . count($secondary) . " คำ");
        } elseif ($found === 0) {
            $rules[] = seo_make_rule('related_keywords', 'failed', 'ไม่พบคีย์เวิร์ดรองจาก research ในเนื้อหาเลย (ควรครอบคลุม ≥ ' . (int)(SEO_RELATED_MIN * 100) . '%)');
        } else {
            $rules[] = seo_make_rule('related_keywords', 'needs_improvement', "ครอบคลุมคีย์เวิร์ดรองเพียง {$found}/" . count($secondary) . " คำ (ควร ≥ " . (int)(SEO_RELATED_MIN * 100) . '%)');
        }
    }

    // ── 11. topic_coverage (research-dependent) ─────────────────────────────
    if (!$brief || empty(seo_brief_outline($brief))) {
        $rules[] = seo_make_rule('topic_coverage', 'pending', 'ยังไม่มี outline จาก research จึงข้ามการตรวจ');
    } else {
        $outline = seo_brief_outline($brief);
        $covered = 0;
        foreach ($outline as $heading) {
            if (seo_contains($searchText, $heading)) $covered++;
        }
        $ratio = count($outline) > 0 ? $covered / count($outline) : 0;
        if ($ratio >= SEO_TOPIC_MIN) {
            $rules[] = seo_make_rule('topic_coverage', 'passed', "ครอบคลุมหัวข้อจาก outline {$covered}/" . count($outline) . " หัวข้อ");
        } elseif ($ratio < SEO_TOPIC_FAIL) {
            $rules[] = seo_make_rule('topic_coverage', 'failed', "ครอบคลุมหัวข้อจาก outline เพียง {$covered}/" . count($outline) . " (ควร ≥ " . (int)(SEO_TOPIC_MIN * 100) . '%)');
        } else {
            $rules[] = seo_make_rule('topic_coverage', 'needs_improvement', "ครอบคลุมหัวข้อจาก outline {$covered}/" . count($outline) . " หัวข้อ (ควร ≥ " . (int)(SEO_TOPIC_MIN * 100) . '%)');
        }
    }

    // ── 12. paa_questions (research-dependent) ──────────────────────────────
    if (!$brief || empty(seo_brief_paa($brief))) {
        $rules[] = seo_make_rule('paa_questions', 'pending', 'ยังไม่มีคำถาม PAA จาก research จึงข้ามการตรวจ');
    } else {
        $paa = seo_brief_paa($brief);
        $answered = 0;
        foreach ($paa as $q) {
            if (seo_contains($searchText, $q)) $answered++;
        }
        $ratio = count($paa) > 0 ? $answered / count($paa) : 0;
        if ($ratio >= SEO_PAA_MIN) {
            $rules[] = seo_make_rule('paa_questions', 'passed', "เนื้อหาตอบคำถาม PAA {$answered}/" . count($paa) . " ข้อ");
        } elseif ($answered === 0) {
            $rules[] = seo_make_rule('paa_questions', 'failed', 'เนื้อหาไม่ตอบคำถาม PAA จาก research เลย (ควรตอบ ≥ ' . (int)(SEO_PAA_MIN * 100) . '%)');
        } else {
            $rules[] = seo_make_rule('paa_questions', 'needs_improvement', "เนื้อหาตอบคำถาม PAA {$answered}/" . count($paa) . " ข้อ (ควร ≥ " . (int)(SEO_PAA_MIN * 100) . '%)');
        }
    }

    // ── 13. content_gap (research-dependent) ────────────────────────────────
    if (!$brief || empty(seo_brief_gaps($brief))) {
        $rules[] = seo_make_rule('content_gap', 'pending', 'ยังไม่มี content gaps จาก research จึงข้ามการตรวจ');
    } else {
        $gaps = seo_brief_gaps($brief);
        $filled = 0;
        foreach ($gaps as $g) {
            if (seo_contains($searchText, $g)) $filled++;
        }
        $ratio = count($gaps) > 0 ? $filled / count($gaps) : 0;
        if ($ratio >= SEO_GAP_MIN) {
            $rules[] = seo_make_rule('content_gap', 'passed', "เนื้อหาเติม content gaps {$filled}/" . count($gaps) . " จุด");
        } elseif ($filled === 0) {
            $rules[] = seo_make_rule('content_gap', 'failed', 'เนื้อหาไม่เติม content gaps จาก research เลย (ควรเติม ≥ ' . (int)(SEO_GAP_MIN * 100) . '%)');
        } else {
            $rules[] = seo_make_rule('content_gap', 'needs_improvement', "เนื้อหาเติม content gaps {$filled}/" . count($gaps) . " จุด (ควร ≥ " . (int)(SEO_GAP_MIN * 100) . '%)');
        }
    }

    // ── 14. structured_data (JSON + @context/@type; video ต้องเป็น Video schema) ──
    if ($structured === '') {
        $rules[] = seo_make_rule('structured_data', 'pending', 'ยังไม่ได้ตั้งข้อมูลโครงสร้าง (structured data)');
    } else {
        $sd = json_decode($structured, true);
        if (!is_array($sd)) {
            $rules[] = seo_make_rule('structured_data', 'failed', 'structured data ไม่ใช่ JSON ที่อ่านได้');
        } elseif (!seo_structured_valid($sd)) {
            $rules[] = seo_make_rule('structured_data', 'failed', 'structured data ต้องมี @context และ @type');
        } elseif ($isVideo && !seo_structured_has_type($sd, 'VideoObject')) {
            $rules[] = seo_make_rule('structured_data', 'failed', 'structured data ของวิดีโอต้องมี @type เป็น VideoObject');
        } else {
            $rules[] = seo_make_rule('structured_data', 'passed', 'structured data ถูกต้อง');
        }
    }

    // ── 15. internal_linking (per-type) ─────────────────────────────────────
    if ($isVideo) {
        $n = count($videoLinks);
        if ($n >= 1) {
            $rules[] = seo_make_rule('internal_linking', 'passed', "มีลิงก์ภายใน/ที่เกี่ยวข้องใน description {$n} รายการ");
        } else {
            $rules[] = seo_make_rule('internal_linking', 'pending', 'วิดีโอไม่มี description/link ภายในให้ตรวจ (เป็นคำแนะนำ ไม่ fail)');
        }
    } elseif (!$hasContent) {
        $rules[] = seo_make_rule('internal_linking', 'pending', 'ไม่มีเนื้อหาบทความ จึงข้ามการตรวจลิงก์ภายใน');
    } else {
        $n = seo_internal_link_count($html);
        if ($n >= 1) {
            $rules[] = seo_make_rule('internal_linking', 'passed', "มีลิงก์ภายใน {$n} รายการ");
        } else {
            $rules[] = seo_make_rule('internal_linking', 'needs_improvement', 'ไม่พบลิงก์ภายในในเนื้อหา');
        }
    }

    // ── hashtags (วิดีโอต้องมี — critical สำหรับวิดีโอ) ──────────────────────
    if ($isVideo) {
        $hashtags = $art['hashtags'] ?? ($item['hashtags'] ?? []);
        if (is_string($hashtags)) {
            $hashtags = array_values(array_filter(array_map('trim', explode(',', $hashtags))));
        }
        if (empty($hashtags)) {
            $rules[] = [
                'key' => 'hashtags', 'level' => 'fail', 'status' => 'failed',
                'weight' => SEO_WEIGHT_HASHTAGS, 'score' => 0, 'critical' => true,
                'message' => 'วิดีโอต้องมี hashtag อย่างน้อย 1 รายการ',
            ];
        } else {
            $rules[] = [
                'key' => 'hashtags', 'level' => 'pass', 'status' => 'passed',
                'weight' => SEO_WEIGHT_HASHTAGS, 'score' => SEO_WEIGHT_HASHTAGS, 'critical' => true,
                'message' => 'มี hashtag สำหรับวิดีโอแล้ว',
            ];
        }
    }

    $score = seo_normalized_score($rules);
    $gate  = seo_gate_status(['score' => $score, 'rules' => $rules]);

    return ['score' => $score, 'gate' => $gate, 'rules' => $rules];
}

/**
 * นับจำนวนคำแบบ best-effort รองรับไทย+อังกฤษ
 * - อังกฤษ/ตัวเลข: นับตาม token
 * - ไทย: ไม่มีตัวคั่นคำ → ประมาณ ~4 อักษร/คำ
 */
function seo_word_count(string $html): int {
    $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $text = trim(preg_replace('/\s+/u', ' ', $text));
    if ($text === '') return 0;
    $latin = (int) preg_match_all('/[A-Za-z0-9]+/u', $text);
    $thai  = (int) preg_match_all('/[\x{0E00}-\x{0E7F}]/u', $text);
    return $latin + (int) ceil($thai / 4);
}

/** ดึงข้อความย่อหน้าแรกจาก HTML (fallback: 200 อักษรแรกของข้อความล้วน) */
function seo_first_paragraph(string $html): string {
    if (preg_match('/<p[^>]*>(.*?)<\/p>/is', $html, $m)) {
        return trim(strip_tags($m[1]));
    }
    return mb_substr(trim(strip_tags($html)), 0, 200);
}

/** รวมข้อความในแท็กหัวข้อทั้งหมด (H1–H6) */
function seo_headings_text(string $html): string {
    if (preg_match_all('/<h[1-6][^>]*>(.*?)<\/h[1-6]>/is', $html, $m)) {
        return trim(strip_tags(implode(' ', $m[1])));
    }
    return '';
}

/** นับลิงก์ภายใน (relative หรือ anchor ที่ไม่ใช่ http(s) ภายนอก) แบบ best-effort */
function seo_internal_link_count(string $html): int {
    if (!preg_match_all('/<a\s[^>]*href\s*=\s*["\']([^"\']+)["\']/i', $html, $m)) {
        return 0;
    }
    $count = 0;
    foreach ($m[1] as $href) {
        $href = trim($href);
        if ($href === '' || $href[0] === '#') continue;      // anchor ในหน้า ไม่นับ
        if (preg_match('#^[a-z][a-z0-9+.\-]*://#i', $href)) continue; // absolute (external) ไม่นับ
        if (stripos($href, 'mailto:') === 0 || stripos($href, 'tel:') === 0) continue;
        $count++;
    }
    return $count;
}

/** ตรวจว่า structured data มี @context และ @type (รองรับ object เดี่ยว, array, และ @graph) */
function seo_structured_valid(array $sd): bool {
    $hasContext = isset($sd['@context']) || isset($sd[0]['@context']);
    $hasType = isset($sd['@type'])
        || isset($sd[0]['@type'])
        || isset($sd['@graph'][0]['@type']);
    return $hasContext && $hasType;
}

/** ตรวจว่า structured data มี @type ตรงกับค่าที่ระบุ (รองรับ object เดี่ยว, array, และ @graph) */
function seo_structured_has_type(array $sd, string $type): bool {
    $types = [];
    if (isset($sd['@type'])) {
        $t = $sd['@type'];
        $types = array_merge($types, is_array($t) ? $t : [$t]);
    }
    if (isset($sd[0]['@type'])) {
        $t = $sd[0]['@type'];
        $types = array_merge($types, is_array($t) ? $t : [$t]);
    }
    foreach (($sd['@graph'] ?? []) as $node) {
        if (is_array($node) && isset($node['@type'])) {
            $t = $node['@type'];
            $types = array_merge($types, is_array($t) ? $t : [$t]);
        }
    }
    foreach ($types as $t) {
        if (is_string($t) && strcasecmp(trim($t), $type) === 0) return true;
    }
    return false;
}

/** ค้นหาแบบไม่สนตัวพิมพ์ รองรับ multibyte */
function seo_contains(string $haystack, string $needle): bool {
    if ($needle === '' || $haystack === '') return false;
    return mb_stripos($haystack, $needle) !== false;
}

/**
 * ตรวจเกต SEO — อ่านการตั้งค่าจาก content_global_settings แล้วตัดสินว่าจะบล็อกหรือไม่
 *
 * @return array{blocked:bool, reason:?string, score?:int, rules?:array}
 */
function seo_gate_check(PDO $db, string $tenantId, array $item): array {
    $stmt = $db->prepare(
        'SELECT seo_gate_enabled, seo_gate_min_score FROM content_global_settings WHERE tenant_id = ?'
    );
    $stmt->execute([$tenantId]);
    $cfg = $stmt->fetch(PDO::FETCH_ASSOC);

    // ไม่มีแถวการตั้งค่า หรือเกตปิด → ไม่บล็อก (default ปิด = flow เดิมไม่พัง)
    if (!$cfg || (int)($cfg['seo_gate_enabled'] ?? 0) !== 1) {
        return ['blocked' => false, 'reason' => null];
    }

    $minScore = (int)($cfg['seo_gate_min_score'] ?? 0);
    $eval  = seo_evaluate($item);
    $gate  = seo_gate_status($eval);
    $fails = array_values(array_filter($eval['rules'], fn($r) => ($r['status'] ?? '') === 'failed'));
    $lowScore = $eval['score'] < $minScore;

    if ($gate !== 'failed' && !$lowScore) {
        return ['blocked' => false, 'reason' => null, 'score' => $eval['score'], 'gate' => $gate, 'rules' => $eval['rules']];
    }

    // ข้อความเหตุผลภาษาไทย
    $parts = [];
    if (!empty($fails)) {
        $lines = array_map(fn($r) => '• ' . $r['message'], $fails);
        $parts[] = 'ไม่ผ่านเกณฑ์ SEO ' . count($fails) . ' ข้อ:' . "\n" . implode("\n", $lines);
    }
    if ($gate === 'failed' && $eval['score'] < SEO_GATE_WARN_SCORE) {
        $parts[] = "คะแนน SEO {$eval['score']} ต่ำกว่าเกณฑ์ผ่าน (" . SEO_GATE_WARN_SCORE . ")";
    }
    if ($lowScore) {
        $parts[] = "คะแนน SEO {$eval['score']} ต่ำกว่าเกณฑ์ขั้นต่ำ {$minScore}";
    }

    return [
        'blocked' => true,
        'reason'  => implode("\n", $parts),
        'score'   => $eval['score'],
        'gate'    => $gate,
        'rules'   => $eval['rules'],
    ];
}
