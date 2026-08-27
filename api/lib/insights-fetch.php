<?php
/**
 * ดึง engagement (views/likes) ของโพสต์ที่เผยแพร่แล้วกลับจากแพลตฟอร์ม — เฟส 2
 *
 * คู่ตรงข้ามของ api/lib/publish-dispatch.php: ที่นั่นส่งโพสต์ออก ที่นี่ดึงผลตอบรับกลับ
 * เรียกจาก api/cron/content-metrics-sync.php
 *
 * คีย์ที่ใช้: content_publish_queue.platform_post_id (id โพสต์ต่อช่องทาง)
 * ไม่ใช่ content_items.external_post_id เพราะ content_items เก็บได้ช่องทางเดียว
 * ต่อคอนเทนต์ (publish-scheduler เขียนทับทุกรอบ) และไม่มี channel_id
 *
 * creds ถอดด้วย decryptApiKey() จาก config.php เหมือน dispatch_content()
 */

// Base URL ของ Graph API — ประกาศแบบมี guard เพื่อให้สคริปต์ทดสอบชี้ไป mock ในเครื่องได้
// โดยไม่ต้องแก้โค้ดและไม่มี traffic ออก production (define ก่อน require ไฟล์นี้)
//
// v26.0 = เวอร์ชันล่าสุดที่เรียกได้จริงเมื่อ 21 ส.ค. 2026 (v27.0 ตอบ "Unknown path components")
if (!defined('GRAPH_API_BASE')) {
    define('GRAPH_API_BASE', 'https://graph.facebook.com/v26.0');
}

/**
 * ดึง engagement ของโพสต์หนึ่งโพสต์
 *
 * @param string $platform ค่าจาก publish_channels.platform
 * @param array  $channel  แถว publish_channels (ต้องมี credentials_encrypted)
 * @param string $postId   platform_post_id ของช่องทางนั้น
 * @return array {
 *   success:     bool,
 *   unsupported: bool   true = platform นี้ยังไม่รองรับในเฟสนี้ (ไม่ใช่ error)
 *   views:       int,
 *   likes:       int,
 *   error:       ?string,
 *   raw:         mixed  payload ดิบเท่าที่ได้ ไว้ debug
 * }
 */
function fetch_post_insights(string $platform, array $channel, string $postId): array {
    if ($postId === '') {
        return _insights_fail('ไม่มี id โพสต์สำหรับดึง insights');
    }

    $creds = insights_channel_creds($channel);

    return match ($platform) {
        'facebook'  => fetch_facebook_insights($creds, $postId),
        'instagram' => fetch_instagram_insights($creds, $postId),
        // platform อื่น (tiktok/lineoa/linkedin/twitter/wix/custom/wordpress/lotusdomino)
        // ยังไม่มี API/creds ในเฟสนี้ — คืน unsupported ไม่ใช่ error เพื่อไม่ให้ cron ล้มทั้งรอบ
        default     => [
            'success'     => false,
            'unsupported' => true,
            'views'       => 0,
            'likes'       => 0,
            'error'       => "platform '$platform' ยังไม่รองรับการซิงก์ engagement ในเฟสนี้",
        ],
    };
}

/** ถอด credentials ของ channel เป็น array — ตรรกะเดียวกับ dispatch_content() */
function insights_channel_creds(array $channel): array {
    if (empty($channel['credentials_encrypted'])) return [];
    $plain = decryptApiKey($channel['credentials_encrypted']);
    if (!$plain) return [];
    $decoded = json_decode($plain, true);
    return is_array($decoded) ? $decoded : ['token' => $plain];
}

