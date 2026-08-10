<?php
require_once __DIR__ . '/../auth.php';
requireSuperAdmin();
$db = getDB();

$tenants    = (int)$db->query('SELECT COUNT(*) FROM tenants')->fetchColumn();
$active     = (int)$db->query("SELECT COUNT(*) FROM subscriptions WHERE status='active'")->fetchColumn();
$trial      = (int)$db->query("SELECT COUNT(*) FROM subscriptions WHERE plan='trial'")->fetchColumn();
$users      = (int)$db->query('SELECT COUNT(*) FROM users WHERE is_active=1')->fetchColumn();
$pendingPay = (int)$db->query("SELECT COUNT(*) FROM payments WHERE status='pending'")->fetchColumn();
$mrr        = (float)$db->query("
    SELECT COALESCE(SUM(pl.price_thb),0)
    FROM subscriptions s
    JOIN plan_limits pl ON pl.plan = s.plan
    WHERE s.status='active' AND s.plan != 'trial'
")->fetchColumn();

// Signups last 6 months
$signups = $db->query("
    SELECT DATE_FORMAT(created_at,'%Y-%m') AS month, COUNT(*) AS count
    FROM tenants
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
    GROUP BY month ORDER BY month
")->fetchAll(PDO::FETCH_ASSOC);

// Plan distribution (active subs)
$planDist = $db->query("
    SELECT s.plan, COUNT(*) AS count
    FROM subscriptions s
    WHERE s.status = 'active'
    GROUP BY s.plan
    ORDER BY count DESC
")->fetchAll(PDO::FETCH_ASSOC);

// Expiring trials (next 7 days)
$expiringTrials = $db->query("
    SELECT t.id, t.name, t.slug, s.expires_at,
           DATEDIFF(s.expires_at, NOW()) AS days_left
    FROM subscriptions s
    JOIN tenants t ON t.id = s.tenant_id
    WHERE s.plan = 'trial'
      AND s.status = 'active'
      AND s.expires_at IS NOT NULL
      AND s.expires_at <= DATE_ADD(NOW(), INTERVAL 7 DAY)
      AND s.expires_at > NOW()
    ORDER BY s.expires_at ASC
    LIMIT 10
")->fetchAll(PDO::FETCH_ASSOC);

// Already expired (not yet marked)
$expiredCount = (int)$db->query("
    SELECT COUNT(*) FROM subscriptions
    WHERE status = 'active' AND expires_at < NOW()
")->fetchColumn();

// Pending payments (most recent 5)
$pendingList = $db->query("
    SELECT p.id, p.amount, p.method, p.submitted_at,
           i.plan, t.name AS tenant_name
    FROM payments p
    JOIN invoices i ON i.id = p.invoice_id
    JOIN tenants t ON t.id = i.tenant_id
    WHERE p.status = 'pending'
    ORDER BY p.submitted_at DESC
    LIMIT 5
")->fetchAll(PDO::FETCH_ASSOC);

// Recent tenants (last 5)
$recentTenants = $db->query("
    SELECT t.id, t.name, t.plan, t.status, t.created_at,
           s.expires_at, s.status AS sub_status,
           (SELECT COUNT(*) FROM tenant_users tu WHERE tu.tenant_id = t.id) AS user_count
    FROM tenants t
    LEFT JOIN subscriptions s ON s.tenant_id = t.id
    ORDER BY t.created_at DESC
    LIMIT 5
")->fetchAll(PDO::FETCH_ASSOC);

// Revenue this month vs last month
$revenueThisMonth = (float)$db->query("
    SELECT COALESCE(SUM(p.amount), 0)
    FROM payments p
    WHERE p.status = 'approved'
      AND MONTH(p.verified_at) = MONTH(NOW())
      AND YEAR(p.verified_at) = YEAR(NOW())
")->fetchColumn();

$revenueLastMonth = (float)$db->query("
    SELECT COALESCE(SUM(p.amount), 0)
    FROM payments p
    WHERE p.status = 'approved'
      AND MONTH(p.verified_at) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))
      AND YEAR(p.verified_at) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH))
")->fetchColumn();

jsonResponse([
    'tenants'           => $tenants,
    'active_subs'       => $active,
    'trial_count'       => $trial,
    'users'             => $users,
    'pending_payments'  => $pendingPay,
    'mrr_thb'           => $mrr,
    'signups_6m'        => $signups,
    'plan_distribution' => $planDist,
    'expiring_trials'   => $expiringTrials,
    'expired_count'     => $expiredCount,
    'pending_list'      => $pendingList,
    'recent_tenants'    => $recentTenants,
    'revenue_this_month'=> $revenueThisMonth,
    'revenue_last_month'=> $revenueLastMonth,
]);
