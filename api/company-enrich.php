<?php
// POST /api/company-enrich.php
// Enrich a company record by looking up information from the internet via AI web search.
// Body: { name: string, website?: string, tax_id?: string }
// Returns: { business_type, company_size, founded_year, description, website, phone, email, address, tax_id, source_note }

require_once __DIR__ . '/auth.php';

$authUser = requireAuth();
$tenantId = $authUser['tenant_id'];
$db     = getDB();
$method = getMethod();

if ($method !== 'POST') jsonError('Method not allowed', 405);

$body    = getRequestBody();
$name    = trim($body['name'] ?? '');
$website = trim($body['website'] ?? '');
$taxId   = trim($body['tax_id'] ?? '');

if (!$name) jsonError('กรุณาระบุชื่อบริษัท', 400);

// ── Resolve AI credentials (same logic as chat.php) ──────────────────────────
function resolveEnrichCredentials(PDO $db, string $tenantId = ''): array {
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
    } catch (Exception $e) {}
    if (!empty(KILO_API_TOKEN)) {
        return ['api_key' => KILO_API_TOKEN, 'base_url' => 'https://api.kilo.ai/api/gateway'];
    }
    return ['api_key' => '', 'base_url' => 'https://api.kilo.ai/api/gateway'];
}

function callEnrichAI(string $apiKey, string $baseUrl, string $model, array $messages): ?array {
    $url = rtrim($baseUrl, '/') . '/chat/completions';
    $ch  = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode(['model' => $model, 'messages' => $messages, 'stream' => false, 'max_tokens' => 2048]),
        CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $apiKey, 'Content-Type: application/json'],
        CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true,
        CURLOPT_TIMEOUT        => 60,
        CURLOPT_CONNECTTIMEOUT => 20,
    ]);
    $raw  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if (!$raw) return null;
    $decoded = json_decode($raw, true);
    if (!isset($decoded['choices'][0]['message']['content'])) return null;
    return ['content' => $decoded['choices'][0]['message']['content'], 'code' => $code];
}

$creds = resolveEnrichCredentials($db, $tenantId);
if (empty($creds['api_key'])) jsonError('AI API key not configured', 500);

// ── Build prompt ──────────────────────────────────────────────────────────────
$hints = [];
if ($website) $hints[] = "website: $website";
if ($taxId)   $hints[] = "เลขภาษี: $taxId";
$hintsStr = $hints ? ' (' . implode(', ', $hints) . ')' : '';

$systemPrompt = <<<PROMPT
You are a business research assistant. ตอบเป็นภาษาไทยเท่านั้น. When given a company name, search the internet and return ONLY a JSON object (no markdown, no explanation) with these fields:
{
  "business_type": "one of: เทคโนโลยีสารสนเทศ (IT)|การเงิน / ธนาคาร|ประกันภัย|อสังหาริมทรัพย์|การผลิต / อุตสาหกรรม|ค้าปลีก / ค้าส่ง|การแพทย์ / สุขภาพ|การศึกษา|พลังงาน|โทรคมนาคม|การขนส่ง / โลจิสติกส์|อาหาร / เครื่องดื่ม|การท่องเที่ยว / โรงแรม|สื่อ / โฆษณา|ก่อสร้าง / วิศวกรรม|เกษตรกรรม|อื่น ๆ",
  "company_size": "one of: 1-10|11-50|51-200|201-500|501-1000|1000+",
  "founded_year": integer or null,
  "description": "1-2 sentence description in Thai",
  "website": "URL or empty string",
  "phone": "phone number or empty string",
  "email": "email or empty string",
  "address": "address in Thai or empty string",
  "tax_id": "13-digit Thai tax ID or empty string",
  "confidence": "high|medium|low"
}
Rules: Return ONLY valid JSON. If a field is unknown use null or "". Do not wrap in markdown.
PROMPT;

$userMsg = "Research this company and fill in all fields: {$name}{$hintsStr}";

$messages = [
    ['role' => 'system', 'content' => $systemPrompt],
    ['role' => 'user',   'content' => $userMsg],
];

// Resolve model from DB first, fallback to kilo-auto/free
$model = 'kilo-auto/free';
try {
    $msStmt = $db->prepare("SELECT am.model_id FROM company_settings cs LEFT JOIN ai_models am ON am.id = cs.ai_chat_model_id WHERE cs.tenant_id = ? AND am.model_id IS NOT NULL LIMIT 1");
    $msStmt->execute([$tenantId]);
    $ms = $msStmt;
    $mrow = $ms ? $ms->fetch() : null;
    if ($mrow && !empty($mrow['model_id'])) $model = $mrow['model_id'];
} catch (Exception $e) {}
$result = callEnrichAI($creds['api_key'], $creds['base_url'], $model, $messages);
$usedModel = $model;

if (!$result) jsonError('ไม่สามารถเชื่อมต่อ AI ได้', 502);

// ── Parse JSON from AI response ───────────────────────────────────────────────
$content = trim($result['content']);

// Strip markdown code block if present
if (preg_match('/```(?:json)?\s*([\s\S]*?)```/', $content, $m)) {
    $content = trim($m[1]);
}
// Extract first JSON object
if (preg_match('/\{[\s\S]*\}/', $content, $m)) {
    $content = $m[0];
}

$data = json_decode($content, true);
if (!$data) jsonError('AI ตอบสนองไม่ถูกต้อง: ' . substr($content, 0, 200), 502);

// Sanitize
$allowed_business_types = [
    'เทคโนโลยีสารสนเทศ (IT)', 'การเงิน / ธนาคาร', 'ประกันภัย', 'อสังหาริมทรัพย์',
    'การผลิต / อุตสาหกรรม', 'ค้าปลีก / ค้าส่ง', 'การแพทย์ / สุขภาพ', 'การศึกษา',
    'พลังงาน', 'โทรคมนาคม', 'การขนส่ง / โลจิสติกส์', 'อาหาร / เครื่องดื่ม',
    'การท่องเที่ยว / โรงแรม', 'สื่อ / โฆษณา', 'ก่อสร้าง / วิศวกรรม', 'เกษตรกรรม', 'อื่น ๆ',
];
$allowed_sizes = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

$bt = $data['business_type'] ?? '';
$cs = $data['company_size'] ?? '';

$isWebSearch = str_contains($usedModel, 'perplexity') || str_contains($usedModel, 'sonar') || str_contains($usedModel, 'search');
$sourceNote  = $isWebSearch ? 'ข้อมูลจากการค้นหาอินเทอร์เน็ต' : 'ข้อมูลจาก AI (อาจไม่ใช่ข้อมูลปัจจุบัน)';

jsonResponse([
    'business_type'  => in_array($bt, $allowed_business_types) ? $bt : 'อื่น ๆ',
    'company_size'   => in_array($cs, $allowed_sizes) ? $cs : '',
    'founded_year'   => !empty($data['founded_year']) ? (int)$data['founded_year'] : null,
    'description'    => $data['description'] ?? '',
    'website'        => $data['website'] ?? '',
    'phone'          => $data['phone'] ?? '',
    'email'          => $data['email'] ?? '',
    'address'        => $data['address'] ?? '',
    'tax_id'         => $data['tax_id'] ?? '',
    'confidence'     => $data['confidence'] ?? 'medium',
    'source_note'    => $sourceNote,
    'model_used'     => $usedModel,
]);
