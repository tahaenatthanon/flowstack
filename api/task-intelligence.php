<?php
// api/task-intelligence.php
// GET ?action=assessment  - health metrics
// GET ?action=quality     - missing fields, anomalies, zombies
// GET ?action=duplicates  - fuzzy-matched duplicate tasks
// GET ?action=migrate_preview&project_ids=id1,id2  - preview migration
// POST ?action=migrate    - run migration (admin only)
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId    = $tokenData['user_id'];
$tenantId  = $tokenData['tenant_id'];
$db        = getDB();
$method    = getMethod();
$action    = $_GET['action'] ?? '';

$isAdmin = isTenantAdmin($db, $userId, $tenantId);

// PM can see projects where they are manager
function getAccessibleProjectIds(PDO $db, string $tenantId, string $userId, bool $isAdmin): array {
    if ($isAdmin) {
        $stmt = $db->prepare("SELECT id FROM projects WHERE tenant_id = ? AND deleted_at IS NULL AND kind = 'project'");
        $stmt->execute([$tenantId]);
    } else {
        $stmt = $db->prepare("SELECT id FROM projects WHERE tenant_id = ? AND manager_id = ? AND deleted_at IS NULL AND kind = 'project'");
        $stmt->execute([$tenantId, $userId]);
    }
    return array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'id');
}

