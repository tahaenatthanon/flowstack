<?php
// POST /api/auth/login.php
// Body: { "email": "...", "password": "..." }
require_once __DIR__ . '/../auth.php';

if (getMethod() !== 'POST') {
    jsonError('Method not allowed', 405);
}

$body = getRequestBody();
$email = trim($body['email'] ?? '');
$password = $body['password'] ?? '';

if (empty($email) || empty($password)) {
    jsonError('กรุณากรอกอีเมลและรหัสผ่าน');
}

$db = getDB();

// --- Rate limiting: max 20 failed attempts per email per 15 minutes ---
// IP-based limiting is intentionally removed to avoid blocking users behind shared NAT/proxies.
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$rateLimitActive = false;
try {
    $window = date('Y-m-d H:i:s', time() - 900);
    // Purge stale records
    $db->prepare('DELETE FROM login_rate_limits WHERE attempt_at < ?')->execute([$window]);
    // Check per-email limit only
    if (!empty($email)) {
        $emailStmt = $db->prepare('SELECT COUNT(*) FROM login_rate_limits WHERE email = ?');
        $emailStmt->execute([$email]);
        if ((int) $emailStmt->fetchColumn() >= 20) {
            jsonError('พยายามเข้าสู่ระบบมากเกินไป กรุณารอ 15 นาทีแล้วลองใหม่', 429);
        }
    }
    $rateLimitActive = true;
} catch (PDOException $e) {
    // Table not yet created — rate limiting disabled until migration runs
}

// Detect which optional columns exist (production DB may be behind local schema)
$hasPosition    = false;
$hasAvatarUrl   = false;
$hasIsAdmin     = false;
$hasIsSuperadmin = false;
$hasIsActive    = false;
$hasRoleId      = false;
try {
    $colCheck = $db->query("SHOW COLUMNS FROM users LIKE 'position'");
    $hasPosition = $colCheck && $colCheck->rowCount() > 0;
    $colCheck2 = $db->query("SHOW COLUMNS FROM users LIKE 'avatar_url'");
    $hasAvatarUrl = $colCheck2 && $colCheck2->rowCount() > 0;
    $colCheck3 = $db->query("SHOW COLUMNS FROM users LIKE 'is_admin'");
    $hasIsAdmin = $colCheck3 && $colCheck3->rowCount() > 0;
    $colCheck4 = $db->query("SHOW COLUMNS FROM users LIKE 'is_superadmin'");
    $hasIsSuperadmin = $colCheck4 && $colCheck4->rowCount() > 0;
    $colCheck5 = $db->query("SHOW COLUMNS FROM users LIKE 'is_active'");
    $hasIsActive = $colCheck5 && $colCheck5->rowCount() > 0;
    $colCheck6 = $db->query("SHOW COLUMNS FROM users LIKE 'role_id'");
    $hasRoleId = $colCheck6 && $colCheck6->rowCount() > 0;
} catch (PDOException $e) {}

$selectCols = 'id, email, password_hash, display_name'
    . ($hasPosition     ? ', position'      : ", '' AS position")
    . ($hasAvatarUrl    ? ', avatar_url'    : ", '' AS avatar_url")
    . ($hasIsAdmin      ? ', is_admin'      : ', 0 AS is_admin')
    . ($hasIsActive     ? ', is_active'     : ', 1 AS is_active')
    . ($hasIsSuperadmin ? ', is_superadmin' : ', 0 AS is_superadmin')
    . ($hasRoleId       ? ', role_id'       : ', NULL AS role_id');

// 1. Try to find user directly by their primary email
$stmt = $db->prepare("SELECT $selectCols FROM users WHERE email = ?");
$stmt->execute([$email]);
$user = $stmt->fetch();

// 2. If not found by primary email, check alias table (skip if table absent)
$hasAliasTable = false;
try {
    $aliasTableCheck = $db->query("SHOW TABLES LIKE 'user_email_aliases'");
    $hasAliasTable = $aliasTableCheck && $aliasTableCheck->rowCount() > 0;
} catch (PDOException $e) {}

