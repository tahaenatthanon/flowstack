<?php
// ============================================
// Flowstack API - JWT Authentication Helper
// ============================================

require_once __DIR__ . '/config.php';

// --- JWT Functions ---

// Only define if not already defined (may be defined in config.php)
if (!function_exists('base64UrlEncode')) {
    function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}

if (!function_exists('base64UrlDecode')) {
    function base64UrlDecode(string $data): string {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}

function generateToken(string $userId, string $email, string $tenantId): string {
    $header = base64UrlEncode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = base64UrlEncode(json_encode([
        'user_id'   => $userId,
        'email'     => $email,
        'tenant_id' => $tenantId,
        'exp'       => time() + JWT_EXPIRY,
        'iat'       => time(),
    ]));
    $signature = base64UrlEncode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    return "$header.$payload.$signature";
}

function verifyToken(): ?array {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (empty($authHeader)) return null;

    if (!preg_match('/^Bearer\s+(.+)$/i', $authHeader, $matches)) return null;
    $token = $matches[1];

    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;

    [$header, $payload, $signature] = $parts;

    // Verify signature
    $expectedSignature = base64UrlEncode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    if (!hash_equals($expectedSignature, $signature)) return null;

    // Decode payload
    $data = json_decode(base64UrlDecode($payload), true);
    if (!$data) return null;

    // Check expiry
    if (isset($data['exp']) && $data['exp'] < time()) return null;

    return $data;
}

function requireAuth(): array {
    $tokenData = verifyToken();
    if (!$tokenData) {
        jsonError('Unauthorized', 401);
    }
    // Ensure tenant_id is always present; old tokens without it are rejected.
    if (empty($tokenData['tenant_id'])) {
        jsonError('Unauthorized: token missing tenant context. Please log in again.', 401);
    }

    // Allow superadmin to impersonate any tenant via X-Superadmin-Tenant header
    $overrideTenant = $_SERVER['HTTP_X_SUPERADMIN_TENANT'] ?? null;
    if ($overrideTenant) {
        $db   = getDB();
        $stmt = $db->prepare('SELECT is_superadmin FROM users WHERE id = ?');
        $stmt->execute([$tokenData['user_id']]);
        $row  = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row && !empty($row['is_superadmin'])) {
            $tokenData['tenant_id']     = $overrideTenant;
            $tokenData['is_superadmin'] = 1;
        }
    }

    return $tokenData;
}

