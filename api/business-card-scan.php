<?php
// POST /api/business-card-scan.php
// Scan business card image via AI vision model and return structured fields for preview.

require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$tenantId = $tokenData['tenant_id'];
$userId = $tokenData['user_id'];
$db = getDB();
$method = getMethod();

function logCardScanActivity(PDO $db, string $userId, string $tenantId, string $action, string $description): void {
    try {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $ua = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
        $stmt = $db->prepare('INSERT INTO user_activity_logs (id, user_id, tenant_id, action, description, ip_address, user_agent, created_at) VALUES (UUID(), ?, ?, ?, ?, ?, ?, NOW())');
        $stmt->execute([$userId, $tenantId, $action, $description, $ip, $ua]);
    } catch (Throwable $e) {
        // Logging failures must never break API flow.
    }
}

function scanError(PDO $db, string $userId, string $tenantId, string $message, int $statusCode = 400): void {
    logCardScanActivity($db, $userId, $tenantId, 'card_scan_failed', $message);
    jsonError($message, $statusCode);
}

function normalizeCompanyName(string $name): string {
    $s = mb_strtolower(trim($name), 'UTF-8');
    $s = str_replace(
        ['บริษัท', 'จำกัด', '(มหาชน)', 'มหาชน', 'co.,ltd.', 'co., ltd.', 'co,ltd', 'co ltd', 'company limited', 'public company limited', 'ltd.', 'ltd', 'inc.', 'inc', 'corp.', 'corporation', 'co.', 'co'],
        '',
        $s
    );
    $s = preg_replace('/[^\p{L}\p{N}]+/u', '', $s) ?: '';
    return $s;
}

if ($method !== 'POST') {
    jsonError('Method not allowed', 405);
}

if (empty($_FILES['file'])) {
    scanError($db, $userId, $tenantId, 'กรุณาแนบไฟล์นามบัตร', 400);
}

$file = $_FILES['file'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    scanError($db, $userId, $tenantId, 'อัปโหลดไฟล์ไม่สำเร็จ', 400);
}

$maxSize = 8 * 1024 * 1024;
if (($file['size'] ?? 0) > $maxSize) {
    scanError($db, $userId, $tenantId, 'ไฟล์ต้องมีขนาดไม่เกิน 8 MB', 400);
}

$tmpPath = $file['tmp_name'] ?? '';
if (!$tmpPath || !is_uploaded_file($tmpPath)) {
    scanError($db, $userId, $tenantId, 'ไฟล์อัปโหลดไม่ถูกต้อง', 400);
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = $finfo ? (finfo_file($finfo, $tmpPath) ?: '') : '';
if ($finfo) {
    finfo_close($finfo);
}

$allowedMimes = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
];

if (!isset($allowedMimes[$mime])) {
    scanError($db, $userId, $tenantId, 'รองรับเฉพาะไฟล์ภาพ .jpg .png .webp', 400);
}

$imgBinary = file_get_contents($tmpPath);
if ($imgBinary === false || $imgBinary === '') {
    scanError($db, $userId, $tenantId, 'ไม่สามารถอ่านไฟล์ภาพได้', 400);
}

$dataUrl = 'data:' . $mime . ';base64,' . base64_encode($imgBinary);