/**
 * ตรวจอายุ credentials ของช่องทางหนึ่งด้วย Graph API debug_token
 *
 * คืนข้อเท็จจริงดิบเท่าที่ API บอก ไม่ตัดสินสถานะและไม่แตะฐานข้อมูล —
 * การแปลงเป็น token_status และการเขียนลง publish_channels เป็นหน้าที่ของผู้เรียก
 * (ไฟล์นี้เป็นชั้นเรียก Graph API ล้วน ไม่รับ PDO เลย จงใจรักษาไว้เช่นนั้น)
 *
 * ⚠️ expires_at ที่คืนเป็น Unix timestamp ดิบ ค่า 0 คงไว้เป็น 0 ไม่แปลงเป็น null ที่นี่
 *    ผู้เรียกต้องรู้ว่า 0 = "ไม่มีวันหมดอายุ" ไม่ใช่ปี 1970 (Page token ที่ระบบใช้คืน 0)
 *
 * debug_token ปกติต้องใช้ app access token (`app_id|app_secret`) หรือ token ของ
 * developer ของแอป — ระบบนี้ไม่ได้เก็บ app secret ไว้ที่ไหน จึงส่ง token ตัวเดียวกัน
 * เป็นทั้ง input_token และ access_token ซึ่งทดสอบกับเพจจริงแล้วใช้ได้ (27 ส.ค. 2026)
 *
 * @return array {
 *   unsupported:            bool    true = platform นี้ไม่มี API บอกอายุ (ไม่มี request ออกไป)
 *   is_valid:               ?bool   null เมื่อไม่ได้ตรวจ
 *   expires_at:             ?int    Unix ts ของวันหมดอายุ token (0 = ไม่มีวันหมดอายุ)
 *   data_access_expires_at: ?int    Unix ts ของหน้าต่าง data access — เดดไลน์คนละตัว
 *   error:                  ?string ข้อความจาก API เมื่อตรวจไม่ได้หรือ token ใช้ไม่ได้
 *   raw:                    mixed
 * }
 */
function fetch_channel_token_health(string $platform, array $channel): array {
    if ($platform !== 'facebook' && $platform !== 'instagram') {
        return _token_health_unsupported();
    }

    $creds = insights_channel_creds($channel);
    $token = $creds['access_token'] ?? '';
    if ($token === '') {
        // ไม่ยิง request เมื่อ creds ไม่ครบ — คำขอที่ไม่มี token ตอบ error ที่ไม่มีความหมายอยู่แล้ว
        return _token_health_fail("creds ของ {$platform} ไม่ครบ — ไม่มี access_token");
    }

    $res = _insights_get(GRAPH_API_BASE . '/debug_token?' . http_build_query([
        'input_token'  => $token,
        'access_token' => $token,
    ]));
    if (!$res['success']) {
        return _token_health_fail((string) $res['error'], $res['data'] ?? null);
    }

    $d = $res['data']['data'] ?? null;
    if (!is_array($d)) {
        return _token_health_fail('debug_token ตอบในรูปแบบที่อ่านไม่ได้', $res['data']);
    }

    $isValid = !empty($d['is_valid']);
    return [
        'unsupported'            => false,
        'is_valid'               => $isValid,
        'expires_at'             => isset($d['expires_at'])             ? (int) $d['expires_at']             : null,
        'data_access_expires_at' => isset($d['data_access_expires_at']) ? (int) $d['data_access_expires_at'] : null,
        // is_valid = false มาพร้อม HTTP 200 ได้ จึงต้องแปลงเป็นข้อความเองไม่ใช่รอ error จาก HTTP
        'error'                  => $isValid ? null : 'debug_token รายงานว่า token ใช้ไม่ได้แล้ว (is_valid = false)',
        'raw'                    => $d,
    ];
}

/** platform ที่ไม่มี API บอกอายุ credentials — ไม่ใช่ความล้มเหลว */
function _token_health_unsupported(): array {
    return [
        'unsupported'            => true,
        'is_valid'               => null,
        'expires_at'             => null,
        'data_access_expires_at' => null,
        'error'                  => null,
        'raw'                    => null,
    ];
}

/** ตรวจไม่ได้หรือ token ใช้ไม่ได้ — platform รองรับแต่ผลออกมาไม่ดี */
function _token_health_fail(string $error, $raw = null): array {
    return [
        'unsupported'            => false,
        'is_valid'               => false,
        'expires_at'             => null,
        'data_access_expires_at' => null,
        'error'                  => $error,
        'raw'                    => $raw,
    ];
}

