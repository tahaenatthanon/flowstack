<?php
// POST /api/agent-auth.php — Exchange API Key for JWT
// Accepts: X-API-Key: fsk_... or Authorization: Bearer fsk_...
// Returns: { "token": "<JWT>", "expires_in": 604800 }

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

if (getMethod() !== 'POST') {
    jsonError('Method not allowed', 405);
}

// ── Rate limiting: 5 attempts / 15 min / IP (DB-backed, atomic) ─────────────────
$clientIp = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';

function checkRateLimit(string $clientIp, PDO $db): void {
    $limitKey   = 'agent_auth:' . $clientIp;
    $maxAttempts = 5;
    $windowSecs  = 900; // 15 minutes

    // Purge expired rows for this key first (keeps table lean)
    $db->prepare("DELETE FROM rate_limits WHERE `key` = ? AND window_end < NOW()")
       ->execute([$limitKey]);

    // Atomic upsert: insert new row or increment existing counter
    // ON DUPLICATE KEY UPDATE is atomic at the InnoDB row level — no TOCTOU race
    $db->prepare("
        INSERT INTO rate_limits (`key`, attempts, window_end)
        VALUES (?, 1, DATE_ADD(NOW(), INTERVAL ? SECOND))
        ON DUPLICATE KEY UPDATE attempts = attempts + 1
    ")->execute([$limitKey, $windowSecs]);

    // Read back the current count and window_end
    $row = $db->prepare("SELECT attempts, window_end FROM rate_limits WHERE `key` = ?");
    $row->execute([$limitKey]);
    $entry = $row->fetch(PDO::FETCH_ASSOC);

    if ($entry && (int)$entry['attempts'] > $maxAttempts) {
        $wait = max(1, (int)ceil((strtotime($entry['window_end']) - time()) / 60));
        jsonError("ลองมากเกินไป กรุณารอ {$wait} นาที", 429);
    }
}

checkRateLimit($clientIp, getDB());

// ── Extract API key ─────────────────────────────────────────────────────────────
$apiKey = '';
// Check X-API-Key header first
if (!empty($_SERVER['HTTP_X_API_KEY'])) {
    $apiKey = trim($_SERVER['HTTP_X_API_KEY']);
} elseif (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
    // Also allow Authorization: Bearer fsk_...
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    if (preg_match('/^Bearer\s+(.+)$/i', $authHeader, $m)) {
        $apiKey = trim($m[1]);
    }
}

if (!$apiKey || !str_starts_with($apiKey, 'fsk_')) {
    jsonError('กรุณาระบุ X-API-Key header ด้วย API key ที่ถูกต้อง', 401);
}

if (strlen($apiKey) < 55) { // fsk_ (4) + 48 hex = 52 minimum
    jsonError('รูปแบบ API key ไม่ถูกต้อง', 401);
}

// ── Hash and look up ────────────────────────────────────────────────────────────
$keyHash = hash('sha256', $apiKey);
$db = getDB();

$stmt = $db->prepare(
    "SELECT ak.*, u.email, u.is_active AS user_active, u.display_name,
            u.tenant_id AS user_tenant_id
     FROM agent_api_keys ak
     JOIN users u ON u.id = ak.user_id
     WHERE ak.key_hash = ?"
);
$stmt->execute([$keyHash]);
$keyRow = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$keyRow) {
    // Constant-time-ish delay to reduce key-enumeration timing attacks
    usleep(100000); // 100ms
    jsonError('API key ไม่ถูกต้อง', 401);
}

// ── Validate key ────────────────────────────────────────────────────────────────
if (!$keyRow['is_active']) {
    jsonError('API key นี้ถูกระงับการใช้งาน', 403);
}
if (!$keyRow['user_active']) {
    jsonError('บัญชีผู้ใช้ของ key นี้ถูกระงับ', 403);
}
if ($keyRow['expires_at'] && strtotime($keyRow['expires_at']) < time()) {
    jsonError('API key นี้หมดอายุแล้ว', 403);
}

$userId   = $keyRow['user_id'];
$tenantId = $keyRow['tenant_id'];

// ── Generate JWT (7-day expiry, same as normal login) ───────────────────────────
// Override JWT_EXPIRY for agent tokens to 7 days
$agentExpiry = 604800; // 7 days in seconds
$header  = base64UrlEncode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
$payload = base64UrlEncode(json_encode([
    'user_id'   => $userId,
    'email'     => $keyRow['email'],
    'tenant_id' => $tenantId,
    'agent_key' => $keyRow['id'],
    'exp'       => time() + $agentExpiry,
    'iat'       => time(),
]));
$signature = base64UrlEncode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
$jwt = "$header.$payload.$signature";

// ── Update last_used_at ─────────────────────────────────────────────────────────
$db->prepare("UPDATE agent_api_keys SET last_used_at = NOW() WHERE id = ?")
   ->execute([$keyRow['id']]);

// ── Log to activity_logs (if table exists) ──────────────────────────────────────
try {
    $logId = generateUUID();
    $db->prepare(
        "INSERT INTO activity_logs (id, user_id, tenant_id, action, entity_type, entity_id, details, ip_address, created_at)
         VALUES (?, ?, ?, 'agent_auth', 'agent_api_key', ?, ?, ?, NOW())"
    )->execute([
        $logId, $userId, $tenantId, $keyRow['id'],
        json_encode(['key_name' => $keyRow['name'], 'key_prefix' => $keyRow['key_prefix']]),
        $clientIp,
    ]);
} catch (Exception $e) {
    // activity_logs may not exist yet — non-critical
}

// ── Return JWT ──────────────────────────────────────────────────────────────────
jsonResponse([
    'token'      => $jwt,
    'expires_in' => $agentExpiry,
    'token_type' => 'Bearer',
    'user'       => [
        'id'           => $userId,
        'email'        => $keyRow['email'],
        'display_name' => $keyRow['display_name'],
    ],
]);
