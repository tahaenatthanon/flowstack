<?php
// api/chat.php
require_once 'config.php';
require_once __DIR__ . '/auth.php';

// ---------------------------------------------------------------
// Resolve API key + base URL
// Priority: active provider stored in DB > KILO_API_TOKEN env
// ---------------------------------------------------------------
function resolveKiloCredentials(PDO $db, string $tenantId = ''): array {
    // Try to load from active AI provider stored in DB
    try {
        $whereClause = $tenantId ? 'cs.tenant_id = ' . $db->quote($tenantId) : 'cs.id = 1';
        $stmt = $db->query("
            SELECT ap.api_base_url, ap.api_key_encrypted
            FROM company_settings cs
            JOIN ai_providers ap ON ap.id = cs.ai_active_provider_id
            WHERE $whereClause AND ap.api_key_encrypted IS NOT NULL AND ap.api_key_encrypted != ''
            LIMIT 1
        ");
        $row = $stmt ? $stmt->fetch() : null;
        if ($row && !empty($row['api_key_encrypted'])) {
            $plain = decryptApiKey($row['api_key_encrypted']);
            if (!empty(trim($plain))) {
                $baseUrl = rtrim($row['api_base_url'] ?: 'https://api.kilo.ai/api/gateway', '/');
                return ['api_key' => trim($plain), 'base_url' => $baseUrl];
            }
        }
    } catch (Exception $e) { /* fall through */ }

    // Fallback: KILO_API_TOKEN from .env
    if (!empty(KILO_API_TOKEN)) {
        return ['api_key' => KILO_API_TOKEN, 'base_url' => 'https://api.kilo.ai/api/gateway'];
    }

    return ['api_key' => '', 'base_url' => 'https://api.kilo.ai/api/gateway'];
}

$db       = getDB();
$authUser = requireAuth(); // Require valid JWT — prevents unauthenticated AI calls
$tenantId = $authUser['tenant_id'];

// AI requests can take a long time — lift PHP execution limit for this endpoint
set_time_limit(300);

$credentials = resolveKiloCredentials($db, $tenantId);

if (empty($credentials['api_key'])) {
    jsonError('AI API key not configured — ตั้งค่า API Key ใน Admin > AI Settings ก่อน', 500);
}

define('RESOLVED_API_KEY',  $credentials['api_key']);
define('RESOLVED_BASE_URL', $credentials['base_url']);

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// --- CORS FIX ---
// Headers are handled by .htaccess in /api/
// Duplicate headers cause "Multiple CORS header" errors in browser

if ($method === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Function to call Kilo AI API (single attempt, no retry)
function callKiloAI($endpoint, $method = 'GET', $data = null) {
    $url = rtrim(RESOLVED_BASE_URL, '/') . '/' . ltrim($endpoint, '/');

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true); // Follow redirects if any

    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true);

    // 90s per attempt — keeps well under PHP's 300s limit even with retries
    curl_setopt($ch, CURLOPT_TIMEOUT, 90);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);

    $headers = [
        'Authorization: Bearer ' . RESOLVED_API_KEY,
        'Content-Type: application/json'
    ];

    if ($data) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }

    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);

    curl_close($ch);

    // Check if curl request failed
    if ($response === false) {
        return ['error' => 'Curl Error: ' . $error, 'status' => 500, 'raw' => $response];
    }

    // Explicitly parse JSON response
    $decoded = json_decode($response, true);

    // If decoding failed, return raw response for debugging
    if (json_last_error() !== JSON_ERROR_NONE) {
        return ['error' => 'JSON Decode Error: ' . json_last_error_msg(), 'status' => 500, 'raw' => $response];
    }

    return ['data' => $decoded, 'status' => $httpCode, 'raw' => $response];
}

// Retry wrapper: retries on 429 (Rate Limit) and 5xx (server errors) with exponential backoff
function callKiloAIWithRetry($endpoint, $method = 'GET', $data = null, $maxRetries = 2) {
    $lastResult = null;
    for ($attempt = 0; $attempt <= $maxRetries; $attempt++) {
        $result = callKiloAI($endpoint, $method, $data);
        $status = $result['status'] ?? 500;

        // Success — return immediately
        if ($status >= 200 && $status < 300) {
            return $result;
        }

        // Only retry on 429 (rate limit) and 5xx (server errors)
        if ($status !== 429 && $status < 500) {
            return $result;
        }

        // Never retry context-overflow errors — they will always fail again
        $raw = $result['raw'] ?? '';
        $errBody = is_array($result['data'] ?? null) ? json_encode($result['data']) : $raw;
        if (stripos($errBody, 'context_length_exceeded') !== false
            || stripos($errBody, 'maximum context length') !== false
            || stripos($errBody, 'max_tokens') !== false
            || stripos($errBody, 'token limit') !== false) {
            return $result;
        }

        $lastResult = $result;

        // Last attempt — don't sleep
        if ($attempt >= $maxRetries) break;

        // Exponential backoff: 2s, 4s + jitter (capped at 5s)
        $delay = min((pow(2, $attempt) * 1000000) + rand(0, 500000), 5000000);
        usleep($delay);
    }
    return $lastResult;
}

