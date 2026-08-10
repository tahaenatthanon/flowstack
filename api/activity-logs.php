<?php
// GET /api/activity-logs.php
// Returns user activity logs (admin only)
// Query params: page, limit, user_id, action, search, start_date, end_date
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$db = getDB();
requireAdmin($db, $tokenData['user_id'], $tokenData['tenant_id']);
$tenantId = $tokenData['tenant_id'];

if (getMethod() !== 'GET') jsonError('Method not allowed', 405);

$page       = max(1, intval($_GET['page']   ?? 1));
$limitRaw   = intval($_GET['limit'] ?? 50);
$allMode    = $limitRaw >= 99999;
$limit      = $allMode ? 99999 : min(100, max(10, $limitRaw));
$offset     = ($page - 1) * $limit;
$userId    = $_GET['user_id']    ?? '';
$action    = $_GET['action']     ?? '';
$search    = trim($_GET['search']    ?? '');
$startDate = $_GET['start_date'] ?? '';
$endDate   = $_GET['end_date']   ?? '';

$where  = ['l.tenant_id = ?'];
$params = [$tenantId];

if ($userId) {
    $where[]  = 'l.user_id = ?';
    $params[] = $userId;
}
if ($action) {
    $where[]  = 'l.action = ?';
    $params[] = $action;
}
if ($search) {
    $like     = "%$search%";
    $where[]  = '(u.display_name LIKE ? OR u.email LIKE ? OR l.description LIKE ? OR l.ip_address LIKE ? OR EXISTS (SELECT 1 FROM user_email_aliases ea WHERE ea.user_id = l.user_id AND ea.alias_email LIKE ?))';
    $params   = array_merge($params, [$like, $like, $like, $like, $like]);
}
if ($startDate) {
    $where[]  = 'l.created_at >= ?';
    $params[] = $startDate . ' 00:00:00';
}
if ($endDate) {
    $where[]  = 'l.created_at <= ?';
    $params[] = $endDate . ' 23:59:59';
}

$whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

// Total count
$countSql  = "SELECT COUNT(*) FROM user_activity_logs l LEFT JOIN users u ON u.id = l.user_id $whereSql";
$countStmt = $db->prepare($countSql);
$countStmt->execute($params);
$total = (int) $countStmt->fetchColumn();

// Distinct action types for filter
$actionStmt = $db->prepare('SELECT DISTINCT action FROM user_activity_logs WHERE tenant_id = ? ORDER BY action');
$actionStmt->execute([$tenantId]);
$actionTypes = $actionStmt->fetchAll(PDO::FETCH_COLUMN);

// Fetch rows
if ($allMode) {
    $sql = "SELECT l.id, l.user_id, u.display_name, u.email,
                   l.action, l.description, l.ip_address, l.created_at
            FROM user_activity_logs l
            LEFT JOIN users u ON u.id = l.user_id
            $whereSql
            ORDER BY l.created_at DESC";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
} else {
    $sql = "SELECT l.id, l.user_id, u.display_name, u.email,
                   l.action, l.description, l.ip_address, l.created_at
            FROM user_activity_logs l
            LEFT JOIN users u ON u.id = l.user_id
            $whereSql
            ORDER BY l.created_at DESC
            LIMIT ? OFFSET ?";
    $stmt = $db->prepare($sql);
    $stmt->execute(array_merge($params, [$limit, $offset]));
}
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

jsonResponse([
    'logs'        => $rows,
    'total'       => $total,
    'page'        => $page,
    'limit'       => $allMode ? $total : $limit,
    'pages'       => $allMode ? 1 : (int) ceil($total / $limit),
    'actionTypes' => $actionTypes,
]);
