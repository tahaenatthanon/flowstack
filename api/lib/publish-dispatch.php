<?php
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
function publish_html_to_text(string $html, string $dupTitle = ''): string {
    if (trim($html) === '') {
        return '';
    }

    // ── ตัด <h1> ตัวแรกเมื่อข้อความข้างในซ้ำกับหัวเรื่องที่จะถูกเติม ──────────────
    // dispatcher โซเชียลทุกตัวประกอบข้อความเป็น "$title\n\n$body" ถ้าไม่ตัด หัวเรื่องจะขึ้นสองครั้งติดกัน
    // ตัดเฉพาะตัวแรกและเฉพาะเมื่อตรงเป๊ะ — <h1> ที่ไม่ซ้ำเป็นเนื้อหาที่ผู้ใช้อนุมัติมา ห้ามลบ
    // เทียบแบบ normalize ทั้งสองฝั่ง ไม่เทียบสตริงดิบ เพราะ <h1> มักมี attribute และ entity ข้างใน
    $dupTitle = trim($dupTitle);
    if ($dupTitle !== '' && preg_match('/<h1\b[^>]*>(.*?)<\/h1>/is', $html, $m)) {
        $h1Text = trim(html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        if ($h1Text === $dupTitle) {
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
    $excerpt = $art['excerpt'] ?? '';
    $imgUrl  = $content['generated_image_url'] ?? '';

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
    $socialBody = trim($content['caption'] ?? '') !== ''
        ? trim($content['caption'])
        : publish_html_to_text($art['html'] ?? '', $title);

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
        'facebook'  => dispatch_facebook($channel, $creds, $title, $socialBody, $imgUrl),
        'instagram' => dispatch_instagram($channel, $creds, $title, $socialBody, $imgUrl),
        'tiktok'    => dispatch_tiktok($channel, $creds, $title, $socialBody),
        'lineoa'    => dispatch_lineoa($channel, $creds, $title, $socialBody),
        'linkedin'  => dispatch_linkedin($channel, $creds, $title, $socialBody, $imgUrl),
        'twitter'   => dispatch_twitter($channel, $creds, $title, $socialBody),
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

// ─── cURL helper ────────────────────────────────────────────────────────────────

function _dispatch_post(string $url, array $options = []): array {
    $ch = curl_init($url);
    $defaults = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_TIMEOUT        => 30,
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

// ─── Local image resolver ───────────────────────────────────────────────────────

/**
 * แปลงค่า generated_image_url ให้เป็นไฟล์จริงบนดิสก์ เพื่ออัปโหลดขึ้น platform
 *
 * ทำไมต้องมีขั้นนี้: generated_image_url ที่ระบบผลิตเองเป็น path เทียบ document root
 * (`/uploads/content/...` — ดู brand-content.php) ไม่ใช่ URL ที่เข้าถึงได้จากอินเทอร์เน็ต
 * และโปรเจกต์ไม่มีคีย์ config ที่บอก public base URL จึงส่งค่านี้ให้ platform
 * ไปดึงรูปเองไม่ได้ ต้องอ่านไฟล์แล้วอัปโหลด bytes ขึ้นไป
 *
 * ค่า $imgUrl มาจากคอลัมน์ในฐานข้อมูล — ไม่ถือเป็น path ที่เชื่อถือได้โดยปริยาย
 * จึง resolve ด้วย realpath() แล้วบังคับให้ผลลัพธ์อยู่ใต้ uploads/ เท่านั้น
 * เพื่อไม่ให้ `../` ไต่ไปหยิบ .env หรือ api/config.php ขึ้นไปโพสต์บนเพจสาธารณะ
 *
 * @return array{ok: bool, path?: string, mime?: string, error?: string}
 */
function resolve_local_image(string $imgUrl): array {
    $imgUrl = trim($imgUrl);
    if ($imgUrl === '') {
        return ['ok' => false, 'error' => 'ไม่ได้ระบุ path ของรูป'];
    }

    // ไฟล์นี้อยู่ที่ api/lib/ — ย้อนขึ้น 2 ระดับได้ project root ซึ่งเป็น document root ด้วย
    $projectRoot = realpath(__DIR__ . '/../..');
    $uploadsRoot = $projectRoot !== false ? realpath($projectRoot . DIRECTORY_SEPARATOR . 'uploads') : false;
    if ($uploadsRoot === false) {
        return ['ok' => false, 'error' => 'หาไดเรกทอรี uploads ของโปรเจกต์ไม่พบ'];
    }

    // ตัด query string / fragment ที่อาจติดมากับค่าในคอลัมน์ก่อนแปลงเป็น path บนดิสก์
    $relative = parse_url($imgUrl, PHP_URL_PATH);
    if ($relative === false || $relative === null || $relative === '') {
        return ['ok' => false, 'error' => "path ของรูปอ่านไม่ออก: $imgUrl"];
    }
    $candidate = $projectRoot . DIRECTORY_SEPARATOR
        . ltrim(str_replace('/', DIRECTORY_SEPARATOR, $relative), DIRECTORY_SEPARATOR);

    $real = realpath($candidate);
    if ($real === false) {
        return ['ok' => false, 'error' => "ไม่พบไฟล์รูปที่ระบุไว้: $imgUrl (มองหาที่ $candidate)"];
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
        return ['ok' => false, 'error' => "รูปอยู่นอกขอบเขตที่อนุญาต (ต้องอยู่ใต้ uploads/): $imgUrl"];
    }

    if (!is_file($real) || !is_readable($real)) {
        return ['ok' => false, 'error' => "ไฟล์รูปอ่านไม่ได้: $real"];
    }

    // เดา MIME จากนามสกุล ไม่ใช้ mime_content_type() ซึ่งต้องการ extension fileinfo
    // ที่อาจไม่ได้เปิดไว้บน XAMPP บางเครื่อง
    $mimeByExt = [
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png'  => 'image/png',
        'gif'  => 'image/gif',
        'webp' => 'image/webp',
    ];
    $ext = strtolower(pathinfo($real, PATHINFO_EXTENSION));

    return [
        'ok'   => true,
        'path' => $real,
        'mime' => $mimeByExt[$ext] ?? 'application/octet-stream',
    ];
}

// ─── Facebook ───────────────────────────────────────────────────────────────────
// Creds: { "page_id": "...", "access_token": "..." }

function dispatch_facebook(array $channel, array $creds, string $title, string $body, string $imgUrl = ''): array {
    $pageId = $creds['page_id'] ?? '';
    $token  = $creds['access_token'] ?? '';
    if (!$pageId || !$token) {
        return ['success' => false, 'error' => 'Missing page_id or access_token'];
    }
    $msg = $title ? "$title\n\n$body" : $body;
    $msg = mb_substr($msg, 0, 63206); // Facebook limit

    $apiBase = "https://graph.facebook.com/v19.0/$pageId";
    $imgUrl  = trim($imgUrl);

    if ($imgUrl === '') {
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
        // อ่าน post_id ก่อน id — /photos คืน id เป็น photo id เปล่า ซึ่งใช้ทั้ง permalink
        // lookup และ /insights ไม่ได้ ส่วน post_id เป็นรูปแบบผสม {page_id}_{post_id}
        // ตัวเดียวกับที่ /feed คืนมาใน id (ยืนยันจาก content_publish_queue.response_snippet)
        // api/lib/insights-fetch.php พึ่งค่านี้เป็นคีย์ดึง engagement — ถ้าเก็บ photo id ไว้
        // การซิงก์จะเงียบหายไปทั้งที่โพสต์สำเร็จ
        $result['platform_post_id'] = $result['data']['post_id'] ?? $result['data']['id'] ?? null;
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
                $result['published_url'] = (string) $lookup['data']['permalink_url'];
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
