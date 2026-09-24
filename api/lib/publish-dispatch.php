<?php
require_once __DIR__ . '/seo-checklist.php';
require_once __DIR__ . '/aeo-checklist.php';

// Platform ที่เป็น script/social content (มี script ต่อ platform) แยกจาก web/CMS platform
// ที่ใช้ Article HTML ตรงๆ — ใช้กำหนดเส้นทาง Quality Gate ใน content_quality_gate_check()/
// final_publish_gate_check() ด้านล่าง (web ใช้ Article SEO/AEO, script ใช้ script เดิม)
// ย้ายมาจาก api/lib/script-quality-checklist.php ตอนเลิกใช้ Script SEO/AEO quality gate
// (constant นี้เป็น routing ล้วน ไม่เกี่ยวกับการให้คะแนน SEO/AEO ของ script)
const SCRIPT_PLATFORMS = [
    'facebook', 'instagram', 'tiktok', 'youtube', 'lineoa', 'linkedin', 'twitter',
];

/**
 * Platform dispatch functions — real API calls per platform.
 *
 * Called from cron/publish-scheduler.php (content_publish_queue flow)
 * and directly from brand-content.php for immediate "send now".
 *
 * Credentials are stored encrypted in publish_channels.credentials_encrypted
 * as JSON: {"page_id":"...","access_token":"..."} etc.
 * decryptApiKey() is provided by config.php (loaded before this file).
 */

/**
 * แปลง HTML บทความเป็นข้อความล้วน สำหรับปลายทางที่ไม่เรนเดอร์ HTML
 *
 * ใช้กับแพลตฟอร์มโซเชียลเท่านั้น (facebook, instagram, tiktok, lineoa, linkedin, twitter)
 * ปลายทางเว็บ/CMS (wordpress, lotusdomino, custom) ต้องได้ HTML เดิม — ห้ามเรียกฟังก์ชันนี้กับเส้นนั้น
 *
 * ไม่ใช้ strip_tags() เปล่า ๆ เพราะจะยุบย่อหน้ากับรายการเป็นข้อความติดกันเป็นพืดอ่านไม่ออก
 * (16 จาก 23 แถวใน content_items มี <li>) จึงแปลงแท็กเชิงโครงสร้างเป็นตัวคั่นข้อความก่อน
 *
 * ลำดับ strip ก่อน decode สลับกันไม่ได้: ถ้า decode ก่อน ข้อความที่ผู้เขียน escape ไว้
 * อย่าง &lt;div&gt; จะกลายเป็นแท็กจริงแล้วถูก strip_tags() กินหายไป
 * ลำดับนี้ตรงกับ seo_word_count() ใน api/lib/seo-checklist.php ที่ใช้อยู่แล้ว
 *
 * @param string $html     HTML จาก article_content.html
 * @param string $dupTitle หัวเรื่องที่ผู้เรียกจะเติมไว้หน้าข้อความอยู่แล้ว — ใช้ตัด <h1> ที่ซ้ำ
 *                         ต้องเป็นค่า $title ที่ dispatch_content() คำนวณแล้ว ไม่ใช่คอลัมน์ title ดิบ
 *                         (5 แถวมี article_content.title ต่างจากคอลัมน์ และเป็นค่าที่โพสต์จริงใช้)
 */
