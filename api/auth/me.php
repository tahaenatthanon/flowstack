<?php
// GET /api/auth/me.php
// Returns current user info from JWT token
require_once __DIR__ . '/../auth.php';

if (getMethod() !== 'GET') {
    jsonError('Method not allowed', 405);
}

$tokenData = requireAuth();
$tenantId  = $tokenData['tenant_id'];

$db = getDB();
$hasPosition    = (bool)$db->query("SHOW COLUMNS FROM users LIKE 'position'")->rowCount();
$hasAvatarUrl   = (bool)$db->query("SHOW COLUMNS FROM users LIKE 'avatar_url'")->rowCount();
$hasIsSuperadmin = (bool)$db->query("SHOW COLUMNS FROM users LIKE 'is_superadmin'")->rowCount();
$meCols = 'id, email, display_name'
    . ($hasPosition     ? ', position'      : ", '' AS position")
    . ($hasAvatarUrl    ? ', avatar_url'    : ", '' AS avatar_url")
    . ', is_active'
    . ($hasIsSuperadmin ? ', is_superadmin' : ', 0 AS is_superadmin')
    . ', created_at';
$stmt = $db->prepare("SELECT $meCols FROM users WHERE id = ?");
$stmt->execute([$tokenData['user_id']]);
$user = $stmt->fetch();

if (!$user) {
    jsonError('ไม่พบผู้ใช้', 404);
}

if (!$user['is_active']) {
    jsonError('บัญชีผู้ใช้ถูกระงับการใช้งาน', 403);
}

// Superadmin impersonating a tenant — bypass membership check
$isSuperadmin = !empty($user['is_superadmin']);
$isImpersonating = !empty($_SERVER['HTTP_X_SUPERADMIN_TENANT']);

if ($isSuperadmin && $isImpersonating) {
    $isAdmin = 1;
    $roleId  = null;
} else {
    $tuStmt = $db->prepare('SELECT is_admin, role_id FROM tenant_users WHERE user_id = ? AND tenant_id = ?');
    $tuStmt->execute([$user['id'], $tenantId]);
    $tu = $tuStmt->fetch();
    if (!$tu) {
        jsonError('Forbidden: user is not a member of this tenant', 403);
    }
    $isAdmin = (int)$tu['is_admin'];
    $roleId  = $tu['role_id'];
}

$permissions = getUserPermissions($db, $user['id'], $tenantId);

$roleLabel = null;
if ($roleId) {
    $roleStmt = $db->prepare('SELECT label FROM roles WHERE id = ?');
    $roleStmt->execute([$roleId]);
    $roleLabel = $roleStmt->fetchColumn() ?: null;
}

// Rewrite avatar_url to use current request host.
// This fixes legacy absolute URLs stored with 'localhost' and handles relative paths.
$avatarUrl = $user['avatar_url'];
if ($avatarUrl) {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];
    if (str_starts_with($avatarUrl, 'http://') || str_starts_with($avatarUrl, 'https://')) {
        // Legacy absolute URL: replace hostname with current request host
        $path = parse_url($avatarUrl, PHP_URL_PATH);
        $avatarUrl = $protocol . '://' . $host . $path;
    } else {
        // Relative path: prepend current host
        $avatarUrl = $protocol . '://' . $host . $avatarUrl;
    }
}

// Fetch email aliases for this user
$aliasStmt = $db->prepare('SELECT id, alias_email, label, created_at FROM user_email_aliases WHERE user_id = ? ORDER BY created_at ASC');
$aliasStmt->execute([$user['id']]);
$aliases = $aliasStmt->fetchAll();

jsonResponse([
    'id'           => $user['id'],
    'email'        => $user['email'],
    'display_name' => $user['display_name'],
    'position'     => $user['position'],
    'avatar_url'   => $avatarUrl,
    'is_admin'     => $isAdmin,
    'is_active'    => $user['is_active'],
    'role_id'      => $roleId,
    'role_label'   => $roleLabel,
    'tenant_id'    => $tenantId,
    'permissions'  => $permissions,
    'aliases'      => $aliases,
    'is_superadmin'=> (int)($user['is_superadmin'] ?? 0),
    'created_at'   => $user['created_at'],
]);
