<?php
// /api/agent-keys.php — API Key CRUD management
//
// GET    /api/agent-keys.php            — list current user's keys
// GET    /api/agent-keys.php?id=xxx     — get single key metadata (plaintext never returned)
// POST   /api/agent-keys.php            — create new key (returns plaintext ONCE)
// PUT    /api/agent-keys.php?id=xxx     — update key (rename, toggle is_active, change expiry)
// DELETE /api/agent-keys.php?id=xxx     — permanently delete key
//
// Admin (is_admin=1) can manage all keys; regular users see only their own.

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

$db = getDB();
$tokenData = requireAuth();
$userId   = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
// Check admin status from DB — same pattern as calendar.php
$isAdmin = isTenantAdmin($db, $userId, $tenantId);

$method = getMethod();
$id     = $_GET['id'] ?? '';

// ── POST: Create new API key ────────────────────────────────────────────────────
if ($method === 'POST') {
    $body = getRequestBody();
    $name = trim($body['name'] ?? '');
    if (!$name) jsonError('กรุณาระบุชื่อ key', 400);

    // Optionally allow admin to create for another user
    $targetUserId = $userId;
    if ($isAdmin && !empty($body['user_id'])) {
        $targetUserId = $body['user_id'];
        // Verify user belongs to same tenant
        $stmt = $db->prepare("SELECT id FROM users WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$targetUserId, $tenantId]);
        if (!$stmt->fetch()) jsonError('ไม่พบผู้ใช้ใน tenant นี้', 404);
    }

    $permissions = isset($body['permissions']) ? json_encode($body['permissions']) : null;
    // Default to 90 days if caller does not specify an expiry.
    // Pass expires_at=null explicitly to opt out (admin only).
    if (!empty($body['expires_at'])) {
        $expiresAt = $body['expires_at'];
    } elseif ($isAdmin && array_key_exists('expires_at', $body) && $body['expires_at'] === null) {
        $expiresAt = null; // admin explicitly requested no expiry
    } else {
        $expiresAt = date('Y-m-d H:i:s', strtotime('+90 days'));
    }

    // Generate key: fsk_ + 48 hex chars (24 bytes → 48 hex)
    $plainKey = 'fsk_' . bin2hex(random_bytes(24));
    $keyHash  = hash('sha256', $plainKey);
    $keyPrefix = substr($plainKey, 0, 7); // fsk_xx

    $newId = generateUUID();
    $db->prepare(
        "INSERT INTO agent_api_keys (id, user_id, tenant_id, name, key_hash, key_prefix, permissions, expires_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )->execute([$newId, $targetUserId, $tenantId, $name, $keyHash, $keyPrefix, $permissions, $expiresAt, $userId]);

    jsonResponse([
        'id'         => $newId,
        'name'       => $name,
        'key'        => $plainKey,  // Plaintext returned ONCE
        'key_prefix' => $keyPrefix,
        'expires_at' => $expiresAt,
        'message'    => 'บันทึก API key นี้ไว้ — จะไม่มีการแสดงอีก',
    ], 201);
}

// ── GET: List or single key ─────────────────────────────────────────────────────
if ($method === 'GET') {
    if ($id) {
        $stmt = $db->prepare(
            "SELECT id, user_id, name, key_prefix, permissions, last_used_at, expires_at, is_active, created_at, updated_at
             FROM agent_api_keys WHERE id = ? AND tenant_id = ?"
        );
        $stmt->execute([$id, $tenantId]);
        $key = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$key) jsonError('ไม่พบ key นี้', 404);
        // Non-admin can only see own keys
        if (!$isAdmin && $key['user_id'] !== $userId) jsonError('Forbidden', 403);
        jsonResponse($key);
    } else {
        // List keys
        $where = 'tenant_id = ?';
        $params = [$tenantId];
        if (!$isAdmin) {
            $where .= ' AND user_id = ?';
            $params[] = $userId;
        }
        $stmt = $db->prepare(
            "SELECT ak.id, ak.user_id, ak.name, ak.key_prefix, ak.permissions,
                    ak.last_used_at, ak.expires_at, ak.is_active, ak.created_at, ak.updated_at,
                    u.display_name AS user_display_name, u.email AS user_email,
                    CASE WHEN ak.expires_at IS NULL THEN 1 ELSE 0 END AS no_expiry_warning
             FROM agent_api_keys ak
             JOIN users u ON u.id = ak.user_id
             WHERE $where
             ORDER BY ak.created_at DESC"
        );
        $stmt->execute($params);
        jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
    }
}

// ── PUT: Update key ─────────────────────────────────────────────────────────────
if ($method === 'PUT') {
    if (!$id) jsonError('id required', 400);

    // Verify ownership
    $stmt = $db->prepare("SELECT * FROM agent_api_keys WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$id, $tenantId]);
    $key = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$key) jsonError('ไม่พบ key นี้', 404);
    if (!$isAdmin && $key['user_id'] !== $userId) jsonError('Forbidden', 403);

    $body = getRequestBody();
    $sets = [];
    $params = [];

    if (isset($body['name']))       { $sets[] = 'name = ?';       $params[] = trim($body['name']); }
    if (isset($body['is_active']))  { $sets[] = 'is_active = ?';  $params[] = (int)$body['is_active']; }
    if (array_key_exists('expires_at', $body)) {
        $sets[] = 'expires_at = ?';
        $params[] = $body['expires_at'] ?: null;
    }
    if (isset($body['permissions'])) {
        $sets[] = 'permissions = ?';
        $params[] = $body['permissions'] ? json_encode($body['permissions']) : null;
    }

    if (empty($sets)) jsonError('ไม่มีข้อมูลที่ต้องการอัปเดต', 400);

    $params[] = $id;
    $db->prepare("UPDATE agent_api_keys SET " . implode(', ', $sets) . " WHERE id = ?")
       ->execute($params);

    jsonResponse(['ok' => true, 'message' => 'อัปเดต key สำเร็จ']);
}

// ── DELETE: Permanently delete key ──────────────────────────────────────────────
if ($method === 'DELETE') {
    if (!$id) jsonError('id required', 400);

    $stmt = $db->prepare("SELECT * FROM agent_api_keys WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$id, $tenantId]);
    $key = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$key) jsonError('ไม่พบ key นี้', 404);
    if (!$isAdmin && $key['user_id'] !== $userId) jsonError('Forbidden', 403);

    $db->prepare("DELETE FROM agent_api_keys WHERE id = ? AND tenant_id = ?")->execute([$id, $tenantId]);
    jsonResponse(['ok' => true, 'message' => 'ลบ key สำเร็จ']);
}

jsonError('Method not allowed', 405);