function publish_html_to_text(string $html, string|array $dupTitle = ''): string {
    if (trim($html) === '') {
        return '';
    }

    // ── ตัด <h1> ตัวแรกเมื่อข้อความข้างในซ้ำกับหัวเรื่องที่จะถูกเติม ──────────────
    // dispatcher โซเชียลทุกตัวประกอบข้อความเป็น "$title\n\n$body" ถ้าไม่ตัด หัวเรื่องจะขึ้นสองครั้งติดกัน
    // ตัดเฉพาะตัวแรกและเฉพาะเมื่อตรงเป๊ะ — <h1> ที่ไม่ซ้ำเป็นเนื้อหาที่ผู้ใช้อนุมัติมา ห้ามลบ
    // เทียบแบบ normalize ทั้งสองฝั่ง ไม่เทียบสตริงดิบ เพราะ <h1> มักมี attribute และ entity ข้างใน
    // รับได้หลายค่า (platform-post-text): โซเชียลเติม content_items.title แต่ <h1> ของบทความคือ
    // article_content.title — ตรงค่าใดค่าหนึ่งก็ถือว่าซ้ำ
    $dupTitles = array_values(array_filter(array_map('trim', (array)$dupTitle), static fn($t) => $t !== ''));
    if ($dupTitles && preg_match('/<h1\b[^>]*>(.*?)<\/h1>/is', $html, $m)) {
        $h1Text = trim(html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        if (in_array($h1Text, $dupTitles, true)) {
            $html = preg_replace('/<h1\b[^>]*>.*?<\/h1>/is', '', $html, 1);
        }
    }

    // ── ลบ <script>/<style> พร้อมเนื้อข้างใน ────────────────────────────────────
    // ต้องอยู่ก่อน strip_tags() ซึ่งตัดแต่แท็กแล้วเก็บข้อความข้างในไว้
    // ยังไม่พบในข้อมูลจริง (0 แถว) — เป็นการกัน CSS/JS ไหลไปโพสต์บนเพจสาธารณะ ไม่ใช่แก้อาการที่พบ
    $html = preg_replace('#<(script|style)\b[^>]*>.*?</\1\s*>#is', '', $html);

    // ── แท็กเชิงโครงสร้าง → ตัวคั่นข้อความ (ต้องก่อน strip_tags) ─────────────────
    // <li> เปิดบรรทัดใหม่ให้เอง จึงไม่ต้องแปลง </li> เพิ่ม ไม่งั้นจะได้บรรทัดว่างคั่นทุกหัวข้อย่อย
    $html = preg_replace('/<li\b[^>]*>/i', "\n• ", $html);
    $html = preg_replace('#<br\s*/?>#i', "\n", $html);
    $html = preg_replace('#</(p|h[1-6]|div|ul|ol|blockquote)\s*>#i', "\n\n", $html);

    // ── ตัดแท็กที่เหลือ แล้วจึงถอดรหัส entity (ลำดับนี้สลับไม่ได้ ดู docblock) ────
    $text = strip_tags($html);
    $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');

    // ── normalize ปิดท้าย ───────────────────────────────────────────────────────
    $text = str_replace(["\r\n", "\r"], "\n", $text);
    $text = preg_replace('/[ \t\x{00A0}]+/u', ' ', $text);  // ยุบช่องว่าง/แท็บ/nbsp ในบรรทัดเดียวกัน
    $text = preg_replace('/ *\n */', "\n", $text);          // ตัดช่องว่างที่คร่อมการขึ้นบรรทัด
    $text = preg_replace('/\n{3,}/', "\n\n", $text);        // บรรทัดว่างติดกันไม่เกินหนึ่งบรรทัด

    return trim($text);
}

// ── ข้อความโพสต์โซเชียล (platform-post-text) ──────────────────────────────────
// platform ที่โพสต์ "หัวข้อ + ข้อความโพสต์ของ platform" — เว็บ/CMS ใช้บทความ HTML แทน
const SOCIAL_POST_PLATFORMS = ['facebook', 'instagram', 'tiktok', 'lineoa', 'linkedin', 'twitter', 'youtube'];

// คำกำกับต้นบรรทัดที่ AI เคยใส่ใน scripts[platform] — ต้องตรงกับ SCRIPT_DIRECTION_LINE_RE ใน
// src/components/content/types.ts (ใช้ fixture ชุดเดียวกันในเทสต์ทั้งสองฝั่ง)
const PUBLISH_DIRECTION_RE = '/^[ \t]*(?:post caption|caption\/reels|caption|professional post|post|ข้อความ line oa|hook(?:[ \t]*\d+[ \t]*วิ)?|scene[ \t]*\d+|section[ \t]*\d+|intro|outro|cta)[ \t]*[:：][ \t]*/imu';

/** ตัดคำกำกับที่ต้นบรรทัดออก (ทุก platform) — บรรทัดที่เหลือว่างเพราะมีแต่คำกำกับถูกลบ, บรรทัดว่างไม่ซ้อน */
function publish_strip_directions(string $text): string {
    $text = str_replace(["\r\n", "\r"], "\n", $text);
    $lines = explode("\n", $text);
    $out = [];
    foreach ($lines as $line) {
        $hadLabel = preg_match(PUBLISH_DIRECTION_RE, $line) === 1;
        $stripped = preg_replace(PUBLISH_DIRECTION_RE, '', $line);
        if ($hadLabel && trim($stripped) === '') continue;
        $out[] = rtrim($stripped);
    }
    return trim(preg_replace('/\n{3,}/', "\n\n", implode("\n", $out)));
}

/**
 * ตรวจบทวิดีโอที่ปนในข้อความโพสต์ (Visual:/Voiceover:/timecode) — คืนเหตุผลภาษาไทย หรือ null ถ้าผ่าน
 * ตรวจหลังตัดคำกำกับแล้ว: Scene N: ถูกตัดไปแล้ว แต่บทวิดีโอเต็มรูปแบบต้องให้คนแก้ ไม่ตัดทิ้งเงียบๆ
 */
function publish_screenplay_check(string $finalText, string $platform = ''): ?string {
    // บรรทัดอาจนำด้วย bullet/เลขข้อ ("- Visual:", "• Voiceover:", "1) Shot:") — พบจริงในแคปชั่นเก่าของ 5121176a
    $bullet = '(?:[-•*·▪➤>]+[ \t]*|\d+[.)][ \t]*)?';
    $patterns = [
        '/^[ \t]*' . $bullet . '(?:visual|voice[ \t]?over|narration|shot|บทพากย์|เสียงบรรยาย)[ \t]*[:：].*$/imu',
        '/^[ \t]*' . $bullet . 'ฉากที่[ \t]*\d+[^\n]*/mu',      // "ฉากที่ 1 (8 วินาที)"
        '/[\[(][ \t]*\d{1,2}:\d{2}[^\n]*/u',                    // timecode [0:00 / (0:15)
        '/\[[ \t]*(?:hook|สคริปต์)[^\n]*/iu',                   // [Hook: 0-10s] / [สคริปต์วิดีโอสั้น …]
    ];
    foreach ($patterns as $re) {
        if (preg_match($re, $finalText, $m)) {
            $sample = mb_substr(trim($m[0]), 0, 40);
            $label = $platform !== '' ? $platform : 'platform นี้';
            return "ข้อความโพสต์มีบทวิดีโอปน (\"{$sample}\") กรุณาแก้ข้อความโพสต์ของ {$label} ก่อนเผยแพร่";
        }
    }
    return null;
}

/**
 * ข้อความโพสต์โซเชียลของ platform — จุดเดียวที่ทั้ง "ส่งเดี๋ยวนี้" และ cron ใช้ (ผ่าน dispatch_content)
 *   title = content_items.title (ช่อง "หัวข้อ" ในฟอร์ม — ไม่ใช่ชื่อที่ AI ตั้ง)
 *   body  = content_override ของคิวเดิม → scripts[platform] ที่ตัดคำกำกับ → caption → บทความแปลงเป็นข้อความ
 * @return array{title: string, body: string, source: string}
 */
function publish_social_post_text(array $content, string $platform): array {
    $platform = strtolower(trim($platform));
    $title = trim((string)($content['title'] ?? ''));
    $art = !empty($content['article_content']) ? json_decode((string)$content['article_content'], true) : null;
    $art = is_array($art) ? $art : [];

    $override = trim((string)($content['content_override'] ?? ''));
    if ($override !== '') return ['title' => $title, 'body' => $override, 'source' => 'override'];

    $script = $art['scripts'][$platform] ?? null;
    if (is_string($script)) {
        $script = publish_strip_directions($script);
        if ($script !== '') return ['title' => $title, 'body' => $script, 'source' => 'script'];
    }

    $caption = trim((string)($content['caption'] ?? ''));
    if ($caption !== '') return ['title' => $title, 'body' => $caption, 'source' => 'caption'];

    $text = publish_html_to_text((string)($art['html'] ?? ''), [$title, (string)($art['title'] ?? '')]);
    return ['title' => $title, 'body' => $text, 'source' => $text !== '' ? 'article' : 'empty'];
}

/** ข้อความสุดท้ายแบบที่ dispatcher โซเชียลจะประกอบ ("หัวข้อ\n\nข้อความ") — ใช้ตรวจ gate และแสดงตัวอย่าง */
function publish_social_final_text(array $post): string {
    return $post['title'] !== '' ? $post['title'] . "\n\n" . $post['body'] : $post['body'];
}

/**
 * ผ่าน/ไม่ผ่านของ Quality (SEO+AEO) — `failed` เฉพาะเมื่อมี Required rule ที่ `failed`
 * คะแนนรวม, `critical`, `needs_improvement` และ Recommended rule ไม่ใช้ตัดสิน
 * ใช้ร่วมกันทั้งตอน Generate และใน quality_required_gate() (change quality-required-tiers)
 *
 * @return array{status:string, failed_required:list<array{quality:string,key:string,message:string,expected:string}>}
 */
function quality_required_status(array $seoEval, array $aeoEval, string $type = 'article'): array {
    $failed = [];
    foreach (['SEO' => $seoEval, 'AEO' => $aeoEval] as $quality => $eval) {
        foreach (($eval['rules'] ?? []) as $r) {
            if (($r['tier'] ?? 'required') !== 'required' || ($r['status'] ?? '') !== 'failed') continue;
            $key = (string)($r['key'] ?? '');
            $failed[] = [
                'quality' => $quality,
                'key' => $key,
                'message' => (string)($r['message'] ?? ''),
                'expected' => $quality === 'SEO' ? seo_contract_pass_condition($type, $key) : 'AEO: ต้องผ่านกฎ ' . $key,
            ];
        }
    }
    return ['status' => $failed ? 'failed' : 'passed', 'failed_required' => $failed];
}

/**
 * ตอน generate ควรเรียก AI repair ไหม — เฉพาะเมื่อมี Required rule ที่ `failed` และไม่ใช่วิดีโอ
 * (needs_improvement / Recommended / pending / n/a ไม่กระตุ้น repair)
 */
function quality_should_repair(array $seoEval, array $aeoEval, bool $isVideo): bool {
    return !$isVideo && quality_required_status($seoEval, $aeoEval)['status'] === 'failed';
}

/**
 * feedback สำหรับ AI repair — เฉพาะ Required rule ที่ `failed` ของทั้ง SEO และ AEO
 * แต่ละข้อมี key, status, expected (เกณฑ์ Required) และ message (มีค่าที่วัดได้จริง)
 */
function quality_repair_feedback(array $seoEval, array $aeoEval, string $type = 'article'): string {
    $lines = [];
    foreach (quality_required_status($seoEval, $aeoEval, $type)['failed_required'] as $f) {
        $lines[] = "- [{$f['quality']}:{$f['key']}] failed\n  expected: {$f['expected']}\n  actual: {$f['message']}";
    }
    return implode("\n", $lines);
}

/**
 * Quality Gate กลาง — ตัวเดียวที่ใช้ตัดสิน Quality ตอนขออนุมัติ, เผยแพร่ทันที/ตั้งเวลา และ cron
 * ลำดับ: วิดีโอข้าม → marker quality_checked_at (ตรวจเวอร์ชันนี้แล้วหรือยัง) → สวิตช์รวม
 * seo_gate_enabled ของ tenant → ประเมิน SEO/AEO ใหม่จาก $content (ข้อมูลที่อ่านจาก DB ในคำขอนั้น)
 * ไม่ใช้ seo_score/aeo_score หรือผล recheck เดิมเป็นตัวตัดสิน และไม่อ่าน seo_gate_min_score
 *
 * @param bool $evaluateQuality false = เช็คแค่ marker (เช่น เลือกแต่ platform โซเชียล)
 * @param bool $requireMarker   false = ข้ามการเช็ค marker (ผู้เรียกเช็คไปแล้ว)
 * @return array{blocked:bool, reason:?string, seo?:array, aeo?:array, failed_required?:list}
 */
function quality_required_gate(PDO $db, string $tenantId, array $content, ?array $researchBrief = null, bool $evaluateQuality = true, bool $requireMarker = true): array {
    if (strtolower(trim((string)($content['type'] ?? ''))) === 'video') {
        return ['blocked' => false, 'reason' => null];
    }
    if ($requireMarker) {
        $articleSnapshot = $content['article_content'] ?? null;
        if (is_string($articleSnapshot)) $articleSnapshot = json_decode($articleSnapshot, true);
        if (!is_array($articleSnapshot) || empty($articleSnapshot['quality_checked_at'])) {
            return ['blocked' => true, 'reason' => 'Quality gate: ยังไม่ได้ตรวจ SEO/AEO ของเวอร์ชันนี้ กรุณาบันทึกแล้วกด "ตรวจ SEO/AEO ใหม่" ก่อน'];
        }
    }
    if (!$evaluateQuality) return ['blocked' => false, 'reason' => null];

    $cfgStmt = $db->prepare('SELECT seo_gate_enabled FROM content_global_settings WHERE tenant_id=?');
    $cfgStmt->execute([$tenantId]);
    if ((int)($cfgStmt->fetchColumn() ?: 0) !== 1) return ['blocked' => false, 'reason' => null];

    $brief = $researchBrief ?? (is_array($content['research_brief'] ?? null) ? $content['research_brief'] : null);
    $item = array_merge($content, ['research_brief' => $brief]);
    $seo = seo_evaluate($item);
    $aeo = aeo_evaluate($item);
    $status = quality_required_status($seo, $aeo, (string)($content['type'] ?? 'article'));
    if ($status['status'] === 'passed') {
        return ['blocked' => false, 'reason' => null, 'seo' => $seo, 'aeo' => $aeo, 'failed_required' => []];
    }
    $groups = array_values(array_unique(array_column($status['failed_required'], 'quality')));
    $lines = array_map(static fn(array $f): string => "• {$f['quality']}: {$f['message']}", $status['failed_required']);
    return [
        'blocked' => true,
        'reason' => 'Article ' . implode('/', $groups) . ' gate: ไม่ผ่านข้อบังคับ ' . count($lines) . " ข้อ\n" . implode("\n", $lines),
        'seo' => $seo,
        'aeo' => $aeo,
        'failed_required' => $status['failed_required'],
    ];
}

/**
 * Quality gate ตอนขออนุมัติ — เช็ค marker ทุกคอนเทนต์ (ยกเว้นวิดีโอ) และประเมิน SEO/AEO
 * เฉพาะเมื่อเลือก platform เว็บ/CMS (platform โซเชียลไม่มี Quality gate ของตัวเอง)
 */
function content_quality_gate_check(PDO $db, string $tenantId, array $content, ?array $researchBrief = null): array {
    $webPlatforms = array_values(array_diff(publish_content_platforms($content), SCRIPT_PLATFORMS));
    return quality_required_gate($db, $tenantId, $content, $researchBrief, (bool)$webPlatforms);
}

/**
 * เช็คว่าคอนเทนต์วิดีโอพร้อมเผยแพร่จริง — ต้องสร้างวิดีโอรวมเสร็จแล้วและไฟล์ยังมีอยู่จริงบนดิสก์
 * คอนเทนต์ที่ไม่ใช่ type='video' ผ่านเสมอ (ไม่กระทบ article)
 */
function video_readiness_gate_check(array $content): array {
    if (($content['type'] ?? '') !== 'video') {
        return ['blocked' => false, 'reason' => null];
    }
    if (($content['video_gen_status'] ?? '') !== 'done') {
        return ['blocked' => true, 'reason' => 'Video gate: วิดีโอยังสร้างไม่เสร็จ กรุณาสร้างวิดีโอรวมให้เสร็จก่อนเผยแพร่'];
    }
    $video = resolve_local_video((string)($content['video_url'] ?? ''));
    if (!$video['ok']) {
        return ['blocked' => true, 'reason' => 'Video gate: ไม่พบไฟล์วิดีโอ — ' . $video['error']];
    }
    return ['blocked' => false, 'reason' => null];
}

/**
 * Final publish gate shared by immediate publish, queued publish and scheduled publish.
 * Approval and platform selection are always hard requirements; Quality ใช้ quality_required_gate()
 * (ประเมิน SEO/AEO เฉพาะ platform เว็บ/CMS — platform โซเชียลไม่มี Quality gate)
 */
function final_publish_gate_check(PDO $db, string $tenantId, array $content, string $platform, ?array $researchBrief = null): array {
    $platform = strtolower(trim($platform));
    $selected = publish_content_platforms($content);

    // The publish gate is evaluated against the canonical Content Item snapshot.
    // Keep platform normalization in one place so send-now, schedule, and cron
    // cannot accidentally evaluate a different platform representation.
    if ($platform === '') {
        return ['blocked' => true, 'reason' => 'Platform gate: ไม่ได้ระบุแพลตฟอร์มสำหรับเผยแพร่'];
    }

    if (($content['status'] ?? '') !== 'approved' || empty($content['approved_at'])) {
        return ['blocked' => true, 'reason' => 'Approval gate: คอนเทนต์นี้ยังไม่ผ่านการอนุมัติ'];
    }
    // Marker ของเวอร์ชันปัจจุบัน — การแก้เนื้อหาล้าง marker ทุกครั้ง จึงต้องตรวจใหม่ก่อนเผยแพร่/ตั้งเวลา
    $markerGate = quality_required_gate($db, $tenantId, $content, $researchBrief, false);
    if ($markerGate['blocked']) return $markerGate;

    if (!in_array($platform, $selected, true)) {
        return ['blocked' => true, 'reason' => "Platform gate: {$platform} ไม่ได้ถูกเลือกไว้ใน Content Item"];
    }

    $videoGate = video_readiness_gate_check($content);
    if ($videoGate['blocked']) return $videoGate;

    // Script/social platforms (TikTok, Facebook ฯลฯ) ไม่มี Quality gate ของตัวเอง —
    // ผ่าน Approval + Platform gate ด้านบนแล้วก็เผยแพร่ได้ทันที
    if (in_array($platform, SCRIPT_PLATFORMS, true)) {
        return ['blocked' => false, 'reason' => null];
    }

    // Web/CMS targets: ประเมิน SEO/AEO ใหม่ด้วย gate กลาง (marker เช็คไปแล้วด้านบน)
    $qualityGate = quality_required_gate($db, $tenantId, $content, $researchBrief, true, false);
    return [
        'blocked' => $qualityGate['blocked'],
        'reason' => $qualityGate['reason'],
        'article' => ['seo' => $qualityGate['seo'] ?? null, 'aeo' => $qualityGate['aeo'] ?? null],
    ];
}


function publish_content_platforms(array $content): array {
    $raw = $content['platforms'] ?? null;
    if (is_array($raw)) {
        $platforms = $raw;
    } elseif (is_string($raw) && trim($raw) !== '') {
        $decoded = json_decode($raw, true);
        $platforms = is_array($decoded) ? $decoded : preg_split('/\\s*,\\s*/', $raw);
    } else {
        $platforms = preg_split('/\\s*,\\s*/', (string)($content['platform'] ?? ''));
    }
    $platforms = array_values(array_unique(array_filter(array_map(
        static fn($p): string => strtolower(trim((string)$p)),
        $platforms
    ))));
    return $platforms;
}

/**
 * Return platforms that have already been successfully published for a content item.
 * The business key is content + platform, not content + channel: a second channel
 * on the same platform must not create a second published post.
 */
function get_published_content_platforms(PDO $db, string $tenantId, string $contentId): array {
    $stmt = $db->prepare(
        "SELECT DISTINCT LOWER(pc.platform) AS platform
         FROM content_publish_queue q
         JOIN publish_channels pc ON pc.id = q.channel_id
         WHERE q.tenant_id=? AND q.content_id=? AND q.status='sent'
         UNION
         SELECT DISTINCT LOWER(pc.platform) AS platform
         FROM content_schedules cs
         JOIN content_plan_items cpi ON cpi.id=cs.plan_item_id
         JOIN content_items ci ON ci.plan_item_id=cpi.id
         JOIN publish_channels pc ON pc.id=cs.channel_id
         WHERE ci.tenant_id=? AND ci.id=? AND cs.status='sent'"
    );
    $stmt->execute([$tenantId, $contentId, $tenantId, $contentId]);
    return array_values(array_filter(array_map(
        static fn($row): string => strtolower(trim((string)$row['platform'])),
        $stmt->fetchAll(PDO::FETCH_ASSOC)
    )));
}

/**
 * Guard for scheduled_date mutations (drag/drop on the calendar, manual date field
 * in the edit dialog). Rejects with HTTP 409 when ANY platform of this content item
 * has already been published — not just when every platform is done (that would be
 * content_items.published_at, a stricter/looser condition we intentionally don't use
 * here). See openspec/changes/lock-published-content-date/design.md Decision 1.
 */
function assert_scheduled_date_editable(PDO $db, string $tenantId, string $contentId): void {
    $published = get_published_content_platforms($db, $tenantId, $contentId);
    if (!empty($published)) {
        jsonError('ไม่สามารถเปลี่ยนวันที่ได้ เนื่องจากเผยแพร่ไปแล้วบางแพลตฟอร์ม (' . implode(', ', $published) . ')', 409);
    }
}

/**
 * Sync content-level status from per-platform publish history.
 * Approved remains the actionable state while at least one selected platform
 * is still unpublished. It becomes published only when every selected platform
 * has a successful publish record.
 */
function sync_content_publish_status(PDO $db, string $tenantId, array $content): void {
    $contentId = (string)($content['id'] ?? '');
    if ($contentId === '') return;
    $selected = publish_content_platforms($content);
    if (!$selected) return;
    $published = get_published_content_platforms($db, $tenantId, $contentId);
    $allPublished = count(array_diff($selected, $published)) === 0;
    $status = $allPublished ? 'published' : 'approved';
    if ($status === 'published') {
        $db->prepare("UPDATE content_items SET status='published', published_at=COALESCE(published_at,NOW()), updated_at=NOW() WHERE id=? AND tenant_id=?")
           ->execute([$contentId, $tenantId]);
    } else {
        $db->prepare("UPDATE content_items SET status='approved', updated_at=NOW() WHERE id=? AND tenant_id=? AND status='published'")
           ->execute([$contentId, $tenantId]);
    }
}

function dispatch_content(string $platform, array $channel, array $content): array {
    // Decrypt credentials once
    $creds = [];
    if (!empty($channel['credentials_encrypted'])) {
        $plain = decryptApiKey($channel['credentials_encrypted']);
        if ($plain) {
            // Credentials may be JSON or a plain token string
            $decoded = json_decode($plain, true);
            $creds = is_array($decoded) ? $decoded : ['token' => $plain];
        }
    }

    // Resolve article content (JSON with title/html/excerpt)
    $art = !empty($content['article_content'])
        ? json_decode($content['article_content'], true)
        : null;
    $title   = $art['title']   ?? $content['title']       ?? '';
    $body    = $art['html']    ?? $content['caption']     ?? '';
    $excerpt  = $art['excerpt'] ?? '';
    $imgUrl   = $content['generated_image_url'] ?? '';
    $videoUrl = $content['video_url'] ?? '';

    // เนื้อหาสำหรับแพลตฟอร์มโซเชียล — แยกจาก $body ข้างบนที่เป็น HTML สำหรับเว็บ/CMS
    // โซเชียลไม่เรนเดอร์ HTML ส่ง $body เข้าไปตรง ๆ จะได้ <article>/<h1>/<p> ขึ้นเพจ
    //
    // caption มาก่อนเพราะเป็นข้อความล้วนที่เขียนไว้สำหรับโซเชียลโดยเฉพาะ (284–1,415 เฉลี่ย 749 อักษร)
    // ขณะที่ article_content.html เป็นบทความ SEO (1,014–6,360 เฉลี่ย 3,615 อักษร) ที่แปลงเป็นข้อความ
    // แล้วก็ยังยาวเกินเพดาน instagram/tiktok (2,200) และ twitter (280) ในหลายแถว
    // — ลำดับเดิมที่ $body ใช้ทิ้ง caption เงียบ ๆ ทุกครั้งที่มีบทความ (20 จาก 34 แถว)
    //
    // trim() ก่อนเทียบ เพื่อไม่ให้ caption ที่มีแต่ช่องว่างชนะ HTML ที่มีเนื้อหาจริง
    // caption ที่ถูกเลือกไม่ผ่านตัวแปลงเลย — ผู้ใช้พิมพ์อะไรได้อย่างนั้น รวมถึงเส้น
    // channel_overrides ที่ api/content-publish.php:179 ซึ่งตั้ง caption เป็นข้อความที่ผู้ใช้พิมพ์
    //
    // platform-post-text: โซเชียลใช้ publish_social_post_text() จุดเดียว — หัวข้อ = content_items.title
    // (ช่อง "หัวข้อ" ในฟอร์ม) และข้อความ = override ของคิวเดิม → scripts[platform] → caption → บทความ
    // เว็บ/CMS ด้านล่างยังใช้ $title/$body เดิม (ชื่อบทความ + HTML)
    $socialPost  = publish_social_post_text($content, $platform);
    $socialTitle = $socialPost['title'];
    $socialBody  = $socialPost['body'];

    // ฟิลด์ SEO/AEO สำหรับ Lotus Domino — อ่านจาก article_content JSON ก่อน แล้ว fallback ไปคอลัมน์ content_items
    // (ลำดับ fallback ตรงกับ inline handler เดิมใน brand-content.php)
    $seo = [
        'date'             => $content['scheduled_at'] ?? $content['scheduled_date'] ?? '',
        'slug'             => $art['slug']             ?? $content['slug']             ?? '',
        'seo_title'        => $art['seo_title']        ?? $content['seo_title']        ?? $title,
        'meta_description' => $art['meta_description'] ?? $content['meta_description'] ?? $excerpt,
        'tags'             => is_array($art['hashtags'] ?? null)
            ? implode(',', array_map(fn($t) => ltrim($t, '#'), $art['hashtags']))
            : ($art['meta_keywords'] ?? $content['meta_keywords'] ?? ''),
    ];

    return match($platform) {
        // โซเชียล → $socialBody (ข้อความล้วน)
        'facebook'  => dispatch_facebook($channel, $creds, $socialTitle, $socialBody, $imgUrl, $videoUrl),
        'instagram' => dispatch_instagram($channel, $creds, $socialTitle, $socialBody, $imgUrl),
        'tiktok'    => dispatch_tiktok($channel, $creds, $socialTitle, $socialBody),
        'lineoa'    => dispatch_lineoa($channel, $creds, $socialTitle, $socialBody),
        'linkedin'  => dispatch_linkedin($channel, $creds, $socialTitle, $socialBody, $imgUrl),
        'twitter'   => dispatch_twitter($channel, $creds, $socialTitle, $socialBody),
        // เว็บ/CMS → $body (HTML เดิม) เพราะปลายทางเรนเดอร์ HTML เป็นบทความ
        'wordpress' => dispatch_wordpress($channel, $creds, $title, $body, $excerpt),
        'wix'       => dispatch_wix($channel, $creds, $title, $body),
        'lotusdomino' => dispatch_lotusdomino($channel, $creds, $title, $body, $excerpt, $imgUrl, $seo),
        'custom'    => dispatch_custom($channel, $creds, $title, $body, $excerpt, $imgUrl),
        default     => ['success' => false, 'error' => "Unknown platform: $platform"],
    };
}

/**
 * สกัดข้อมูลอ้างอิงโพสต์ (platform_post_id / published_url) จากผลลัพธ์ dispatch_content()
 * ใช้ร่วมกันโดย send_now (content-publish.php) และ cron scheduler (publish-scheduler.php)
 * เป็น additive — ไม่เปลี่ยนพฤติกรรม dispatch_* เดิม
 *
 * platform_post_id : แต่ละ dispatch_* ตั้ง $result['platform_post_id'] ไว้แล้วเมื่อสำเร็จ
 * published_url    : อ่าน $result['published_url'] ก่อน — dispatch_* ที่หา URL โพสต์ได้เอง
 *                    (facebook ยิง permalink lookup) จะตั้งคีย์นี้ไว้ให้
 *                    ถ้าไม่มี ค่อย fallback ไป WordPress ที่คืน URL ใน data.link
 *                    platform อื่นที่ยังไม่มี URL ที่เชื่อถือได้ → null
 *
 * @return array{platform_post_id: ?string, published_url: ?string}
 */
function extract_publish_meta(array $result, string $platform, array $channel): array {
    $postId = (isset($result['platform_post_id']) && $result['platform_post_id'] !== '')
        ? (string) $result['platform_post_id']
        : null;

    $url = null;
    if (isset($result['published_url']) && $result['published_url'] !== '') {
        $url = (string) $result['published_url'];
    } elseif ($platform === 'wordpress' && !empty($result['data']['link'])) {
        $url = (string) $result['data']['link'];
    }

    return ['platform_post_id' => $postId, 'published_url' => $url];
}

/**
 * สกัดเนื้อ response ที่ปลายทางตอบกลับ เพื่อเก็บลง content_publish_queue.response_snippet
 * ใช้ร่วมกันโดย send_now (content-publish.php) และ cron scheduler (publish-scheduler.php)
 *
 * ตอบคำถาม "ปลายทางพูดว่าอะไร" ซึ่งต่างจาก error_msg ที่ตอบว่า "ทำไมถือว่าล้มเหลว"
 * - สำเร็จ  : $result['data']      (payload ที่ decode แล้ว)
 * - ล้มเหลว : $result['response']  (payload ที่ decode แล้ว ตอน HTTP >= 400)
 * - ไม่มี response เลย (cURL error / ยังไม่ได้ยิงเพราะ config ขาด) → ระบุไว้ตรง ๆ พร้อม error
 *
 * ตัดที่ 2000 ตัวอักษรด้วย mb_substr เพื่อไม่ให้ตัดกลางอักขระไทย
 */
function extract_response_snippet(array $result): string {
    $payload = $result['data'] ?? $result['response'] ?? null;
    if ($payload === null) {
        $raw = '(no response body) ' . ($result['error'] ?? '');
    } elseif (is_string($payload)) {
        $raw = $payload;
    } else {
        $raw = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    return mb_substr((string) $raw, 0, 2000);
}

/**
 * Central publish executor used by all legacy entry points that still expose
 * direct publish/schedule actions. It owns the final gate, duplicate guard,
 * dispatch, history persistence, and content publish-status synchronization.
 *
 * The caller supplies a canonical content_items row and an active channel.
 * No platform-specific HTTP call belongs outside dispatch_content().
 */
function publish_via_central_flow(
    PDO $db,
    string $tenantId,
    array $content,
    array $channel,
    string $userId = '',
    ?string $scheduleId = null,
    ?string $contentOverride = null
): array {
    $contentId = (string)($content['id'] ?? '');
    $platform = strtolower(trim((string)($channel['platform'] ?? '')));
    if ($contentId === '' || $platform === '') {
        return ['success' => false, 'status' => 'blocked', 'error' => 'Content/channel ไม่ถูกต้อง'];
    }
    if (($content['status'] ?? '') !== 'approved' || empty($content['approved_at'])) {
        return ['success' => false, 'status' => 'blocked', 'error' => 'คอนเทนต์นี้ยังไม่ผ่านการอนุมัติ'];
    }
    if (!(int)($channel['is_active'] ?? 0)) {
        return ['success' => false, 'status' => 'blocked', 'error' => 'Channel นี้ถูกปิดใช้งาน'];
    }

    $gate = final_publish_gate_check($db, $tenantId, $content, $platform);
    if (!empty($gate['blocked'])) {
        return ['success' => false, 'status' => 'blocked', 'error' => $gate['reason'] ?? 'ไม่ผ่าน Final Publish Gate'];
    }
    // บทวิดีโอปนในข้อความโพสต์โซเชียล → ไม่โพสต์ (platform-post-text)
    if (in_array($platform, SOCIAL_POST_PLATFORMS, true)) {
        $screenplay = publish_screenplay_check(publish_social_final_text(publish_social_post_text($content, $platform)), $platform);
        if ($screenplay !== null) {
            return ['success' => false, 'status' => 'blocked', 'error' => $screenplay];
        }
    }

    $published = get_published_content_platforms($db, $tenantId, $contentId);
    if (in_array($platform, $published, true)) {
        return ['success' => false, 'status' => 'skipped', 'error' => "แพลตฟอร์ม {$platform} ของคอนเทนต์นี้เผยแพร่แล้ว"];
    }
    $pending = $db->prepare(
        "SELECT COUNT(*) FROM content_publish_queue q
         JOIN publish_channels pc ON pc.id=q.channel_id
         WHERE q.tenant_id=? AND q.content_id=? AND LOWER(pc.platform)=? AND q.status IN ('pending','processing')"
    );
    $pending->execute([$tenantId, $contentId, $platform]);
    if ((int)$pending->fetchColumn() > 0) {
        return ['success' => false, 'status' => 'skipped', 'error' => "แพลตฟอร์ม {$platform} มีรายการเผยแพร่ที่กำลังดำเนินการอยู่แล้ว"];
    }

    $lockName = 'sp:' . md5($contentId . ':' . $platform);
    $lock = $db->prepare('SELECT GET_LOCK(?, 5) AS got');
    $lock->execute([$lockName]);
    if ((int)($lock->fetchColumn() ?: 0) !== 1) {
        return ['success' => false, 'status' => 'skipped', 'error' => "มีคำขอเผยแพร่ {$platform} ของคอนเทนต์นี้กำลังทำงานอยู่"];
    }

    try {
        // Re-check after acquiring the platform lock so concurrent callers cannot race.
        if (in_array($platform, get_published_content_platforms($db, $tenantId, $contentId), true)) {
            return ['success' => false, 'status' => 'skipped', 'error' => "แพลตฟอร์ม {$platform} ของคอนเทนต์นี้เผยแพร่แล้ว"];
        }

        // platform-post-text: เลิกรับข้อความแทนที่จากคำขอ (content-publish send_now / brand-content publish)
        // — ข้อความที่โพสต์ต้องเป็นข้อความที่ผ่านการอนุมัติใน ContentCardDialog เท่านั้น
        // พารามิเตอร์ $contentOverride คงไว้เพื่อไม่เปลี่ยน signature ของผู้เรียกเดิม (client เก่ายังส่งมาได้ไม่ error)
        if ($contentOverride !== null && trim($contentOverride) !== '') {
            error_log('[publish] ignored content_override from request | content=' . $contentId . ' | platform=' . $platform);
        }
        $contentForChannel = $content;

        $queueId = generateUUID();
        $db->prepare(
            "INSERT INTO content_publish_queue (id,tenant_id,content_id,channel_id,scheduled_at,status)
             VALUES (?,?,?,?,NOW(),'processing')"
        )->execute([$queueId, $tenantId, $contentId, $channel['id']]);

        $result = dispatch_content($platform, $channel, $contentForChannel);
        $snippet = extract_response_snippet($result);
        if (!empty($result['success'])) {
            $meta = extract_publish_meta($result, $platform, $channel);
            $db->prepare(
                "UPDATE content_publish_queue SET status='sent', sent_at=NOW(), platform_post_id=?, published_url=?, response_snippet=? WHERE id=?"
            )->execute([$meta['platform_post_id'], $meta['published_url'], $snippet, $queueId]);
            $db->prepare(
                "UPDATE content_items SET published_url=COALESCE(?, published_url), external_post_id=COALESCE(?, external_post_id), updated_at=NOW() WHERE id=? AND tenant_id=?"
            )->execute([$meta['published_url'], $meta['platform_post_id'], $contentId, $tenantId]);
            sync_content_publish_status($db, $tenantId, $content);

            if ($scheduleId !== null && $scheduleId !== '') {
                $db->prepare(
                    "UPDATE content_schedules SET status='sent', publish_result=?, platform_post_id=?, published_url=?, updated_at=NOW() WHERE id=?"
                )->execute([json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $meta['platform_post_id'], $meta['published_url'], $scheduleId]);
            }
            return ['success' => true, 'status' => 'success', 'result' => $result, 'queue_id' => $queueId];
        }

        $error = mb_substr((string)($result['error'] ?? 'dispatch failed'), 0, 500);
        $db->prepare(
            "UPDATE content_publish_queue SET status='failed', error_msg=?, response_snippet=? WHERE id=?"
        )->execute([$error, $snippet, $queueId]);
        if ($scheduleId !== null && $scheduleId !== '') {
            $db->prepare(
                "UPDATE content_schedules SET status='failed', publish_result=?, updated_at=NOW() WHERE id=?"
            )->execute([json_encode(['error' => $error], JSON_UNESCAPED_UNICODE), $scheduleId]);
        }
        return ['success' => false, 'status' => 'failed', 'error' => $error, 'result' => $result, 'queue_id' => $queueId];
    } finally {
        $db->prepare('SELECT RELEASE_LOCK(?)')->execute([$lockName]);
    }
}

// ─── cURL helper ────────────────────────────────────────────────────────────────

function _dispatch_post(string $url, array $options = [], int $timeoutSeconds = 30): array {
    $ch = curl_init($url);
    $defaults = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_TIMEOUT        => $timeoutSeconds,
    ];
    curl_setopt_array($ch, $options + $defaults);
    $res    = curl_exec($ch);
    $err    = curl_error($ch);
    $code   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($err) {
        return ['success' => false, 'error' => "cURL error: $err"];
    }
    // 2000 = เพดานเดียวกับ response_snippet — ปลายทางที่ตอบ HTML/text (เช่น Domino agent)
    // จะถูกเก็บไว้ให้ตรวจย้อนหลังได้ ไม่ถูกตัดเหลือ 500 ก่อนถึงผู้เรียก
    $data = json_decode($res, true) ?: ['raw' => mb_substr((string) $res, 0, 2000)];
    if ($code >= 400) {
        $msg = $data['error']['message'] ?? $data['message'] ?? $data['error'] ?? "HTTP $code";
        if (is_array($msg)) $msg = json_encode($msg);
        return ['success' => false, 'error' => $msg, 'http_code' => $code, 'response' => $data];
    }
    return ['success' => true, 'data' => $data];
}

/**
 * GET helper — โครงเดียวกับ _dispatch_post แต่ไม่ตั้ง CURLOPT_POST
 *
 * ใช้สำหรับ lookup ข้อมูลโพสต์หลังเผยแพร่สำเร็จ (เช่น permalink_url ของ facebook)
 * ผู้เรียกต้องถือว่าผลลัพธ์เป็น "ข้อมูลเสริม" — ล้มเหลวได้โดยไม่ทำให้การเผยแพร่ล้มเหลว
 */
function _dispatch_get(string $url): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
    ]);
    $res  = curl_exec($ch);
    $err  = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($err) {
        return ['success' => false, 'error' => "cURL error: $err"];
    }
    $data = json_decode((string) $res, true) ?: ['raw' => mb_substr((string) $res, 0, 2000)];
    if ($code >= 400) {
        $msg = $data['error']['message'] ?? $data['message'] ?? $data['error'] ?? "HTTP $code";
        if (is_array($msg)) $msg = json_encode($msg);
        return ['success' => false, 'error' => $msg, 'http_code' => $code, 'response' => $data];
    }
    return ['success' => true, 'data' => $data];
}

