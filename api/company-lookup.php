<?php
// GET /api/company-lookup.php?name=CompanyName
// Searches the internet for company contact info using a web-search AI model
// Returns: { name, address, phone, email, website, tax_id }
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$tenantId  = $tokenData['tenant_id'];
$db = getDB();

if (getMethod() !== 'GET') jsonError('Method not allowed', 405);

$name = trim($_GET['name'] ?? '');
if (empty($name)) jsonError('กรุณาระบุชื่อบริษัท');

// Resolve API key: DB-stored provider first, fallback to KILO_API_TOKEN env
$resolvedApiKey = '';
$resolvedBaseUrl = 'https://api.kilo.ai/api/gateway';
try {
    $stmt = $db->prepare("
        SELECT ap.api_base_url, ap.api_key_encrypted
        FROM company_settings cs
        JOIN ai_providers ap ON ap.id = cs.ai_active_provider_id
        WHERE cs.tenant_id = ? AND ap.api_key_encrypted IS NOT NULL AND ap.api_key_encrypted != ''
        LIMIT 1
    ");
    $stmt->execute([$tenantId]);
    $row = $stmt->fetch();
    if ($row && !empty($row['api_key_encrypted'])) {
        $plain = decryptApiKey($row['api_key_encrypted']);
        if (!empty(trim($plain))) {
            $resolvedApiKey = trim($plain);
            $resolvedBaseUrl = rtrim($row['api_base_url'] ?: $resolvedBaseUrl, '/');
        }
    }
} catch (Exception $e) { /* fall through */ }

if (empty($resolvedApiKey) && !empty(KILO_API_TOKEN)) {
    $resolvedApiKey = KILO_API_TOKEN;
}

if (empty($resolvedApiKey)) {
    jsonError('ระบบ AI ไม่สามารถเข้าถึงบริการค้นหาข้อมูลได้ (AI API token not configured)', 500);
}

// Resolve company lookup model from DB (falls back to default model)
$lookupModel = 'perplexity/sonar';
try {
    $mStmt = $db->prepare("
        SELECT am.model_id
        FROM company_settings cs
        JOIN ai_models am ON am.id = cs.ai_default_model_id
        WHERE cs.tenant_id = ? LIMIT 1
    ");
    $mStmt->execute([$tenantId]);
    $mRow = $mStmt->fetch();
    if ($mRow && !empty($mRow['model_id'])) $lookupModel = $mRow['model_id'];
} catch (Exception $e) { /* keep default */ }

// ---- Call AI with a web-search capable model ----
$systemPrompt = 'You are a business information lookup assistant. ตอบเป็นภาษาไทยเท่านั้น. ' .
    'Search the internet for the company\'s contact information. ' .
    'Respond ONLY with a valid JSON object — no explanations, no markdown, no code blocks. ' .
    'Return these fields (use "" for any you cannot find): name, address, phone, email, website, tax_id. ' .
    'tax_id is optional — only include if found. ' .
    'Example: {"name":"บริษัท ABC จำกัด","address":"123 ถนน ABC กรุงเทพฯ 10110","phone":"02-123-4567","email":"contact@abc.co.th","website":"https://www.abc.co.th","tax_id":""}';

$userPrompt = "Search for contact information of this Thai company: $name\n" .
    "Return ONLY JSON with fields: name, address, phone, email, website, tax_id (tax_id optional, use \"\" if not found)";

$payload = [
    'model'       => $lookupModel,
    'messages'    => [
        ['role' => 'system', 'content' => $systemPrompt],
        ['role' => 'user',   'content' => $userPrompt],
    ],
    'stream'      => false,
    'max_tokens'  => 2048,
];

$ch = curl_init($resolvedBaseUrl . '/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($payload),
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . $resolvedApiKey,
        'Content-Type: application/json',
    ],
    CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_CONNECTTIMEOUT => 10,
]);

$response  = curl_exec($ch);
$httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

$info = null;

if ($response && $httpCode === 200) {
    $data    = json_decode($response, true);
    $content = $data['choices'][0]['message']['content'] ?? '';

    // Strip markdown code fences if the model wrapped the JSON
    $content = trim($content);
    $content = preg_replace('/^```(?:json)?\s*/i', '', $content);
    $content = preg_replace('/\s*```$/i', '', $content);

    // Extract the first {...} block
    if (preg_match('/\{[\s\S]*\}/u', $content, $matches)) {
        $parsed = json_decode($matches[0], true);
        if (is_array($parsed)) {
            $info = $parsed;
        }
    }
}

// Fallback: return empty structure so the form can still be filled manually
if (!is_array($info)) {
    $info = [];
}

// Merge with defaults — ensure all expected keys exist
$result = array_merge(
    ['name' => $name, 'address' => '', 'phone' => '', 'email' => '', 'website' => '', 'tax_id' => ''],
    array_intersect_key($info, array_flip(['name', 'address', 'phone', 'email', 'website', 'tax_id']))
);

// If the AI returned an empty name, keep the original search name
if (empty(trim($result['name']))) {
    $result['name'] = $name;
}

jsonResponse($result);
