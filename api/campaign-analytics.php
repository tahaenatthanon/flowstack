<?php
// GET /api/campaign-analytics.php?range=30d|90d|12m — aggregate email campaign analytics

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

$tokenData = requireAuth();
$tenantId = $tokenData['tenant_id'];

if ($method !== 'GET') {
    jsonError('Method not allowed', 405);
}

$range = $_GET['range'] ?? '30d';
$allowed = ['30d', '90d', '12m'];
if (!in_array($range, $allowed)) {
    $range = '30d';
}

// Determine cutoff date
switch ($range) {
    case '30d': $cutoff = "DATE_SUB(NOW(), INTERVAL 30 DAY)"; break;
    case '90d': $cutoff = "DATE_SUB(NOW(), INTERVAL 90 DAY)"; break;
    case '12m': $cutoff = "DATE_SUB(NOW(), INTERVAL 12 MONTH)"; break;
}

// ─── Overall summary stats ──────────────────────────────────────────
$stmt = $db->prepare("
    SELECT
        COUNT(*) as total_campaigns,
        COALESCE(SUM(total_sent), 0) as total_sent,
        COALESCE(SUM(total_opens), 0) as total_opens,
        COALESCE(SUM(total_clicks), 0) as total_clicks,
        CASE WHEN COALESCE(SUM(total_sent), 0) > 0
            THEN ROUND(COALESCE(SUM(total_opens), 0) / SUM(total_sent) * 100, 1)
            ELSE 0 END as avg_open_rate,
        CASE WHEN COALESCE(SUM(total_sent), 0) > 0
            THEN ROUND(COALESCE(SUM(total_clicks), 0) / SUM(total_sent) * 100, 1)
            ELSE 0 END as avg_click_rate
    FROM email_campaigns
    WHERE tenant_id = ? AND status IN ('sent', 'sending')
      AND created_at >= {$cutoff}
");
$stmt->execute([$tenantId]);
$summary = $stmt->fetch();

// ─── Campaign status breakdown ──────────────────────────────────────
$stmt = $db->prepare("
    SELECT status, COUNT(*) as count
    FROM email_campaigns
    WHERE tenant_id = ?
    GROUP BY status
");
$stmt->execute([$tenantId]);
$statusBreakdown = $stmt->fetchAll();

// ─── Monthly trends (from email_tracking sent_at) ───────────────────
$monthFormat = $range === '12m' ? '%Y-%m' : '%Y-%m-%d';
$stmt = $db->prepare("
    SELECT
        DATE_FORMAT(et.sent_at, '{$monthFormat}') as period,
        COUNT(*) as sent,
        SUM(CASE WHEN et.opened_at IS NOT NULL THEN 1 ELSE 0 END) as opens,
        SUM(CASE WHEN et.clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicks
    FROM email_tracking et
    JOIN email_campaigns ec ON et.campaign_id = ec.id
    WHERE ec.tenant_id = ? AND et.sent_at IS NOT NULL
      AND et.sent_at >= {$cutoff}
    GROUP BY period
    ORDER BY period ASC
");
$stmt->execute([$tenantId]);
$trends = $stmt->fetchAll();

// Compute rates per period
foreach ($trends as &$t) {
    $t['sent'] = (int)$t['sent'];
    $t['opens'] = (int)$t['opens'];
    $t['clicks'] = (int)$t['clicks'];
    $t['open_rate'] = $t['sent'] > 0 ? round($t['opens'] / $t['sent'] * 100, 1) : 0;
    $t['click_rate'] = $t['sent'] > 0 ? round($t['clicks'] / $t['sent'] * 100, 1) : 0;
}
unset($t);

// ─── Top 5 campaigns ────────────────────────────────────────────────
$stmt = $db->prepare("
    SELECT id, name, subject, status,
           total_sent, total_opens, total_clicks,
           CASE WHEN total_sent > 0 THEN ROUND(total_opens / total_sent * 100, 1) ELSE 0 END as open_rate,
           CASE WHEN total_sent > 0 THEN ROUND(total_clicks / total_sent * 100, 1) ELSE 0 END as click_rate,
           sent_at
    FROM email_campaigns
    WHERE tenant_id = ? AND status IN ('sent', 'sending') AND total_sent > 0
      AND created_at >= {$cutoff}
    ORDER BY total_opens DESC
    LIMIT 5
");
$stmt->execute([$tenantId]);
$topCampaigns = $stmt->fetchAll();

// Cast numeric fields
foreach ($topCampaigns as &$c) {
    $c['total_sent'] = (int)$c['total_sent'];
    $c['total_opens'] = (int)$c['total_opens'];
    $c['total_clicks'] = (int)$c['total_clicks'];
    $c['open_rate'] = (float)$c['open_rate'];
    $c['click_rate'] = (float)$c['click_rate'];
}
unset($c);

// ─── All campaigns (paginated) ──────────────────────────────────────
$limit = min((int)($_GET['limit'] ?? 20), 100);
$offset = max((int)($_GET['offset'] ?? 0), 0);

$stmt = $db->prepare("
    SELECT id, name, subject, status,
           total_recipients, total_sent, total_opens, total_clicks,
           CASE WHEN total_sent > 0 THEN ROUND(total_opens / total_sent * 100, 1) ELSE 0 END as open_rate,
           CASE WHEN total_sent > 0 THEN ROUND(total_clicks / total_sent * 100, 1) ELSE 0 END as click_rate,
           created_at, sent_at
    FROM email_campaigns
    WHERE tenant_id = ?
    ORDER BY created_at DESC
    LIMIT {$limit} OFFSET {$offset}
");
$stmt->execute([$tenantId]);
$allCampaigns = $stmt->fetchAll();

// Count total
$stmt = $db->prepare("SELECT COUNT(*) as total FROM email_campaigns WHERE tenant_id = ?");
$stmt->execute([$tenantId]);
$totalCount = $stmt->fetch()['total'] ?? 0;

foreach ($allCampaigns as &$c) {
    $c['total_recipients'] = (int)$c['total_recipients'];
    $c['total_sent'] = (int)$c['total_sent'];
    $c['total_opens'] = (int)$c['total_opens'];
    $c['total_clicks'] = (int)$c['total_clicks'];
    $c['open_rate'] = (float)$c['open_rate'];
    $c['click_rate'] = (float)$c['click_rate'];
}
unset($c);

jsonSuccess([
    'summary' => [
        'total_campaigns' => (int)$summary['total_campaigns'],
        'total_sent' => (int)$summary['total_sent'],
        'total_opens' => (int)$summary['total_opens'],
        'total_clicks' => (int)$summary['total_clicks'],
        'avg_open_rate' => (float)$summary['avg_open_rate'],
        'avg_click_rate' => (float)$summary['avg_click_rate'],
    ],
    'status_breakdown' => $statusBreakdown,
    'trends' => $trends,
    'top_campaigns' => $topCampaigns,
    'campaigns' => $allCampaigns,
    'total' => (int)$totalCount,
    'limit' => $limit,
    'offset' => $offset,
]);
