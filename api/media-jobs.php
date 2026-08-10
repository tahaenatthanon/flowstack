<?php
// POST /api/media-jobs.php?action=create  - สร้าง image job ผ่าน AI Provider ที่ตั้งค่าไว้
// GET  /api/media-jobs.php?action=poll&id= - ดึง status จาก DB
// GET  /api/media-jobs.php?action=list    - รายการ jobs ของ tenant

require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$tenantId  = $tokenData['tenant_id'];
$userId    = $tokenData['user_id'];
$db        = getDB();
$method    = getMethod();
$action    = $_GET['action'] ?? '';

// ── Helper: resolve image AI credentials from admin settings ─────────────────
function resolveImageCreds(PDO $db, string $tenantId): array {
    $stmt = $db->prepare("
        SELECT ap.api_base_url, ap.api_key_encrypted, am.model_id, ap.display_name AS provider_name
        FROM company_settings cs
        JOIN ai_models am ON am.id = cs.ai_content_image_model_id
        JOIN ai_providers ap ON ap.id = am.provider_id
        WHERE cs.tenant_id = ?
          AND ap.api_key_encrypted IS NOT NULL
          AND ap.api_key_encrypted != ''
        LIMIT 1
    ");
    $stmt->execute([$tenantId]);
    $row = $stmt->fetch();
    if (!$row || empty($row['api_key_encrypted'])) {
        jsonError('ยังไม่ได้ตั้งค่า Image Model — ไปที่ Admin › ตั้งค่า AI แล้วเลือก Image Model', 400);
    }
    $apiKey = decryptApiKey($row['api_key_encrypted']);
    if (empty(trim($apiKey))) jsonError('ไม่สามารถถอดรหัส API Key ได้', 500);
    return [
        'api_key'       => trim($apiKey),
        'base_url'      => rtrim($row['api_base_url'] ?? 'https://api.openai.com/v1', '/'),
        'model'         => $row['model_id'] ?: 'dall-e-3',
        'provider_name' => $row['provider_name'] ?? '',
    ];
}

// ── Helper: aspect-ratio string for Imagen ───────────────────────────────────
function _aspectRatioStr(int $w, int $h): string {
    if ($w === $h) return '1:1';
    if ($w > $h)   return '16:9';
    return '9:16';
}

// ── Helper: save data URI to /uploads/media/, return relative URL ────────────
function _saveMediaImage(string $dataUriOrUrl, string $jobId): string {
    if (!str_starts_with($dataUriOrUrl, 'data:')) return $dataUriOrUrl;
    if (!preg_match('/^data:(image\/[^;]+);base64,(.+)$/s', $dataUriOrUrl, $m)) return $dataUriOrUrl;
    $mime = $m[1];
    $ext  = match($mime) { 'image/jpeg' => 'jpg', 'image/webp' => 'webp', default => 'png' };
    $dir  = __DIR__ . '/../uploads/media';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $filename = 'media_' . $jobId . '_' . time() . '.' . $ext;
    file_put_contents($dir . '/' . $filename, base64_decode($m[2]));
    return '/uploads/media/' . $filename;
}

// ── Helper: call image API and return data URI or absolute URL ───────────────
// Throws \RuntimeException on failure.
function generateImage(string $prompt, array $creds, int $width, int $height): string {
    $apiKey  = $creds['api_key'];
    $baseUrl = $creds['base_url'];
    $model   = $creds['model'];

    $isGeminiBase = stripos($baseUrl, 'generativelanguage.googleapis.com') !== false;
    $isImagen     = $isGeminiBase && stripos($model, 'imagen') !== false;
    $isGeminiImg  = $isGeminiBase && !$isImagen;

    // ── Imagen 3 (predict endpoint) ──────────────────────────────────────────
    if ($isImagen) {
        $endpoint = $baseUrl . '/models/' . $model . ':predict?key=' . $apiKey;
        $payload  = [
            'instances'  => [['prompt' => $prompt]],
            'parameters' => [
                'sampleCount' => 1,
                'aspectRatio' => _aspectRatioStr($width, $height),
            ],
        ];
        $ch = curl_init($endpoint);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT        => 120,
        ]);
        $res  = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($code >= 400) {
            $dec = json_decode($res, true) ?: [];
            $msg = $dec['error']['message'] ?? ('Imagen HTTP ' . $code);
            throw new \RuntimeException('Imagen: ' . $msg);
        }
        $dec = json_decode($res, true) ?: [];
        $b64 = $dec['predictions'][0]['bytesBase64Encoded'] ?? null;
        if (!$b64) throw new \RuntimeException('Imagen returned no image: ' . substr($res, 0, 300));
        $mime = $dec['predictions'][0]['mimeType'] ?? 'image/png';
        return 'data:' . $mime . ';base64,' . $b64;
    }

    // ── Gemini image generation (generateContent) ─────────────────────────────
    if ($isGeminiImg) {
        $endpoint = $baseUrl . '/models/' . $model . ':generateContent?key=' . $apiKey;
        $payload  = [
            'contents'         => [['parts' => [['text' => $prompt]]]],
            'generationConfig' => ['responseModalities' => ['TEXT', 'IMAGE']],
        ];
        $ch = curl_init($endpoint);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT        => 120,
        ]);
        $res  = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($code >= 400) {
            $dec = json_decode($res, true) ?: [];
            $msg = $dec['error']['message'] ?? ('Gemini HTTP ' . $code);
            throw new \RuntimeException('Gemini: ' . $msg);
        }
        $dec = json_decode($res, true) ?: [];
        foreach ($dec['candidates'][0]['content']['parts'] ?? [] as $part) {
            if (!empty($part['inlineData']['data'])) {
                $mime = $part['inlineData']['mimeType'] ?? 'image/png';
                return 'data:' . $mime . ';base64,' . $part['inlineData']['data'];
            }
        }
        // Some Gemini models return a URL in text part
        foreach ($dec['candidates'][0]['content']['parts'] ?? [] as $part) {
            if (!empty($part['text'])) {
                if (preg_match('/https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp)/i', $part['text'], $m)) {
                    return $m[0];
                }
            }
        }
        throw new \RuntimeException('Gemini returned no image. Response: ' . substr($res, 0, 300));
    }

    // ── Helper: parse image out of a /chat/completions response ─────────────
    $parseChatImageResponse = function(array $dec, string $raw): ?string {
        // Format 1: data[].b64_json (standard images/generations)
        if (!empty($dec['data'][0]['b64_json']))
            return 'data:image/png;base64,' . $dec['data'][0]['b64_json'];
        // Format 2: data[].url
        if (!empty($dec['data'][0]['url']))
            return $dec['data'][0]['url'];
        // Format 3: choices[0].message.content with inlineData (Gemini via gateway)
        $content = $dec['choices'][0]['message']['content'] ?? null;
        if (is_array($content)) {
            foreach ($content as $part) {
                if (!empty($part['image_url']['url'])) return $part['image_url']['url'];
                if (!empty($part['inlineData']['data'])) {
                    $mime = $part['inlineData']['mimeType'] ?? 'image/png';
                    return 'data:' . $mime . ';base64,' . $part['inlineData']['data'];
                }
            }
        }
        // Format 4: content is a markdown image or direct URL in text
        if (is_string($content)) {
            if (preg_match('/!\[.*?\]\((https?:\/\/[^)]+)\)/', $content, $m)) return $m[1];
            if (preg_match('/https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp)/i', $content, $m)) return $m[0];
            // Format 5: base64 image embedded in text (some gateways)
            if (preg_match('/data:image\/[^;]+;base64,[A-Za-z0-9+\/=]+/', $content, $m)) return $m[0];
        }
        // Format 6: tool_calls with image data
        foreach ($dec['choices'][0]['message']['tool_calls'] ?? [] as $tc) {
            $args = json_decode($tc['function']['arguments'] ?? '{}', true);
            if (!empty($args['url'])) return $args['url'];
        }
        return null;
    };

    // ── Try /images/generations first ────────────────────────────────────────
    $sizeStr      = $width . 'x' . $height;
    $imgPayload   = ['model' => $model, 'prompt' => $prompt, 'n' => 1, 'size' => $sizeStr, 'response_format' => 'b64_json'];
    $commonOpts   = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $apiKey, 'Content-Type: application/json'],
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_TIMEOUT        => 120,
    ];

    $ch = curl_init($baseUrl . '/images/generations');
    curl_setopt_array($ch, $commonOpts + [CURLOPT_POSTFIELDS => json_encode($imgPayload)]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $dec = json_decode($res, true) ?: [];

    // Check if gateway rejects /images/generations and only allows /chat/completions
    $errMsg       = $dec['error']['message'] ?? $dec['message'] ?? '';
    $needsChatFb  = ($code === 405)
        || stripos($errMsg, 'chat/completions') !== false
        || stripos($errMsg, 'only accepts') !== false
        || stripos($errMsg, 'not supported') !== false;

    if (!$needsChatFb && $code < 400) {
        $url = $parseChatImageResponse($dec, $res);
        if ($url) return $url;
        // Unexpected: fall through to chat fallback
    }

    // ── Fallback: /chat/completions (for gateways like Kilo) ─────────────────
    $chatPayload = [
        'model'      => $model,
        'messages'   => [[
            'role'    => 'user',
            'content' => 'Generate an image based on this description. Output ONLY the image, no explanatory text: ' . $prompt,
        ]],
        'max_tokens' => 4096,
        'stream'     => false,   // prevent SSE chunked response
    ];
    $ch2 = curl_init($baseUrl . '/chat/completions');
    curl_setopt_array($ch2, $commonOpts + [CURLOPT_POSTFIELDS => json_encode($chatPayload)]);
    $res2  = curl_exec($ch2);
    $code2 = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
    curl_close($ch2);

    if ($code2 >= 400) {
        $dec2 = json_decode($res2, true) ?: [];
        $msg  = $dec2['error']['message'] ?? $dec2['message'] ?? ('API HTTP ' . $code2);
        throw new \RuntimeException($msg);
    }
    $dec2 = json_decode($res2, true) ?: [];
    $url2 = $parseChatImageResponse($dec2, $res2);
    if ($url2) return $url2;

    // Debug: dump raw response to help diagnose unsupported formats
    $preview = preg_replace('/\s+/', ' ', substr($res2, 0, 600));
    throw new \RuntimeException('AI returned no image. Raw response: ' . $preview);
}

