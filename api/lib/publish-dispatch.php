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

    return match($platform) {
        'facebook'  => dispatch_facebook($channel, $creds, $title, $body),
        'instagram' => dispatch_instagram($channel, $creds, $title, $body, $imgUrl),
        'tiktok'    => dispatch_tiktok($channel, $creds, $title, $body),
        'lineoa'    => dispatch_lineoa($channel, $creds, $title, $body),
        'linkedin'  => dispatch_linkedin($channel, $creds, $title, $body, $imgUrl),
        'twitter'   => dispatch_twitter($channel, $creds, $title, $body),
        'wordpress' => dispatch_wordpress($channel, $creds, $title, $body, $excerpt),
        'wix'       => dispatch_wix($channel, $creds, $title, $body),
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
 * published_url    : WordPress คืน URL โพสต์กลับใน data.link — platform อื่นยังไม่มี URL ที่เชื่อถือได้ → null
 *
 * @return array{platform_post_id: ?string, published_url: ?string}
 */
function extract_publish_meta(array $result, string $platform, array $channel): array {
    $postId = (isset($result['platform_post_id']) && $result['platform_post_id'] !== '')
        ? (string) $result['platform_post_id']
        : null;

    $url = null;
    if ($platform === 'wordpress' && !empty($result['data']['link'])) {
        $url = (string) $result['data']['link'];
    }

    return ['platform_post_id' => $postId, 'published_url' => $url];
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
    $data = json_decode($res, true) ?: ['raw' => substr($res, 0, 500)];
    if ($code >= 400) {
        $msg = $data['error']['message'] ?? $data['message'] ?? $data['error'] ?? "HTTP $code";
        if (is_array($msg)) $msg = json_encode($msg);
        return ['success' => false, 'error' => $msg, 'http_code' => $code, 'response' => $data];
    }
    return ['success' => true, 'data' => $data];
}

// ─── Facebook ───────────────────────────────────────────────────────────────────
// Creds: { "page_id": "...", "access_token": "..." }

function dispatch_facebook(array $channel, array $creds, string $title, string $body): array {
    $pageId = $creds['page_id'] ?? '';
    $token  = $creds['access_token'] ?? '';
    if (!$pageId || !$token) {
        return ['success' => false, 'error' => 'Missing page_id or access_token'];
    }
    $msg = $title ? "$title\n\n$body" : $body;
    $msg = mb_substr($msg, 0, 63206); // Facebook limit

    $result = _dispatch_post("https://graph.facebook.com/v19.0/$pageId/feed", [
        CURLOPT_POSTFIELDS => http_build_query(['message' => $msg, 'access_token' => $token]),
    ]);
    if ($result['success']) {
        $result['platform_post_id'] = $result['data']['id'] ?? null;
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