if (!$user && $hasAliasTable) {
    $aliasSelectCols = 'u.id, u.email, u.password_hash, u.display_name'
        . ($hasPosition     ? ', u.position'      : ", '' AS position")
        . ($hasAvatarUrl    ? ', u.avatar_url'     : ", '' AS avatar_url")
        . ($hasIsAdmin      ? ', u.is_admin'       : ', 0 AS is_admin')
        . ($hasIsActive     ? ', u.is_active'      : ', 1 AS is_active')
        . ($hasIsSuperadmin ? ', u.is_superadmin'  : ', 0 AS is_superadmin')
        . ($hasRoleId       ? ', u.role_id'        : ', NULL AS role_id');
    $aliasStmt = $db->prepare("
        SELECT $aliasSelectCols
        FROM user_email_aliases a
        JOIN users u ON u.id = a.user_id
        WHERE a.alias_email = ?
    ");
    $aliasStmt->execute([$email]);
    $user = $aliasStmt->fetch();
}

if (!$user || !password_verify($password, $user['password_hash'])) {
    if ($rateLimitActive) {
        try {
            $db->prepare('INSERT INTO login_rate_limits (ip_address, email) VALUES (?, ?)')
               ->execute([$ip, $email ?: null]);
        } catch (PDOException $e) {}
    }
    jsonError('อีเมลหรือรหัสผ่านไม่ถูกต้อง', 401);
}

// Clear rate limit records for this email on successful authentication
if ($rateLimitActive && !empty($email)) {
    try {
        $db->prepare('DELETE FROM login_rate_limits WHERE email = ?')->execute([$email]);
    } catch (PDOException $e) {}
}

if (!$user['is_active']) {
    jsonError('บัญชีผู้ใช้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ', 403);
}

// Resolve which tenant this user belongs to.
// If the user belongs to exactly one tenant, use it automatically.
// If multiple, the client should call /auth/select-tenant.php to choose.
$tuStmt = $db->prepare('SELECT tenant_id FROM tenant_users WHERE user_id = ? ORDER BY joined_at ASC LIMIT 1');
$tuStmt->execute([$user['id']]);
$tenantRow = $tuStmt->fetch();
if (!$tenantRow) {
    jsonError('ผู้ใช้งานไม่ได้เป็นสมาชิกของ Tenant ใด กรุณาติดต่อผู้ดูแลระบบ', 403);
}
$tenantId = $tenantRow['tenant_id'];

$token = generateToken($user['id'], $user['email'], $tenantId);
$permissions = getUserPermissions($db, $user['id'], $tenantId);

// Log user login activity (ignore if table doesn't exist yet)
try {
    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? null;
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;
    $logStmt = $db->prepare('INSERT INTO user_activity_logs (id, user_id, action, description, ip_address, user_agent, created_at) VALUES (UUID(), ?, ?, ?, ?, ?, NOW())');
    $logStmt->execute([$user['id'], 'login', 'เข้าสู่ระบบ', $ipAddress, $userAgent]);
} catch (Exception $e) {
    // Table doesn't exist yet, ignore
}

// Get role label from the tenant-scoped role assignment
$roleLabel = null;
$tuRoleStmt = $db->prepare('SELECT is_admin, role_id FROM tenant_users WHERE user_id = ? AND tenant_id = ?');
$tuRoleStmt->execute([$user['id'], $tenantId]);
$tuRow = $tuRoleStmt->fetch();
$tenantIsAdmin = $tuRow ? (int)$tuRow['is_admin'] : 0;
$tenantRoleId  = $tuRow ? $tuRow['role_id'] : null;
if ($tenantRoleId) {
    $roleStmt = $db->prepare('SELECT label FROM roles WHERE id = ?');
    $roleStmt->execute([$tenantRoleId]);
    $roleLabel = $roleStmt->fetchColumn() ?: null;
}

// Rewrite avatar_url to current host (fixes legacy localhost URLs on production)
$avatarUrl = $user['avatar_url'];
if ($avatarUrl) {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];
    if (str_starts_with($avatarUrl, 'http://') || str_starts_with($avatarUrl, 'https://')) {
        $path = parse_url($avatarUrl, PHP_URL_PATH);
        $avatarUrl = $protocol . '://' . $host . $path;
    } else {
        $avatarUrl = $protocol . '://' . $host . $avatarUrl;
    }
}

jsonResponse([
    'token' => $token,
    'user' => [
        'id'            => $user['id'],
        'email'         => $user['email'],
        'display_name'  => $user['display_name'],
        'position'      => $user['position'],
        'avatar_url'    => $avatarUrl,
        'is_admin'      => $tenantIsAdmin,
        'is_active'     => $user['is_active'],
        'is_superadmin' => (int)($user['is_superadmin'] ?? 0),
        'role_id'       => $tenantRoleId,
        'role_label'    => $roleLabel,
        'tenant_id'     => $tenantId,
        'permissions'   => $permissions,
    ],
]);
