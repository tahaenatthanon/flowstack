<?php
// GET    /api/users.php           - list all users with role info (all authenticated users)
// PUT    /api/users.php?id=...    - update user including role_id (admin only)
// POST   /api/users.php           - create user (admin only)
// POST   /api/users.php?id=...    - actions: reset_password, change_password, toggle_active (admin only)
// DELETE /api/users.php?id=...    - delete user (admin only)
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db = getDB();

function generateTempPassword(int $length = 10): string {
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    $result = '';
    $maxIndex = strlen($chars) - 1;
    for ($i = 0; $i < $length; $i++) {
        $result .= $chars[random_int(0, $maxIndex)];
    }
    return $result;
}

$method = getMethod();

if ($method === 'GET') {
    $singleId   = $_GET['id']          ?? null;
    $activeOnly = ($_GET['active_only'] ?? '0') === '1';
    $search     = trim($_GET['search'] ?? '');

    if ($singleId) {
        $stmt = $db->prepare('
            SELECT u.id, u.email, u.display_name, u.position, tu.is_admin, u.is_active,
                   tu.role_id, r.label AS role_label, u.created_at
            FROM users u
            JOIN tenant_users tu ON tu.user_id = u.id AND tu.tenant_id = ?
            LEFT JOIN roles r ON tu.role_id = r.id
            WHERE u.id = ?
        ');
        $stmt->execute([$tenantId, $singleId]);
        $user = $stmt->fetch();
        if (!$user) jsonError('ไม่พบผู้ใช้', 404);
        jsonResponse($user);
    }

    $where  = ['tu.tenant_id = ?'];
    $params = [$tenantId];
    if ($activeOnly) { $where[] = 'u.is_active = 1'; }
    if ($search !== '') {
        $where[] = '(u.display_name LIKE ? OR u.email LIKE ?)';
        $like = "%$search%";
        $params[] = $like;
        $params[] = $like;
    }
    $whereClause = 'WHERE ' . implode(' AND ', $where);

    $stmt = $db->prepare("
        SELECT u.id, u.email, u.display_name, u.position, tu.is_admin, u.is_active,
               tu.role_id, r.label AS role_label, u.created_at,
               (SELECT COUNT(*) FROM user_email_aliases a WHERE a.user_id = u.id) AS alias_count
        FROM users u
        JOIN tenant_users tu ON tu.user_id = u.id
        LEFT JOIN roles r ON tu.role_id = r.id
        $whereClause
        ORDER BY u.display_name ASC, u.email ASC
    ");
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

if ($method === 'PUT') {
    requireAdmin($db, $tokenData['user_id'], $tokenData['tenant_id']);

    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id parameter');

    $body = getRequestBody();
    $email       = trim($body['email'] ?? '');
    $displayName = trim($body['display_name'] ?? '');
    $position    = trim($body['position'] ?? '');
    $isAdminFlag = isset($body['is_admin']) && intval($body['is_admin']) === 1 ? 1 : 0;
    $isActive    = isset($body['is_active']) ? (intval($body['is_active']) === 1 ? 1 : 0) : null;
    $roleId      = array_key_exists('role_id', $body) ? ($body['role_id'] ? (int)$body['role_id'] : null) : 'UNCHANGED';

    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonError('อีเมลไม่ถูกต้อง', 400);
    }

    $stmt = $db->prepare('SELECT id FROM users WHERE email = ? AND id != ?');
    $stmt->execute([$email, $id]);
    if ($stmt->fetch()) jsonError('อีเมลนี้ถูกใช้งานแล้ว', 400);

    // Check that new email is not already an alias of another user
    $aliasCheck = $db->prepare('SELECT user_id FROM user_email_aliases WHERE alias_email = ? AND user_id != ?');
    $aliasCheck->execute([strtolower($email), $id]);
    if ($aliasCheck->fetch()) jsonError('อีเมลนี้ถูกใช้เป็น Alias ของผู้ใช้อื่นอยู่แล้ว', 400);

    // Prevent admin from deactivating their own account
    if ($isActive === 0 && $id === $tokenData['user_id']) {
        jsonError('ไม่สามารถระงับบัญชีของตัวเอง', 400);
    }

    // Build dynamic update for users table (profile fields only)
    $fields = ['email = ?', 'display_name = ?', 'position = ?'];
    $values = [$email, $displayName, $position];

    if ($isActive !== null) {
        $fields[] = 'is_active = ?';
        $values[] = $isActive;
    }

    $values[] = $id;
    $db->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);

    // Update tenant-scoped is_admin and role_id in tenant_users
    $tuFields = ['is_admin = ?'];
    $tuValues = [$isAdminFlag];
    if ($roleId !== 'UNCHANGED') {
        $tuFields[] = 'role_id = ?';
        $tuValues[] = $roleId;
    }
    $tuValues[] = $id;
    $tuValues[] = $tenantId;
    $db->prepare('UPDATE tenant_users SET ' . implode(', ', $tuFields) . ' WHERE user_id = ? AND tenant_id = ?')->execute($tuValues);

    $stmt = $db->prepare('
            SELECT u.id, u.email, u.display_name, u.position, tu.is_admin, u.is_active,
                   tu.role_id, r.label AS role_label, u.created_at
            FROM users u
            JOIN tenant_users tu ON tu.user_id = u.id AND tu.tenant_id = ?
            LEFT JOIN roles r ON tu.role_id = r.id
            WHERE u.id = ?
        ');
        $stmt->execute([$tenantId, $id]);
        $user = $stmt->fetch();
        if (!$user) jsonError('ไม่พบผู้ใช้', 404);

        jsonResponse($user);
    }

if ($method === 'POST') {
    $id = $_GET['id'] ?? null;

    if (!$id) {
        requireAdmin($db, $tokenData['user_id'], $tokenData['tenant_id']);
        checkUserLimit($db, $tenantId);

        $body        = getRequestBody();
        $email       = trim($body['email'] ?? '');
        $displayName = trim($body['display_name'] ?? '');
        $position    = trim($body['position'] ?? '');
        $password    = $body['password'] ?? '';
        $roleId      = isset($body['role_id']) && $body['role_id'] ? (int)$body['role_id'] : null;
        $isAdminFlag = isset($body['is_admin']) && intval($body['is_admin']) === 1 ? 1 : 0;

        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonError('อีเมลไม่ถูกต้อง', 400);
        }
        if (strlen($password) < 6) {
            jsonError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', 400);
        }

        $stmt = $db->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->execute([$email]);
        if ($stmt->fetch()) jsonError('อีเมลนี้ถูกใช้งานแล้ว', 400);

        // Check that email is not already an alias for another user
        $aliasCheck = $db->prepare('SELECT id FROM user_email_aliases WHERE alias_email = ?');
        $aliasCheck->execute([strtolower($email)]);
        if ($aliasCheck->fetch()) jsonError('อีเมลนี้ถูกใช้เป็น Alias อยู่แล้ว', 400);

        $hash  = password_hash($password, PASSWORD_DEFAULT);
        $newId = generateUUID();
        $db->beginTransaction();
        try {
            $stmt  = $db->prepare('INSERT INTO users (id, email, display_name, position, password_hash, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, NOW())');
            $stmt->execute([$newId, $email, $displayName, $position, $hash]);
            // Add to tenant_users
            $db->prepare('INSERT INTO tenant_users (tenant_id, user_id, role_id, is_admin, joined_at) VALUES (?, ?, ?, ?, NOW())')
               ->execute([$tenantId, $newId, $roleId, $isAdminFlag]);
            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            jsonError('เกิดข้อผิดพลาดในการสร้างผู้ใช้', 500);
        }

        $stmt = $db->prepare('
            SELECT u.id, u.email, u.display_name, u.position, tu.is_admin, u.is_active,
                   tu.role_id, r.label AS role_label, u.created_at
            FROM users u
            JOIN tenant_users tu ON tu.user_id = u.id AND tu.tenant_id = ?
            LEFT JOIN roles r ON tu.role_id = r.id
            WHERE u.id = ?
        ');
        $stmt->execute([$tenantId, $newId]);
        jsonResponse($stmt->fetch());
    }

    requireAdmin($db, $tokenData['user_id'], $tokenData['tenant_id']);

    $body   = getRequestBody();
    $action = $body['action'] ?? '';

    if ($action === 'reset_password') {
        if ($id === $tokenData['user_id']) jsonError('ไม่สามารถรีเซ็ตรหัสผ่านของตัวเองด้วยวิธีนี้', 400);
        $tempPassword = generateTempPassword();
        $db->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($tempPassword, PASSWORD_DEFAULT), $id]);
        jsonResponse(['temporary_password' => $tempPassword]);
    }

    if ($action === 'change_password') {
        $newPassword = $body['new_password'] ?? '';
        if (strlen($newPassword) < 6) jsonError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', 400);
        $db->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($newPassword, PASSWORD_DEFAULT), $id]);
        jsonResponse(['updated' => true]);
    }

    if ($action === 'toggle_active') {
        if ($id === $tokenData['user_id']) jsonError('ไม่สามารถระงับบัญชีของตัวเอง', 400);
        $stmt = $db->prepare('SELECT is_active FROM users WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) jsonError('ไม่พบผู้ใช้', 404);
        $newActive = $row['is_active'] ? 0 : 1;
        $db->prepare('UPDATE users SET is_active = ? WHERE id = ?')->execute([$newActive, $id]);
        jsonResponse(['is_active' => $newActive]);
    }

    jsonError('Unknown action', 400);
}

if ($method === 'DELETE') {
    requireAdmin($db, $tokenData['user_id'], $tokenData['tenant_id']);

    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id parameter');
    if ($id === $tokenData['user_id']) jsonError('ไม่สามารถลบผู้ใช้งานของตัวเอง', 400);

    $stmt = $db->prepare('DELETE FROM users WHERE id = ?');
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) jsonError('ไม่พบผู้ใช้', 404);

    jsonResponse(['deleted' => true]);
}

jsonError('Method not allowed', 405);