// ── ASSESSMENT ───────────────────────────────────────────────────────────────
if ($method === 'GET' && $action === 'assessment') {
    $projectIds = getAccessibleProjectIds($db, $tenantId, $userId, $isAdmin);
    if (empty($projectIds)) { echo json_encode(['summary'=>[],'workload'=>[],'monthly'=>[],'status_dist'=>[]]); exit; }

    $filterProject = $_GET['project_id'] ?? '';
    $filterUser    = $_GET['user_id'] ?? '';
    $year          = $_GET['year'] ?? '';       // '2025', '2026', or '' = all time
    $dateFrom      = $_GET['date_from'] ?? '';
    $dateTo        = $_GET['date_to']   ?? '';

    // Resolve date range
    if ($year && $year !== 'all') {
        $dateFrom = "$year-01-01";
        $dateTo   = "$year-12-31";
    } elseif (!$dateFrom) {
        $dateFrom = '2000-01-01';
        $dateTo   = date('Y-m-d');
    }

    if ($filterProject && !in_array($filterProject, $projectIds)) { jsonError('Forbidden', 403); }
    $scope = $filterProject ? [$filterProject] : $projectIds;
    $inClause = implode(',', array_fill(0, count($scope), '?'));

    $userFilter = '';
    $userParam  = [];
    if ($filterUser) { $userFilter = ' AND t.assignee_user_id = ?'; $userParam = [$filterUser]; }

    // Summary counts
    $params = array_merge($scope, [$dateFrom, $dateTo], $userParam);
    $stmt = $db->prepare("SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status='completed' AND (completed_date IS NULL OR completed_date <= end_date) THEN 1 ELSE 0 END) as on_time,
        SUM(CASE WHEN status='completed' AND completed_date > end_date THEN 1 ELSE 0 END) as late_completed,
        SUM(CASE WHEN status != 'completed' AND end_date < CURDATE() THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status='in-progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending,
        SUM(COALESCE(actual_hours,0)) as total_actual_hours,
        SUM(COALESCE(estimated_hours,0)) as total_estimated_hours,
        SUM(CASE WHEN estimated_hours > 0 THEN actual_hours - estimated_hours ELSE NULL END) as hours_diff_sum,
        COUNT(CASE WHEN estimated_hours > 0 THEN 1 END) as hours_diff_count
        FROM tasks t
        WHERE t.project_id IN ($inClause)
        AND t.is_subtask = 0
        AND t.deleted_at IS NULL
        AND t.task_type NOT IN ('holiday','leave')
        AND (t.start_date BETWEEN ? AND ? OR t.end_date BETWEEN ? AND ?)
        $userFilter");
    $params = array_merge($scope, [$dateFrom, $dateTo, $dateFrom, $dateTo], $userParam);
    $stmt->execute($params);
    $summary = $stmt->fetch(PDO::FETCH_ASSOC);

    // Workload per person (filtered by date)
    $wParams = array_merge($scope, [$dateFrom, $dateTo], $userParam);
    $stmt2 = $db->prepare("SELECT u.id, u.display_name as name,
        SUM(t.actual_hours) as actual_hours,
        SUM(t.estimated_hours) as estimated_hours,
        COUNT(t.id) as task_count,
        SUM(CASE WHEN t.status='completed' AND (t.completed_date IS NULL OR t.completed_date <= t.end_date) THEN 1 ELSE 0 END) as on_time,
        SUM(CASE WHEN t.status != 'completed' AND t.end_date < CURDATE() THEN 1 ELSE 0 END) as overdue
        FROM tasks t
        JOIN users u ON u.id = t.assignee_user_id
        WHERE t.project_id IN ($inClause)
        AND t.is_subtask = 0
        AND t.deleted_at IS NULL
        AND t.task_type NOT IN ('holiday','leave')
        AND (t.start_date BETWEEN ? AND ? OR t.end_date BETWEEN ? AND ?)
        " . ($filterUser ? "AND t.assignee_user_id = ?" : "") . "
        GROUP BY u.id, u.display_name
        ORDER BY actual_hours DESC");
    $wParams = array_merge($scope, [$dateFrom, $dateTo, $dateFrom, $dateTo], $userParam);
    $stmt2->execute($wParams);
    $workload = $stmt2->fetchAll(PDO::FETCH_ASSOC);

    // Monthly breakdown: completed, overdue, hours per month
    $mParams = array_merge($scope, [$dateFrom, $dateTo], $userParam);
    $stmt3 = $db->prepare("SELECT
        DATE_FORMAT(t.end_date, '%Y-%m') as month,
        COUNT(*) as total,
        SUM(CASE WHEN t.status='completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN t.status != 'completed' AND t.end_date < CURDATE() THEN 1 ELSE 0 END) as overdue,
        SUM(COALESCE(t.actual_hours, 0)) as actual_hours,
        SUM(COALESCE(t.estimated_hours, 0)) as estimated_hours
        FROM tasks t
        WHERE t.project_id IN ($inClause)
        AND t.is_subtask = 0
        AND t.deleted_at IS NULL
        AND t.task_type NOT IN ('holiday','leave')
        AND t.end_date BETWEEN ? AND ?
        $userFilter
        GROUP BY month ORDER BY month");
    $stmt3->execute($mParams);
    $monthly = $stmt3->fetchAll(PDO::FETCH_ASSOC);

    // Format monthly labels to Thai month names
    $thMonths = ['01'=>'ม.ค.','02'=>'ก.พ.','03'=>'มี.ค.','04'=>'เม.ย.',
                 '05'=>'พ.ค.','06'=>'มิ.ย.','07'=>'ก.ค.','08'=>'ส.ค.',
                 '09'=>'ก.ย.','10'=>'ต.ค.','11'=>'พ.ย.','12'=>'ธ.ค.'];
    foreach ($monthly as &$m) {
        [$y, $mo] = explode('-', $m['month']);
        $m['label'] = ($thMonths[$mo] ?? $mo) . ' ' . ((int)$y + 543 - 2500);
    }
    unset($m);

    $total    = (int)($summary['total'] ?? 0);
    $onTime   = (int)($summary['on_time'] ?? 0);
    $overdue  = (int)($summary['overdue'] ?? 0);
    $diffCount = (int)($summary['hours_diff_count'] ?? 0);
    $avgDev   = $diffCount > 0 ? round(($summary['hours_diff_sum'] / $diffCount) * 100) / 100 : 0;

    echo json_encode([
        'summary' => [
            'total'               => $total,
            'completed'           => (int)($summary['completed'] ?? 0),
            'in_progress'         => (int)($summary['in_progress'] ?? 0),
            'pending'             => (int)($summary['pending'] ?? 0),
            'on_time'             => $onTime,
            'on_time_pct'         => $total > 0 ? round($onTime / $total * 100) : 0,
            'overdue'             => $overdue,
            'overdue_pct'         => $total > 0 ? round($overdue / $total * 100) : 0,
            'total_actual_hours'  => round((float)($summary['total_actual_hours'] ?? 0), 1),
            'total_estimated_hours'=> round((float)($summary['total_estimated_hours'] ?? 0), 1),
            'avg_hours_deviation' => $avgDev,
        ],
        'workload' => $workload,
        'monthly'  => $monthly,
    ], JSON_NUMERIC_CHECK);
    exit;
}

// ── DATA QUALITY ─────────────────────────────────────────────────────────────
if ($method === 'GET' && $action === 'quality') {
    $projectIds = getAccessibleProjectIds($db, $tenantId, $userId, $isAdmin);
    if (empty($projectIds)) {
        echo json_encode(['missing'=>[],'missing_total'=>0,'anomalies'=>[],'anomalies_total'=>0,'zombies'=>[],'zombies_total'=>0]);
        exit;
    }
    $inClause  = implode(',', array_fill(0, count($projectIds), '?'));
    $perPage   = max(1, min(100, (int)($_GET['per_page'] ?? 20)));
    $missingPg = max(1, (int)($_GET['missing_page'] ?? 1));
    $anomalyPg = max(1, (int)($_GET['anomaly_page'] ?? 1));
    $zombiePg  = max(1, (int)($_GET['zombie_page']  ?? 1));
    $search    = trim($_GET['search'] ?? '');
    $searchCond  = $search ? " AND t.title LIKE ?" : '';
    $searchParam = $search ? ["%$search%"] : [];

    // Missing fields — total count (exclude completed/cancelled — no point fixing closed tasks)
    $cntStmt = $db->prepare("SELECT COUNT(*) FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE t.project_id IN ($inClause)
        AND t.is_subtask = 0 AND t.deleted_at IS NULL
        AND t.status NOT IN ('completed','cancelled')
        AND t.task_type NOT IN ('holiday','leave')
        AND p.deleted_at IS NULL AND p.status NOT IN ('completed','cancelled')
        AND (t.estimated_hours IS NULL OR t.estimated_hours = 0
             OR t.assignee_user_id IS NULL OR t.end_date IS NULL)$searchCond");
    $cntStmt->execute(array_merge($projectIds, $searchParam));
    $missingTotal = (int)$cntStmt->fetchColumn();
    $missingOff   = ($missingPg - 1) * $perPage;

    $stmt = $db->prepare("SELECT t.id, t.title, p.name as project_name,
        t.assignee, t.assignee_user_id, t.estimated_hours, t.end_date, t.status, t.project_id
        FROM tasks t JOIN projects p ON p.id = t.project_id
        WHERE t.project_id IN ($inClause)
        AND t.is_subtask = 0 AND t.deleted_at IS NULL
        AND t.status NOT IN ('completed','cancelled')
        AND t.task_type NOT IN ('holiday','leave')
        AND p.deleted_at IS NULL AND p.status NOT IN ('completed','cancelled')
        AND (t.estimated_hours IS NULL OR t.estimated_hours = 0
             OR t.assignee_user_id IS NULL OR t.end_date IS NULL)$searchCond
        ORDER BY t.updated_at DESC
        LIMIT $perPage OFFSET $missingOff");
    $stmt->execute(array_merge($projectIds, $searchParam));
    $missing = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Hour anomalies — total count (is_subtask=0 only; subtasks can legitimately exceed 16h)
    $cntStmt2 = $db->prepare("SELECT COUNT(*) FROM tasks t
        WHERE t.project_id IN ($inClause) AND t.deleted_at IS NULL
        AND t.is_subtask = 0 AND t.actual_hours > 16$searchCond");
    $cntStmt2->execute(array_merge($projectIds, $searchParam));
    $anomalyTotal = (int)$cntStmt2->fetchColumn();
    $anomalyOff   = ($anomalyPg - 1) * $perPage;

    $stmt2 = $db->prepare("SELECT t.id, t.title, p.name as project_name,
        t.actual_hours, t.estimated_hours, t.assignee, t.assignee_user_id, t.start_date, t.end_date, t.status, t.project_id
        FROM tasks t JOIN projects p ON p.id = t.project_id
        WHERE t.project_id IN ($inClause) AND t.deleted_at IS NULL
        AND t.is_subtask = 0 AND t.actual_hours > 16$searchCond
        ORDER BY t.actual_hours DESC
        LIMIT $perPage OFFSET $anomalyOff");
    $stmt2->execute(array_merge($projectIds, $searchParam));
    $anomalies = $stmt2->fetchAll(PDO::FETCH_ASSOC);

    // Zombie tasks — total count
    $cntStmt3 = $db->prepare("SELECT COUNT(*) FROM (
        SELECT t.id FROM tasks t
        JOIN projects p ON p.id = t.project_id
        LEFT JOIN task_history th ON th.task_id = t.id
        WHERE t.project_id IN ($inClause)
        AND t.status = 'in-progress' AND t.end_date < DATE_SUB(CURDATE(), INTERVAL 3 DAY)
        AND t.deleted_at IS NULL AND t.is_subtask = 0$searchCond
        GROUP BY t.id
        HAVING MAX(th.created_at) IS NULL OR MAX(th.created_at) < DATE_SUB(CURDATE(), INTERVAL 14 DAY)
    ) z");
    $cntStmt3->execute(array_merge($projectIds, $searchParam));
    $zombieTotal = (int)$cntStmt3->fetchColumn();
    $zombieOff   = ($zombiePg - 1) * $perPage;

    $stmt3 = $db->prepare("SELECT t.id, t.title, p.name as project_name, t.project_id,
        t.assignee, t.assignee_user_id, t.estimated_hours, t.actual_hours, t.end_date, t.status,
        MAX(th.created_at) as last_activity
        FROM tasks t JOIN projects p ON p.id = t.project_id
        LEFT JOIN task_history th ON th.task_id = t.id
        WHERE t.project_id IN ($inClause)
        AND t.status = 'in-progress' AND t.end_date < DATE_SUB(CURDATE(), INTERVAL 3 DAY)
        AND t.deleted_at IS NULL AND t.is_subtask = 0$searchCond
        GROUP BY t.id, t.title, p.name, t.assignee, t.assignee_user_id, t.end_date, t.status
        HAVING last_activity IS NULL OR last_activity < DATE_SUB(CURDATE(), INTERVAL 14 DAY)
        ORDER BY t.end_date ASC
        LIMIT $perPage OFFSET $zombieOff");
    $stmt3->execute(array_merge($projectIds, $searchParam));
    $zombies = $stmt3->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'missing'        => $missing,
        'missing_total'  => $missingTotal,
        'anomalies'      => $anomalies,
        'anomalies_total'=> $anomalyTotal,
        'zombies'        => $zombies,
        'zombies_total'  => $zombieTotal,
        'per_page'       => $perPage,
    ], JSON_NUMERIC_CHECK);
    exit;
}

// ── DUPLICATES ───────────────────────────────────────────────────────────────
if ($method === 'GET' && $action === 'duplicates') {
    $projectIds = getAccessibleProjectIds($db, $tenantId, $userId, $isAdmin);
    if (empty($projectIds)) { echo json_encode(['data' => []]); exit; }
    $inClause = implode(',', array_fill(0, count($projectIds), '?'));

    $stmt = $db->prepare("SELECT t.id, t.title, t.project_id, p.name as project_name,
        t.assignee_user_id, t.assignee, t.start_date, t.end_date, t.status
        FROM tasks t JOIN projects p ON p.id = t.project_id
        WHERE t.project_id IN ($inClause)
        AND t.is_subtask = 0
        AND t.deleted_at IS NULL
        ORDER BY t.title, t.assignee_user_id, t.start_date
        LIMIT 400");
    $stmt->execute($projectIds);
    $all = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // PHP-side fuzzy match: group by similar title + same assignee + overlapping dates
    $groups = [];
    $used   = [];
    for ($i = 0; $i < count($all); $i++) {
        if (isset($used[$i])) continue;
        $group = [$all[$i]];
        for ($j = $i + 1; $j < count($all); $j++) {
            if (isset($used[$j])) continue;
            $a = $all[$i]; $b = $all[$j];
            similar_text(strtolower($a['title']), strtolower($b['title']), $pct);
            if ($pct < 80) continue;
            if ($a['assignee_user_id'] !== $b['assignee_user_id']) continue;
            // Date overlap check
            $aStart = $a['start_date']; $aEnd = $a['end_date'];
            $bStart = $b['start_date']; $bEnd = $b['end_date'];
            if ($aStart && $aEnd && $bStart && $bEnd) {
                if ($aEnd < $bStart || $bEnd < $aStart) continue;
            }
            $group[] = $b;
            $used[$j] = true;
        }
        if (count($group) > 1) {
            $groups[] = $group;
            $used[$i] = true;
        }
    }

    echo json_encode(['data' => $groups], JSON_NUMERIC_CHECK);
    exit;
}

// ── STALE PROJECTS ───────────────────────────────────────────────────────────
// Projects whose end_date has passed but are not completed/cancelled
if ($method === 'GET' && $action === 'stale_projects') {
    $projectIds = getAccessibleProjectIds($db, $tenantId, $userId, $isAdmin);
    if (empty($projectIds)) { echo json_encode(['data' => []]); exit; }
    $inClause = implode(',', array_fill(0, count($projectIds), '?'));

    $threshold = (int)($_GET['days'] ?? 30); // days overdue threshold

    $stmt = $db->prepare("
        SELECT p.id, p.name, p.status, p.end_date, p.start_date,
               DATEDIFF(CURDATE(), p.end_date) AS days_overdue,
               u.display_name AS manager_name,
               COUNT(t.id) AS open_task_count
        FROM projects p
        LEFT JOIN users u ON u.id = p.manager_id
        LEFT JOIN tasks t ON t.project_id = p.id AND t.deleted_at IS NULL
            AND t.status NOT IN ('completed','cancelled')
        WHERE p.tenant_id = ? AND p.deleted_at IS NULL
          AND p.kind = 'project'
          AND p.status NOT IN ('completed','cancelled')
          AND p.end_date < CURDATE()
          AND DATEDIFF(CURDATE(), p.end_date) >= ?
          AND p.id IN ($inClause)
        GROUP BY p.id
        ORDER BY days_overdue DESC
    ");
    $params = array_merge([$tenantId, $threshold], $projectIds);
    $stmt->execute($params);
    echo json_encode(['data' => $stmt->fetchAll(PDO::FETCH_ASSOC)], JSON_NUMERIC_CHECK);
    exit;
}

// ── MIGRATE PREVIEW ──────────────────────────────────────────────────────────
if ($method === 'GET' && $action === 'migrate_preview') {
    if (!$isAdmin) { jsonError('Forbidden', 403); }
    $ids = array_filter(explode(',', $_GET['project_ids'] ?? ''));
    if (empty($ids)) { jsonError('project_ids required', 400); }
    $inClause = implode(',', array_fill(0, count($ids), '?'));

    $stmt = $db->prepare("SELECT p.id, p.name,
        COUNT(t.id) as task_count
        FROM projects p
        LEFT JOIN tasks t ON t.project_id = p.id AND t.deleted_at IS NULL AND t.is_subtask = 0
        WHERE p.id IN ($inClause) AND p.tenant_id = ?
        GROUP BY p.id, p.name");
    $params = array_merge($ids, [$tenantId]);
    $stmt->execute($params);
    $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Find base_calendar
    $cal = $db->prepare("SELECT id, name FROM projects WHERE tenant_id = ? AND kind = 'base_calendar' AND deleted_at IS NULL LIMIT 1");
    $cal->execute([$tenantId]);
    $calendar = $cal->fetch(PDO::FETCH_ASSOC);

    echo json_encode(['projects' => $projects, 'target_calendar' => $calendar], JSON_NUMERIC_CHECK);
    exit;
}

// ── MIGRATE (POST) ───────────────────────────────────────────────────────────
if ($method === 'POST' && $action === 'migrate') {
    if (!$isAdmin) { jsonError('Forbidden', 403); }
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $ids = $input['project_ids'] ?? [];
    if (empty($ids) || !is_array($ids)) { jsonError('project_ids required', 400); }

    // Find base_calendar
    $cal = $db->prepare("SELECT id FROM projects WHERE tenant_id = ? AND kind = 'base_calendar' AND deleted_at IS NULL LIMIT 1");
    $cal->execute([$tenantId]);
    $calId = $cal->fetchColumn();
    if (!$calId) { jsonError('ไม่พบ Team Calendar สำหรับ tenant นี้', 404); }

    $db->beginTransaction();
    try {
        $moved = 0;
        foreach ($ids as $srcId) {
            // Verify ownership
            $check = $db->prepare("SELECT id, name FROM projects WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
            $check->execute([$srcId, $tenantId]);
            $src = $check->fetch(PDO::FETCH_ASSOC);
            if (!$src) continue;

            // Determine task_type mapping from project name
            $name = strtolower($src['name']);
            if (strpos($name, 'meeting') !== false)  $newType = 'meeting';
            elseif (strpos($name, 'research') !== false) $newType = 'research';
            else $newType = 'task';

            // Fetch tasks to move
            $tasks = $db->prepare("SELECT id FROM tasks WHERE project_id = ? AND deleted_at IS NULL");
            $tasks->execute([$srcId]);
            $taskRows = $tasks->fetchAll(PDO::FETCH_ASSOC);

            // Move tasks
            $upd = $db->prepare("UPDATE tasks SET project_id = ?, task_type = ? WHERE id = ?");
            $hist = $db->prepare("INSERT INTO task_history (id, task_id, action, field_name, old_value, new_value, changed_by, created_at)
                VALUES (UUID(), ?, 'migrated', 'project_id', ?, ?, ?, NOW())");
            foreach ($taskRows as $row) {
                $upd->execute([$calId, $newType, $row['id']]);
                $hist->execute([$row['id'], $srcId, $calId, $userId]);
                $moved++;
            }

            // Mark source project as cancelled (tasks have been moved to ปฏิทินทีม)
            $del = $db->prepare("UPDATE projects SET status = 'cancelled', deleted_at = NOW() WHERE id = ? AND tenant_id = ?");
            $del->execute([$srcId, $tenantId]);
        }
        $db->commit();
        echo json_encode(['success' => true, 'moved' => $moved]);
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('Migration failed: ' . $e->getMessage(), 500);
    }
    exit;
}

// ── BULK UPDATE TASKS ─────────────────────────────────────────────────────────
if ($method === 'POST' && $action === 'bulk_update') {
    $input   = json_decode(file_get_contents('php://input'), true) ?? [];
    $taskIds = $input['task_ids'] ?? [];
    $fields  = $input['fields']   ?? [];
    if (empty($taskIds) || !is_array($taskIds) || empty($fields)) jsonError('task_ids and fields required', 400);

    $allowed = ['status', 'estimated_hours', 'actual_hours', 'end_date', 'assignee_user_id', 'project_id'];
    $sets    = [];
    $params  = [];
    foreach ($fields as $col => $val) {
        if (!in_array($col, $allowed)) continue;
        $sets[]   = "$col = ?";
        $params[] = ($val === '' || $val === null) ? null : $val;
    }
    if (empty($sets)) jsonError('ไม่มีฟิลด์ที่อนุญาต', 400);

    // Re-derive assignee display name when assignee_user_id is set
    $assigneeJoin = '';
    if (isset($fields['assignee_user_id']) && $fields['assignee_user_id']) {
        $sets[]   = "assignee = (SELECT display_name FROM users WHERE id = ?)";
        $params[] = $fields['assignee_user_id'];
    }

    $sets[]   = "updated_at = NOW()";
    $inClause = implode(',', array_fill(0, count($taskIds), '?'));
    $params   = array_merge($params, [$tenantId], $taskIds);

    $db->beginTransaction();
    try {
        $sql  = "UPDATE tasks SET " . implode(', ', $sets) . " WHERE tenant_id = ? AND id IN ($inClause)";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $updated = $stmt->rowCount();

        // Log history for each task
        $hist = $db->prepare("INSERT INTO task_history (id, task_id, action, field_name, old_value, new_value, changed_by, created_at)
            VALUES (UUID(), ?, 'bulk_update', ?, NULL, ?, ?, NOW())");
        foreach ($taskIds as $tid) {
            foreach ($fields as $col => $val) {
                if (!in_array($col, $allowed)) continue;
                $hist->execute([$tid, $col, (string)($val ?? ''), $userId]);
            }
        }
        $db->commit();
        echo json_encode(['success' => true, 'updated' => $updated]);
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('Failed: ' . $e->getMessage(), 500);
    }
    exit;
}

// ── BULK DELETE TASKS ────────────────────────────────────────────────────────
if ($method === 'POST' && $action === 'bulk_delete') {
    $input   = json_decode(file_get_contents('php://input'), true) ?? [];
    $taskIds = $input['task_ids'] ?? [];
    if (empty($taskIds) || !is_array($taskIds)) jsonError('task_ids required', 400);
    $inClause = implode(',', array_fill(0, count($taskIds), '?'));
    $params   = array_merge([$tenantId], $taskIds);
    $db->beginTransaction();
    try {
        $stmt = $db->prepare("UPDATE tasks SET deleted_at = NOW(), updated_at = NOW() WHERE tenant_id = ? AND id IN ($inClause) AND deleted_at IS NULL");
        $stmt->execute($params);
        $deleted = $stmt->rowCount();
        $db->commit();
        echo json_encode(['success' => true, 'deleted' => $deleted]);
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('Failed: ' . $e->getMessage(), 500);
    }
    exit;
}

// ── ORPHANED TASKS (project_id IS NULL) ──────────────────────────────────────
if ($method === 'GET' && $action === 'orphaned') {
    $perPage  = max(1, min(100, (int)($_GET['per_page'] ?? 20)));
    $page     = max(1, (int)($_GET['page'] ?? 1));
    $search   = trim($_GET['search'] ?? '');
    $offset   = ($page - 1) * $perPage;

    $searchCond  = $search ? " AND t.title LIKE ?" : '';
    $searchParam = $search ? ["%$search%"] : [];

    // Total count
    $cntStmt = $db->prepare("SELECT COUNT(*) FROM tasks t
        WHERE t.tenant_id = ? AND t.project_id IS NULL AND t.deleted_at IS NULL AND t.is_subtask = 0$searchCond");
    $cntStmt->execute(array_merge([$tenantId], $searchParam));
    $total = (int)$cntStmt->fetchColumn();

    $stmt = $db->prepare("SELECT t.id, t.title, t.status, t.assignee, t.assignee_user_id, t.start_date, t.end_date,
        t.actual_hours, t.estimated_hours, t.task_type, t.created_at
        FROM tasks t
        WHERE t.tenant_id = ? AND t.project_id IS NULL AND t.deleted_at IS NULL AND t.is_subtask = 0$searchCond
        ORDER BY t.created_at DESC
        LIMIT $perPage OFFSET $offset");
    $stmt->execute(array_merge([$tenantId], $searchParam));
    $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Available projects and base_calendar for frontend
    $projStmt = $db->prepare("SELECT id, name, kind FROM projects
        WHERE tenant_id = ? AND deleted_at IS NULL
        ORDER BY kind DESC, name ASC");
    $projStmt->execute([$tenantId]);
    $projects = $projStmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'tasks'    => $tasks,
        'total'    => $total,
        'per_page' => $perPage,
        'projects' => $projects,
    ], JSON_NUMERIC_CHECK);
    exit;
}

// ── ASSIGN ORPHANED TASKS TO PROJECT ─────────────────────────────────────────
if ($method === 'POST' && $action === 'assign_project') {
    $input      = json_decode(file_get_contents('php://input'), true) ?? [];
    $taskIds    = $input['task_ids']    ?? [];
    $projectId  = $input['project_id'] ?? '';

    if (empty($taskIds) || !is_array($taskIds)) jsonError('task_ids required', 400);
    if (!$projectId) jsonError('project_id required', 400);

    // Verify project belongs to tenant
    $projStmt = $db->prepare("SELECT id, name, kind FROM projects WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
    $projStmt->execute([$projectId, $tenantId]);
    $project = $projStmt->fetch(PDO::FETCH_ASSOC);
    if (!$project) jsonError('ไม่พบ project', 404);

    $db->beginTransaction();
    try {
        $upd  = $db->prepare("UPDATE tasks SET project_id = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ? AND project_id IS NULL");
        $hist = $db->prepare("INSERT INTO task_history (id, task_id, action, field_name, old_value, new_value, changed_by, created_at)
            VALUES (UUID(), ?, 'assign_project', 'project_id', NULL, ?, ?, NOW())");
        $assigned = 0;
        foreach ($taskIds as $tid) {
            $upd->execute([$projectId, $tid, $tenantId]);
            if ($upd->rowCount() > 0) {
                $hist->execute([$tid, $projectId, $userId]);
                $assigned++;
            }
        }
        $db->commit();
        echo json_encode(['success' => true, 'assigned' => $assigned, 'project_name' => $project['name']]);
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('Failed: ' . $e->getMessage(), 500);
    }
    exit;
}

if ($method === 'POST' && $action === 'auto_fix') {
    $projectIds = getAccessibleProjectIds($db, $tenantId, $userId, $isAdmin);
    if (empty($projectIds)) jsonError('No accessible projects', 404);

    $inClause = implode(',', array_fill(0, count($projectIds), '?'));
    $fixedMissingHours = 0;
    $fixedMissingEnd   = 0;
    $fixedZombies      = 0;

    $db->beginTransaction();
    try {
        // 1. Fix missing estimated_hours (NULL or 0) → set to 8
        $stmt1 = $db->prepare("UPDATE tasks SET estimated_hours = 8, updated_at = NOW()
            WHERE project_id IN ($inClause)
            AND is_subtask = 0 AND deleted_at IS NULL
            AND task_type NOT IN ('holiday','leave')
            AND (estimated_hours IS NULL OR estimated_hours = 0)");
        $stmt1->execute($projectIds);
        $fixedMissingHours = $stmt1->rowCount();

        // 2. Fix missing end_date → set to start_date
        $stmt2 = $db->prepare("UPDATE tasks SET end_date = start_date, updated_at = NOW()
            WHERE project_id IN ($inClause)
            AND is_subtask = 0 AND deleted_at IS NULL
            AND task_type NOT IN ('holiday','leave')
            AND end_date IS NULL AND start_date IS NOT NULL");
        $stmt2->execute($projectIds);
        $fixedMissingEnd = $stmt2->rowCount();

        // 3. Fix zombie tasks (in-progress past deadline, no activity 14 days) → set to pending
        $stmt3 = $db->prepare("UPDATE tasks t
            SET t.status = 'pending', t.updated_at = NOW()
            WHERE t.project_id IN ($inClause)
            AND t.status = 'in-progress' AND t.end_date < DATE_SUB(CURDATE(), INTERVAL 3 DAY)
            AND t.deleted_at IS NULL AND t.is_subtask = 0
            AND (
                SELECT MAX(th.created_at) FROM task_history th WHERE th.task_id = t.id
            ) IS NULL OR (
                SELECT MAX(th.created_at) FROM task_history th WHERE th.task_id = t.id
            ) < DATE_SUB(CURDATE(), INTERVAL 14 DAY)"
        );
        $stmt3->execute($projectIds);
        $fixedZombies = $stmt3->rowCount();

        $db->commit();
        echo json_encode([
            'success'            => true,
            'fixed_missing_hours'=> $fixedMissingHours,
            'fixed_missing_end'  => $fixedMissingEnd,
            'fixed_zombies'      => $fixedZombies,
            'total_fixed'        => $fixedMissingHours + $fixedMissingEnd + $fixedZombies,
        ]);
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('Failed: ' . $e->getMessage(), 500);
    }
    exit;
}

jsonError('Method or action not allowed', 405);
