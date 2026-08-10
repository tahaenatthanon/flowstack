<?php
// CRUD /api/subtasks.php
// Sub-tasks API - task hour logging via subtask management (is_subtask=1)
// 
// Endpoints:
// GET    - list subtasks (?parent_task_id= filter, or ?id= single)
// POST   - create subtask
// PUT    - update subtask (?id= required)
// DELETE - delete subtask (?id= required)
// GET    - get subtasks tree (?task_id= for getting all nested subtasks)
// POST   - reorder subtasks
// GET    - get task with subtasks included

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/task-hours-rollup.php';

$tokenData = requireAuth();
$userId = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db = getDB();
$method = getMethod();

// Check if user is admin
$isAdmin = isTenantAdmin($db, $userId, $tenantId);

function getMaxTaskHours(PDO $db, string $tenantId = ''): float {
    $where = $tenantId ? 'tenant_id = ?' : 'id = 1';
    $s = $db->prepare("SELECT max_task_hours FROM company_settings WHERE $where");
    $s->execute($tenantId ? [$tenantId] : []);
    $val = $s->fetchColumn();
    return ($val !== false && $val !== null) ? (float)$val : 16.0;
}

// Helper: calculate progress from subtasks
function calculateProgress(PDO $db, string $taskId): int {
    // Hours-weighted progress matching recalcTaskProgress() in tasks.php.
    // Cancelled subtasks are excluded from both numerator and denominator so they
    // don't artificially inflate the percentage (consistent with tasks.php).
    $stmt = $db->prepare('
        SELECT
            COUNT(*)                                                                      AS total,
            COALESCE(SUM(estimated_hours), 0)                                            AS total_hours,
            SUM(CASE WHEN status = "completed" THEN 1       ELSE 0 END)                  AS completed_count,
            SUM(CASE WHEN status = "completed" THEN COALESCE(estimated_hours, 0) ELSE 0 END) AS completed_hours
        FROM tasks
        WHERE parent_task_id = ? AND deleted_at IS NULL AND is_subtask = 0
          AND status != "cancelled"
    ');
    $stmt->execute([$taskId]);
    $result = $stmt->fetch();

    $total = (int)($result['total'] ?? 0);
    if ($total === 0) return 0;

    $totalHours     = (float)($result['total_hours']     ?? 0);
    $completedHours = (float)($result['completed_hours'] ?? 0);
    if ($totalHours > 0) {
        return (int)round(($completedHours / $totalHours) * 100);
    }
    return (int)round(((int)$result['completed_count'] / $total) * 100);
}

// Helper: update parent task progress recursively
function updateParentProgress(PDO $db, string $taskId) {
    $stmt = $db->prepare('SELECT parent_task_id FROM tasks WHERE id = ?');
    $stmt->execute([$taskId]);
    $parentId = $stmt->fetchColumn();

    if ($parentId) {
        $progress = calculateProgress($db, $parentId);
        $stmt = $db->prepare('UPDATE tasks SET progress_percentage = ?, updated_at = NOW() WHERE id = ?');
        $stmt->execute([$progress, $parentId]);
        updateParentProgress($db, $parentId);
    }
}

// Helper: recalculate parent hours from children
// Delegates to unified helper in task-hours-rollup.php.
// estimated_hours = SUM(children.estimated_hours), actual_hours = SUM(children.actual_hours)
// Filters: deleted_at IS NULL, is_subtask=0, status != \'cancelled\'
function recalculateParentHours(PDO $db, string $taskId) {
    $stmt = $db->prepare('SELECT parent_task_id FROM tasks WHERE id = ?');
    $stmt->execute([$taskId]);
    $parentId = $stmt->fetchColumn();

    if ($parentId) {
        recalcTaskHoursFromChildrenUnified($db, $parentId);
    }
}

// --- GET: List or Get Single Subtask ---
if ($method === 'GET') {
    $id = $_GET['id'] ?? null;
    $parentTaskId = $_GET['parent_task_id'] ?? null;
    $taskId = $_GET['task_id'] ?? null;
    $includeSubtasks = isset($_GET['include_subtasks']);
    $flat = isset($_GET['flat']);

    // --- Report mode: paginated subtasks with joins ---
    if (isset($_GET['report'])) {
        $page       = max(1, intval($_GET['page']  ?? 1));
        $limitRaw   = intval($_GET['limit'] ?? 25);
        $allMode    = $limitRaw >= 99999;
        $limit      = $allMode ? 99999 : min(100, max(10, $limitRaw));
        $offset     = ($page - 1) * $limit;
        $search    = trim($_GET['search']    ?? '');
        $startDate = trim($_GET['start_date'] ?? '');
        $endDate   = trim($_GET['end_date']   ?? '');
        $status    = trim($_GET['status']    ?? '');
        $priority  = trim($_GET['priority']  ?? '');
        $projectId = trim($_GET['project_id'] ?? '');

        $where  = ['s.is_subtask = 0', 's.parent_task_id IS NOT NULL', 's.deleted_at IS NULL'];
        $params = [];

        if ($search) {
            $like = "%$search%";
            $where[]  = '(s.title LIKE ? OR s.assignee LIKE ? OR p.name LIKE ? OR pt.title LIKE ?)';
            $params   = array_merge($params, [$like, $like, $like, $like]);
        }
        if ($startDate) {
            $where[]  = 's.start_date >= ?';
            $params[] = $startDate;
        }
        if ($endDate) {
            $where[]  = 's.end_date <= ?';
            $params[] = $endDate;
        }
        if ($status) {
            $where[]  = 's.status = ?';
            $params[] = $status;
        }
        if ($priority) {
            $where[]  = 's.priority = ?';
            $params[] = $priority;
        }
        if ($projectId) {
            $where[]  = 's.project_id = ?';
            $params[] = $projectId;
        }
        // Non-admins only see their own projects
        if (!$isAdmin) {
            $where[]  = '(p.user_id = ? OR pm.user_id = ?)';
            $params[] = $userId;
            $params[] = $userId;
        }

        $whereSql = 'WHERE ' . implode(' AND ', $where);

        $joinSql = 'FROM tasks s
            JOIN tasks pt ON pt.id = s.parent_task_id
            JOIN projects p ON p.id = s.project_id
            LEFT JOIN project_members pm ON pm.project_id = p.id';

        // Count
        $cStmt = $db->prepare("SELECT COUNT(DISTINCT s.id) $joinSql $whereSql");
        $cStmt->execute($params);
        $total = (int) $cStmt->fetchColumn();

        // Rows
        $rStmt = $db->prepare("SELECT DISTINCT
                s.id, s.title, s.description, s.status, s.priority,
                s.assignee, s.start_date, s.end_date, s.days_spent,
                s.estimated_days, s.completed_date, s.created_at,
                s.project_id, s.parent_task_id,
                p.name  AS project_name,
                pt.title AS parent_task_title
            $joinSql $whereSql
            ORDER BY s.start_date ASC, s.created_at ASC"
            . ($allMode ? '' : ' LIMIT ? OFFSET ?'));
        $rStmt->execute($allMode ? $params : array_merge($params, [$limit, $offset]));
        $rows = $rStmt->fetchAll(PDO::FETCH_ASSOC);

        jsonResponse([
            'subtasks' => $rows,
            'total'    => $total,
            'page'     => $page,
            'limit'    => $allMode ? $total : $limit,
            'pages'    => $allMode ? 1 : (int) ceil($total / $limit),
        ]);
    }

    // Get single subtask
    if ($id) {
        $task = getTaskWithAccess($db, $id, $userId, $tenantId, $isAdmin);
        
        // Get custom field values
        $stmt = $db->prepare('
            SELECT cfv.*, cf.name as field_name, cf.field_type, cf.field_options
            FROM task_custom_field_values cfv
            JOIN custom_fields cf ON cfv.custom_field_id = cf.id
            WHERE cfv.task_id = ? AND cf.deleted_at IS NULL
        ');
        $stmt->execute([$id]);
        $task['custom_fields'] = $stmt->fetchAll();
        
        // Get dependencies
        $stmt = $db->prepare('
            SELECT td.*, t.title as depends_on_title, t.status as depends_on_status
            FROM task_dependencies td
            JOIN tasks t ON td.depends_on_task_id = t.id
            WHERE td.task_id = ? AND td.deleted_at IS NULL
        ');
        $stmt->execute([$id]);
        $task['dependencies'] = $stmt->fetchAll();
        
        // Get blocked by
        $stmt = $db->prepare('
            SELECT td.*, t.title as blocking_task_title, t.status as blocking_task_status
            FROM task_dependencies td
            JOIN tasks t ON td.task_id = t.id
            WHERE td.depends_on_task_id = ? AND td.deleted_at IS NULL
        ');
        $stmt->execute([$id]);
        $task['blocked_by'] = $stmt->fetchAll();
        
        jsonResponse($task);
    }
    
    // Get subtasks for a parent task
    if ($parentTaskId) {
        // Verify access to parent task
        $parentTask = getTaskWithAccess($db, $parentTaskId, $userId, $tenantId, $isAdmin);
        
        $stmt = $db->prepare('
            SELECT t.*, u.display_name AS user_display_name, u.email AS user_email
            FROM tasks t
            LEFT JOIN users u ON t.user_id = u.id
            WHERE t.parent_task_id = ? AND t.deleted_at IS NULL
            ORDER BY t.sort_order ASC, t.created_at ASC
        ');
        $stmt->execute([$parentTaskId]);
        $subtasks = $stmt->fetchAll();
        
        // If not flat, add nested subtasks
        if (!$flat) {
            foreach ($subtasks as &$subtask) {
                $stmt = $db->prepare('
                    SELECT * FROM tasks 
                    WHERE parent_task_id = ? AND deleted_at IS NULL
                    ORDER BY sort_order ASC, created_at ASC
                ');
                $stmt->execute([$subtask['id']]);
                $subtask['subtasks'] = $stmt->fetchAll();
            }
        }
        
        jsonResponse($subtasks);
    }
    
    // Get task with all nested subtasks (tree structure)
    if ($taskId) {
        $task = getTaskWithAccess($db, $taskId, $userId, $tenantId, $isAdmin);
        
        // Get direct subtasks
        $stmt = $db->prepare('
            SELECT * FROM tasks 
            WHERE parent_task_id = ? AND deleted_at IS NULL
            ORDER BY sort_order ASC, created_at ASC
        ');
        $stmt->execute([$taskId]);
        $task['subtasks'] = buildSubtaskTree($db, $stmt->fetchAll());
        
        // Get progress
        $task['progress_percentage'] = calculateProgress($db, $taskId);
        
        jsonResponse($task);
    }
    
    // List all root tasks (not subtasks) - for kanban/gantt views
    $projectId = $_GET['project_id'] ?? null;
    
    if ($projectId) {
        if (!canAccessProject($db, $projectId, $userId, $tenantId, $isAdmin)) {
            jsonError('Forbidden', 403);
        }
        // Get root tasks + subtask count
        $stmt = $db->prepare('
            SELECT t.*, 
                   (SELECT COUNT(*) FROM tasks sub WHERE sub.parent_task_id = t.id AND sub.deleted_at IS NULL AND sub.is_subtask = 0 AND sub.status != \'cancelled\') as subtask_count,
                   (SELECT SUM(actual_hours) FROM tasks sub WHERE sub.parent_task_id = t.id AND sub.deleted_at IS NULL AND sub.is_subtask = 0 AND sub.status != \'cancelled\') as total_hours
            FROM tasks t
            WHERE t.project_id = ? AND t.parent_task_id IS NULL AND t.deleted_at IS NULL
            ORDER BY t.sort_order ASC, t.created_at ASC
        ');
        $stmt->execute([$projectId]);
    } elseif ($isAdmin) {
        $stmt = $db->prepare('
            SELECT t.*, 
                   (SELECT COUNT(*) FROM tasks sub WHERE sub.parent_task_id = t.id AND sub.deleted_at IS NULL AND sub.is_subtask = 0 AND sub.status != \'cancelled\') as subtask_count,
                   (SELECT SUM(actual_hours) FROM tasks sub WHERE sub.parent_task_id = t.id AND sub.deleted_at IS NULL AND sub.is_subtask = 0 AND sub.status != \'cancelled\') as total_hours
            FROM tasks t
            WHERE t.parent_task_id IS NULL AND t.deleted_at IS NULL
            ORDER BY t.sort_order ASC, t.created_at ASC
        ');
        $stmt->execute();
    } else {
        $stmt = $db->prepare('
            SELECT t.*, 
                   (SELECT COUNT(*) FROM tasks sub WHERE sub.parent_task_id = t.id AND sub.deleted_at IS NULL AND sub.is_subtask = 0 AND sub.status != \'cancelled\') as subtask_count,
                   (SELECT SUM(actual_hours) FROM tasks sub WHERE sub.parent_task_id = t.id AND sub.deleted_at IS NULL AND sub.is_subtask = 0 AND sub.status != \'cancelled\') as total_hours
            FROM tasks t
            INNER JOIN projects p ON t.project_id = p.id
            LEFT JOIN project_members pm ON p.id = pm.project_id
            WHERE (p.user_id = ? OR pm.user_id = ?) AND t.parent_task_id IS NULL AND t.deleted_at IS NULL
            ORDER BY t.sort_order ASC, t.created_at ASC
        ');
        $stmt->execute([$userId, $userId]);
    }
    
    $tasks = $stmt->fetchAll();
    
    // Include subtasks if requested
    if ($includeSubtasks) {
        foreach ($tasks as &$task) {
            $stmt = $db->prepare('
                SELECT * FROM tasks 
                WHERE parent_task_id = ? AND deleted_at IS NULL
                ORDER BY sort_order ASC, created_at ASC
            ');
            $stmt->execute([$task['id']]);
            $task['subtasks'] = $stmt->fetchAll();
        }
    }
    
    jsonResponse($tasks);
}

// --- POST: Create Subtask ---
if ($method === 'POST') {
    $body = getRequestBody();
    
    // Check if creating a subtask
    $parentTaskId = $body['parent_task_id'] ?? null;
    $projectId = $body['project_id'] ?? null;

    // Resolve project_id and permissions before duplicate guard
    if ($parentTaskId) {
        $parentTask = getTaskWithAccess($db, $parentTaskId, $userId, $tenantId, $isAdmin);
        $projectId = $parentTask['project_id'];
        $level = ($parentTask['level'] ?? 0) + 1;
        if ($level > 5) {
            jsonError('Maximum subtask nesting level (5) exceeded', 400);
        }
    } else {
        if (!canAccessProject($db, $projectId, $userId, $tenantId, $isAdmin)) {
            jsonError('Forbidden', 403);
        }
        $level = 0;
    }

    // Duplicate guard: check if identical task (same dedup key) already exists
    $dupTitle = $body['title'] ?? '';
    $dupStartDate = $body['start_date'] ?? date('Y-m-d');
    $dupEndDate = $body['end_date'] ?? $dupStartDate;
    $dupAssignee = $body['assignee'] ?? '';
    if ($dupTitle && $projectId) {
        // Check for existing task — including soft-deleted (they still block the unique key)
        $dupStmt = $db->prepare('
            SELECT id, deleted_at FROM tasks
            WHERE project_id = ? AND title = ? AND start_date = ? AND end_date = ? AND assignee = ?
            ORDER BY deleted_at IS NULL DESC LIMIT 1
        ');
        $dupStmt->execute([$projectId, $dupTitle, $dupStartDate, $dupEndDate, $dupAssignee]);
        $dupRow = $dupStmt->fetch();
        if ($dupRow) {
            if ($dupRow['deleted_at']) {
                $db->prepare('UPDATE tasks SET deleted_at = NULL, updated_at = NOW() WHERE id = ?')->execute([$dupRow['id']]);
            }
            $existingTask = getTaskWithAccess($db, $dupRow['id'], $userId, $tenantId, $isAdmin);
            jsonResponse($existingTask, 201);
            exit;
        }
    }
    
    $taskId = $body['id'] ?? generateUUID();
    $title = $body['title'] ?? 'Untitled Task';
    $description = $body['description'] ?? '';
    $status = $body['status'] ?? 'pending';
    $priority = $body['priority'] ?? 'medium';
    $assignee = $body['assignee'] ?? '';
    $assigneeUserId = $body['assignee_user_id'] ?? null;
    $startDate = $body['start_date'] ?? date('Y-m-d');
    $endDate = $body['end_date'] ?? $startDate;
    // Recompute estimated_days from date range (match tasks.php logic)
    $estimatedDays = $startDate !== $endDate
        ? max(1, round((strtotime($endDate) - strtotime($startDate)) / 86400 + 1))
        : intval($body['estimated_days'] ?? 1);
    $estimatedHours = isset($body['estimated_hours']) && $body['estimated_hours'] !== ''
        ? floatval($body['estimated_hours'])
        : $estimatedDays * 8;

    $maxTaskHours = getMaxTaskHours($db, $tenantId);
    // Business Rule: single-day tasks cannot exceed configured max hours
    if ($startDate === $endDate && $estimatedHours > $maxTaskHours) {
        jsonError("Single-day task cannot exceed {$maxTaskHours} hours. Please split into subtasks.", 422);
    }

    $actualHours = floatval($body['actual_hours'] ?? 0);
    $taskType = $body['task_type'] ?? 'task';
    $sortOrder = intval($body['sort_order'] ?? 0);

    try {
        $stmt = $db->prepare('
            INSERT IGNORE INTO tasks (
                id, tenant_id, project_id, user_id, title, description, status, priority,
                assignee, assignee_user_id, start_date, end_date, estimated_days, task_type,
                parent_task_id, is_subtask, level, sort_order, estimated_hours, actual_hours, base_actual_hours,
                created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?,
                NOW(), NOW()
            )
        ');

        $stmt->execute([
            $taskId, $tenantId, $projectId, $userId, $title, $description, $status, $priority,
            $assignee, $assigneeUserId, $startDate, $endDate, $estimatedDays, $taskType,
            $parentTaskId, $level, $sortOrder, $estimatedHours, $actualHours, $actualHours
        ]);

        // If rowCount is 0, INSERT IGNORE skipped a duplicate — return existing
        if ($stmt->rowCount() === 0) {
            // Duplicate key violation — find existing (including soft-deleted) and restore if needed
            $existing = $db->prepare('
                SELECT id, deleted_at FROM tasks
                WHERE project_id = ? AND title = ? AND start_date = ? AND end_date = ? AND assignee = ?
                ORDER BY deleted_at IS NULL DESC, created_at ASC LIMIT 1
            ');
            $existing->execute([$projectId, $title, $startDate, $endDate, $assignee]);
            $row = $existing->fetch();
            if ($row) {
                if ($row['deleted_at']) {
                    $db->prepare('UPDATE tasks SET deleted_at = NULL, updated_at = NOW() WHERE id = ?')->execute([$row['id']]);
                }
                $existingTask = getTaskWithAccess($db, $row['id'], $userId, $tenantId, $isAdmin);
                jsonResponse($existingTask, 201);
                exit;
            }
        }
    } catch (PDOException $e) {
        throw $e;
    }

    // Calculate and update progress for parent
    if ($parentTaskId) {
        updateParentProgress($db, $taskId);
        recalculateParentHours($db, $taskId);
    }

    // Return created task
    $task = getTaskWithAccess($db, $taskId, $userId, $tenantId, $isAdmin);
    jsonResponse($task, 201);
}

// --- PUT: Update Subtask ---
if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Task ID required', 400);
    
    $task = getTaskWithAccess($db, $id, $userId, $tenantId, $isAdmin);
    $body = getRequestBody();
    
    // Fields that can be updated
    $allowedFields = [
        'title', 'description', 'status', 'priority', 'assignee',
        'start_date', 'end_date', 'estimated_days', 'task_type',
        'sort_order', 'progress_percentage', 'estimated_hours', 'actual_hours'
    ];

    // Recompute estimated_days from date range when dates change
    $newStart = $body['start_date'] ?? $task['start_date'];
    $newEnd   = $body['end_date']   ?? $task['end_date'];
    if ($newStart !== $newEnd) {
        $body['estimated_days'] = max(1, round((strtotime($newEnd) - strtotime($newStart)) / 86400 + 1));
    }

    $updates = [];
    $params = [];

    foreach ($allowedFields as $field) {
        if (isset($body[$field])) {
            $updates[] = "$field = ?";
            $params[] = $body[$field];
        }
    }

    if (array_key_exists('actual_hours', $body)) {
        $updates[] = 'base_actual_hours = ?';
        $params[] = floatval($body['actual_hours']);
    }
    
    // Handle status change - trigger auto-shift for dependencies (completed or cancelled)
    if (isset($body['status']) && in_array($body['status'], ['completed', 'cancelled']) && $task['status'] !== $body['status']) {
        // Update dependent tasks
        $stmt = $db->prepare('
            SELECT task_id FROM task_dependencies 
            WHERE depends_on_task_id = ? AND auto_shift_dates = 1 AND deleted_at IS NULL
        ');
        $stmt->execute([$id]);
        $dependentTasks = $stmt->fetchAll();
        
        $newEndDate = $body['end_date'] ?? $task['end_date'];
        
        foreach ($dependentTasks as $dep) {
            $depTask = getTaskWithAccess($db, $dep['task_id'], $userId, $tenantId, $isAdmin);
            if ($depTask['end_date'] <= $newEndDate) {
                $newDepEndDate = date('Y-m-d', strtotime($newEndDate . ' +1 day'));
                $updates[] = 'end_date = ?';
                $params[] = $newDepEndDate;
                $updates[] = 'auto_shifted = 1';
            }
        }
    }
    
    $maxTaskHours = getMaxTaskHours($db, $tenantId);
    // Business Rule: single-day tasks cannot exceed configured max hours
    $finalEstHours = floatval($body['estimated_hours'] ?? $task['estimated_hours'] ?? 8);
    if ($newStart === $newEnd && $finalEstHours > $maxTaskHours) {
        jsonError("Single-day task cannot exceed {$maxTaskHours} hours. Please split into subtasks.", 422);
    }

    if (count($updates) > 0) {
        $updates[] = 'updated_at = NOW()';
        $params[] = $id;

        $stmt = $db->prepare('UPDATE tasks SET ' . implode(', ', $updates) . ' WHERE id = ?');
        $stmt->execute($params);

        // Recalculate parent progress and hours
        if ($task['parent_task_id']) {
            updateParentProgress($db, $id);
            recalculateParentHours($db, $id);
        }
    }
    
    // Return updated task
    $updatedTask = getTaskWithAccess($db, $id, $userId, $tenantId, $isAdmin);
    jsonResponse($updatedTask);
}

// --- DELETE: Delete Subtask ---
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Task ID required', 400);
    
    $task = getTaskWithAccess($db, $id, $userId, $tenantId, $isAdmin);
    $parentTaskId = $task['parent_task_id'];
    
    // Soft delete
    $stmt = $db->prepare('UPDATE tasks SET deleted_at = NOW() WHERE id = ?');
    $stmt->execute([$id]);
    
    // Also delete subtasks recursively (soft delete)
    $stmt = $db->prepare('UPDATE tasks SET deleted_at = NOW() WHERE parent_task_id = ?');
    $stmt->execute([$id]);
    
    // Update parent progress
    if ($parentTaskId) {
        updateParentProgress($db, $id);
        recalculateParentHours($db, $id);
    }
    
    jsonResponse(['success' => true, 'message' => 'Task deleted']);
}

// --- POST: Reorder Subtasks ---
if ($method === 'POST' && isset($_GET['reorder'])) {
    $body = getRequestBody();
    $orders = $body['orders'] ?? []; // Array of {id, sort_order}
    
    foreach ($orders as $order) {
        $stmt = $db->prepare('UPDATE tasks SET sort_order = ?, updated_at = NOW() WHERE id = ?');
        $stmt->execute([$order['sort_order'], $order['id']]);
    }
    
    jsonResponse(['success' => true]);
}

// Helper function to build subtask tree
function buildSubtaskTree(PDO $db, array $parentTasks): array {
    foreach ($parentTasks as &$task) {
        $stmt = $db->prepare('
            SELECT * FROM tasks 
            WHERE parent_task_id = ? AND deleted_at IS NULL
            ORDER BY sort_order ASC, created_at ASC
        ');
        $stmt->execute([$task['id']]);
        $children = $stmt->fetchAll();
        
        if (count($children) > 0) {
            $task['subtasks'] = buildSubtaskTree($db, $children);
        }
    }
    return $parentTasks;
}

// If method not matched
jsonError('Method not allowed', 405);
