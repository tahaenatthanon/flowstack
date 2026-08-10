<?php
// GET  /api/ai-providers.php              - List all AI providers with model count + has_api_key
// GET  /api/ai-providers.php?id={id}     - Get single provider with models (no key)
// POST /api/ai-providers.php              - Create AI provider
// PUT  /api/ai-providers.php?id={id}     - Update AI provider (display_name, description, api_base_url, is_active)
// PUT  /api/ai-providers.php?action=set-api-key&id={id}  - Save encrypted API key
// POST /api/ai-providers.php?action=test&id={id}         - Test provider connection

require_once __DIR__ . '/auth.php';
// encryptApiKey() and decryptApiKey() are defined in config.php (included by auth.php)

$db = getDB();
$method = getMethod();
$providerId = $_GET['id'] ?? null;
$action = $_GET['action'] ?? null;

if ($method === 'GET') {
    $tokenData = requireAuth();

    // --- Get decrypted API key (admin only) ---
    if ($action === 'get-api-key' && $providerId) {
        requireAdmin($db, $tokenData['user_id'], $tokenData['tenant_id']);

        $stmt = $db->prepare('SELECT id, api_key_encrypted FROM ai_providers WHERE id = ?');
        $stmt->execute([$providerId]);
        $provider = $stmt->fetch();

        if (!$provider) jsonError('Provider not found', 404);
        if (empty($provider['api_key_encrypted'])) {
            // No key stored; return empty so the UI lets the user enter a fresh key
            jsonResponse(['api_key' => '']);
        }

        $apiKey = decryptApiKey($provider['api_key_encrypted']);
        // Return whatever we got (empty string when decryption fails).  This allows the user
        // to overwrite the broken key rather than being stuck on an error message.
        jsonResponse(['api_key' => $apiKey ?? '']);
    }

    if ($providerId) {
        // Get single provider with models (never return api_key)
        $stmt = $db->prepare('
            SELECT 
                ap.id,
                ap.name,
                ap.display_name,
                ap.description,
                ap.api_base_url,
                ap.icon,
                ap.is_active,
                (ap.api_key_encrypted IS NOT NULL AND ap.api_key_encrypted != \'\') as has_api_key,
                ap.created_at,
                ap.updated_at,
                COUNT(am.id) as model_count
            FROM ai_providers ap
            LEFT JOIN ai_models am ON am.provider_id = ap.id AND am.status != \'inactive\'
            WHERE ap.id = ?
            GROUP BY ap.id
        ');
        $stmt->execute([$providerId]);
        $provider = $stmt->fetch();

        if (!$provider) {
            jsonError('Provider not found', 404);
        }

        // Get models for this provider
        $modelStmt = $db->prepare('
            SELECT 
                id,
                model_id,
                name,
                description,
                context_window,
                max_output_tokens,
                input_price_per_1k,
                output_price_per_1k,
                supports_vision,
                supports_streaming,
                supports_function_calling,
                supports_tool_calling,
                status,
                features,
                created_at,
                updated_at
            FROM ai_models
            WHERE provider_id = ? AND status != \'inactive\'
            ORDER BY name ASC
        ');
        $modelStmt->execute([$providerId]);
        $provider['models'] = $modelStmt->fetchAll();

        jsonResponse($provider);
    } else {
        // Get all providers with model count + has_api_key (never return api_key itself)
        $stmt = $db->prepare('
            SELECT 
                ap.id,
                ap.name,
                ap.display_name,
                ap.description,
                ap.api_base_url,
                ap.icon,
                ap.is_active,
                (ap.api_key_encrypted IS NOT NULL AND ap.api_key_encrypted != \'\') as has_api_key,
                ap.created_at,
                ap.updated_at,
                COUNT(CASE WHEN am.status != \'inactive\' THEN 1 END) as model_count
            FROM ai_providers ap
            LEFT JOIN ai_models am ON am.provider_id = ap.id
            GROUP BY ap.id
            ORDER BY ap.display_name ASC
        ');
        $stmt->execute();
        $providers = $stmt->fetchAll();

        jsonResponse(['providers' => $providers, 'total' => count($providers)]);
    }
}

if ($method === 'POST' && !$action) {
    $tokenData = requireAuth();
    requireAdmin($db, $tokenData['user_id'], $tokenData['tenant_id']);

    $body = getRequestBody();

    $id = generateUUID();
    
    $stmt = $db->prepare('
        INSERT INTO ai_providers (id, name, display_name, description, api_base_url, icon, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
    ');

    $stmt->execute([
        $id,
        $body['name'] ?? '',
        $body['display_name'] ?? '',
        $body['description'] ?? '',
        $body['api_base_url'] ?? '',
        $body['icon'] ?? ''
    ]);

    jsonResponse(['id' => $id, 'message' => 'Provider created'], 201);
}

if ($method === 'PUT' && $providerId) {
    $tokenData = requireAuth();
    requireAdmin($db, $tokenData['user_id'], $tokenData['tenant_id']);

    $body = getRequestBody();

    // --- Save API key action ---
    if ($action === 'set-api-key') {
        $apiKey = $body['api_key'] ?? '';
        if ($apiKey === '') {
            // Allow clearing the key
            $stmt = $db->prepare("UPDATE ai_providers SET api_key_encrypted = NULL, updated_at = NOW() WHERE id = ?");
            $stmt->execute([$providerId]);
        } else {
            $encrypted = encryptApiKey($apiKey);
            $stmt = $db->prepare("UPDATE ai_providers SET api_key_encrypted = ?, updated_at = NOW() WHERE id = ?");
            $stmt->execute([$encrypted, $providerId]);
        }
        jsonResponse(['message' => 'API key saved']);
    }

    // --- Regular update ---
    $allowed = ['display_name', 'description', 'api_base_url', 'icon', 'is_active'];
    $setParts = [];
    $params = [];

    foreach ($allowed as $field) {
        if (array_key_exists($field, $body)) {
            $setParts[] = "`$field` = ?";
            $params[] = $body[$field];
        }
    }

    if (empty($setParts)) {
        jsonError('No valid fields to update');
    }

    $params[] = $providerId;
    $sql = "UPDATE ai_providers SET " . implode(', ', $setParts) . ", updated_at = NOW() WHERE id = ?";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    jsonResponse(['message' => 'Provider updated']);
}

// --- Test connection action ---
if ($method === 'POST' && $action === 'test' && $providerId) {
    $tokenData = requireAuth();
    requireAdmin($db, $tokenData['user_id'], $tokenData['tenant_id']);

    // Get provider with decrypted key
    $stmt = $db->prepare('SELECT id, name, api_base_url, api_key_encrypted FROM ai_providers WHERE id = ?');
    $stmt->execute([$providerId]);
    $provider = $stmt->fetch();

    if (!$provider) {
        jsonError('Provider not found', 404);
    }

    if (empty($provider['api_key_encrypted'])) {
        jsonError('API key not configured for this provider', 400);
    }

    $apiKey = decryptApiKey($provider['api_key_encrypted']);
    if (empty($apiKey)) {
        jsonError('Failed to decrypt API key', 500);
    }

    $baseUrl = rtrim($provider['api_base_url'], '/');
    if (empty($baseUrl)) {
        jsonError('API base URL not configured', 400);
    }

    // kie.ai ไม่มี /models endpoint — ทดสอบด้วย HEAD ที่ base URL แทน
    if ($provider['id'] === 'provider-kieai') {
        $ch = curl_init($baseUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10,
            CURLOPT_NOBODY => true, CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $apiKey, 'Content-Type: application/json'],
        ]);
        curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);
        if ($curlError) jsonError('Connection failed: ' . $curlError, 502);
        // kie.ai base URL returns 2xx/3xx/4xx — any response means reachable
        $reachable = $httpCode > 0 && $httpCode < 500;
        jsonResponse(['success' => $reachable, 'message' => $reachable ? 'เชื่อมต่อ Kie.ai สำเร็จ' : 'ไม่สามารถเชื่อมต่อได้ (HTTP ' . $httpCode . ')', 'http_code' => $httpCode]);
    }

    // Test by calling the /models endpoint (OpenAI-compatible)
    $testUrl = $baseUrl . '/models';
    $ch = curl_init($testUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json',
        ],
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        jsonError('Connection failed: ' . $curlError, 502);
    }

    if ($httpCode >= 200 && $httpCode < 300) {
        $data = json_decode($response, true);
        $modelCount = 0;
        if (isset($data['data']) && is_array($data['data'])) $modelCount = count($data['data']);
        elseif (is_array($data)) $modelCount = count($data);
        jsonResponse(['success' => true, 'message' => 'เชื่อมต่อสำเร็จ', 'model_count' => $modelCount, 'http_code' => $httpCode]);
    } else {
        jsonResponse(['success' => false, 'message' => 'Server returned HTTP ' . $httpCode, 'http_code' => $httpCode]);
    }
}

// --- Sync models from provider API ---
if ($method === 'POST' && $action === 'sync-models' && $providerId) {
    $tokenData = requireAuth();
    requireAdmin($db, $tokenData['user_id'], $tokenData['tenant_id']);

    // Get provider with decrypted key
    $stmt = $db->prepare('SELECT id, name, api_base_url, api_key_encrypted FROM ai_providers WHERE id = ?');
    $stmt->execute([$providerId]);
    $provider = $stmt->fetch();

    if (!$provider) {
        jsonError('Provider not found', 404);
    }

    if (empty($provider['api_key_encrypted'])) {
        jsonError('API key not configured — ตั้งค่า API Key ก่อนซิงค์', 400);
    }

    $apiKey = decryptApiKey($provider['api_key_encrypted']);
    if (empty($apiKey)) {
        jsonError('Failed to decrypt API key', 500);
    }

    $baseUrl = rtrim($provider['api_base_url'], '/');
    if (empty($baseUrl)) {
        jsonError('API base URL not configured', 400);
    }

    // kie.ai ไม่มี /models endpoint — return hardcoded catalog แทน
    if ($provider['id'] === 'provider-kieai') {
        $kieModels = [
            // ── Image Generation ──────────────────────────────────────────
            ['id' => 'google/nano-banana-pro',          'name' => 'Nano Banana Pro (Gemini Flash)',  'description' => 'Fast, high-quality image generation & editing'],
            ['id' => 'google/nano-banana-edit',         'name' => 'Nano Banana Edit',               'description' => 'Image editing with Gemini Flash'],
            ['id' => 'flux-2/pro-text-to-image',        'name' => 'Flux 2 Pro',                     'description' => 'High-fidelity text-to-image by Black Forest Labs'],
            ['id' => 'seedream/4.5-text-to-image',      'name' => 'Seedream 4.5',                   'description' => 'ByteDance text-to-image model'],
            ['id' => 'seedream/4.5-edit',               'name' => 'Seedream 4.5 Edit',              'description' => 'ByteDance image editing'],
            ['id' => 'gpt-image-2-text-to-image',       'name' => 'GPT Image 2',                    'description' => 'OpenAI photorealistic image generation'],
            ['id' => 'google/imagen4-ultra',            'name' => 'Imagen 4 Ultra',                 'description' => "Google's highest quality image model"],
            ['id' => 'ideogram/v3-text-to-image',       'name' => 'Ideogram v3',                    'description' => 'Great text rendering in images'],
            ['id' => 'recraft/remove-background',       'name' => 'Recraft Remove Background',      'description' => 'Background removal'],
            ['id' => 'topaz/image-upscale',             'name' => 'Topaz Image Upscale',            'description' => 'AI image upscaling'],
            // ── Video Generation ──────────────────────────────────────────
            ['id' => 'veo3',                            'name' => 'Veo 3 (Quality)',                'description' => 'Google Veo 3 — premium video generation'],
            ['id' => 'veo3_fast',                       'name' => 'Veo 3 Fast',                    'description' => 'Google Veo 3 — faster, cost-efficient'],
            ['id' => 'sora-2-text-to-video',            'name' => 'Sora 2 (Text→Video)',            'description' => 'OpenAI Sora 2 text-to-video'],
            ['id' => 'sora-2-image-to-video',           'name' => 'Sora 2 (Image→Video)',           'description' => 'OpenAI Sora 2 image-to-video'],
            ['id' => 'kling/v2-5-turbo-text-to-video-pro',  'name' => 'Kling 2.5 Turbo (Text)',   'description' => 'Kling fast text-to-video'],
            ['id' => 'kling/v2-5-turbo-image-to-video-pro', 'name' => 'Kling 2.5 Turbo (Image)',  'description' => 'Kling fast image-to-video'],
            ['id' => 'bytedance/seedance-2-fast',       'name' => 'Seedance 2 Fast',               'description' => 'ByteDance fast video generation'],
            ['id' => 'wan/2-7-image-to-video',          'name' => 'Wan 2.7 (Image→Video)',         'description' => 'Wan image-to-video'],
            // ── Music ─────────────────────────────────────────────────────
            ['id' => 'suno-v5',                         'name' => 'Suno V5',                       'description' => 'AI music generation'],
            // ── Speech ────────────────────────────────────────────────────
            ['id' => 'elevenlabs/text-to-speech-turbo-2-5',        'name' => 'ElevenLabs TTS Turbo', 'description' => 'Fast text-to-speech'],
            ['id' => 'elevenlabs/text-to-speech-multilingual-v2',   'name' => 'ElevenLabs TTS Multi', 'description' => 'Multilingual text-to-speech'],
            ['id' => 'elevenlabs/sound-effect-v2',      'name' => 'ElevenLabs Sound FX',           'description' => 'AI sound effect generation'],
        ];
        foreach ($kieModels as $m) {
            $mid = $m['id'];
            $stmt = $db->prepare('SELECT id FROM ai_models WHERE provider_id = ? AND model_id = ?');
            $stmt->execute([$providerId, $mid]);
            if (!$stmt->fetch()) {
                $db->prepare('INSERT INTO ai_models (id, provider_id, model_id, name, description, created_at, updated_at) VALUES (?,?,?,?,?,NOW(),NOW())')
                   ->execute([generateUUID(), $providerId, $mid, $m['name'], $m['description']]);
            }
        }
        jsonResponse(['synced' => count($kieModels), 'models' => $kieModels]);
    }

    // Fetch models list from provider
    $modelsUrl = $baseUrl . '/models';
    $ch = curl_init($modelsUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json',
        ],
    ]);

    $response   = curl_exec($ch);
    $httpCode   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError  = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        jsonError('Connection failed: ' . $curlError, 502);
    }
    if ($httpCode < 200 || $httpCode >= 300) {
        jsonError('Provider returned HTTP ' . $httpCode . ': ' . substr($response, 0, 200), 502);
    }

    $data = json_decode($response, true);
    if ($data === null) {
        jsonError('Invalid JSON from provider', 502);
    }

    // Normalize: OpenAI-compatible list is { data: [{id, ...}] } or direct array [{id, ...}]
    $rawModels = [];
    if (isset($data['data']) && is_array($data['data'])) {
        $rawModels = $data['data'];
    } elseif (is_array($data) && isset($data[0]['id'])) {
        $rawModels = $data;
    }

    if (empty($rawModels)) {
        jsonError('No models returned from provider', 502);
    }

    $added   = 0;
    $updated = 0;

    foreach ($rawModels as $rm) {
        $modelId = $rm['id'] ?? null;
        if (empty($modelId)) continue;

        // Derive display name: use 'name' field or prettify the model_id
        $name = $rm['name'] ?? null;
        if (empty($name)) {
            // Convert "org/model-name" -> "Model Name (Org)"
            $parts = explode('/', $modelId, 2);
            $modelSlug = end($parts);
            $name = ucwords(str_replace(['-', '_', '.'], ' ', $modelSlug));
            if (count($parts) > 1) $name .= ' (' . ucfirst($parts[0]) . ')';
        }

        $description  = $rm['description'] ?? ($rm['object'] ?? '');
        $contextWin   = (int)($rm['context_length'] ?? $rm['context_window'] ?? 4096);
        $maxOut       = (int)($rm['top_provider']['max_completion_tokens'] ?? $rm['max_tokens'] ?? $rm['max_output_tokens'] ?? 2048);
        $inputPrice   = (float)($rm['pricing']['prompt'] ?? 0);
        $outputPrice  = (float)($rm['pricing']['completion'] ?? 0);
        // Pricing from OpenRouter comes as price per token — convert to per 1k
        if ($inputPrice > 0 && $inputPrice < 0.01)  $inputPrice  = $inputPrice  * 1000;
        if ($outputPrice > 0 && $outputPrice < 0.01) $outputPrice = $outputPrice * 1000;

        $supportsVision    = isset($rm['architecture']['modality']) && str_contains($rm['architecture']['modality'], 'image') ? 1 : 0;
        $supportsStreaming  = 1; // virtually all modern models support streaming
        $supportsFunc      = isset($rm['supported_parameters']) && in_array('tools', $rm['supported_parameters']) ? 1 : 0;

        $features = [];
        if (!empty($rm['architecture'])) $features['architecture'] = $rm['architecture'];

        // Check if model already exists for this provider
        $existing = $db->prepare('SELECT id FROM ai_models WHERE provider_id = ? AND model_id = ?');
        $existing->execute([$providerId, $modelId]);
        $existingRow = $existing->fetch();

        if ($existingRow) {
            // Update
            $upd = $db->prepare('UPDATE ai_models SET
                name = ?, description = ?, context_window = ?, max_output_tokens = ?,
                input_price_per_1k = ?, output_price_per_1k = ?,
                supports_vision = ?, supports_streaming = ?, supports_function_calling = ?, supports_tool_calling = ?,
                features = ?, status = "active", updated_at = NOW()
                WHERE id = ?');
            $upd->execute([
                $name, $description, $contextWin, $maxOut,
                $inputPrice, $outputPrice,
                $supportsVision, $supportsStreaming, $supportsFunc, $supportsFunc,
                json_encode($features), $existingRow['id']
            ]);
            $updated++;
        } else {
            // Insert
            $ins = $db->prepare('INSERT INTO ai_models
                (id, provider_id, model_id, name, description, context_window, max_output_tokens,
                 input_price_per_1k, output_price_per_1k, supports_vision, supports_streaming,
                 supports_function_calling, supports_tool_calling, status, features, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "active", ?, NOW(), NOW())');
            $ins->execute([
                generateUUID(), $providerId, $modelId, $name, $description, $contextWin, $maxOut,
                $inputPrice, $outputPrice, $supportsVision, $supportsStreaming, $supportsFunc, $supportsFunc,
                json_encode($features)
            ]);
            $added++;
        }
    }

    jsonResponse([
        'success' => true,
        'message' => "ซิงค์สำเร็จ: เพิ่ม {$added} โมเดล, อัปเดต {$updated} โมเดล",
        'added'   => $added,
        'updated' => $updated,
        'total'   => count($rawModels),
    ]);
}

jsonError('Method not allowed', 405);
?>
