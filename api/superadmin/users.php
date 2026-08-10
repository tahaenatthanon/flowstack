<?php
require_once __DIR__ . '/../auth.php';
requireSuperAdmin();
$db     = getDB();
$method = getMethod();

if ($method === 'GET') {
    $search = trim($_GET['search'] ?? '');
    $sql = "
        SELECT u.id, u.email, u.display_name, u.is_active, u.is_superadmin, u.created_at,
               t.name AS tenant_name, t.id AS tenant_id, s.plan, tu.is_admin
        FROM users u
        JOIN tenant_users tu ON tu.user_id = u.id
        JOIN tenants t ON t.id = tu.tenant_id
        LEFT JOIN subscriptions s ON s.tenant_id = t.id
    ";
    $params = [];
    if ($search !== '') {
        $sql .= ' WHERE u.email LIKE ? OR u.display_name LIKE ? OR t.name LIKE ?';
        $like = "%$search%";
        $params = [$like, $like, $like];
    }
    $sql .= ' ORDER BY u.created_at DESC LIMIT 200';
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

if ($method === 'PUT') {
    $id   = $_GET['id'] ?? null;
    $body = getRequestBody();
    if (!$id) jsonError('id required', 400);

    $updates = []; $params = [];
    if (isset($body['is_active'])) {
        $updates[] = 'is_active = ?';
        $params[] = (int)$body['is_active'];
    }
    if (isset($body['is_superadmin'])) {
        $updates[] = 'is_superadmin = ?';
        $params[] = (int)$body['is_superadmin'];
    }
    if (isset($body['display_name'])) {
        $updates[] = 'display_name = ?';
        $params[] = trim($body['display_name']);
    }
    if (isset($body['email'])) {
        $email = trim($body['email']);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonError('อีเมลไม่ถูกต้อง', 400);
        $dup = $db->prepare('SELECT id FROM users WHERE email = ? AND id != ?');
        $dup->execute([$email, $id]);
        if ($dup->fetch()) jsonError('อีเมลนี้ถูกใช้แล้ว', 400);
        $updates[] = 'email = ?';
        $params[] = $email;
    }
    if (isset($body['password']) && strlen($body['password']) >= 6) {
        $updates[] = 'password_hash = ?';
        $params[] = password_hash($body['password'], PASSWORD_DEFAULT);
    }
    if (empty($updates)) jsonError('Nothing to update', 400);
    $params[] = $id;
    $db->prepare('UPDATE users SET ' . implode(', ', $updates) . ' WHERE id = ?')->execute($params);
    jsonResponse(['ok' => true]);
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('id required', 400);
    $me = requireSuperAdmin();
    if ($id === $me['user_id']) jsonError('ไม่สามารถลบตัวเองได้', 400);
    $db->beginTransaction();
    try {
        $db->prepare('DELETE FROM tenant_users WHERE user_id = ?')->execute([$id]);
        $db->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('ลบไม่สำเร็จ', 500);
    }
    jsonResponse(['ok' => true]);
}

jsonError('Method not allowed', 405);