// ── POST ?action=create ───────────────────────────────────────────────────────
if ($method === 'POST' && $action === 'create') {
    $body   = json_decode(file_get_contents('php://input'), true) ?? [];
    $prompt = trim($body['prompt'] ?? '');
    $inputParams     = $body['input_params'] ?? [];
    $sourceContentId = $body['source_content_id'] ?? null;

    if (!$prompt) jsonError('กรุณาระบุ prompt', 400);

    $creds  = resolveImageCreds($db, $tenantId);
    $width  = (int)($inputParams['width']  ?? 1024);
    $height = (int)($inputParams['height'] ?? 1024);

    $jobId = generateUUID();
    $db->prepare('
        INSERT INTO media_jobs
          (id, tenant_id, created_by, job_type, provider, model, status, prompt, input_params, source_content_id)
        VALUES (?, ?, ?, \'image\', \'ai\', ?, \'processing\', ?, ?, ?)
    ')->execute([
        $jobId, $tenantId, $userId,
        $creds['model'],
        $prompt,
        json_encode($inputParams),
        $sourceContentId,
    ]);

    ignore_user_abort(true);
    set_time_limit(180);

    try {
        $imageDataOrUrl = generateImage($prompt, $creds, $width, $height);
        $savedUrl = _saveMediaImage($imageDataOrUrl, $jobId);
        $resultUrls = json_encode([$savedUrl]);

        $db->prepare('
            UPDATE media_jobs SET status=\'completed\', result_urls=?, updated_at=NOW() WHERE id=?
        ')->execute([$resultUrls, $jobId]);

        jsonResponse([
            'job_id'      => $jobId,
            'status'      => 'completed',
            'result_urls' => [$savedUrl],
        ]);
    } catch (\Exception $e) {
        $errMsg = $e->getMessage();
        $db->prepare('
            UPDATE media_jobs SET status=\'failed\', error_message=?, updated_at=NOW() WHERE id=?
        ')->execute([$errMsg, $jobId]);
        jsonError($errMsg, 502);
    }
}

// ── GET ?action=poll&id= ──────────────────────────────────────────────────────
if ($method === 'GET' && $action === 'poll') {
    $jobId = $_GET['id'] ?? null;
    if (!$jobId) jsonError('กรุณาระบุ id', 400);

    $stmt = $db->prepare('SELECT * FROM media_jobs WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$jobId, $tenantId]);
    $job = $stmt->fetch();
    if (!$job) jsonError('ไม่พบ job', 404);

    jsonResponse([
        'job_id'        => $jobId,
        'status'        => $job['status'],
        'result_urls'   => json_decode($job['result_urls'] ?? '[]', true),
        'error_message' => $job['error_message'],
    ]);
}

// ── GET ?action=list ──────────────────────────────────────────────────────────
if ($method === 'GET' && $action === 'list') {
    $stmt = $db->prepare('
        SELECT id, job_type, model, status, prompt, result_urls, error_message, created_at
        FROM media_jobs
        WHERE tenant_id = ?
        ORDER BY created_at DESC
        LIMIT 50
    ');
    $stmt->execute([$tenantId]);
    $jobs = $stmt->fetchAll();
    foreach ($jobs as &$j) {
        $j['result_urls'] = json_decode($j['result_urls'] ?? '[]', true);
    }
    jsonResponse(['jobs' => $jobs]);
}

jsonError('Invalid action', 400);