// ─── Local upload resolver ──────────────────────────────────────────────────────

/**
 * แปลงค่า path ที่เก็บในคอลัมน์ DB (เช่น generated_image_url, video_url) ให้เป็นไฟล์จริงบนดิสก์
 * เพื่ออัปโหลดขึ้น platform — ใช้ร่วมกันโดย resolve_local_image() และ resolve_local_video()
 *
 * ทำไมต้องมีขั้นนี้: path ที่ระบบผลิตเองเป็น path เทียบ document root
 * (`/uploads/content/...` — ดู brand-content.php) ไม่ใช่ URL ที่เข้าถึงได้จากอินเทอร์เน็ต
 * และโปรเจกต์ไม่มีคีย์ config ที่บอก public base URL จึงส่งค่านี้ให้ platform
 * ไปดึงไฟล์เองไม่ได้ ต้องอ่านไฟล์แล้วอัปโหลด bytes ขึ้นไป
 *
 * ค่า $path มาจากคอลัมน์ในฐานข้อมูล — ไม่ถือเป็น path ที่เชื่อถือได้โดยปริยาย
 * จึง resolve ด้วย realpath() แล้วบังคับให้ผลลัพธ์อยู่ใต้ uploads/ เท่านั้น
 * เพื่อไม่ให้ `../` ไต่ไปหยิบ .env หรือ api/config.php ขึ้นไปโพสต์บนเพจสาธารณะ
 *
 * @param array<string,string> $mimeByExt นามสกุล (ตัวพิมพ์เล็ก ไม่มีจุด) => MIME type
 * @return array{ok: bool, path?: string, mime?: string, error?: string}
 */