// Returns true if user is a platform superadmin OR a tenant-level admin.
// Use this everywhere instead of inline "SELECT is_admin FROM tenant_users" checks.
function isTenantAdmin(PDO $db, string $userId, string $tenantId): bool {
    $stmt = $db->prepare('SELECT is_superadmin FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row && !empty($row['is_superadmin'])) return true;

    $stmt = $db->prepare('SELECT is_admin FROM tenant_users WHERE user_id = ? AND tenant_id = ?');
    $stmt->execute([$userId, $tenantId]);
    return (int)($stmt->fetchColumn() ?? 0) === 1;
}

function requireAdmin(PDO $db, string $userId, string $tenantId): void {
    // Superadmin bypasses tenant admin check
    $stmt = $db->prepare('SELECT is_superadmin FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row && !empty($row['is_superadmin'])) return;

    $stmt = $db->prepare('SELECT is_admin FROM tenant_users WHERE user_id = ? AND tenant_id = ?');
    $stmt->execute([$userId, $tenantId]);
    $row = $stmt->fetch();
    if (!$row || intval($row['is_admin']) !== 1) {
        jsonError('Forbidden', 403);
    }
}

function requireAdminOrPermission(PDO $db, string $userId, string $tenantId, string $permission): void {
    // Superadmin bypasses all permission checks
    $stmt = $db->prepare('SELECT is_superadmin FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $saRow = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($saRow && !empty($saRow['is_superadmin'])) return;

    $stmt = $db->prepare('SELECT is_admin, role_id FROM tenant_users WHERE user_id = ? AND tenant_id = ?');
    $stmt->execute([$userId, $tenantId]);
    $tu = $stmt->fetch();

    if (!$tu) {
        jsonError('Forbidden', 403);
    }

    // Tenant-level admin has full access
    if (intval($tu['is_admin']) === 1) {
        return;
    }

    // Check role-based permission scoped to this tenant
    if ($tu['role_id']) {
        $stmt = $db->prepare('SELECT 1 FROM role_menu_permissions WHERE role_id = ? AND menu_key = ?');
        $stmt->execute([$tu['role_id'], $permission]);
        if ($stmt->fetch()) {
            return;
        }
    }

    jsonError('Forbidden', 403);
}

// All available menu keys in the system
const ALL_MENU_KEYS = ['home','projects','sales','quotations','companies','revenue','resources','task_hours','reports','analytics','marketing','goals','automation','budget','support','admin','inbox','calendar','task_intelligence','workflow','brand_setting','media_studio','data_management','lead_generation','content_approval'];

// Returns array of menu_key strings the user is allowed to access within a tenant
function getUserPermissions(PDO $db, string $userId, string $tenantId): array {
    // Superadmin always has all permissions
    $saStmt = $db->prepare('SELECT is_superadmin FROM users WHERE id = ?');
    $saStmt->execute([$userId]);
    $saRow = $saStmt->fetch(PDO::FETCH_ASSOC);
    if ($saRow && !empty($saRow['is_superadmin'])) {
        return ALL_MENU_KEYS;
    }

    $stmt = $db->prepare('SELECT is_admin, role_id FROM tenant_users WHERE user_id = ? AND tenant_id = ?');
    $stmt->execute([$userId, $tenantId]);
    $tu = $stmt->fetch();
    if (!$tu) {
        return [];
    }
    if (intval($tu['is_admin']) === 1) {
        return ALL_MENU_KEYS;
    }
    if ($tu['role_id']) {
        $stmt = $db->prepare('SELECT menu_key FROM role_menu_permissions WHERE role_id = ?');
        $stmt->execute([$tu['role_id']]);
        return array_column($stmt->fetchAll(), 'menu_key');
    }
    return [];
}

// --- Project & Task Access Helpers ---

if (!function_exists('canAccessProject')) {
    function canAccessProject(PDO $db, ?string $projectId, string $userId, string $tenantId, bool $isAdmin): bool {
        if ($isAdmin) return true;
        if (!$projectId) return true;
        // Base Calendar is shared with everyone in the tenant
        $stmt = $db->prepare('
            SELECT 1 FROM projects p
            LEFT JOIN project_members pm ON p.id = pm.project_id
            WHERE p.id = ? AND p.tenant_id = ?
              AND p.deleted_at IS NULL
              AND (p.user_id = ? OR pm.user_id = ? OR p.kind = ?)
        ');
        $stmt->execute([$projectId, $tenantId, $userId, $userId, 'base_calendar']);
        return (bool)$stmt->fetch();
    }
}

if (!function_exists('getProjectKind')) {
    // Returns 'project' or 'base_calendar' or null if not found
    function getProjectKind(PDO $db, string $projectId, string $tenantId): ?string {
        $stmt = $db->prepare('SELECT kind FROM projects WHERE id = ? AND tenant_id = ?');
        $stmt->execute([$projectId, $tenantId]);
        $kind = $stmt->fetchColumn();
        return $kind === false ? null : $kind;
    }
}

if (!function_exists('getBaseCalendarProjectId')) {
    // Returns the Base Calendar project id for a tenant (or null if not seeded)
    function getBaseCalendarProjectId(PDO $db, string $tenantId): ?string {
        $stmt = $db->prepare("SELECT id FROM projects WHERE tenant_id = ? AND kind = 'base_calendar' AND deleted_at IS NULL LIMIT 1");
        $stmt->execute([$tenantId]);
        $id = $stmt->fetchColumn();
        return $id === false ? null : $id;
    }
}

if (!function_exists('getTaskWithAccess')) {
    function getTaskWithAccess(PDO $db, string $taskId, string $userId, string $tenantId, bool $isAdmin): array {
        $stmt = $db->prepare('SELECT * FROM tasks WHERE id = ? AND tenant_id = ?');
        $stmt->execute([$taskId, $tenantId]);
        $task = $stmt->fetch();
        if (!$task) jsonError('Task not found', 404);
        if (!$task['project_id'] && !$isAdmin && $task['user_id'] !== $userId) {
            jsonError('Forbidden', 403);
        }
        if ($task['project_id'] && !canAccessProject($db, $task['project_id'], $userId, $tenantId, $isAdmin)) {
            jsonError('Forbidden', 403);
        }
        return $task;
    }
}

// ── Superadmin guard ──────────────────────────────────────────────────────
if (!function_exists('requireSuperAdmin')) {
    function requireSuperAdmin(): array {
        $user = requireAuth();
        $db   = getDB();
        $stmt = $db->prepare('SELECT is_superadmin FROM users WHERE id = ?');
        $stmt->execute([$user['user_id']]);
        $row  = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row || empty($row['is_superadmin'])) {
            jsonError('Forbidden — superadmin only', 403);
        }
        $user['is_superadmin'] = 1;
        return $user;
    }
}

// ── Plan enforcement ──────────────────────────────────────────────────────
if (!function_exists('checkUserLimit')) {
    function checkUserLimit(PDO $db, string $tenantId): void {
        $stmt = $db->prepare('
            SELECT pl.max_users
            FROM subscriptions s
            JOIN plan_limits pl ON pl.plan = s.plan
            WHERE s.tenant_id = ? AND s.status = "active"
        ');
        $stmt->execute([$tenantId]);
        $maxUsers = $stmt->fetchColumn();

        if ($maxUsers === false) $maxUsers = 1;
        $maxUsers = (int)$maxUsers;
        if ($maxUsers === 0) return;

        $countStmt = $db->prepare('SELECT COUNT(*) FROM tenant_users WHERE tenant_id = ?');
        $countStmt->execute([$tenantId]);
        $current = (int)$countStmt->fetchColumn();

        if ($current >= $maxUsers) {
            jsonError(
                "แผนปัจจุบันรองรับสูงสุด {$maxUsers} users กรุณาอัปเกรดแผน",
                402
            );
        }
    }
}