try {
    if ($method === 'GET' && $action === 'models') {
        // Fetch models from Kilo AI (GET /models)
        // Kilo AI might return a list directly or { data: [...] }
        
        // We're acting as a proxy here.
        // The issue is that we need to pass the correct Authorization header.
        
        // Re-implement simplified version to test
        $url = rtrim(RESOLVED_BASE_URL, '/') . '/models';
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . RESOLVED_API_KEY,
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        $decoded = json_decode($response, true);
        
        // If we got a valid JSON list of models, force 200 OK
        // This bypasses any upstream 400 issues if the content is actually good
        if (is_array($decoded) && (isset($decoded['data']) || isset($decoded[0]['id']))) {
            $httpCode = 200;
        }

        http_response_code($httpCode);
        
        // If the upstream response already has a 'data' envelope, just return it as is
        // If it's a raw list, wrap it in 'data'
        if (isset($decoded['data'])) {
             echo json_encode($decoded);
        } else {
             echo json_encode(['data' => $decoded]);
        }
        exit;
    } elseif ($method === 'POST') {
        // Chat completion
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input) {
            throw new Exception('Invalid JSON input');
        }
        
        // Ensure "messages" is present
        if (!isset($input['messages']) || !is_array($input['messages'])) {
            throw new Exception('Missing or invalid "messages" field');
        }

        // Default model: use ai_chat_model_id from DB settings, fallback to minimax-01
        $defaultModel = 'minimax/minimax-01';
        try {
            $ms = $db->prepare("
                SELECT am.model_id FROM company_settings cs
                LEFT JOIN ai_models am ON am.id = cs.ai_chat_model_id
                WHERE cs.tenant_id = ? AND am.model_id IS NOT NULL LIMIT 1
            ");
            $ms->execute([$tenantId]);
            $mrow = $ms ? $ms->fetch() : null;
            if ($mrow && !empty($mrow['model_id'])) $defaultModel = $mrow['model_id'];
        } catch (Exception $e) { /* ignore */ }

        $model = $input['model'] ?? $defaultModel;

        // Extract action from query param if needed, but handled by block
        
        // Inject Thai-only enforcement into system prompt
        $messages = $input['messages'];
        $thaiRule = ['role' => 'system', 'content' => 'ตอบเป็นภาษาไทยเท่านั้น ห้ามใช้ภาษาจีน เกาหลี ญี่ปุ่น หรือภาษาอื่นที่ไม่ใช่ภาษาไทย'];
        if (!empty($messages) && $messages[0]['role'] === 'system') {
            $messages[0]['content'] = $thaiRule['content'] . "\n" . $messages[0]['content'];
        } else {
            array_unshift($messages, $thaiRule);
        }

        $payload = [
            'model' => $model,
            'messages' => $messages,
            'stream' => false,
            'max_tokens' => 4096,
        ];

        // Call Kilo AI API with retry on 429/5xx
        $result = callKiloAIWithRetry('chat/completions', 'POST', $payload);

        // Handle errors from Kilo AI
        if (!isset($result['data'])) {
            $status = $result['status'] ?? 500;
            http_response_code($status);
            echo json_encode(['error' => 'AI Service Error [HTTP ' . $status . ']: ' . ($result['error'] ?? 'Unknown error from AI service')]);
            exit;
        }

        // Check if upstream returned an error
        if (isset($result['data']['error'])) {
            $errData = $result['data']['error'];
            if (is_array($errData)) {
                $errMsg = $errData['message'] ?? ($errData['type'] ?? json_encode($errData));
                $errType = $errData['type'] ?? '';
                if ($errType) $errMsg = "[$errType] $errMsg";
            } else {
                $errMsg = (string)$errData;
            }
            $httpCode = ($result['status'] >= 400) ? $result['status'] : 500;
            http_response_code($httpCode);
            echo json_encode(['error' => 'AI Service Error [HTTP ' . $httpCode . ']: ' . $errMsg]);
            exit;
        }

        // Provider returned non-200 but no error field
        if (!isset($result['data']['choices']) && $result['status'] >= 400) {
            http_response_code($result['status']);
            echo json_encode(['error' => 'AI Service Error [HTTP ' . $result['status'] . ']: ' . substr($result['raw'] ?? '', 0, 200)]);
            exit;
        }

        // Valid response with choices
        if (isset($result['data']['choices'])) {
            http_response_code(200);
            echo json_encode(['data' => $result['data']]);
            exit;
        }

        // Unexpected format - return as-is wrapped in data
        http_response_code(200);
        echo json_encode(['data' => $result['data']]);
        exit;
        
    } else {
        throw new Exception('Invalid action or method');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