// ─── Facebook ───────────────────────────────────────────────────────────────────
// Creds: { "page_id": "...", "access_token": "..." } — ชุดเดียวกับ dispatch_facebook()
// ⚠️ ต้องเป็น **Page** access token ไม่ใช่ User token: User token เรียก /{post_id}/insights
// และ /{page_id}/posts ไม่ได้ (ตอบ OAuthException 190) แลกได้จาก GET /me/accounts
//
// mapping ที่ใช้ (ตรวจกับเพจจริงเมื่อ 21 ส.ค. 2026 ทั้ง v19.0–v26.0 ได้ผลเหมือนกันหมด):
//   post_video_views              → views  จำนวนครั้งที่วิดีโอถูกเล่นเกิน 3 วินาที
//   post_reactions_by_type_total  → likes  ผลรวม reaction ทุกชนิด (like/love/haha/…)
//
// ⚠️ metric ตระกูล impressions ถูกยกเลิกไปแล้ว — post_impressions,
// post_impressions_unique, post_impressions_organic, post_views, post_views_unique,
// post_engaged_users, post_activity ทุกตัวตอบ
// "(#100) The value must be a valid insights metric"
// จึงไม่มีตัวเลข "คนเห็น" ระดับโพสต์ให้ดึงอีก ค่า views จะเป็น 0 สำหรับโพสต์ที่ไม่ใช่วิดีโอ
// = "ไม่มีข้อมูลให้ดึง" ไม่ใช่ "ไม่มีคนเห็น" — ห้ามตีความเป็นยอดคนเห็นจริง
// (metric ที่ยังใช้ได้และอาจมีประโยชน์ในอนาคต: post_clicks, post_reactions_<type>_total,
//  post_video_views_organic/paid, post_consumptions* — ยังไม่มีคอลัมน์เก็บในเฟสนี้)

function fb_post_metric_names(): array {
    return ['post_video_views', 'post_reactions_by_type_total'];
}

function fetch_facebook_insights(array $creds, string $postId): array {
    $token = $creds['access_token'] ?? '';
    if (!$token) {
        return _insights_fail('creds ของ Facebook ไม่ครบ — ไม่มี access_token');
    }

    $res = _insights_fb_metrics($postId, fb_post_metric_names(), $token);
    if (!$res['success']) return _insights_fail($res['error'], $res['data'] ?? null);

    $metrics = $res['metrics'];

    return [
        'success'     => true,
        'unsupported' => false,
        'views'       => (int) ($metrics['post_video_views'] ?? 0),
        'likes'       => (int) ($metrics['post_reactions_by_type_total'] ?? 0),
        'error'       => null,
        'warning'     => $res['warning'],
        'raw'         => $res['raw'],
    ];
}

/**
 * ยิง metric ทั้งชุดในคำขอเดียว แล้วถอยไปยิงแยกทีละตัวถ้าถูกปฏิเสธ
 *
 * Graph API ปฏิเสธทั้งคำขอ (error code 100) ถ้ามี metric ที่ไม่รู้จักแม้แต่ตัวเดียว
 * และ Meta ยกเลิก metric เป็นระยะ (post_impressions หายไปแล้ว) — ถ้าไม่ถอย
 * metric ที่ตายตัวเดียวจะทำให้ไม่ได้ข้อมูลเลยทั้งรอบ จึงเก็บเท่าที่ยังได้
 * และรายงานชื่อที่ถูกปฏิเสธเป็น warning ให้เห็นใน log ของ cron
 *
 * @return array { success: bool, metrics: array, warning: ?string, raw: mixed, error: ?string, data: mixed }
 */
function _insights_fb_metrics(string $postId, array $metrics, string $token): array {
    $call = fn(string $metricParam) => _insights_get(
        GRAPH_API_BASE . '/' . rawurlencode($postId) . '/insights?' . http_build_query([
            'metric'       => $metricParam,
            'access_token' => $token,
        ])
    );

    $res = $call(implode(',', $metrics));
    if ($res['success']) {
        return [
            'success' => true,
            'metrics' => _insights_metric_map($res['data']['data'] ?? []),
            'warning' => null,
            'raw'     => $res['data'],
        ];
    }
    // ไม่ใช่ error เรื่องชื่อ metric (เช่น token ผิด 190) — ไม่ต้องถอย
    if ((int) ($res['data']['error']['code'] ?? 0) !== 100) {
        return ['success' => false, 'error' => $res['error'], 'data' => $res['data'] ?? null];
    }

    $collected = []; $rejected = []; $raw = [];
    foreach ($metrics as $metric) {
        $one = $call($metric);
        if ($one['success']) {
            $collected += _insights_metric_map($one['data']['data'] ?? []);
            $raw[]      = $one['data'];
        } else {
            $rejected[] = $metric;
        }
    }
    if (!$collected) {
        return ['success' => false, 'error' => $res['error'], 'data' => $res['data'] ?? null];
    }
    return [
        'success' => true,
        'metrics' => $collected,
        'warning' => 'Graph API ปฏิเสธ metric: ' . implode(', ', $rejected),
        'raw'     => $raw,
    ];
}