function resolve_local_upload(string $path, array $mimeByExt): array {
    $path = trim($path);
    if ($path === '') {
        return ['ok' => false, 'error' => 'ไม่ได้ระบุ path ของไฟล์'];
    }

    // ไฟล์นี้อยู่ที่ api/lib/ — ย้อนขึ้น 2 ระดับได้ project root ซึ่งเป็น document root ด้วย
    $projectRoot = realpath(__DIR__ . '/../..');
    $uploadsRoot = $projectRoot !== false ? realpath($projectRoot . DIRECTORY_SEPARATOR . 'uploads') : false;
    if ($uploadsRoot === false) {
        return ['ok' => false, 'error' => 'หาไดเรกทอรี uploads ของโปรเจกต์ไม่พบ'];
    }

    // ตัด query string / fragment ที่อาจติดมากับค่าในคอลัมน์ก่อนแปลงเป็น path บนดิสก์
    $relative = parse_url($path, PHP_URL_PATH);
    if ($relative === false || $relative === null || $relative === '') {
        return ['ok' => false, 'error' => "path ของไฟล์อ่านไม่ออก: $path"];
    }
    $candidate = $projectRoot . DIRECTORY_SEPARATOR
        . ltrim(str_replace('/', DIRECTORY_SEPARATOR, $relative), DIRECTORY_SEPARATOR);

    $real = realpath($candidate);
    if ($real === false) {
        return ['ok' => false, 'error' => "ไม่พบไฟล์ที่ระบุไว้: $path (มองหาที่ $candidate)"];
    }

    // เทียบ path ที่ normalize แล้วทั้งสองฝั่ง — ทั้งคู่ผ่าน realpath() จึงใช้ separator
    // และรูปแบบเดียวกัน ไม่ใช่สตริงดิบเทียบสตริงดิบ
    // Windows: ระบบไฟล์ไม่สนตัวพิมพ์ จึงต้องเทียบแบบไม่สนตัวพิมพ์ ไม่งั้น C:\ vs c:\ จะไม่ตรง
    // Linux: เทียบตรงตัว เพื่อไม่ให้ไดเรกทอรีชื่อ UPLOADS หลุดผ่านขอบเขต
    $prefix = rtrim($uploadsRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
    $inScope = (DIRECTORY_SEPARATOR === '\\')
        ? strncasecmp($real, $prefix, strlen($prefix)) === 0
        : strncmp($real, $prefix, strlen($prefix)) === 0;
    if (!$inScope) {
        return ['ok' => false, 'error' => "ไฟล์อยู่นอกขอบเขตที่อนุญาต (ต้องอยู่ใต้ uploads/): $path"];
    }

    if (!is_file($real) || !is_readable($real)) {
        return ['ok' => false, 'error' => "ไฟล์อ่านไม่ได้: $real"];
    }

    // เดา MIME จากนามสกุล ไม่ใช้ mime_content_type() ซึ่งต้องการ extension fileinfo
    // ที่อาจไม่ได้เปิดไว้บน XAMPP บางเครื่อง
    $ext = strtolower(pathinfo($real, PATHINFO_EXTENSION));

    return [
        'ok'   => true,
        'path' => $real,
        'mime' => $mimeByExt[$ext] ?? 'application/octet-stream',
    ];
}

/** แปลงค่า generated_image_url ให้เป็นไฟล์รูปจริงบนดิสก์ — ดู resolve_local_upload() */
function resolve_local_image(string $imgUrl): array {
    return resolve_local_upload($imgUrl, [
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png'  => 'image/png',
        'gif'  => 'image/gif',
        'webp' => 'image/webp',
    ]);
}

/** แปลงค่า video_url ให้เป็นไฟล์วิดีโอจริงบนดิสก์ — ดู resolve_local_upload() */
function resolve_local_video(string $videoUrl): array {
    return resolve_local_upload($videoUrl, [
        'mp4'  => 'video/mp4',
        'mov'  => 'video/quicktime',
        'webm' => 'video/webm',
    ]);
}

// ─── Facebook ───────────────────────────────────────────────────────────────────
// Creds: { "page_id": "...", "access_token": "..." }

function dispatch_facebook(array $channel, array $creds, string $title, string $body, string $imgUrl = '', string $videoUrl = ''): array {
    $pageId = $creds['page_id'] ?? '';
    $token  = $creds['access_token'] ?? '';
    if (!$pageId || !$token) {
        return ['success' => false, 'error' => 'Missing page_id or access_token'];
    }
    $msg = $title ? "$title\n\n$body" : $body;
    $msg = mb_substr($msg, 0, 63206); // Facebook limit

    $apiBase  = "https://graph.facebook.com/v19.0/$pageId";
    $imgUrl   = trim($imgUrl);
    $videoUrl = trim($videoUrl);
    $isVideo  = false;

    if ($videoUrl !== '') {
        // เช็คก่อนรูป/ข้อความเสมอ — คอนเทนต์วิดีโอต้องไม่ตกไป branch รูป/ข้อความโดยไม่ตั้งใจ
        $video = resolve_local_video($videoUrl);
        if (!$video['ok']) {
            // เหมือนรูป: ไม่ถอยไปโพสต์ข้อความเปล่า ตั้งใจให้ล้มเหลวชัดเจน
            return ['success' => false, 'error' => 'ส่งวิดีโอไป Facebook ไม่ได้ — ' . $video['error']];
        }
        $isVideo = true;
        // /videos ใช้ description ไม่ใช่ message เหมือน /feed และ /photos
        // timeout 120s (ไม่ใช่ 30s เดิม) — ไฟล์วิดีโอใหญ่กว่ารูปมาก อัปโหลดใช้เวลานานกว่า
        $result = _dispatch_post("$apiBase/videos", [
            CURLOPT_POST       => true,
            CURLOPT_POSTFIELDS => [
                'description'  => $msg,
                'access_token' => $token,
                'source'       => new CURLFile($video['path'], $video['mime'], basename($video['path'])),
            ],
        ], 120);
    } elseif ($imgUrl === '') {
        // ไม่มีรูป → /feed ตามพฤติกรรมเดิมทุกอย่าง (โพสต์ข้อความเปล่าไม่ใช่ความล้มเหลว)
        $result = _dispatch_post("$apiBase/feed", [
            CURLOPT_POSTFIELDS => http_build_query(['message' => $msg, 'access_token' => $token]),
        ]);
    } elseif (preg_match('#^https?://#i', $imgUrl)) {
        // absolute URL → ให้ Graph API ไปดึงรูปเอง
        // ยังไม่มีข้อมูลรูปแบบนี้ในฐานข้อมูล แต่แยกแขนงไว้เพื่อไม่ให้ไปเปิดไฟล์ชื่อ "https:/..." บนดิสก์
        $result = _dispatch_post("$apiBase/photos", [
            CURLOPT_POSTFIELDS => http_build_query([
                'message'      => $msg,
                'url'          => $imgUrl,
                'access_token' => $token,
            ]),
        ]);
    } else {
        $img = resolve_local_image($imgUrl);
        if (!$img['ok']) {
            // ตั้งใจให้ล้มเหลว ไม่ถอยไปโพสต์ข้อความเปล่าผ่าน /feed
            // การถอยเงียบจะได้โพสต์ที่ต่างจากที่ผู้ใช้อนุมัติไว้ โดยที่ผู้ใช้ไม่รู้ว่ารูปหายไป
            // ซึ่งคืออาการเดิมที่การแก้ครั้งนี้กำลังซ่อม
            return ['success' => false, 'error' => 'ส่งรูปไป Facebook ไม่ได้ — ' . $img['error']];
        }
        // /photos รับรูปเป็น multipart ในคำขอเดียวกับข้อความ ไม่ต้องมี public URL
        //
        // CURLOPT_POST ต้องตั้งที่นี่ให้มาก่อน CURLOPT_POSTFIELDS: _dispatch_post()
        // รวม option ด้วย `$options + $defaults` ซึ่งเรียง key ของ $options ไว้หน้า
        // ถ้าปล่อยให้ CURLOPT_POST มาจาก $defaults มันจะถูก setopt หลัง POSTFIELDS
        // แล้วรีเซ็ต mime post ที่ PHP สร้างไว้ กลับเป็น urlencoded — รูปจะไม่ถูกส่ง
        //
        // POSTFIELDS ต้องเป็น array ดิบ ห้ามผ่าน http_build_query() ไม่งั้น CURLFile
        // จะกลายเป็นข้อความ
        $result = _dispatch_post("$apiBase/photos", [
            CURLOPT_POST       => true,
            CURLOPT_POSTFIELDS => [
                'message'      => $msg,
                'access_token' => $token,
                'source'       => new CURLFile($img['path'], $img['mime'], basename($img['path'])),
            ],
        ]);
    }

    if ($result['success']) {
        if ($isVideo) {
            // /videos ไม่คืน post_id แบบผสมเหมือน /photos — id ที่ได้คือ video id ตรงๆ ใช้ได้ทันที
            $result['platform_post_id'] = $result['data']['id'] ?? null;
        } else {
            // อ่าน post_id ก่อน id — /photos คืน id เป็น photo id เปล่า ซึ่งใช้ทั้ง permalink
            // lookup และ /insights ไม่ได้ ส่วน post_id เป็นรูปแบบผสม {page_id}_{post_id}
            // ตัวเดียวกับที่ /feed คืนมาใน id (ยืนยันจาก content_publish_queue.response_snippet)
            // api/lib/insights-fetch.php พึ่งค่านี้เป็นคีย์ดึง engagement — ถ้าเก็บ photo id ไว้
            // การซิงก์จะเงียบหายไปทั้งที่โพสต์สำเร็จ
            $result['platform_post_id'] = $result['data']['post_id'] ?? $result['data']['id'] ?? null;
        }
        // ดึงลิงก์โพสต์ — endpoint /{pageId}/feed คืนแค่ id ไม่มี URL จึงต้อง GET เพิ่มอีกครั้ง
        //
        // Non-blocking โดยเจตนา: โพสต์ถูกสร้างที่ปลายทางไปแล้ว ถ้า lookup ล้มเหลว
        // (token หมดอายุ / ไม่มีสิทธิ์ pages_read_engagement) ต้องคง success=true ไว้
        // แล้วปล่อย published_url เป็น null — การรายงานว่า "ล้มเหลว" จะทำให้ผู้ใช้กดส่งซ้ำ
        if ($result['platform_post_id']) {
            $lookup = _dispatch_get(
                'https://graph.facebook.com/v19.0/' . rawurlencode((string) $result['platform_post_id'])
                . '?fields=permalink_url&access_token=' . urlencode($token)
            );
            if ($lookup['success'] && !empty($lookup['data']['permalink_url'])) {
                $permalink = (string) $lookup['data']['permalink_url'];
                // ยืนยันจากการโพสต์วิดีโอจริง: permalink_url ของโพสต์วิดีโอ/Reel กลับมาเป็น
                // path สัมพัทธ์ (เช่น "/reel/{id}/") ต่างจากโพสต์รูป/ข้อความที่ได้ URL เต็มเสมอ
                // — เก็บ path สัมพัทธ์ตรงๆ ตอนหน้าเว็บเอาไปเป็น href จะพาไปที่โดเมนของแอปเราแทน
                $result['published_url'] = str_starts_with($permalink, '/')
                    ? 'https://www.facebook.com' . $permalink
                    : $permalink;
            }
        }
    }
    return $result;
}

// ─── Instagram ──────────────────────────────────────────────────────────────────
// Creds: { "ig_user_id": "...", "access_token": "..." }
// Two-step: 1) create media container  2) publish

function dispatch_instagram(array $channel, array $creds, string $title, string $body, string $imgUrl): array {
    $igUserId = $creds['ig_user_id'] ?? '';
    $token    = $creds['access_token'] ?? '';
    if (!$igUserId || !$token) {
        return ['success' => false, 'error' => 'Missing ig_user_id or access_token'];
    }
    $caption = $title ? "$title\n\n$body" : $body;
    $caption = mb_substr($caption, 0, 2200);

    $apiBase = "https://graph.facebook.com/v19.0/$igUserId";

    // Step 1: Create media container
    $containerParams = [
        'caption'      => $caption,
        'access_token' => $token,
    ];
    if ($imgUrl) {
        $containerParams['image_url'] = $imgUrl;
    } else {
        // Text-only not supported for single-media; require image
        return ['success' => false, 'error' => 'Instagram posts require an image (generated_image_url is empty)'];
    }

    $createResult = _dispatch_post("$apiBase/media", [
        CURLOPT_POSTFIELDS => http_build_query($containerParams),
    ]);
    if (!$createResult['success']) {
        return $createResult;
    }
    $creationId = $createResult['data']['id'] ?? '';
    if (!$creationId) {
        return ['success' => false, 'error' => 'No creation_id returned from Instagram media container'];
    }

    // Step 2: Publish
    $publishResult = _dispatch_post("$apiBase/media_publish", [
        CURLOPT_POSTFIELDS => http_build_query(['creation_id' => $creationId, 'access_token' => $token]),
    ]);
    if ($publishResult['success']) {
        $publishResult['platform_post_id'] = $publishResult['data']['id'] ?? null;
    }
    return $publishResult;
}

// ─── TikTok ─────────────────────────────────────────────────────────────────────
// Creds: { "access_token": "..." }
// TikTok Content Posting API — Direct Post (simplified flow)

function dispatch_tiktok(array $channel, array $creds, string $title, string $body): array {
    $token = $creds['access_token'] ?? '';
    if (!$token) {
        return ['success' => false, 'error' => 'Missing TikTok access_token'];
    }
    $text = $title ? "$title\n\n$body" : $body;
    // TikTok caption limit ~2200 chars
    $text = mb_substr($text, 0, 2200);

    // TikTok Content Posting API v2 — Direct Post
    // POST https://open.tiktokapis.com/v2/post/publish/content/init/
    $result = _dispatch_post('https://open.tiktokapis.com/v2/post/publish/content/init/', [
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            "Authorization: Bearer $token",
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'post_info' => [
                'title'             => $title ?: mb_substr($text, 0, 100),
                'description'       => $text,
                'privacy_setting'   => 'PUBLIC',
                'disable_comment'   => false,
                'disable_duet'      => false,
                'disable_stitch'    => false,
            ],
            'source_info' => [
                'source' => 'PULL_FROM_URL',
            ],
        ]),
    ]);
    if ($result['success']) {
        $result['platform_post_id'] = $result['data']['data']['publish_id'] ?? null;
    }
    return $result;
}