function resolveCardScanCredentials(PDO $db, string $tenantId): array {
    $fallbackBase = defined('KILO_API_BASE_URL') ? rtrim(KILO_API_BASE_URL, '/') : 'https://api.kilo.ai/api/gateway';

    // Try dedicated card-scan model first, then content model, then default model
    $stmt = $db->prepare('SELECT
            cs.ai_cardscan_model_id,
            cs.ai_content_model_id,
            cs.ai_default_model_id
        FROM company_settings cs WHERE cs.tenant_id = ? LIMIT 1');
    $stmt->execute([$tenantId]);
    $cs = $stmt->fetch() ?: [];

    $modelColumns = array_filter([
        $cs['ai_cardscan_model_id'] ?? null,
        $cs['ai_content_model_id']  ?? null,
        $cs['ai_default_model_id']  ?? null,
    ]);

    foreach ($modelColumns as $modelId) {
        $stmt2 = $db->prepare('SELECT am.model_id, ap.api_base_url, ap.api_key_encrypted
            FROM ai_models am JOIN ai_providers ap ON ap.id = am.provider_id
            WHERE am.id = ? LIMIT 1');
        $stmt2->execute([$modelId]);
        $row = $stmt2->fetch();
        if ($row && !empty($row['api_key_encrypted'])) {
            $plain = decryptApiKey($row['api_key_encrypted']);
            if (!empty(trim($plain))) {
                return [
                    'model_id' => (string)$row['model_id'],
                    'api_key'  => trim($plain),
                    'base_url' => rtrim((string)($row['api_base_url'] ?: $fallbackBase), '/'),
                ];
            }
        }
    }

    // Fallback: use active provider (same as chat.php) with a vision-capable default model
    $stmt3 = $db->prepare('SELECT ap.api_base_url, ap.api_key_encrypted
        FROM company_settings cs
        JOIN ai_providers ap ON ap.id = cs.ai_active_provider_id
        WHERE cs.tenant_id = ? AND ap.api_key_encrypted IS NOT NULL AND ap.api_key_encrypted != ""
        LIMIT 1');
    $stmt3->execute([$tenantId]);
    $row3 = $stmt3->fetch();
    if ($row3 && !empty($row3['api_key_encrypted'])) {
        $plain = decryptApiKey($row3['api_key_encrypted']);
        if (!empty(trim($plain))) {
            return [
                'model_id' => 'kilo-auto/balanced',
                'api_key'  => trim($plain),
                'base_url' => rtrim((string)($row3['api_base_url'] ?: $fallbackBase), '/'),
            ];
        }
    }

    // Last resort: KILO_API_TOKEN constant
    if (!empty(KILO_API_TOKEN)) {
        return ['model_id' => 'kilo-auto/balanced', 'api_key' => KILO_API_TOKEN, 'base_url' => $fallbackBase];
    }

    return ['model_id' => '', 'api_key' => '', 'base_url' => ''];
}

$creds = resolveCardScanCredentials($db, $tenantId);
if (empty($creds['api_key'])) {
    scanError($db, $userId, $tenantId, 'ยังไม่ได้ตั้งค่า AI API Key — ตั้งค่าได้ที่ Admin > AI Settings', 400);
}
if (empty($creds['model_id'])) {
    scanError($db, $userId, $tenantId, 'ยังไม่ได้ตั้งค่าโมเดล AI — ตั้งค่าได้ที่ Admin > AI Settings', 400);
}

$systemPrompt = "You are a precise OCR + contact parser for business cards. ตอบเป็นภาษาไทยเท่านั้น — preserve Thai names and addresses exactly as they appear. Return ONLY one JSON object with these keys:\n"
    . "full_name, first_name, last_name, position, email, phone, company_name, website, address, confidence, field_confidence.\n"
    . "Rules:\n"
    . "- Keep unknown values as empty string.\n"
    . "- confidence must be one of: high, medium, low.\n"
    . "- field_confidence must be an object with keys: first_name,last_name,position,email,phone,company_name,website,address and values high|medium|low.\n"
    . "- Do not include markdown or explanations.";

$userText = 'Extract business card details from this image and return JSON only.';

$payload = [
    'model' => $creds['model_id'],
    'messages' => [
        ['role' => 'system', 'content' => $systemPrompt],
        [
            'role' => 'user',
            'content' => [
                ['type' => 'text', 'text' => $userText],
                ['type' => 'image_url', 'image_url' => ['url' => $dataUrl]],
            ],
        ],
    ],
    'temperature' => 0.1,
    'max_tokens' => 900,
];

$ch = curl_init($creds['base_url'] . '/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $creds['api_key'],
    ],
    CURLOPT_POSTFIELDS => json_encode($payload),
    CURLOPT_TIMEOUT => 90,
    CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true,
]);
$raw = curl_exec($ch);
$curlErr = curl_error($ch);
$httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($curlErr) {
    scanError($db, $userId, $tenantId, 'เชื่อมต่อ AI ไม่สำเร็จ: ' . $curlErr, 502);
}
if (!$raw) {
    scanError($db, $userId, $tenantId, 'AI ไม่ตอบกลับ', 502);
}

$decoded = json_decode($raw, true);
$content = trim((string)($decoded['choices'][0]['message']['content'] ?? ''));
if ($content === '') {
    $providerErr = $decoded['error']['message'] ?? '';
    $providerCode = $decoded['error']['code'] ?? '';
    $fallbackErr = $providerErr ?: ('HTTP ' . $httpCode);
    if ($providerCode) $fallbackErr .= ' (' . $providerCode . ')';
    scanError($db, $userId, $tenantId, 'อ่านนามบัตรไม่สำเร็จ: ' . $fallbackErr, 502);
}

if (preg_match('/```(?:json)?\s*([\s\S]*?)```/i', $content, $m)) {
    $content = trim($m[1]);
}
if (preg_match('/\{[\s\S]*\}/', $content, $m)) {
    $content = $m[0];
}

$data = json_decode($content, true);
if (!is_array($data)) {
    scanError($db, $userId, $tenantId, 'AI ตอบกลับไม่เป็น JSON ที่อ่านได้', 502);
}

$result = [
    'full_name' => trim((string)($data['full_name'] ?? '')),
    'first_name' => trim((string)($data['first_name'] ?? '')),
    'last_name' => trim((string)($data['last_name'] ?? '')),
    'position' => trim((string)($data['position'] ?? '')),
    'email' => trim((string)($data['email'] ?? '')),
    'phone' => trim((string)($data['phone'] ?? '')),
    'company_name' => trim((string)($data['company_name'] ?? '')),
    'website' => trim((string)($data['website'] ?? '')),
    'address' => trim((string)($data['address'] ?? '')),
    'confidence' => trim((string)($data['confidence'] ?? 'medium')),
];

$fieldConfidenceRaw = is_array($data['field_confidence'] ?? null) ? $data['field_confidence'] : [];
$fieldConfidence = [];
foreach (['first_name', 'last_name', 'position', 'email', 'phone', 'company_name', 'website', 'address'] as $k) {
    $v = trim((string)($fieldConfidenceRaw[$k] ?? 'medium'));
    $fieldConfidence[$k] = in_array($v, ['high', 'medium', 'low'], true) ? $v : 'medium';
}

if ($result['first_name'] === '' && $result['full_name'] !== '') {
    $parts = preg_split('/\s+/u', $result['full_name']) ?: [];
    if (count($parts) > 0) {
        $result['first_name'] = (string)$parts[0];
        $result['last_name'] = trim(implode(' ', array_slice($parts, 1)));
    }
}

if (!in_array($result['confidence'], ['high', 'medium', 'low'], true)) {
    $result['confidence'] = 'medium';
}

$candidates = [];
$matchReason = 'none';
if ($result['company_name'] !== '') {
    $stmt = $db->prepare('SELECT id, name FROM companies WHERE tenant_id = ? ORDER BY name ASC');
    $stmt->execute([$tenantId]);
    $allCompanies = $stmt->fetchAll() ?: [];

    $needle = normalizeCompanyName($result['company_name']);
    if ($needle !== '') {
        $scored = [];
        foreach ($allCompanies as $co) {
            $norm = normalizeCompanyName((string)($co['name'] ?? ''));
            if ($norm === '') {
                continue;
            }

            $score = 0;
            if ($norm === $needle) {
                $score = 100;
            } elseif (str_contains($norm, $needle) || str_contains($needle, $norm)) {
                $score = 70;
            } elseif (str_contains((string)mb_strtolower((string)$co['name'], 'UTF-8'), (string)mb_strtolower($result['company_name'], 'UTF-8'))) {
                $score = 40;
            }

            if ($score > 0) {
                $scored[] = ['id' => $co['id'], 'name' => $co['name'], 'score' => $score];
            }
        }

        usort($scored, fn($a, $b) => $b['score'] <=> $a['score']);
        $candidates = array_map(
            fn($x) => ['id' => $x['id'], 'name' => $x['name']],
            array_slice($scored, 0, 10)
        );

        if (!empty($scored)) {
            $top = $scored[0]['score'];
            if ($top >= 100) {
                $matchReason = 'exact-normalized';
            } elseif ($top >= 70) {
                $matchReason = 'partial-normalized';
            } else {
                $matchReason = 'name-contains';
            }
        }
    }
}

logCardScanActivity(
    $db,
    $userId,
    $tenantId,
    'card_scan_success',
    'สแกนนามบัตรสำเร็จ: ' . ($result['company_name'] !== '' ? $result['company_name'] : 'ไม่พบชื่อบริษัท') . ' (' . $result['confidence'] . ')'
);

jsonResponse([
    'parsed' => $result,
    'field_confidence' => $fieldConfidence,
    'candidates' => $candidates,
    'match_reason' => $matchReason,
    'model_used' => $creds['model_id'],
]);
