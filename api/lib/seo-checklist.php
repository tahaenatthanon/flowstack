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

// คะแนนหักต่อกฎที่ไม่ผ่าน (โปร่งใส: score = 100 − ผลรวมที่หัก)
const SEO_PENALTY_FAIL = 12;
const SEO_PENALTY_WARN = 4;

// Shared thresholds used by both seo_evaluate() and AI generation prompts.
const SEO_TITLE_MAX = 60;
const META_DESC_MIN = 120;
const META_DESC_MAX = 160;
const WORD_COUNT_MIN = 500;
const H2_MIN = 1;
const H1_MAX = 1;
const SEO_GEN_MAX_ATTEMPTS = 3;

/**
 * Return generation requirements derived from the same thresholds/rules used by
 * seo_evaluate(). This keeps the AI prompt and evaluator in sync.
 *
 * @return array<int,array{key:string,requirement:string}>
 */
function seo_generation_requirements(string $type): array {
    $isVideo = strtolower(trim($type)) === 'video';
    $requirements = [
        ['key' => 'seo_title', 'requirement' => "SEO title ต้องไม่เกิน " . SEO_TITLE_MAX . " ตัวอักษร"],
        ['key' => 'meta_description', 'requirement' => "meta description ต้องยาว " . META_DESC_MIN . "–" . META_DESC_MAX . " ตัวอักษร"],
        ['key' => 'slug', 'requirement' => 'slug ต้องเป็นตัวพิมพ์เล็ก ใช้เฉพาะ a-z, 0-9 และขีด (-) และห้ามมีขีดติดกัน/ขึ้นต้น/ลงท้าย'],
        ['key' => 'structured_data', 'requirement' => 'structured data ต้องเป็น JSON ที่ถูกต้องและมี @context กับ @type'],
    ];

    if ($isVideo) {
        $requirements[] = ['key' => 'hashtags', 'requirement' => 'วิดีโอต้องมี hashtag อย่างน้อย 1 รายการ'];
        return $requirements;
    }

    $requirements[] = ['key' => 'has_h2', 'requirement' => 'full_html ต้องมีหัวข้อ H2 อย่างน้อย ' . H2_MIN . ' หัวข้อ'];
    $requirements[] = ['key' => 'no_h1', 'requirement' => 'full_html ต้องมี H1 ไม่เกิน ' . H1_MAX . ' ตัว และไม่ควรใส่ H1 ซ้ำในเนื้อหา'];
    $requirements[] = ['key' => 'word_count', 'requirement' => 'full_html ต้องมีเนื้อหาอย่างน้อย ' . WORD_COUNT_MIN . ' คำตามตัวนับของระบบ'];
    $requirements[] = ['key' => 'keyword_in_title', 'requirement' => 'ใส่คีย์เวิร์ดหลักใน SEO title หรือชื่อบทความอย่างเป็นธรรมชาติเมื่อมีคีย์เวิร์ด'];
    $requirements[] = ['key' => 'keyword_in_first_para', 'requirement' => 'ใส่คีย์เวิร์ดหลักในย่อหน้าแรกอย่างเป็นธรรมชาติเมื่อมีคีย์เวิร์ด'];
    $requirements[] = ['key' => 'keyword_in_headings', 'requirement' => 'ใส่คีย์เวิร์ดหลักในหัวข้ออย่างเป็นธรรมชาติเมื่อมีคีย์เวิร์ด'];
    $requirements[] = ['key' => 'internal_link', 'requirement' => 'ใส่ internal link อย่างน้อย 1 ลิงก์เมื่อมี URL ที่เกี่ยวข้อง (เป็นคำแนะนำ ไม่ใช่ fail)'];

    return $requirements;
}

/**
 * ประเมิน SEO ของคอนเทนต์
 *
 * @param array $item ฟิลด์ที่ใช้: seo_title, slug, meta_description, meta_keywords,
 *                    structured_data, og_image, article_content (JSON string หรือ array), title
 * @return array{score:int, rules:array<array{key:string, level:string, message:string}>}
 */