// ─── LINE Official Account ──────────────────────────────────────────────────────
// Creds: { "channel_access_token": "..." }
// Sends a broadcast text message to all followers

function dispatch_lineoa(array $channel, array $creds, string $title, string $body): array {
    $token = $creds['channel_access_token'] ?? '';
    if (!$token) {
        return ['success' => false, 'error' => 'Missing LINE channel_access_token'];
    }
    $msg = $title ? "$title\n\n$body" : $body;
    $msg = mb_substr($msg, 0, 5000); // LINE text limit

    $result = _dispatch_post('https://api.line.me/v2/bot/message/broadcast', [
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            "Authorization: Bearer $token",
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'messages' => [['type' => 'text', 'text' => $msg]],
        ]),
    ]);
    // LINE broadcast returns {} on success (no post ID)
    if ($result['success']) {
        $result['platform_post_id'] = 'broadcast_' . time();
    }
    return $result;
}

// ─── LinkedIn ───────────────────────────────────────────────────────────────────
// Creds: { "access_token": "...", "person_urn": "urn:li:person:..." }
// Uses LinkedIn Share API (UGC Posts)

function dispatch_linkedin(array $channel, array $creds, string $title, string $body, string $imgUrl): array {
    $token = $creds['access_token'] ?? '';
    $urn   = $creds['person_urn']   ?? $creds['organization_urn'] ?? '';
    if (!$token || !$urn) {
        return ['success' => false, 'error' => 'Missing LinkedIn access_token or person_urn/organization_urn'];
    }
    $text = $title ? "$title\n\n$body" : $body;

    $shareBody = [
        'author'          => $urn,
        'lifecycleState'  => 'PUBLISHED',
        'specificContent' => [
            'com.linkedin.ugc.ShareContent' => [
                'shareCommentary' => ['text' => mb_substr($text, 0, 3000)],
                'shareMediaCategory' => 'NONE',
            ],
        ],
        'visibility' => ['com.linkedin.ugc.MemberNetworkVisibility' => 'PUBLIC'],
    ];

    // If image URL provided, add as article thumbnail
    if ($imgUrl) {
        $shareBody['specificContent']['com.linkedin.ugc.ShareContent']['shareMediaCategory'] = 'ARTICLE';
        $shareBody['specificContent']['com.linkedin.ugc.ShareContent']['media'] = [[
            'status'      => 'READY',
            'originalUrl' => $imgUrl,
        ]];
    }

    $result = _dispatch_post('https://api.linkedin.com/v2/ugcPosts', [
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            "Authorization: Bearer $token",
            'X-Restli-Protocol-Version: 2.0.0',
            'LinkedIn-Version: 202405',
        ],
        CURLOPT_POSTFIELDS => json_encode($shareBody),
    ]);
    if ($result['success']) {
        $result['platform_post_id'] = $result['data']['id'] ?? null;
    }
    return $result;
}

