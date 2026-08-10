<?php
// CRUD /api/budget.php
// Budget & Cost Tracking API - tracks budget vs actual costs per project/task
// 
// Endpoints:
// GET    - list budget items (?project_id=, ?task_id=)
// POST   - create budget item
// PUT    - update budget item (?id= required)
// DELETE - delete budget item (?id= required)
// GET    - get budget summary for project
// GET    - get cost breakdown

require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db = getDB();
$method = getMethod();

// Check if user is admin (tenant-scoped)
$isAdmin = isTenantAdmin($db, $userId, $tenantId);

// --- GET: Multi-Project Budget Summary ---
if ($method === 'GET' && isset($_GET['multi-summary'])) {
    $year = !empty($_GET['year']) ? (int)$_GET['year'] : null;

    // Build project query — filter by tenant and optionally by year
    $projSql = "SELECT id, name, project_value FROM projects WHERE tenant_id = ? AND deleted_at IS NULL AND name != 'ปฏิทินทีม'";
    $projParams = [$tenantId];
    if ($year) {
        // Projects active during the selected year:
        // started on or before Dec 31 of that year AND (no end date OR ended on or after Jan 1 of that year)
        $projSql .= ' AND start_date <= ? AND (end_date IS NULL OR end_date >= ?)';
        $projParams[] = "$year-12-31";
        $projParams[] = "$year-01-01";
    }
    $projSql .= ' ORDER BY start_date DESC';
    $projStmt = $db->prepare($projSql);
    $projStmt->execute($projParams);
    $projects = $projStmt->fetchAll();

    if (empty($projects)) {
        jsonResponse(['projects' => [], 'total' => ['budget' => 0, 'spent' => 0, 'remaining' => 0, 'count' => 0]]);
    }

    $projectIds = array_column($projects, 'id');
    $inPlaceholders = implode(',', array_fill(0, count($projectIds), '?'));

    // Batch query: budget totals for all projects
    $btStmt = $db->prepare("
        SELECT project_id,
               SUM(planned_cost) as total_planned,
               SUM(actual_cost) as total_actual,
               SUM(CASE WHEN status = 'committed' THEN actual_cost ELSE 0 END) as committed,
               SUM(CASE WHEN status = 'actual' THEN actual_cost ELSE 0 END) as spent
        FROM budget_items
        WHERE project_id IN ($inPlaceholders) AND deleted_at IS NULL
        GROUP BY project_id
    ");
    $btStmt->execute($projectIds);
    $budgetTotals = [];
    foreach ($btStmt->fetchAll() as $row) {
        $budgetTotals[$row['project_id']] = $row;
    }

    // Batch query: labor hours for all projects
    $labStmt = $db->prepare("
        SELECT project_id,
               SUM(actual_hours) as total_hours,
               AVG(hourly_rate) as avg_rate
        FROM tasks
        WHERE project_id IN ($inPlaceholders) AND deleted_at IS NULL AND actual_hours > 0
        GROUP BY project_id
    ");
    $labStmt->execute($projectIds);
    $laborTotals = [];
    foreach ($labStmt->fetchAll() as $row) {
        $laborTotals[$row['project_id']] = $row;
    }

    $grandBudget = 0;
    $grandSpent = 0;
    $grandRemaining = 0;

    // Build per-project summaries
    $projectSummaries = [];
    foreach ($projects as $p) {
        $pid      = $p['id'];
        $pBudget  = (float)($p['project_value'] ?? 0);
        $totals   = $budgetTotals[$pid] ?? null;
        $labor    = $laborTotals[$pid] ?? null;
        $totalActual = (float)($totals['total_actual'] ?? 0);
        $laborCost   = (float)($labor['total_hours'] ?? 0) * (float)($labor['avg_rate'] ?? 0);
        $remaining   = $pBudget > 0 ? $pBudget - $totalActual : 0;
        $remainingPct = $pBudget > 0 ? round(($remaining / $pBudget) * 100, 2) : 0;

        $health = 'healthy';
        if ($pBudget > 0) {
            if ($remaining < 0) $health = 'over_budget';
            elseif ($remainingPct < 10) $health = 'warning';
        }

        $committed = (float)($totals['committed'] ?? 0);
        $spent     = (float)($totals['spent'] ?? 0);

        $grandBudget    += $pBudget;
        $grandSpent     += $totalActual;
        $grandRemaining += $remaining;

        $projectSummaries[] = [
            'project_id'      => $pid,
            'project_name'    => $p['name'],
            'project_budget'  => $pBudget,
            'total_planned'   => (float)($totals['total_planned'] ?? 0),
            'total_actual'    => $totalActual,
            'committed'       => $committed,
            'spent'           => $spent,
            'labor_cost'      => $laborCost,
            'total_with_labor'=> $totalActual + $laborCost,
            'remaining'       => $remaining,
            'remaining_percent' => $remainingPct,
            'health'          => $health,
        ];
    }

    jsonResponse([
        'projects' => $projectSummaries,
        'total'    => [
            'budget'    => $grandBudget,
            'spent'     => $grandSpent,
            'remaining' => $grandRemaining,
            'count'     => count($projects),
        ],
    ]);
}

// --- GET: Budget Summary for Project ---
if ($method === 'GET' && isset($_GET['summary'])) {
    $projectId = $_GET['project_id'] ?? null;
    if (!$projectId) jsonError('Project ID required', 400);
    
    if (!canAccessProject($db, $projectId, $userId, $tenantId, $isAdmin)) {
        jsonError('Forbidden', 403);
    }
    
    // Get project budget (from project_value column)
    $stmt = $db->prepare('SELECT project_value FROM projects WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$projectId, $tenantId]);
    $projectBudget = floatval($stmt->fetchColumn() ?? 0);
    
    // Get totals by status
    $stmt = $db->prepare('
        SELECT 
            SUM(planned_cost) as total_planned,
            SUM(actual_cost) as total_actual,
            SUM(CASE WHEN status = "planned" THEN planned_cost ELSE 0 END) as planned,
            SUM(CASE WHEN status = "committed" THEN actual_cost ELSE 0 END) as committed,
            SUM(CASE WHEN status = "actual" THEN actual_cost ELSE 0 END) as spent
        FROM budget_items 
        WHERE project_id = ? AND deleted_at IS NULL
    ');
    $stmt->execute([$projectId]);
    $totals = $stmt->fetch();
    
    // Get by category
    $stmt = $db->prepare('
        SELECT category, 
               SUM(planned_cost) as planned, 
               SUM(actual_cost) as actual
        FROM budget_items 
        WHERE project_id = ? AND deleted_at IS NULL
        GROUP BY category
    ');
    $stmt->execute([$projectId]);
    $byCategory = $stmt->fetchAll();
    
    // Cast to float so JSON returns numbers
    $byCategory = array_map(function($row) {
        $row['planned'] = (float)$row['planned'];
        $row['actual'] = (float)$row['actual'];
        return $row;
    }, $byCategory);
    
    // Calculate variances
    $totalActual = (float)($totals['total_actual'] ?? 0);
    $variance = $projectBudget > 0 ? $projectBudget - $totalActual : 0;
    $variancePercent = $projectBudget > 0 ? round(($variance / $projectBudget) * 100, 2) : 0;
    
    $remaining = $projectBudget > 0 ? $projectBudget - $totalActual : 0;
    $remainingPercent = $projectBudget > 0 ? round(($remaining / $projectBudget) * 100, 2) : 0;
    
    // Budget health status (only evaluate if budget is set)
    $health = 'healthy';
    if ($projectBudget > 0) {
        if ($remaining < 0) {
            $health = 'over_budget';
        } elseif ($remainingPercent < 10) {
            $health = 'warning';
        }
    }
    
    // Add time-tracked costs from tasks
    $stmt = $db->prepare('
        SELECT SUM(actual_hours) as total_hours, AVG(hourly_rate) as avg_rate
        FROM tasks 
        WHERE project_id = ? AND deleted_at IS NULL AND actual_hours > 0
    ');
    $stmt->execute([$projectId]);
    $timeData = $stmt->fetch();
    
    $laborCost = (float)($timeData['total_hours'] ?? 0) * (float)($timeData['avg_rate'] ?? 0);
    
    jsonResponse([
        'project_budget' => $projectBudget,
        'total_planned' => (float)($totals['total_planned'] ?? 0),
        'total_actual' => $totalActual,
        'committed' => (float)($totals['committed'] ?? 0),
        'spent' => (float)($totals['spent'] ?? 0),
        'labor_cost' => $laborCost,
        'total_with_labor' => $totalActual + $laborCost,
        'variance' => $variance,
        'variance_percent' => $variancePercent,
        'remaining' => $remaining,
        'remaining_percent' => $remainingPercent,
        'health' => $health,
        'by_category' => $byCategory
    ]);
}

// --- GET: Cost Breakdown ---
if ($method === 'GET' && isset($_GET['breakdown'])) {
    $projectId = $_GET['project_id'] ?? null;
    if (!$projectId) jsonError('Project ID required', 400);
    
    if (!canAccessProject($db, $projectId, $userId, $tenantId, $isAdmin)) {
        jsonError('Forbidden', 403);
    }
    
    $stmt = $db->prepare('
        SELECT bi.*, t.title as task_title, t.status as task_status,
               t.progress_percentage as task_progress
        FROM budget_items bi
        LEFT JOIN tasks t ON bi.task_id = t.id
        WHERE bi.project_id = ? AND bi.tenant_id = ? AND bi.deleted_at IS NULL
        ORDER BY bi.category ASC, bi.created_at DESC
    ');
    $stmt->execute([$projectId, $tenantId]);
    $items = $stmt->fetchAll();
    
    $stmt = $db->prepare('
        SELECT id, title, status, progress_percentage,
               estimated_hours, actual_hours, 
               (estimated_hours * hourly_rate) as planned_labor,
               (actual_hours * hourly_rate) as actual_labor
        FROM tasks 
        WHERE project_id = ? AND deleted_at IS NULL AND is_subtask = 0
    ');
    $stmt->execute([$projectId]);
    $tasks = $stmt->fetchAll();
    
    jsonResponse([
        'budget_items' => $items,
        'labor_by_task' => $tasks,
        'totals' => [
            'budget_items_total' => array_sum(array_column($items, 'actual_cost')),
            'labor_total' => array_sum(array_map(fn($t) => (float)($t['actual_labor'] ?? 0), $tasks))
        ]
    ]);
}

// --- GET: Time Tracking Summary ---
if ($method === 'GET' && isset($_GET['time_tracking'])) {
    $projectId = $_GET['project_id'] ?? null;
    $taskId = $_GET['task_id'] ?? null;
    $userIdFilter = $_GET['user_id'] ?? null;
    
    if ($projectId && !canAccessProject($db, $projectId, $userId, $tenantId, $isAdmin)) {
        jsonError('Forbidden', 403);
    }
    
    $query = '
        SELECT t.id as task_id, t.title as task_title, t.status as task_status,
               t.estimated_hours, t.actual_hours, t.hourly_rate,
               (t.estimated_hours * t.hourly_rate) as planned_cost,
               (t.actual_hours * t.hourly_rate) as actual_cost,
               p.name as project_name
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE t.deleted_at IS NULL AND t.is_subtask = 0
    ';
    $params = [];
    
    if ($projectId) {
        $query .= ' AND t.project_id = ?';
        $params[] = $projectId;
    }
    if ($taskId) {
        $query .= ' AND t.id = ?';
        $params[] = $taskId;
    }
    if ($userIdFilter) {
        $query .= ' AND t.assignee = ?';
        $params[] = $userIdFilter;
    }
    
    $query .= ' ORDER BY t.actual_hours DESC';
    
    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $tasks = $stmt->fetchAll();
    
    $totalEstimated = 0; $totalActual = 0; $totalPlannedCost = 0; $totalActualCost = 0;
    foreach ($tasks as $task) {
        $totalEstimated += (float)($task['estimated_hours'] ?? 0);
        $totalActual += (float)($task['actual_hours'] ?? 0);
        $totalPlannedCost += (float)($task['planned_cost'] ?? 0);
        $totalActualCost += (float)($task['actual_cost'] ?? 0);
    }
    
    jsonResponse([
        'tasks' => $tasks,
        'totals' => [
            'estimated_hours' => $totalEstimated,
            'actual_hours' => $totalActual,
            'planned_cost' => $totalPlannedCost,
            'actual_cost' => $totalActualCost,
            'variance_hours' => $totalEstimated - $totalActual,
            'variance_cost' => $totalPlannedCost - $totalActualCost
        ]
    ]);
}

// --- GET: List Budget Items ---
if ($method === 'GET') {
    $id = $_GET['id'] ?? null;
    $projectId = $_GET['project_id'] ?? null;
    $taskId = $_GET['task_id'] ?? null;
    $category = $_GET['category'] ?? null;
    
    // Get single budget item
    if ($id) {
        $stmt = $db->prepare('SELECT * FROM budget_items WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL');
        $stmt->execute([$id, $tenantId]);
        $item = $stmt->fetch();
        if (!$item) jsonError('Budget item not found', 404);
        jsonResponse($item);
    }
    
    // List items
    $query = 'SELECT bi.*, p.name as project_name, t.title as task_title
              FROM budget_items bi
              LEFT JOIN projects p ON bi.project_id = p.id
              LEFT JOIN tasks t ON bi.task_id = t.id
              WHERE bi.tenant_id = ? AND bi.deleted_at IS NULL';
    $params = [$tenantId];
    
    if ($projectId) {
        if (!canAccessProject($db, $projectId, $userId, $tenantId, $isAdmin)) jsonError('Forbidden', 403);
        $query .= ' AND bi.project_id = ?';
        $params[] = $projectId;
    }
    if ($taskId) {
        $query .= ' AND bi.task_id = ?';
        $params[] = $taskId;
    }
    if ($category) {
        $query .= ' AND bi.category = ?';
        $params[] = $category;
    }
    
    $query .= ' ORDER BY bi.created_at DESC';
    $stmt = $db->prepare($query);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

// --- POST: Create Budget Item ---
if ($method === 'POST') {
    $body = getRequestBody();
    
    $projectId = $body['project_id'] ?? '';
    if (!canAccessProject($db, $projectId, $userId, $tenantId, $isAdmin)) {
        jsonError('Forbidden', 403);
    }
    
    $id = generateUUID();
    $name = $body['name'] ?? '';
    $description = $body['description'] ?? '';
    $category = $body['category'] ?? 'general'; // labor, material, equipment, travel, software, other
    $taskId = $body['task_id'] ?? null;
    $plannedCost = floatval($body['planned_cost'] ?? 0);
    $actualCost = floatval($body['actual_cost'] ?? 0);
    $quantity = floatval($body['quantity'] ?? 1);
    $unitPrice = floatval($body['unit_price'] ?? 0);
    $unit = $body['unit'] ?? 'unit'; // hours, days, items, etc.
    $startDate = $body['start_date'] ?? null;
    $endDate = $body['end_date'] ?? null;
    $vendor = $body['vendor'] ?? '';
    $status = $body['status'] ?? 'planned'; // planned, committed, actual, cancelled
    
    if (empty($name)) {
        jsonError('Budget item name is required', 400);
    }
    
    $stmt = $db->prepare('
        INSERT INTO budget_items (
            id, tenant_id, project_id, task_id, name, description, category,
            planned_cost, actual_cost, quantity, unit_price, unit,
            start_date, end_date, vendor, status,
            created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
        )
    ');
    
    $stmt->execute([
        $id, $tenantId, $projectId, $taskId, $name, $description, $category,
        $plannedCost, $actualCost, $quantity, $unitPrice, $unit,
        $startDate, $endDate, $vendor, $status
    ]);
    
    // Update project total budget
    updateProjectBudget($db, $projectId);
    
    $stmt = $db->prepare('SELECT * FROM budget_items WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch(), 201);
}

// --- PUT: Update Budget Item ---
if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Budget Item ID required', 400);
    
    $body = getRequestBody();
    
    $stmt = $db->prepare('SELECT * FROM budget_items WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL');
    $stmt->execute([$id, $tenantId]);
    $item = $stmt->fetch();
    if (!$item) jsonError('Budget item not found', 404);
    
    if (!canAccessProject($db, $item['project_id'], $userId, $tenantId, $isAdmin)) {
        jsonError('Forbidden', 403);
    }
    
    $updates = [];
    $params = [];
    
    $allowedFields = [
        'name', 'description', 'category', 'task_id',
        'planned_cost', 'actual_cost', 'quantity', 'unit_price', 'unit',
        'start_date', 'end_date', 'vendor', 'status'
    ];
    
    foreach ($allowedFields as $f) {
        if (isset($body[$f])) {
            $updates[] = "$f = ?";
            $params[] = $body[$f];
        }
    }
    
    if (count($updates) > 0) {
        $updates[] = 'updated_at = NOW()';
        $params[] = $id;
        
        $stmt = $db->prepare('UPDATE budget_items SET ' . implode(', ', $updates) . ' WHERE id = ?');
        $stmt->execute($params);
        
        // Update project totals
        updateProjectBudget($db, $item['project_id']);
    }
    
    $stmt = $db->prepare('SELECT * FROM budget_items WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch());
}

// --- DELETE: Delete Budget Item ---
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Budget Item ID required', 400);
    
    $stmt = $db->prepare('SELECT * FROM budget_items WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL');
    $stmt->execute([$id, $tenantId]);
    $item = $stmt->fetch();
    if (!$item) jsonError('Budget item not found', 404);
    
    if (!canAccessProject($db, $item['project_id'], $userId, $tenantId, $isAdmin)) {
        jsonError('Forbidden', 403);
    }
    
    $stmt = $db->prepare('UPDATE budget_items SET deleted_at = NOW() WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$id, $tenantId]);
    
    // Update project totals
    updateProjectBudget($db, $item['project_id']);
    
    jsonResponse(['success' => true, 'message' => 'Budget item deleted']);
}

// Helper: Update project updated_at when budget changes
function updateProjectBudget(PDO $db, string $projectId) {
    $stmt = $db->prepare('UPDATE projects SET updated_at = NOW() WHERE id = ?');
    $stmt->execute([$projectId]);
}

jsonError('Method not allowed', 405);