function seo_evaluate(array $item): array {
    $rules = [];
    $type = strtolower(trim((string)($item['type'] ?? 'article')));
    $isVideo = $type === 'video';

    $seoTitle   = trim((string)($item['seo_title'] ?? ''));
    $slug       = trim((string)($item['slug'] ?? ''));
    $metaDesc   = trim((string)($item['meta_description'] ?? ''));
    $ogImage    = trim((string)($item['og_image'] ?? ''));
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

    // ── seo_title 1–60 ──────────────────────────────────────────────────────
    $len = mb_strlen($seoTitle);
    if ($seoTitle === '') {
        $rules[] = ['key' => 'seo_title', 'level' => 'pending', 'message' => 'ยังไม่ได้กรอก SEO title'];
    } elseif ($len > SEO_TITLE_MAX) {
        $rules[] = ['key' => 'seo_title', 'level' => 'fail', 'message' => "SEO title ยาวเกิน " . SEO_TITLE_MAX . " ตัวอักษร (ปัจจุบัน {$len})"];
    } else {
        $rules[] = ['key' => 'seo_title', 'level' => 'pass', 'message' => "SEO title มีความยาวเหมาะสม ({$len} ตัวอักษร)"];
    }

    // ── meta_description 120–160 ────────────────────────────────────────────
    $dlen = mb_strlen($metaDesc);
    if ($metaDesc === '') {
        $rules[] = ['key' => 'meta_description', 'level' => 'pending', 'message' => 'ยังไม่ได้กรอกคำอธิบาย meta'];
    } elseif ($dlen < META_DESC_MIN) {
        $rules[] = ['key' => 'meta_description', 'level' => 'fail', 'message' => "คำอธิบาย meta สั้นเกินไป ({$dlen} ตัวอักษร ควร " . META_DESC_MIN . "–" . META_DESC_MAX . ")"];
    } elseif ($dlen > META_DESC_MAX) {
        $rules[] = ['key' => 'meta_description', 'level' => 'fail', 'message' => "คำอธิบาย meta ยาวเกินไป ({$dlen} ตัวอักษร ควร " . META_DESC_MIN . "–" . META_DESC_MAX . ")"];
    } else {
        $rules[] = ['key' => 'meta_description', 'level' => 'pass', 'message' => "คำอธิบาย meta มีความยาวเหมาะสม ({$dlen} ตัวอักษร)"];
    }

    // ── slug ตัวพิมพ์เล็ก-ขีดคั่น ────────────────────────────────────────────
    if ($slug === '') {
        $rules[] = ['key' => 'slug', 'level' => 'pending', 'message' => 'ยังไม่ได้กำหนด slug'];
    } elseif (!preg_match('/^[a-z0-9]+(-[a-z0-9]+)*$/', $slug)) {
        $rules[] = ['key' => 'slug', 'level' => 'fail', 'message' => 'slug ต้องเป็นตัวพิมพ์เล็กและคั่นด้วยขีด (a-z, 0-9, -)'];
    } else {
        $rules[] = ['key' => 'slug', 'level' => 'pass', 'message' => 'slug ถูกต้อง'];
    }

    // ── has_h2 (body-dependent) ─────────────────────────────────────────────
    if ($isVideo) {
        $rules[] = ['key' => 'has_h2', 'level' => 'skip', 'message' => 'วิดีโอไม่ใช้โครงสร้างหัวข้อ H2 จึงข้ามการตรวจ'];
    } elseif (!$hasBody) {
        $rules[] = ['key' => 'has_h2', 'level' => 'skip', 'message' => 'ไม่มีเนื้อหาบทความ จึงข้ามการตรวจหัวข้อ H2'];
    } elseif (preg_match('/<h2[\s>]/i', $html)) {
        $rules[] = ['key' => 'has_h2', 'level' => 'pass', 'message' => 'มีหัวข้อ H2 ในเนื้อหา'];
    } else {
        $rules[] = ['key' => 'has_h2', 'level' => 'fail', 'message' => 'เนื้อหาไม่มีหัวข้อ H2 เลย'];
    }

    // ── no_h1 (body-dependent) ──────────────────────────────────────────────
    if ($isVideo) {
        $rules[] = ['key' => 'no_h1', 'level' => 'skip', 'message' => 'วิดีโอไม่มีเนื้อหาบทความ จึงข้ามการตรวจ H1'];
    } elseif (!$hasBody) {
        $rules[] = ['key' => 'no_h1', 'level' => 'skip', 'message' => 'ไม่มีเนื้อหาบทความ จึงข้ามการตรวจ H1'];
    } elseif (preg_match_all('/<h1[\s>]/i', $html, $matches) > H1_MAX) {
        $count = count($matches[0]);
        $rules[] = ['key' => 'no_h1', 'level' => 'fail', 'message' => "เนื้อหามีแท็ก H1 ซ้ำ {$count} ตัว (อนุญาตเฉพาะ H1 ของชื่อบทความ 1 ตัวแรก)"];
    } else {
        $rules[] = ['key' => 'no_h1', 'level' => 'pass', 'message' => 'มีแท็ก H1 ของชื่อบทความไม่เกิน 1 ตัว'];
    }

    // ── word_count ≥500 (body-dependent) ────────────────────────────────────
    if ($isVideo) {
        $rules[] = ['key' => 'word_count', 'level' => 'skip', 'message' => 'วิดีโอไม่ใช้เกณฑ์จำนวนคำบทความ จึงข้ามการตรวจ'];
    } elseif (!$hasBody) {
        $rules[] = ['key' => 'word_count', 'level' => 'skip', 'message' => 'ไม่มีเนื้อหาบทความ จึงข้ามการนับจำนวนคำ'];
    } else {
        $wc = seo_word_count($html);
        if ($wc < WORD_COUNT_MIN) {
            $rules[] = ['key' => 'word_count', 'level' => 'fail', 'message' => "เนื้อหาสั้นเกินไป (~{$wc} คำ ควร ≥ " . WORD_COUNT_MIN . ")"];
        } else {
            $rules[] = ['key' => 'word_count', 'level' => 'pass', 'message' => "จำนวนคำเพียงพอ (~{$wc} คำ)"];
        }
    }

    // ── keyword_in_title ────────────────────────────────────────────────────
    if ($primaryKw === '') {
        $rules[] = ['key' => 'keyword_in_title', 'level' => 'pending', 'message' => 'ยังไม่ได้กำหนดคีย์เวิร์ดหลัก (meta_keywords ว่าง)'];
    } elseif (seo_contains($seoTitle, $primaryKw) || seo_contains($fallbackTitle, $primaryKw)) {
        $rules[] = ['key' => 'keyword_in_title', 'level' => 'pass', 'message' => "คีย์เวิร์ดหลัก \"{$primaryKw}\" ปรากฏในชื่อ"];
    } else {
        $rules[] = ['key' => 'keyword_in_title', 'level' => 'warn', 'message' => "ไม่พบคีย์เวิร์ดหลัก \"{$primaryKw}\" ในชื่อ"];
    }

    // ── keyword_in_first_para (body-dependent) ──────────────────────────────
    if ($isVideo) {
        $rules[] = ['key' => 'keyword_in_first_para', 'level' => 'skip', 'message' => 'วิดีโอไม่มีโครงสร้างย่อหน้าบทความ จึงข้ามการตรวจ'];
    } elseif (!$hasBody) {
        $rules[] = ['key' => 'keyword_in_first_para', 'level' => 'skip', 'message' => 'ไม่มีเนื้อหาบทความ จึงข้ามการตรวจคีย์เวิร์ดในย่อหน้าแรก'];
    } elseif ($primaryKw === '') {
        $rules[] = ['key' => 'keyword_in_first_para', 'level' => 'pending', 'message' => 'ยังไม่ได้กำหนดคีย์เวิร์ดหลัก'];
    } elseif (seo_contains(seo_first_paragraph($html), $primaryKw)) {
        $rules[] = ['key' => 'keyword_in_first_para', 'level' => 'pass', 'message' => 'คีย์เวิร์ดหลักปรากฏในย่อหน้าแรก'];
    } else {
        $rules[] = ['key' => 'keyword_in_first_para', 'level' => 'warn', 'message' => 'ไม่พบคีย์เวิร์ดหลักในย่อหน้าแรก'];
    }

    // ── keyword_in_headings (body-dependent) ────────────────────────────────
    if ($isVideo) {
        $rules[] = ['key' => 'keyword_in_headings', 'level' => 'skip', 'message' => 'วิดีโอไม่มีโครงสร้างหัวข้อบทความ จึงข้ามการตรวจ'];
    } elseif (!$hasBody) {
        $rules[] = ['key' => 'keyword_in_headings', 'level' => 'skip', 'message' => 'ไม่มีเนื้อหาบทความ จึงข้ามการตรวจคีย์เวิร์ดในหัวข้อ'];
    } elseif ($primaryKw === '') {
        $rules[] = ['key' => 'keyword_in_headings', 'level' => 'pending', 'message' => 'ยังไม่ได้กำหนดคีย์เวิร์ดหลัก'];
    } elseif (seo_contains(seo_headings_text($html), $primaryKw)) {
        $rules[] = ['key' => 'keyword_in_headings', 'level' => 'pass', 'message' => 'คีย์เวิร์ดหลักปรากฏในหัวข้อ'];
    } else {
        $rules[] = ['key' => 'keyword_in_headings', 'level' => 'warn', 'message' => 'ไม่พบคีย์เวิร์ดหลักในหัวข้อ (H2/H3)'];
    }

    // ── structured_data (JSON + @context/@type) ─────────────────────────────
    if ($structured === '') {
        $rules[] = ['key' => 'structured_data', 'level' => 'pending', 'message' => 'ยังไม่ได้ตั้งข้อมูลโครงสร้าง (structured data)'];
    } else {
        $sd = json_decode($structured, true);
        if (!is_array($sd)) {
            $rules[] = ['key' => 'structured_data', 'level' => 'fail', 'message' => 'structured data ไม่ใช่ JSON ที่อ่านได้'];
        } elseif (!seo_structured_valid($sd)) {
            $rules[] = ['key' => 'structured_data', 'level' => 'fail', 'message' => 'structured data ต้องมี @context และ @type'];
        } else {
            $rules[] = ['key' => 'structured_data', 'level' => 'pass', 'message' => 'structured data ถูกต้อง'];
        }
    }

    // ── og_image (ว่าง = warn ไม่บล็อก) ─────────────────────────────────────
    if ($ogImage === '') {
        $rules[] = ['key' => 'og_image', 'level' => 'pending', 'message' => 'ยังไม่ได้ตั้งรูป OG (og_image)'];
    } else {
        $rules[] = ['key' => 'og_image', 'level' => 'pass', 'message' => 'ตั้งรูป OG แล้ว'];
    }

    // ── internal_link (body-dependent, best-effort ไม่บล็อก) ────────────────
    if ($isVideo) {
        $rules[] = ['key' => 'internal_link', 'level' => 'skip', 'message' => 'วิดีโอไม่ใช้ลิงก์ภายในบทความ จึงข้ามการตรวจ'];
    } elseif (!$hasBody) {
        $rules[] = ['key' => 'internal_link', 'level' => 'skip', 'message' => 'ไม่มีเนื้อหาบทความ จึงข้ามการตรวจลิงก์ภายใน'];
    } else {
        $n = seo_internal_link_count($html);
        if ($n >= 1) {
            $rules[] = ['key' => 'internal_link', 'level' => 'pass', 'message' => "มีลิงก์ภายใน {$n} รายการ"];
        } else {
            $rules[] = ['key' => 'internal_link', 'level' => 'warn', 'message' => 'ไม่พบลิงก์ภายในในเนื้อหา'];
        }
    }

    // ── hashtags (วิดีโอต้องมีสำหรับการเผยแพร่บน social platform) ──────────
    if ($isVideo) {
        $hashtags = $art['hashtags'] ?? ($item['hashtags'] ?? []);
        if (is_string($hashtags)) {
            $hashtags = array_values(array_filter(array_map('trim', explode(',', $hashtags))));
        }
        if (empty($hashtags)) {
            $rules[] = ['key' => 'hashtags', 'level' => 'fail', 'message' => 'วิดีโอต้องมี hashtag อย่างน้อย 1 รายการ'];
        } else {
            $rules[] = ['key' => 'hashtags', 'level' => 'pass', 'message' => 'มี hashtag สำหรับวิดีโอแล้ว'];
        }
    }

    // ── คะแนน: 100 − หักตาม fail/warn (skip/pass ไม่หัก) ────────────────────
    $penalty = 0;
    foreach ($rules as $r) {
        if ($r['level'] === 'fail') $penalty += SEO_PENALTY_FAIL;
        elseif ($r['level'] === 'warn') $penalty += SEO_PENALTY_WARN;
    }
    $score = max(0, 100 - $penalty);

    return ['score' => $score, 'rules' => $rules];
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
    $fails = array_values(array_filter($eval['rules'], fn($r) => ($r['level'] ?? '') === 'fail'));
    $lowScore = $eval['score'] < $minScore;

    if (empty($fails) && !$lowScore) {
        return ['blocked' => false, 'reason' => null, 'score' => $eval['score'], 'rules' => $eval['rules']];
    }

    // ข้อความเหตุผลภาษาไทย
    $parts = [];
    if (!empty($fails)) {
        $lines = array_map(fn($r) => '• ' . $r['message'], $fails);
        $parts[] = 'ไม่ผ่านเกณฑ์ SEO ' . count($fails) . ' ข้อ:' . "\n" . implode("\n", $lines);
    }
    if ($lowScore) {
        $parts[] = "คะแนน SEO {$eval['score']} ต่ำกว่าเกณฑ์ขั้นต่ำ {$minScore}";
    }

    return [
        'blocked' => true,
        'reason'  => implode("\n", $parts),
        'score'   => $eval['score'],
        'rules'   => $eval['rules'],
    ];
}
