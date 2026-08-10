<?php
// POST /api/auth/refresh.php
// Exchanges a valid (non-expired) JWT for a new token with a fresh expiry.
// Body: (none) — token read from Authorization: Bearer header
require_once __DIR__ . '/../auth.php';

if (getMethod() !== 'POST') {
    jsonError('Method not allowed', 405);
}

$tokenData = requireAuth();

$userId   = $tokenData['user_id'];
$email    = $tokenData['email'];
$tenantId = $tokenData['tenant_id'];

$db = getDB();

// Verify user still active
$stmt = $db->prepare('SELECT is_active FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();
if (!$user || !$user['is_active']) {
    jsonError('บัญชีผู้ใช้ถูกระงับการใช้งาน', 403);
}

// Verify user still in tenant
$tuStmt = $db->prepare('SELECT is_admin, role_id FROM tenant_users WHERE user_id = ? AND tenant_id = ?');
$tuStmt->execute([$userId, $tenantId]);
$tu = $tuStmt->fetch();
if (!$tu) {
    jsonError('Unauthorized: tenant membership revoked', 401);
}

$newToken   = generateToken($userId, $email, $tenantId);
$permissions = getUserPermissions($db, $userId, $tenantId);

jsonResponse([
    'token'       => $newToken,
    'expires_in'  => JWT_EXPIRY,
    'permissions' => $permissions,
]);