// ─── Twitter / X ────────────────────────────────────────────────────────────────
// Creds: { "api_key": "...", "api_key_secret": "...",
//           "access_token": "...", "access_token_secret": "..." }
// Twitter API v2 with OAuth 1.0a

function dispatch_twitter(array $channel, array $creds, string $title, string $body): array {
    $apiKey       = $creds['api_key']       ?? '';
    $apiSecret    = $creds['api_key_secret'] ?? '';
    $accessToken  = $creds['access_token']  ?? '';
    $accessSecret = $creds['access_token_secret'] ?? '';
    if (!$apiKey || !$apiSecret || !$accessToken || !$accessSecret) {
        return ['success' => false, 'error' => 'Missing Twitter OAuth credentials (api_key, api_key_secret, access_token, access_token_secret)'];
    }
    $text = $title ? "$title\n\n$body" : $body;
    $text = mb_substr($text, 0, 280);

    // OAuth 1.0a signature
    $method  = 'POST';
    $url     = 'https://api.twitter.com/2/tweets';
    $nonce   = bin2hex(random_bytes(16));
    $ts      = (string) time();
    $params  = [
        'oauth_consumer_key'     => $apiKey,
        'oauth_nonce'            => $nonce,
        'oauth_signature_method' => 'HMAC-SHA1',
        'oauth_timestamp'        => $ts,
        'oauth_token'            => $accessToken,
        'oauth_version'          => '1.0',
    ];
    // Build signature base string
    ksort($params);
    $paramStr = http_build_query($params, '', '&', PHP_QUERY_RFC3986);
    $baseStr  = strtoupper($method) . '&' . rawurlencode($url) . '&' . rawurlencode($paramStr);
    $signKey  = rawurlencode($apiSecret) . '&' . rawurlencode($accessSecret);
    $signature = base64_encode(hash_hmac('sha1', $baseStr, $signKey, true));
    $params['oauth_signature'] = $signature;

    // Build OAuth header
    $headerParts = [];
    foreach ($params as $k => $v) {
        $headerParts[] = rawurlencode($k) . '="' . rawurlencode($v) . '"';
    }
    $authHeader = 'OAuth ' . implode(', ', $headerParts);

    $result = _dispatch_post($url, [
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            "Authorization: $authHeader",
        ],
        CURLOPT_POSTFIELDS => json_encode(['text' => $text]),
    ]);
    if ($result['success']) {
        $result['platform_post_id'] = $result['data']['data']['id'] ?? null;
    }
    return $result;
}

