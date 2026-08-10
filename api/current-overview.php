<?php
// GET /api/current-overview.php
// Returns current overview stats (today/this week/this month - no year filters)
// Available to all authenticated users (not just admins)
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$db = getDB();

if (getMethod() !== 'GET') {
    jsonError('Method not allowed', 405);
}

$tenantId = $tokenData['tenant_id'];
$userId   = $tokenData['user_id'];

$isAdmin = isTenantAdmin($db, $userId, $tenantId);

$today         = date('Y-m-d');
$thisYearStart = date('Y-01-01');
$thisYearEnd   = date('Y-12-31');
$thisWeekStart = date('Y-m-d', strtotime('monday this week'));
$thisWeekEnd   = date('Y-m-d', strtotime('sunday this week'));

try {

// ---- Projects ----
if ($isAdmin) {
    $countStmt = $db->prepare("
        SELECT status, COUNT(*) AS cnt
        FROM projects
        WHERE tenant_id = ? AND archived_at IS NULL AND kind = 'project'
          AND start_date <= ? AND (end_date IS NULL OR end_date >= ?)
        GROUP BY status
    ");
    $countStmt->execute([$tenantId, $thisYearEnd, $thisYearStart]);
    $stmt = $db->prepare('
        SELECT p.id, p.name, p.status, p.start_date, p.end_date,
               co.name AS company_name, uc.display_name AS creator_name
        FROM projects p
        LEFT JOIN companies co ON p.company_id = co.id
        LEFT JOIN users uc ON uc.id = p.user_id
        WHERE p.tenant_id = ? AND p.archived_at IS NULL AND p.kind = \'project\'
          AND p.start_date <= ? AND (p.end_date IS NULL OR p.end_date >= ?)
        ORDER BY p.updated_at DESC
        LIMIT 10
    ');
    $stmt->execute([$tenantId, $thisYearEnd, $thisYearStart]);
} else {
    $countStmt = $db->prepare("
        SELECT p.status, COUNT(DISTINCT p.id) AS cnt
        FROM projects p
        LEFT JOIN project_members pm ON p.id = pm.project_id
        WHERE p.tenant_id = ? AND p.archived_at IS NULL AND p.kind = 'project'
          AND p.start_date <= ? AND (p.end_date IS NULL OR p.end_date >= ?)
          AND (p.user_id = ? OR pm.user_id = ?)
        GROUP BY p.status
    ");
    $countStmt->execute([$tenantId, $thisYearEnd, $thisYearStart, $userId, $userId]);
    $stmt = $db->prepare('
        SELECT p.id, p.name, p.status, p.start_date, p.end_date,
               co.name AS company_name, uc.display_name AS creator_name
        FROM projects p
        LEFT JOIN companies co ON p.company_id = co.id
        LEFT JOIN users uc ON uc.id = p.user_id
        LEFT JOIN project_members pm ON p.id = pm.project_id
        WHERE p.tenant_id = ? AND p.archived_at IS NULL AND p.kind = \'project\'
          AND p.start_date <= ? AND (p.end_date IS NULL OR p.end_date >= ?)
          AND (p.user_id = ? OR pm.user_id = ?)
        GROUP BY p.id
        ORDER BY p.updated_at DESC
        LIMIT 10
    ');
    $stmt->execute([$tenantId, $thisYearEnd, $thisYearStart, $userId, $userId]);
}
$currentProjects = $stmt->fetchAll();
$projectStatusRows = $countStmt->fetchAll();

$projectStats = ['total' => 0, 'active' => 0, 'at_risk' => 0, 'completed' => 0];
foreach ($projectStatusRows as $row) {
    $cnt = (int)$row['cnt'];
    $projectStats['total'] += $cnt;
    if ($row['status'] === 'completed') $projectStats['completed'] += $cnt;
    elseif (in_array($row['status'], ['at-risk', 'delayed'])) $projectStats['at_risk'] += $cnt;
    else $projectStats['active'] += $cnt;
}

// ---- Tasks (assigned to me, parent tasks only, not completed, sorted by urgency) ----
$taskCountStmt = $db->prepare('
    SELECT t.status, COUNT(*) AS cnt
    FROM tasks t
    WHERE t.tenant_id = ? AND t.deleted_at IS NULL AND t.is_subtask = 0
      AND (t.assignee_user_id = ? OR t.user_id = ?)
      AND t.status NOT IN (\'completed\', \'cancelled\')
    GROUP BY t.status
');
$taskCountStmt->execute([$tenantId, $userId, $userId]);
$taskStatusRows = $taskCountStmt->fetchAll();

$stmt = $db->prepare('
    SELECT t.id, t.title, t.status, t.priority, t.end_date, t.task_type,
           p.name AS project_name
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.tenant_id = ? AND t.deleted_at IS NULL AND t.is_subtask = 0
      AND (t.assignee_user_id = ? OR t.user_id = ?)
      AND t.status NOT IN (\'completed\', \'cancelled\')
    ORDER BY
      CASE WHEN t.status = \'overdue\' THEN 0 WHEN t.status = \'in-progress\' THEN 1 ELSE 2 END,
      t.end_date ASC, t.created_at DESC
    LIMIT 15
');
$stmt->execute([$tenantId, $userId, $userId]);
$currentTasks = $stmt->fetchAll();

$taskStats = ['total' => 0, 'pending' => 0, 'in_progress' => 0, 'completed' => 0, 'overdue' => 0];
foreach ($taskStatusRows as $row) {
    $cnt = (int)$row['cnt'];
    $taskStats['total'] += $cnt;
    if ($row['status'] === 'overdue') $taskStats['overdue'] += $cnt;
    elseif ($row['status'] === 'in-progress') $taskStats['in_progress'] += $cnt;
    else $taskStats['pending'] += $cnt;
}

// ---- Opportunities (active, not won/lost) ----
if ($isAdmin) {
    $oppCountStmt = $db->prepare("
        SELECT stage, COUNT(*) AS cnt, SUM(value) AS total_value
        FROM sales_opportunities
        WHERE tenant_id = ? AND stage NOT IN ('won', 'lost')
          AND YEAR(expected_close_date) = YEAR(CURDATE())
        GROUP BY stage
    ");
    $oppCountStmt->execute([$tenantId]);
    $stmt = $db->prepare('
        SELECT o.id, o.name, o.stage, o.value, o.expected_close_date,
               c.name AS company_name
        FROM sales_opportunities o
        LEFT JOIN companies c ON c.id = o.company_id
        WHERE o.tenant_id = ? AND o.stage NOT IN (\'won\', \'lost\')
          AND YEAR(o.expected_close_date) = YEAR(CURDATE())
        ORDER BY o.expected_close_date ASC
        LIMIT 10
    ');
    $stmt->execute([$tenantId]);
} else {
    $oppCountStmt = $db->prepare("
        SELECT o.stage, COUNT(DISTINCT o.id) AS cnt, SUM(DISTINCT o.value) AS total_value
        FROM sales_opportunities o
        LEFT JOIN opportunity_members om ON o.id = om.opportunity_id
        WHERE o.tenant_id = ? AND o.stage NOT IN ('won', 'lost')
          AND YEAR(o.expected_close_date) = YEAR(CURDATE())
          AND (o.assigned_to = ? OR om.user_id = ?)
        GROUP BY o.stage
    ");
    $oppCountStmt->execute([$tenantId, $userId, $userId]);
    $stmt = $db->prepare('
        SELECT o.id, o.name, o.stage, o.value, o.expected_close_date,
               c.name AS company_name
        FROM sales_opportunities o
        LEFT JOIN companies c ON c.id = o.company_id
        LEFT JOIN opportunity_members om ON o.id = om.opportunity_id
        WHERE o.tenant_id = ? AND o.stage NOT IN (\'won\', \'lost\')
          AND YEAR(o.expected_close_date) = YEAR(CURDATE())
          AND (o.assigned_to = ? OR om.user_id = ?)
        GROUP BY o.id
        ORDER BY o.expected_close_date ASC
        LIMIT 10
    ');
    $stmt->execute([$tenantId, $userId, $userId]);
}
$currentOpps = $stmt->fetchAll();
$oppCountRows = $oppCountStmt->fetchAll();

$oppStats = ['total' => 0, 'lead' => 0, 'qualified' => 0, 'proposal' => 0, 'negotiation' => 0, 'pipeline_value' => 0.0];
foreach ($oppCountRows as $row) {
    $cnt = (int)$row['cnt'];
    $oppStats['total'] += $cnt;
    $stage = $row['stage'];
    if (isset($oppStats[$stage])) $oppStats[$stage] += $cnt;
    $oppStats['pipeline_value'] += (float)$row['total_value'];
}

// ---- Support Tickets (open) ----
if ($isAdmin) {
    $ticketCountStmt = $db->prepare("
        SELECT priority, COUNT(*) AS cnt
        FROM support_tickets
        WHERE tenant_id = ? AND status NOT IN ('closed', 'resolved')
          AND YEAR(created_at) = YEAR(CURDATE())
        GROUP BY priority
    ");
    $ticketCountStmt->execute([$tenantId]);
    $stmt = $db->prepare('
        SELECT t.id, t.title, t.status, t.priority,
               DATEDIFF(NOW(), t.created_at) AS days_open,
               c.name AS company_name
        FROM support_tickets t
        LEFT JOIN companies c ON c.id = t.company_id
        WHERE t.tenant_id = ? AND t.status NOT IN (\'closed\', \'resolved\')
          AND YEAR(t.created_at) = YEAR(CURDATE())
        ORDER BY FIELD(t.priority,\'critical\',\'high\',\'medium\',\'low\'), t.created_at DESC
        LIMIT 10
    ');
    $stmt->execute([$tenantId]);
} else {
    $ticketCountStmt = $db->prepare("
        SELECT priority, COUNT(*) AS cnt
        FROM support_tickets
        WHERE tenant_id = ? AND status NOT IN ('closed', 'resolved')
          AND YEAR(created_at) = YEAR(CURDATE())
          AND assigned_to = ?
        GROUP BY priority
    ");
    $ticketCountStmt->execute([$tenantId, $userId]);
    $stmt = $db->prepare('
        SELECT t.id, t.title, t.status, t.priority,
               DATEDIFF(NOW(), t.created_at) AS days_open,
               c.name AS company_name
        FROM support_tickets t
        LEFT JOIN companies c ON c.id = t.company_id
        WHERE t.tenant_id = ? AND t.status NOT IN (\'closed\', \'resolved\')
          AND YEAR(t.created_at) = YEAR(CURDATE())
          AND t.assigned_to = ?
        ORDER BY FIELD(t.priority,\'critical\',\'high\',\'medium\',\'low\'), t.created_at DESC
        LIMIT 10
    ');
    $stmt->execute([$tenantId, $userId]);
}
$currentTickets = $stmt->fetchAll();
$ticketCountRows = $ticketCountStmt->fetchAll();

$ticketStats = ['total' => 0, 'critical' => 0, 'high' => 0, 'medium' => 0, 'low' => 0];
foreach ($ticketCountRows as $row) {
    $cnt = (int)$row['cnt'];
    $ticketStats['total'] += $cnt;
    if (isset($ticketStats[$row['priority']])) $ticketStats[$row['priority']] += $cnt;
}

// ---- Task hours this week (actual_hours from parent tasks, by assignee_user_id or user_id) ----
$stmt = $db->prepare('
    SELECT COALESCE(SUM(actual_hours), 0) AS total_hours,
           COUNT(*) AS total_entries
    FROM tasks
    WHERE tenant_id = ? AND deleted_at IS NULL AND is_subtask = 0
      AND (assignee_user_id = ? OR user_id = ?)
      AND actual_hours > 0
      AND start_date BETWEEN ? AND ?
');
$stmt->execute([$tenantId, $userId, $userId, $thisWeekStart, $thisWeekEnd]);
$timesheetRow = $stmt->fetch();

// ---- Today's schedule: tasks starting/ending today ----
$stmt = $db->prepare('
    SELECT t.title, t.task_type, t.start_date, t.end_date, t.status,
           p.name AS project_name
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.tenant_id = ? AND t.deleted_at IS NULL AND t.is_subtask = 0
      AND (t.assignee_user_id = ? OR t.user_id = ?)
      AND t.start_date <= ? AND (t.end_date IS NULL OR t.end_date >= ?)
    ORDER BY t.start_date ASC
    LIMIT 10
');
$stmt->execute([$tenantId, $userId, $userId, $today, $today]);
$todayTasks = $stmt->fetchAll();

// ---- Companies ----
$stmt = $db->prepare('SELECT COUNT(*) FROM companies WHERE tenant_id = ?');
$stmt->execute([$tenantId]);
$companyCount = (int)$stmt->fetchColumn();

$stmt = $db->prepare('SELECT COUNT(*) FROM customers WHERE tenant_id = ? AND is_active = 1');
$stmt->execute([$tenantId]);
$customerCount = (int)$stmt->fetchColumn();

jsonResponse([
    'stats' => [
        'projects'       => $projectStats,
        'tasks'          => $taskStats,
        'opportunities'  => $oppStats,
        'support_tickets'=> $ticketStats,
        'task_hours'     => [
            'this_week_hours'   => (float)$timesheetRow['total_hours'],
            'this_week_entries' => (int)$timesheetRow['total_entries'],
        ],
        'companies' => [
            'total'     => $companyCount,
            'customers' => $customerCount,
        ],
    ],
    'recent_items' => [
        'tasks'            => array_slice($currentTasks, 0, 8),
        'today_tasks'      => $todayTasks,
        'projects'         => array_slice($currentProjects, 0, 5),
        'opportunities'    => array_slice($currentOpps, 0, 5),
        'support_tickets'  => array_slice($currentTickets, 0, 5),
    ],
]);

} catch (PDOException $e) {
    error_log('[current-overview] DB error: ' . $e->getMessage());
    jsonError('เกิดข้อผิดพลาดในการดึงข้อมูล: ' . $e->getMessage(), 500);
}
