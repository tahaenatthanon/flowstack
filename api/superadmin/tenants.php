<?php
require_once __DIR__ . '/../auth.php';
requireSuperAdmin();
$db     = getDB();
$method = getMethod();
$id     = $_GET['id'] ?? null;
$action = $_GET['action'] ?? null;

if ($method === 'POST' && !$id) {
    $body        = getRequestBody();
    $name        = trim($body['name'] ?? '');
    $plan        = in_array($body['plan'] ?? '', ['trial','starter','pro','enterprise']) ? $body['plan'] : 'trial';
    $adminEmail  = trim($body['admin_email'] ?? '');
    $adminPass   = $body['admin_password'] ?? '';

    if (!$name) jsonError('กรุณากรอกชื่อบริษัท', 400);
    if (!$adminEmail || !filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) jsonError('อีเมลแอดมินไม่ถูกต้อง', 400);
    if (strlen($adminPass) < 6) jsonError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', 400);

    // Auto slug
    $slug = preg_replace('/[^a-z0-9]+/', '-', strtolower($name));
    $slug = trim($slug, '-') ?: 'company';
    $base = $slug; $i = 1;
    while (true) {
        $d = $db->prepare('SELECT id FROM tenants WHERE slug = ?'); $d->execute([$slug]);
        if (!$d->fetch()) break;
        $slug = $base . '-' . $i++;
    }

    $emailCheck = $db->prepare('SELECT id FROM users WHERE email = ?');
    $emailCheck->execute([$adminEmail]);
    if ($emailCheck->fetch()) jsonError('อีเมลนี้ถูกใช้แล้ว', 400);

    $trialStmt = $db->prepare('SELECT trial_days FROM plan_limits WHERE plan = ?');
    $trialStmt->execute([$plan]);
    $trialDays = (int)($trialStmt->fetchColumn() ?: 14);
    $expiresAt = $plan === 'trial' ? date('Y-m-d H:i:s', strtotime("+{$trialDays} days")) : null;

    $tenantId = generateUUID();
    $userId   = generateUUID();
    $hash     = password_hash($adminPass, PASSWORD_DEFAULT);
    $dispName = explode('@', $adminEmail)[0];

    $db->beginTransaction();
    try {
        $db->prepare('INSERT INTO tenants (id, name, slug, plan, status) VALUES (?, ?, ?, ?, \'active\')')
           ->execute([$tenantId, $name, $slug, $plan]);
        $db->prepare('INSERT INTO subscriptions (id, tenant_id, plan, status, expires_at) VALUES (?, ?, ?, \'active\', ?)')
           ->execute([generateUUID(), $tenantId, $plan, $expiresAt]);
        $db->prepare('INSERT INTO users (id, email, display_name, password_hash, is_active, created_at) VALUES (?, ?, ?, ?, 1, NOW())')
           ->execute([$userId, $adminEmail, $dispName, $hash]);
        $db->prepare('INSERT INTO tenant_users (tenant_id, user_id, is_admin, joined_at) VALUES (?, ?, 1, NOW())')
           ->execute([$tenantId, $userId]);
        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('สร้างไม่สำเร็จ: ' . $e->getMessage(), 500);
    }
    jsonResponse(['ok' => true, 'tenant_id' => $tenantId, 'slug' => $slug], 201);
}

