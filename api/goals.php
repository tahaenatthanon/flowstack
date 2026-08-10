<?php
// CRUD /api/goals.php
// Goals API - OKR/KPI Tracker for portfolio-level goal management
// 
// Endpoints:
// GET    - list goals (?project_id=, ?company_id=, ?status=)
// POST   - create goal
// PUT    - update goal (?id= required)
// DELETE - delete goal (?id= required)
// GET    - get goal with tasks (?id= with tasks)
// POST   - link task to goal
// DELETE - unlink task from goal
// GET    - get goals summary for dashboard

require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db = getDB();
$method = getMethod();

// Check if user is admin (tenant-scoped)
$isAdmin = isTenantAdmin($db, $userId, $tenantId);

// --- GET: List Goals ---
if ($method === 'GET') {
    $id = $_GET['id'] ?? null;
    $projectId = $_GET['project_id'] ?? null;
    $companyId = $_GET['company_id'] ?? null;
    $status = $_GET['status'] ?? null;
    $includeTasks = isset($_GET['include_tasks']);
    $parentGoalId = $_GET['parent_goal_id'] ?? null;
    
    // Get single goal with details
    if ($id) {
        $stmt = $db->prepare('SELECT * FROM goals WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL');
        $stmt->execute([$id, $tenantId]);
        $goal = $stmt->fetch();
        if (!$goal) jsonError('Goal not found', 404);
        
        // Get linked tasks
        if ($includeTasks) {
            $stmt = $db->prepare('
                SELECT gt.*, t.title as task_title, t.status as task_status, 
                       t.progress_percentage as task_progress, t.end_date as task_end_date,
                       p.name as project_name
                FROM goal_tasks gt
                JOIN tasks t ON gt.task_id = t.id
                JOIN projects p ON t.project_id = p.id
                WHERE gt.goal_id = ? AND gt.deleted_at IS NULL
                ORDER BY t.end_date ASC
            ');
            $stmt->execute([$id]);
            $goal['linked_tasks'] = $stmt->fetchAll();
            
            // Calculate actual progress from linked tasks
            if (!empty($goal['linked_tasks'])) {
                $totalProgress = 0;
                foreach ($goal['linked_tasks'] as $task) {
                    $totalProgress += $task['task_progress'] ?? 0;
                }
                $goal['calculated_progress'] = round($totalProgress / count($goal['linked_tasks']));
            }
        }
        
        // Get child goals
        $stmt = $db->prepare('SELECT * FROM goals WHERE parent_goal_id = ? AND tenant_id = ? AND deleted_at IS NULL ORDER BY created_at ASC');
        $stmt->execute([$id, $tenantId]);
        $goal['child_goals'] = $stmt->fetchAll();
        
        jsonResponse($goal);
    }
    
    // List goals
    $query = 'SELECT g.*, p.name as project_name, c.name as company_name
              FROM goals g
              LEFT JOIN projects p ON g.project_id = p.id
              LEFT JOIN companies c ON g.company_id = c.id
              WHERE g.tenant_id = ? AND g.deleted_at IS NULL';
    $params = [$tenantId];
    
    if ($projectId) {
        $query .= ' AND g.project_id = ?';
        $params[] = $projectId;
    }
    
    if ($companyId) {
        $query .= ' AND g.company_id = ?';
        $params[] = $companyId;
    }
    
    if ($status) {
        $query .= ' AND g.status = ?';
        $params[] = $status;
    }
    
    if ($parentGoalId !== null) {
        if ($parentGoalId === 'null' || $parentGoalId === '') {
            $query .= ' AND g.parent_goal_id IS NULL';
        } else {
            $query .= ' AND g.parent_goal_id = ?';
            $params[] = $parentGoalId;
        }
    }
    
    $query .= ' ORDER BY g.sort_order ASC, g.created_at DESC';
    
    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $goals = $stmt->fetchAll();
    
    // Add progress for each goal
    foreach ($goals as &$goal) {
        // Get task count and average progress
        $stmt = $db->prepare('
            SELECT COUNT(*) as task_count, 
                   AVG(t.progress_percentage) as avg_progress
            FROM goal_tasks gt
            JOIN tasks t ON gt.task_id = t.id
            WHERE gt.goal_id = ? AND gt.deleted_at IS NULL AND t.deleted_at IS NULL
        ');
        $stmt->execute([$goal['id']]);
        $taskStats = $stmt->fetch();
        
        $goal['task_count'] = $taskStats['task_count'] ?? 0;
        $goal['calculated_progress'] = round($taskStats['avg_progress'] ?? 0);
        
        // Get child goal count
        $stmt = $db->prepare('SELECT COUNT(*) FROM goals WHERE parent_goal_id = ? AND deleted_at IS NULL');
        $stmt->execute([$goal['id']]);
        $goal['child_goal_count'] = $stmt->fetchColumn();
    }
    
    jsonResponse($goals);
}

// --- POST: Create Goal ---
if ($method === 'POST') {
    $body = getRequestBody();
    
    $id = generateUUID();
    $title = $body['title'] ?? '';
    $description = $body['description'] ?? '';
    $goalType = $body['goal_type'] ?? 'objective'; // objective, key_result, kpi
    $projectId = $body['project_id'] ?? null;
    $companyId = $body['company_id'] ?? null;
    $parentGoalId = $body['parent_goal_id'] ?? null;
    $targetValue = floatval($body['target_value'] ?? 100);
    $currentValue = floatval($body['current_value'] ?? 0);
    $unit = $body['unit'] ?? '%'; // %, $, number
    $startDate = $body['start_date'] ?? date('Y-m-d');
    $endDate = $body['end_date'] ?? null;
    $status = $body['status'] ?? 'active';
    $ownerId = $body['owner_id'] ?? $userId;
    $sortOrder = intval($body['sort_order'] ?? 0);
    $weight = floatval($body['weight'] ?? 1); // Weight for parent goal calculation
    
    if (empty($title)) {
        jsonError('Goal title is required', 400);
    }
    
    // Verify project access if specified
    if ($projectId && !canAccessProject($db, $projectId, $userId, $tenantId, $isAdmin)) {
        jsonError('Forbidden', 403);
    }
    
    // Default end_date to 1 year from start if not provided
    if (!$endDate) {
        $endDate = date('Y-m-d', strtotime($startDate . ' +1 year'));
    }

    $stmt = $db->prepare('
        INSERT INTO goals (
            id, tenant_id, title, description, goal_type, project_id, company_id,
            parent_goal_id, target_value, current_value, unit,
            start_date, end_date, status, owner_id, created_by, weight, sort_order,
            created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
        )
    ');

    $stmt->execute([
        $id, $tenantId, $title, $description, $goalType, $projectId, $companyId,
        $parentGoalId, $targetValue, $currentValue, $unit,
        $startDate, $endDate, $status, $ownerId, $userId, $weight, $sortOrder
    ]);
    
    // Return created goal (scoped to tenant to prevent cross-tenant read)
    $stmt = $db->prepare('SELECT * FROM goals WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$id, $tenantId]);
    jsonResponse($stmt->fetch(), 201);
}

// --- PUT: Update Goal ---
if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Goal ID required', 400);
    
    $body = getRequestBody();
    
    $stmt = $db->prepare('SELECT * FROM goals WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL');
    $stmt->execute([$id, $tenantId]);
    $goal = $stmt->fetch();
    if (!$goal) jsonError('Goal not found', 404);
    
    $updates = [];
    $params = [];
    
    $allowedFields = [
        'title', 'description', 'goal_type', 'project_id', 'company_id',
        'parent_goal_id', 'target_value', 'current_value', 'unit',
        'start_date', 'end_date', 'status', 'owner_id', 'weight', 'sort_order'
    ];
    
    foreach ($allowedFields as $f) {
        if (isset($body[$f])) {
            $updates[] = "$f = ?";
            $params[] = $body[$f];
        }
    }
    
    // Auto-calculate progress if current_value or target_value changed
    if (isset($body['current_value']) || isset($body['target_value'])) {
        $currentValue = $body['current_value'] ?? $goal['current_value'];
        $targetValue = $body['target_value'] ?? $goal['target_value'];
        if ($targetValue > 0) {
            $progress = min(100, round(($currentValue / $targetValue) * 100));
            $updates[] = 'progress_percentage = ?';
            $params[] = $progress;
        }
    }
    
    if (count($updates) > 0) {
        $updates[] = 'updated_at = NOW()';
        $params[] = $id;
        
        $stmt = $db->prepare('UPDATE goals SET ' . implode(', ', $updates) . ' WHERE id = ? AND tenant_id = ?');
        $stmt->execute([...$params, $id, $tenantId]);
        
        // Recalculate parent goal progress
        if ($goal['parent_goal_id']) {
            recalculateParentGoalProgress($db, $goal['parent_goal_id']);
        }
    }
    
    $stmt = $db->prepare('SELECT * FROM goals WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$id, $tenantId]);
    jsonResponse($stmt->fetch());
}

// --- DELETE: Delete Goal ---
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Goal ID required', 400);
    
    $stmt = $db->prepare('SELECT * FROM goals WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL');
    $stmt->execute([$id, $tenantId]);
    $goal = $stmt->fetch();
    if (!$goal) jsonError('Goal not found', 404);
    
    // Soft delete
    $stmt = $db->prepare('UPDATE goals SET deleted_at = NOW() WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$id, $tenantId]);
    
    // Also unlink all tasks
    $stmt = $db->prepare('UPDATE goal_tasks SET deleted_at = NOW() WHERE goal_id = ?');
    $stmt->execute([$id]);
    
    jsonResponse(['success' => true, 'message' => 'Goal deleted']);
}

// --- POST: Link Task to Goal ---
if ($method === 'POST' && isset($_GET['link_task'])) {
    $body = getRequestBody();
    
    $goalId = $body['goal_id'] ?? '';
    $taskId = $body['task_id'] ?? '';
    $contribution = floatval($body['contribution'] ?? 100); // How much this task contributes to goal (%)
    
    if (empty($goalId) || empty($taskId)) {
        jsonError('Goal ID and Task ID are required', 400);
    }
    
    // Verify goal exists
    $stmt = $db->prepare('SELECT * FROM goals WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL');
    $stmt->execute([$goalId, $tenantId]);
    $goal = $stmt->fetch();
    if (!$goal) jsonError('Goal not found', 404);
    
    // Verify task exists and user can access
    $taskStmt = $db->prepare('SELECT * FROM tasks WHERE id = ?');
    $taskStmt->execute([$taskId]);
    $task = $taskStmt->fetch();
    if (!$task) jsonError('Task not found', 404);
    
    if (!canAccessProject($db, $task['project_id'], $userId, $tenantId, $isAdmin)) {
        jsonError('Forbidden', 403);
    }
    
    // Check if already linked
    $checkStmt = $db->prepare('SELECT id FROM goal_tasks WHERE goal_id = ? AND task_id = ? AND deleted_at IS NULL');
    $checkStmt->execute([$goalId, $taskId]);
    if ($checkStmt->fetch()) {
        jsonError('Task is already linked to this goal', 400);
    }
    
    $linkId = generateUUID();
    $stmt = $db->prepare('
        INSERT INTO goal_tasks (id, goal_id, task_id, contribution, created_at)
        VALUES (?, ?, ?, ?, NOW())
    ');
    $stmt->execute([$linkId, $goalId, $taskId, $contribution]);
    
    jsonResponse(['success' => true, 'message' => 'Task linked to goal'], 201);
}

// --- DELETE: Unlink Task from Goal ---
if ($method === 'DELETE' && isset($_GET['unlink_task'])) {
    $goalId = $_GET['goal_id'] ?? null;
    $taskId = $_GET['task_id'] ?? null;
    
    if (!$goalId || !$taskId) jsonError('Goal ID and Task ID required', 400);
    
    $stmt = $db->prepare('UPDATE goal_tasks SET deleted_at = NOW() WHERE goal_id = ? AND task_id = ?');
    $stmt->execute([$goalId, $taskId]);
    
    jsonResponse(['success' => true, 'message' => 'Task unlinked from goal']);
}

// --- GET: Goals Summary Dashboard ---
if ($method === 'GET' && isset($_GET['summary'])) {
    $companyId = $_GET['company_id'] ?? null;
    
    // Get overall stats
    $query = '
        SELECT
            COUNT(*) as total_goals,
            SUM(CASE WHEN status = "active" THEN 1 ELSE 0 END) as active_goals,
            SUM(CASE WHEN status = "completed" THEN 1 ELSE 0 END) as completed_goals,
            SUM(CASE WHEN status = "at_risk" THEN 1 ELSE 0 END) as at_risk_goals,
            AVG(progress_percentage) as avg_progress
        FROM goals
        WHERE tenant_id = ? AND deleted_at IS NULL
    ';
    $params = [$tenantId];

    if ($companyId) {
        $query .= ' AND company_id = ?';
        $params[] = $companyId;
    }
    
    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $stats = $stmt->fetch();
    
    // Get top level goals with progress
    $stmt = $db->prepare('
        SELECT g.*,
               (SELECT AVG(t.progress_percentage)
                FROM goal_tasks gt
                JOIN tasks t ON gt.task_id = t.id
                WHERE gt.goal_id = g.id AND gt.deleted_at IS NULL AND t.deleted_at IS NULL) as task_avg_progress
        FROM goals g
        WHERE g.tenant_id = ? AND g.deleted_at IS NULL AND g.parent_goal_id IS NULL
        ORDER BY g.created_at DESC
        LIMIT 10
    ');
    $stmt->execute([$tenantId]);
    $topGoals = $stmt->fetchAll();
    
    // Get goals at risk (past end date or < 50% progress with < 7 days left)
    $stmt = $db->prepare('
        SELECT g.*, DATEDIFF(g.end_date, CURDATE()) as days_left
        FROM goals g
        WHERE g.tenant_id = ? AND g.deleted_at IS NULL
          AND g.status = "active"
          AND (g.end_date < CURDATE()
           OR (g.end_date IS NOT NULL
               AND DATEDIFF(g.end_date, CURDATE()) <= 7
               AND g.progress_percentage < 50))
        ORDER BY g.end_date ASC
        LIMIT 5
    ');
    $stmt->execute([$tenantId]);
    $atRiskGoals = $stmt->fetchAll();
    
    jsonResponse([
        'stats' => $stats,
        'top_goals' => $topGoals,
        'at_risk_goals' => $atRiskGoals
    ]);
}

// Helper: Recalculate parent goal progress
function recalculateParentGoalProgress(PDO $db, string $goalId) {
    // Get all child goals
    $stmt = $db->prepare('
        SELECT g.*, 
               (SELECT AVG(t.progress_percentage) 
                FROM goal_tasks gt 
                JOIN tasks t ON gt.task_id = t.id 
                WHERE gt.goal_id = g.id AND gt.deleted_at IS NULL AND t.deleted_at IS NULL) as task_avg
        FROM goals g
        WHERE g.parent_goal_id = ? AND g.deleted_at IS NULL
    ');
    $stmt->execute([$goalId]);
    $children = $stmt->fetchAll();
    
    if (empty($children)) return;
    
    // Calculate weighted average progress
    $totalWeight = 0;
    $weightedProgress = 0;
    
    foreach ($children as $child) {
        $progress = $child['task_avg'] ?? $child['progress_percentage'] ?? 0;
        $weight = $child['weight'] ?? 1;
        
        $weightedProgress += $progress * $weight;
        $totalWeight += $weight;
    }
    
    $newProgress = $totalWeight > 0 ? round($weightedProgress / $totalWeight) : 0;
    
    $stmt = $db->prepare('UPDATE goals SET progress_percentage = ?, updated_at = NOW() WHERE id = ?');
    $stmt->execute([$newProgress, $goalId]);
    
    // Recursively update grandparent
    $stmt = $db->prepare('SELECT parent_goal_id FROM goals WHERE id = ?');
    $stmt->execute([$goalId]);
    $parentId = $stmt->fetchColumn();
    
    if ($parentId) {
        recalculateParentGoalProgress($db, $parentId);
    }
}

jsonError('Method not allowed', 405);