// ─── WordPress ──────────────────────────────────────────────────────────────────
// Creds: { "username": "...", "app_password": "..." }
// Channel.endpoint_url = site root URL

function dispatch_wordpress(array $channel, array $creds, string $title, string $body, string $excerpt): array {
    $wpUrl  = rtrim($channel['endpoint_url'] ?? '', '/');
    $wpUser = $creds['username']     ?? '';
    $wpPass = $creds['app_password'] ?? '';
    if (!$wpUrl || !$wpUser || !$wpPass) {
        return ['success' => false, 'error' => 'Missing WordPress endpoint_url, username, or app_password'];
    }
    $auth = base64_encode("$wpUser:$wpPass");

    $postData = [
        'title'   => $title,
        'content' => $body,
        'status'  => 'publish',
    ];
    if ($excerpt) {
        $postData['excerpt'] = $excerpt;
    }

    $result = _dispatch_post("$wpUrl/wp-json/wp/v2/posts", [
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            "Authorization: Basic $auth",
        ],
        CURLOPT_POSTFIELDS => json_encode($postData),
    ]);
    if ($result['success']) {
        $result['platform_post_id'] = (string) ($result['data']['id'] ?? null);
    }
    return $result;
}

// ─── Wix ────────────────────────────────────────────────────────────────────────
// Creds: { "api_key": "...", "site_id": "..." }