if ($method === 'GET') {
    $stmt = $db->query("
        SELECT t.id, t.name, t.slug, t.plan, t.status, t.created_at,
               s.expires_at, s.status AS sub_status,
               (SELECT COUNT(*) FROM tenant_users tu WHERE tu.tenant_id = t.id) AS user_count,
               pl.max_users
        FROM tenants t
        LEFT JOIN subscriptions s ON s.tenant_id = t.id
        LEFT JOIN plan_limits pl ON pl.plan = COALESCE(s.plan, t.plan)
        ORDER BY t.created_at DESC
    ");
    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

if ($method === 'PUT' && $id && $action === 'extend') {
    $body = getRequestBody();
    $days = max(1, (int)($body['days'] ?? 30));
    $db->prepare("
        UPDATE subscriptions
        SET expires_at = DATE_ADD(GREATEST(COALESCE(expires_at, NOW()), NOW()), INTERVAL ? DAY),
            status = 'active'
        WHERE tenant_id = ?
    ")->execute([$days, $id]);
    $db->prepare("UPDATE tenants SET status = 'active' WHERE id = ?")->execute([$id]);
    jsonResponse(['ok' => true, 'extended_days' => $days]);
}

if ($method === 'PUT' && $id) {
    $body = getRequestBody();
    $updates = []; $params = [];
    if (isset($body['name']))   {
        $name = trim($body['name']);
        if ($name === '') jsonError('name ไม่สามารถว่างได้', 400);
        $updates[] = 'name = ?'; $params[] = $name;
    }
    if (isset($body['slug']))   {
        $slug = preg_replace('/[^a-z0-9\-]/', '', strtolower(trim($body['slug'])));
        if ($slug === '') jsonError('slug ไม่ถูกต้อง', 400);
        // Check uniqueness
        $dup = $db->prepare('SELECT id FROM tenants WHERE slug = ? AND id != ?');
        $dup->execute([$slug, $id]);
        if ($dup->fetch()) jsonError('slug นี้ถูกใช้แล้ว', 409);
        $updates[] = 'slug = ?'; $params[] = $slug;
    }
    if (isset($body['plan']))   { $updates[] = 'plan = ?';   $params[] = $body['plan']; }
    if (isset($body['status'])) { $updates[] = 'status = ?'; $params[] = $body['status']; }
    if (!empty($updates)) {
        $params[] = $id;
        $db->prepare('UPDATE tenants SET ' . implode(', ', $updates) . ' WHERE id = ?')->execute($params);
    }
    if (isset($body['plan'])) {
        $db->prepare("UPDATE subscriptions SET plan = ?, status = 'active' WHERE tenant_id = ?")
           ->execute([$body['plan'], $id]);
    }
    if (isset($body['status']) && $body['status'] === 'suspended') {
        $db->prepare("UPDATE subscriptions SET status = 'suspended' WHERE tenant_id = ?")
           ->execute([$id]);
    }
    $stmt = $db->prepare("
        SELECT t.*, s.expires_at, s.status AS sub_status,
               (SELECT COUNT(*) FROM tenant_users tu WHERE tu.tenant_id = t.id) AS user_count,
               pl.max_users
        FROM tenants t
        LEFT JOIN subscriptions s ON s.tenant_id = t.id
        LEFT JOIN plan_limits pl ON pl.plan = COALESCE(s.plan, t.plan)
        WHERE t.id = ?
    ");
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch(PDO::FETCH_ASSOC));
}

if ($method === 'DELETE' && $id) {
    // Safety: refuse to delete if tenant has active paid subscription
    $stmt = $db->prepare('SELECT COUNT(*) FROM tenant_users WHERE tenant_id = ?');
    $stmt->execute([$id]);
    $userCount = (int)$stmt->fetchColumn();

    $planStmt = $db->prepare("SELECT plan FROM subscriptions WHERE tenant_id = ? AND status = 'active'");
    $planStmt->execute([$id]);
    $plan = $planStmt->fetchColumn();

    if ($plan && !in_array($plan, ['trial', false])) {
        jsonError('ไม่สามารถลบ tenant ที่มี paid subscription ได้', 400);
    }

    $db->beginTransaction();
    try {
        // FK CASCADE will clean up related rows; but let's be explicit for safety
        $db->prepare('DELETE FROM subscriptions WHERE tenant_id = ?')->execute([$id]);
        $db->prepare('DELETE FROM tenant_users WHERE tenant_id = ?')->execute([$id]);
        $db->prepare('DELETE FROM tenants WHERE id = ?')->execute([$id]);
        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('ลบไม่สำเร็จ: ' . $e->getMessage(), 500);
    }
    jsonResponse(['ok' => true]);
}

jsonError('Method not allowed', 405);
