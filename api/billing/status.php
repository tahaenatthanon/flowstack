<?php
require_once __DIR__ . '/../auth.php';
$user     = requireAuth();
$db       = getDB();
$tenantId = $user['tenant_id'];

$stmt = $db->prepare("
    SELECT s.plan, s.started_at, s.expires_at, s.status,
           pl.max_users, pl.price_thb, pl.trial_days,
           (SELECT COUNT(*) FROM tenant_users tu WHERE tu.tenant_id = s.tenant_id) AS current_users
    FROM subscriptions s
    JOIN plan_limits pl ON pl.plan = s.plan
    WHERE s.tenant_id = ?
");
$stmt->execute([$tenantId]);
$sub = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$sub) {
    jsonResponse([
        'plan' => 'trial', 'status' => 'active',
        'max_users' => 1, 'current_users' => 1,
        'expires_at' => null, 'price_thb' => 0,
    ]);
}

if ($sub['expires_at'] && strtotime($sub['expires_at']) < time() && $sub['status'] === 'active') {
    $db->prepare("UPDATE subscriptions SET status='expired' WHERE tenant_id=?")
       ->execute([$tenantId]);
    $sub['status'] = 'expired';
}

jsonResponse($sub);