// ─── Instagram ──────────────────────────────────────────────────────────────────
// Creds: { "ig_user_id": "...", "access_token": "..." } — ชุดเดียวกับ dispatch_instagram()
// ig_user_id ไม่ถูกใช้เรียก media insights (media id พอ) จึงไม่บังคับให้มี
// เพื่อไม่สร้างความล้มเหลวปลอมกับ channel ที่มีแต่ token
//
// mapping:
//   insights.metric(impressions) → views
//   like_count                   → likes  (IG คืน like ตรงตัว ไม่ต้องรวม reaction)

function fetch_instagram_insights(array $creds, string $mediaId): array {
    $token = $creds['access_token'] ?? '';
    if (!$token) {
        return _insights_fail('creds ของ Instagram ไม่ครบ — ไม่มี access_token');
    }

    $url = GRAPH_API_BASE . '/' . rawurlencode($mediaId) . '?' . http_build_query([
        'fields'       => 'like_count,comments_count,insights.metric(impressions)',
        'access_token' => $token,
    ]);
    $res = _insights_get($url);
    if (!$res['success']) return _insights_fail($res['error'], $res['data'] ?? null);

    $d       = $res['data'];
    $metrics = _insights_metric_map($d['insights']['data'] ?? []);

    return [
        'success'     => true,
        'unsupported' => false,
        'views'       => (int) ($metrics['impressions'] ?? 0),
        'likes'       => (int) ($d['like_count'] ?? 0),
        'error'       => null,
        'raw'         => $d,
    ];
}

// ─── helpers ────────────────────────────────────────────────────────────────────

/**
 * แปลง array metric ของ Graph API เป็น map ชื่อ → ตัวเลข
 *
 * รูปแบบที่ Graph API คืน:
 *   [{"name":"post_impressions","values":[{"value":123}]},
 *    {"name":"post_reactions_by_type_total","values":[{"value":{"like":5,"love":2}}]}]
 * ค่าที่เป็น array (reaction แยกชนิด) ถูกรวมเป็นเลขเดียว
 */
function _insights_metric_map(array $items): array {
    $out = [];
    foreach ($items as $item) {
        $name = $item['name'] ?? '';
        if ($name === '') continue;
        $value = $item['values'][0]['value'] ?? 0;
        $out[$name] = is_array($value) ? array_sum(array_map('intval', $value)) : (int) $value;
    }
    return $out;
}

/** GET + parse JSON — เกณฑ์ความสำเร็จเดียวกับ _dispatch_post(): ไม่มี cURL error และ HTTP < 400 */
function _insights_get(string $url): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
    ]);
    $res  = curl_exec($ch);
    $err  = curl_error($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($err) {
        return ['success' => false, 'error' => "cURL error: $err"];
    }
    $data = json_decode((string) $res, true) ?: ['raw' => mb_substr((string) $res, 0, 2000)];
    if ($code >= 400) {
        $msg = $data['error']['message'] ?? $data['message'] ?? "HTTP $code";
        if (is_array($msg)) $msg = json_encode($msg, JSON_UNESCAPED_UNICODE);
        return ['success' => false, 'error' => "HTTP $code: $msg", 'data' => $data];
    }
    return ['success' => true, 'data' => $data];
}

/** ผลล้มเหลวรูปแบบเดียวกันทุกจุด — ล้มเหลวจริง ไม่ใช่ unsupported */
function _insights_fail(string $error, $raw = null): array {
    return [
        'success'     => false,
        'unsupported' => false,
        'views'       => 0,
        'likes'       => 0,
        'error'       => $error,
        'raw'         => $raw,
    ];
}
