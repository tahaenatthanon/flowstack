<?php
// GET    /api/roles.php       - list all roles with their permissions (admin only)
// POST   /api/roles.php       - create a new role (admin only)
// PUT    /api/roles.php?id=N  - update role label + permissions (admin only)
// DELETE /api/roles.php?id=N  - delete role (admin only, cannot delete if users are assigned)
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db = getDB();

requireAdmin($db, $userId, $tenantId);

$method = getMethod();

function getRoleWithPermissions(PDO $db, int $id, string $tenantId): ?array {
    $stmt = $db->prepare('SELECT * FROM roles WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$id, $tenantId]);
    $role = $stmt->fetch();
    if (!$role) return null;
    $stmt = $db->prepare('SELECT menu_key FROM role_menu_permissions WHERE role_id = ? ORDER BY menu_key ASC');
    $stmt->execute([$id]);
    $role['permissions'] = array_column($stmt->fetchAll(), 'menu_key');
    return $role;
}

// --- GET ---
if ($method === 'GET') {
    $id = $_GET['id'] ?? null;
    if ($id) {
        $role = getRoleWithPermissions($db, (int)$id, $tenantId);
        if (!$role) jsonError('ไม่พบ Role', 404);
        jsonResponse($role);
    }

    $rolesStmt = $db->prepare('SELECT * FROM roles WHERE tenant_id = ? ORDER BY id ASC');
    $rolesStmt->execute([$tenantId]);
    $roles = $rolesStmt->fetchAll();
    foreach ($roles as &$role) {
        $stmt = $db->prepare('SELECT menu_key FROM role_menu_permissions WHERE role_id = ? ORDER BY menu_key ASC');
        $stmt->execute([$role['id']]);
        $role['permissions'] = array_column($stmt->fetchAll(), 'menu_key');

        $countStmt = $db->prepare('SELECT COUNT(*) FROM tenant_users WHERE role_id = ? AND tenant_id = ?');
        $countStmt->execute([$role['id'], $tenantId]);
        $role['user_count'] = (int)$countStmt->fetchColumn();
    }
    jsonResponse($roles);
}

// --- POST ---
if ($method === 'POST') {
    $body = getRequestBody();
    $name = trim($body['name'] ?? '');
    $label = trim($body['label'] ?? '');
    $permissions = $body['permissions'] ?? [];

    if (!$name || !$label) jsonError('กรุณากรอกชื่อและป้ายกำกับ Role', 400);

    // Validate name format (lowercase letters, numbers, underscores only)
    if (!preg_match('/^[a-z0-9_]+$/', $name)) {
        jsonError('ชื่อ Role ต้องเป็นตัวพิมพ์เล็ก ตัวเลข หรือ _ เท่านั้น', 400);
    }

    $stmt = $db->prepare('SELECT id FROM roles WHERE name = ? AND tenant_id = ?');
    $stmt->execute([$name, $tenantId]);
    if ($stmt->fetch()) jsonError('มี Role ชื่อนี้อยู่แล้ว', 400);

    $stmt = $db->prepare('INSERT INTO roles (tenant_id, name, label) VALUES (?, ?, ?)');
    $stmt->execute([$tenantId, $name, $label]);
    $roleId = (int)$db->lastInsertId();

    $validMenuKeys = ALL_MENU_KEYS;
    foreach ($permissions as $menuKey) {
        if (in_array($menuKey, $validMenuKeys, true)) {
            $db->prepare('INSERT IGNORE INTO role_menu_permissions (role_id, menu_key) VALUES (?, ?)')->execute([$roleId, $menuKey]);
        }
    }

    jsonResponse(getRoleWithPermissions($db, $roleId, $tenantId), 201);
}

// --- PUT ---
if ($method === 'PUT') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) jsonError('Missing id parameter', 400);

    $stmt = $db->prepare('SELECT id FROM roles WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$id, $tenantId]);
    if (!$stmt->fetch()) jsonError('ไม่พบ Role', 404);

    $body = getRequestBody();
    $label = trim($body['label'] ?? '');
    $permissions = $body['permissions'] ?? [];

    if (!$label) jsonError('กรุณากรอกป้ายกำกับ Role', 400);

    $db->prepare('UPDATE roles SET label = ? WHERE id = ?')->execute([$label, $id]);

    $db->prepare('DELETE FROM role_menu_permissions WHERE role_id = ?')->execute([$id]);
    $validMenuKeys = ALL_MENU_KEYS;
    foreach ($permissions as $menuKey) {
        if (in_array($menuKey, $validMenuKeys, true)) {
            $db->prepare('INSERT INTO role_menu_permissions (role_id, menu_key) VALUES (?, ?)')->execute([$id, $menuKey]);
        }
    }

    jsonResponse(getRoleWithPermissions($db, $id, $tenantId));
}

// --- DELETE ---
if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) jsonError('Missing id parameter', 400);

    $countStmt = $db->prepare('SELECT COUNT(*) FROM tenant_users WHERE role_id = ? AND tenant_id = ?');
    $countStmt->execute([$id, $tenantId]);
    if ((int)$countStmt->fetchColumn() > 0) {
        jsonError('ไม่สามารถลบ Role ที่ยังมีผู้ใช้งานอยู่ กรุณาเปลี่ยน Role ผู้ใช้ก่อน', 400);
    }

    $stmt = $db->prepare('DELETE FROM roles WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$id, $tenantId]);
    if ($stmt->rowCount() === 0) jsonError('ไม่พบ Role', 404);

    jsonResponse(['deleted' => true]);
}

jsonError('Method not allowed', 405);