function dispatch_wix(array $channel, array $creds, string $title, string $body): array {
    $apiKey = $creds['api_key'] ?? '';
    $siteId = $creds['site_id'] ?? '';
    if (!$apiKey || !$siteId) {
        return ['success' => false, 'error' => 'Missing Wix api_key or site_id'];
    }
    // Build Wix rich content from body (strip tags → plain text nodes)
    $cleanBody = strip_tags($body);

    $result = _dispatch_post('https://www.wixapis.com/blog/v3/posts', [
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            "Authorization: $apiKey",
            "wix-site-id: $siteId",
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'post' => [
                'title'        => $title,
                'richContent'  => [
                    'nodes' => [
                        ['type' => 'PARAGRAPH', 'nodes' => [
                            ['type' => 'TEXT', 'textData' => ['text' => $cleanBody]],
                        ]],
                    ],
                ],
                'memberId'     => '',
                'publish'      => true,
            ],
        ]),
    ]);
    if ($result['success']) {
        $result['platform_post_id'] = $result['data']['post']['id'] ?? null;
    }
    return $result;
}

// ─── Lotus Domino ───────────────────────────────────────────────────────────────
// Creds: ไม่ใช้ (Domino agent endpoint เปิดรับ POST โดยไม่ต้อง auth)
// Channel.endpoint_url = Domino agent URL (เช่น .../transform.nsf/ParseJSONString)
// สกัดจาก inline handler เดิมใน api/brand-content.php (?action=publish)
// เพื่อให้ cron queue และ send_now เผยแพร่ผ่าน dispatch_content() ได้
//
// $seo: ['date','slug','seo_title','meta_description','tags'] — optional ทุก key

function dispatch_lotusdomino(array $channel, array $creds, string $title, string $body, string $excerpt, string $imgUrl, array $seo = []): array {
    $url = $channel['endpoint_url'] ?? '';
    if (!$url) {
        return ['success' => false, 'error' => 'Lotus Domino endpoint_url missing'];
    }

    // Domino agent รับ JSON array ของ document (1 element = 1 โพสต์)
    // Date: ลำดับความสำคัญเดิม — เวลาที่ตั้งไว้มาก่อน ถ้าไม่มีจึงใช้ "เดี๋ยวนี้"
    // ค่านี้กลายเป็นวันที่บทความบนเว็บไซต์ลูกค้าและเรียกคืนไม่ได้ จึงอ่านจากนาฬิกา
    // ฐานข้อมูลด้วย dbNow() (config.php) ไม่ใช่ date() ที่ขึ้นกับ date.timezone ของ runtime
    $payload = [[
        'Date'            => !empty($seo['date']) ? $seo['date'] : dbNow(),
        'Title'           => $title,
        'Body'            => $body,
        'Excerpt'         => $excerpt,
        'Slug'            => $seo['slug']             ?? '',
        'SEOTitle'        => $seo['seo_title']        ?? $title,
        'MetaDescription' => $seo['meta_description'] ?? $excerpt,
        'Tags'            => $seo['tags']             ?? '',
        'AttachPhoto'     => $imgUrl,
    ]];

    $result = _dispatch_post($url, [
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_SSL_VERIFYPEER => false,
    ]);

    // เดิม: ถ้า HTTP >= 400 จะพลิก success กลับเป็น true ("Domino เป็น black-box")
    // เลิกพฤติกรรมนั้น — ทำให้ status='sent' ไม่มีค่าเป็นหลักฐาน (เหตุการณ์ 19 ส.ค. 2026)
    // ตอนนี้: สำเร็จ = ไม่มี cURL error และ HTTP < 400 ตามที่ _dispatch_post() ตัดสิน
    if (!$result['success']) {
        // ใส่เลข HTTP status ลงในข้อความ error ให้วินิจฉัยได้จาก error_msg คอลัมน์เดียว
        // (กรณี cURL error ไม่มี http_code → ข้อความคงเดิมว่า "cURL error: ...")
        if (isset($result['http_code'])) {
            $result['error'] = "HTTP {$result['http_code']}: " . ($result['error'] ?? '');
        }
        return $result;
    }
    // Domino agent ไม่คืน document id → ใช้ค่าอ้างอิงเวลาโพสต์ (แบบเดียวกับ lineoa/custom)
    $result['platform_post_id'] = 'lotusdomino_' . time();
    return $result;
}

// ─── Custom Webhook ─────────────────────────────────────────────────────────────
// Creds (optional): { "headers": { "X-API-Key": "...", ... } }

function dispatch_custom(array $channel, array $creds, string $title, string $body, string $excerpt, string $imgUrl): array {
    $url = $channel['endpoint_url'] ?? '';
    if (!$url) {
        return ['success' => false, 'error' => 'endpoint_url not configured'];
    }
    $headers = ['Content-Type: application/json'];
    // Custom headers from credentials
    foreach (($creds['headers'] ?? []) as $k => $v) {
        $headers[] = "$k: $v";
    }

    $result = _dispatch_post($url, [
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => json_encode([
            'title'      => $title,
            'content'    => $body,
            'excerpt'    => $excerpt,
            'image_url'  => $imgUrl,
            'sent_at'    => date('c'),
        ]),
    ]);
    // Custom webhooks always succeed if HTTP call didn't error
    $result['success'] = true;
    $result['platform_post_id'] = 'custom_' . time();
    return $result;
}
