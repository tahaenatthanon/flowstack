<?php
// GET /api/admin-overview.php
// Returns all admin overview stats in a single round-trip
// ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$db = getDB();

if (getMethod() !== 'GET') {
    jsonError('Method not allowed', 405);
}

requireAdmin($db, $tokenData['user_id'], $tokenData['tenant_id']);
$tenantId = $tokenData['tenant_id'];

$startDate = $_GET['start_date'] ?? date('Y-01-01');
$endDate   = $_GET['end_date']   ?? date('Y-12-31');

// Validate date inputs
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
    jsonError('Invalid date format. Use YYYY-MM-DD', 400);
}

try {

// ---- Users (filtered by created_at) ----
$stmt = $db->prepare('
    SELECT u.id, u.email, u.display_name, u.is_admin, u.is_active,
           r.label AS role_label, u.created_at
    FROM users u
    JOIN tenant_users tu ON tu.user_id = u.id AND tu.tenant_id = ?
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE DATE(u.created_at) BETWEEN ? AND ?
    ORDER BY u.created_at DESC
');
$stmt->execute([$tenantId, $startDate, $endDate]);
$filteredUsers = $stmt->fetchAll();

$totalUsers  = count($filteredUsers);
$activeUsers = 0;
$adminUsers  = 0;
foreach ($filteredUsers as $u) {
    if ((int)$u['is_active'] !== 0) $activeUsers++;
    if ((int)$u['is_admin'] === 1)  $adminUsers++;
}
$recentUsers = array_slice($filteredUsers, 0, 5);

// ---- Projects (filtered by start_date) ----
$stmt = $db->prepare('
    SELECT p.id AS project_id, p.name, p.status AS project_status,
           p.start_date, p.end_date, co.name AS company_name
    FROM projects p
    LEFT JOIN companies co ON p.company_id = co.id
    WHERE p.tenant_id = ? AND p.start_date BETWEEN ? AND ?
    ORDER BY p.start_date DESC
');
$stmt->execute([$tenantId, $startDate, $endDate]);
$filteredProjects = $stmt->fetchAll();

$totalProjects     = count($filteredProjects);
$activeProjects    = 0;
$completedProjects = 0;
$atRiskList        = [];
foreach ($filteredProjects as $p) {
    if ($p['project_status'] !== 'completed') $activeProjects++;
    if ($p['project_status'] === 'completed') $completedProjects++;
    if (in_array($p['project_status'], ['at-risk', 'delayed']) && count($atRiskList) < 6) {
        $atRiskList[] = $p;
    }
}

// ---- Tasks (filtered by created_at) ----
$stmt = $db->prepare('
    SELECT id, title, assignee, status, priority, end_date
    FROM tasks
    WHERE tenant_id = ? AND DATE(created_at) BETWEEN ? AND ?
');
$stmt->execute([$tenantId, $startDate, $endDate]);
$filteredTasks = $stmt->fetchAll();

$totalTasks      = count($filteredTasks);
$completedTasks  = 0;
$inProgressTasks = 0;
$overdueTasks    = 0;
$overdueList     = [];
foreach ($filteredTasks as $t) {
    if ($t['status'] === 'completed')   $completedTasks++;
    if ($t['status'] === 'in-progress') $inProgressTasks++;
    if ($t['status'] === 'overdue') {
        $overdueTasks++;
        if (count($overdueList) < 6) $overdueList[] = $t;
    }
}

// ---- Companies & Customers (total count, no date filter) ----
$cStmt = $db->prepare('SELECT COUNT(*) FROM companies WHERE is_active = 1 AND tenant_id = ?');
$cStmt->execute([$tenantId]);
$companyCount = (int)$cStmt->fetchColumn();
$cuStmt = $db->prepare('SELECT COUNT(*) FROM customers WHERE is_active = 1 AND tenant_id = ?');
$cuStmt->execute([$tenantId]);
$customerCount = (int)$cuStmt->fetchColumn();

// ---- Opportunities (filtered by expected_close_date) ----
$stmt = $db->prepare('
    SELECT stage, value
    FROM sales_opportunities
    WHERE tenant_id = ? AND expected_close_date BETWEEN ? AND ?
');
$stmt->execute([$tenantId, $startDate, $endDate]);
$filteredOpps = $stmt->fetchAll();

$totalOpps     = count($filteredOpps);
$activeOpps    = 0;
$wonOpps       = 0;
$pipelineValue = 0.0;
foreach ($filteredOpps as $o) {
    if (!in_array($o['stage'], ['won', 'lost'])) $activeOpps++;
    if ($o['stage'] === 'won')  $wonOpps++;
    if ($o['stage'] !== 'lost') $pipelineValue += (float)$o['value'];
}

// ---- Quotations (filtered by created_at) ----
$stmt = $db->prepare('
    SELECT status
    FROM quotations
    WHERE tenant_id = ? AND DATE(created_at) BETWEEN ? AND ?
');
$stmt->execute([$tenantId, $startDate, $endDate]);
$filteredQuots = $stmt->fetchAll();

$totalQuots    = count($filteredQuots);
$approvedQuots = 0;
$pendingQuots  = 0;
foreach ($filteredQuots as $q) {
    if ($q['status'] === 'approved') $approvedQuots++;
    if (in_array($q['status'], ['draft', 'sent'])) $pendingQuots++;
}

// ---- Timesheet (from tasks — days_spent * 8 = hours) ----
$stmt = $db->prepare('
    SELECT COALESCE(SUM(days_spent * 8), 0) AS total_hours,
           COUNT(*) AS total_entries
    FROM tasks
    WHERE tenant_id = ? AND start_date BETWEEN ? AND ?
      AND deleted_at IS NULL
      AND days_spent > 0
');
$stmt->execute([$tenantId, $startDate, $endDate]);
$tsRow = $stmt->fetch();

jsonResponse([
    'stats' => [
        'users'         => ['total' => $totalUsers,     'active' => $activeUsers,  'admin' => $adminUsers],
        'projects'      => ['total' => $totalProjects,   'active' => $activeProjects, 'completed' => $completedProjects],
        'tasks'         => ['total' => $totalTasks,      'completed' => $completedTasks, 'in_progress' => $inProgressTasks, 'overdue' => $overdueTasks],
        'companies'     => ['total' => $companyCount,    'customers' => $customerCount],
        'opportunities' => ['total' => $totalOpps,       'active' => $activeOpps, 'won' => $wonOpps, 'pipeline_value' => $pipelineValue],
        'quotations'    => ['total' => $totalQuots,      'approved' => $approvedQuots, 'pending' => $pendingQuots],
        'task_hours'    => ['total_hours' => (float)$tsRow['total_hours'], 'total_entries' => (int)$tsRow['total_entries']],
    ],
    'at_risk_projects' => array_values($atRiskList),
    'overdue_tasks'    => array_values($overdueList),
    'recent_users'     => $recentUsers,
]);

} catch (PDOException $e) {
    error_log('[admin-overview] DB error: ' . $e->getMessage());
    jsonError('เกิดข้อผิดพลาดในการดึงข้อมูล กรุณาลองใหม่', 500);
}
