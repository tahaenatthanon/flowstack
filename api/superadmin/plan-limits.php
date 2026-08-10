<?php
require_once __DIR__ . '/../auth.php';
requireSuperAdmin();
$db     = getDB();
$method = getMethod();

if ($method === 'GET') {
    $stmt = $db->query('SELECT * FROM plan_limits ORDER BY price_thb ASC, plan ASC');
    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

if ($method === 'POST') {
    $body = getRequestBody();
    $plan = strtolower(trim(preg_replace('/[^a-z0-9_]/', '', $body['plan'] ?? '')));
    if (!$plan) jsonError('ชื่อแผนไม่ถูกต้อง (a-z, 0-9, _)', 400);
    $dup = $db->prepare('SELECT plan FROM plan_limits WHERE plan = ?');
    $dup->execute([$plan]);
    if ($dup->fetch()) jsonError('มีแผนชื่อนี้อยู่แล้ว', 409);
    $db->prepare('INSERT INTO plan_limits (plan, max_users, price_thb, trial_days, is_active) VALUES (?, ?, ?, ?, 1)')
       ->execute([$plan, (int)($body['max_users'] ?? 1), (float)($body['price_thb'] ?? 0), (int)($body['trial_days'] ?? 0)]);
    $stmt = $db->prepare('SELECT * FROM plan_limits WHERE plan = ?');
    $stmt->execute([$plan]);
    jsonResponse($stmt->fetch(PDO::FETCH_ASSOC), 201);
}

if ($method === 'DELETE') {
    $plan = $_GET['plan'] ?? null;
    if (!$plan) jsonError('plan required', 400);
    // Cannot delete if tenants are using it
    $used = $db->prepare('SELECT COUNT(*) FROM tenants WHERE plan = ?');
    $used->execute([$plan]);
    if ((int)$used->fetchColumn() > 0) jsonError('ไม่สามารถลบแผนที่มีบริษัทใช้งานอยู่', 400);
    $db->prepare('DELETE FROM plan_limits WHERE plan = ?')->execute([$plan]);
    jsonResponse(['ok' => true]);
}

if ($method === 'PUT') {
    $body = getRequestBody();
    $plan = $body['plan'] ?? null;
    if (!$plan) jsonError('plan required', 400);
    $updates = []; $params = [];
    if (isset($body['max_users']))  { $updates[] = 'max_users = ?';  $params[] = (int)$body['max_users']; }
    if (isset($body['price_thb']))  { $updates[] = 'price_thb = ?';  $params[] = (float)$body['price_thb']; }
    if (isset($body['trial_days'])) { $updates[] = 'trial_days = ?'; $params[] = (int)$body['trial_days']; }
    if (empty($updates)) jsonError('Nothing to update', 400);
    $params[] = $plan;
    $db->prepare('UPDATE plan_limits SET ' . implode(', ', $updates) . ' WHERE plan = ?')->execute($params);
    $stmt = $db->prepare('SELECT * FROM plan_limits WHERE plan = ?');
    $stmt->execute([$plan]);
    jsonResponse($stmt->fetch(PDO::FETCH_ASSOC));
}

jsonError('Method not allowed', 405);
