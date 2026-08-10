<?php
// CRUD /api/tasks.php
// GET    - list tasks (?project_id= filter, or ?id= single, or all)
// POST   - create task
// PUT    - update task (?id= required)
// DELETE - delete task (?id= required)
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/automation-fire.php';
require_once __DIR__ . '/work-type-catalog.php';
require_once __DIR__ . '/task-hours-rollup.php';
require_once __DIR__ . '/notification-utils.php';

$tokenData = requireAuth();
$userId = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db = getDB();
$method = getMethod();

// Check if user is admin (tenant-scoped)
$isAdmin = isTenantAdmin($db, $userId, $tenantId);

function getMaxTaskHours(PDO $db, string $tenantId = ''): float {
    $where = $tenantId ? 'tenant_id = ?' : 'id = 1';
    $s = $db->prepare("SELECT max_task_hours FROM company_settings WHERE $where");
    $s->execute($tenantId ? [$tenantId] : []);
    $val = $s->fetchColumn();
    return ($val !== false && $val !== null) ? (float)$val : 16.0;
}

// ── Validation rule enforcement ───────────────────────────────────────────
function runValidationRules(PDO $db, string $tenantId, string $userId, array $input, ?string $taskId = null): array {
    $warnings = [];
    $blocks   = [];

    $stmt = $db->prepare("SELECT * FROM task_validation_rules WHERE tenant_id = ? AND is_active = 1");
    $stmt->execute([$tenantId]);
    $rules = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($rules as $rule) {
        $field = $rule['condition_field'];
        $op    = $rule['condition_operator'];
        $val   = $rule['condition_value'];
        $msg   = $rule['message_th'];
        $type  = $rule['rule_type'];
        $triggered = false;

        if ($field === 'actual_hours' && $op === 'gt') {
            $triggered = isset($input['actual_hours']) && (float)$input['actual_hours'] > (float)$val;
        } elseif ($field === 'daily_hours_sum' && $op === 'gt') {
            $date = $input['start_date'] ?? date('Y-m-d');
            $excludeId = $taskId ?? '__none__';
            $assigneeId = $input['assignee_user_id'] ?? '';
            if ($assigneeId) {
                $s = $db->prepare("SELECT COALESCE(SUM(actual_hours),0) FROM tasks
                    WHERE assignee_user_id = ? AND start_date = ? AND start_date = end_date AND deleted_at IS NULL
                    AND (
                        is_subtask = 0 AND NOT EXISTS (
                            SELECT 1 FROM tasks sub
                            WHERE sub.parent_task_id = tasks.id
                              AND sub.is_subtask = 0
                              AND sub.deleted_at IS NULL
                        )
                    )
                    AND id != ?");
                $s->execute([$assigneeId, $date, $excludeId]);
                $sum = (float)$s->fetchColumn() + (float)($input['actual_hours'] ?? 0);
                $triggered = $sum > (float)$val;
            }
        } elseif ($field === 'assignee_user_id' && $op === 'null') {
            $triggered = empty($input['assignee_user_id']);
        } elseif ($field === 'estimated_hours' && $op === 'null') {
            $triggered = !isset($input['estimated_hours']) || $input['estimated_hours'] === '' || $input['estimated_hours'] === null;
        } elseif ($field === 'estimated_hours' && $op === 'gt') {
            $threshold = ($val === 'max_task_hours') ? getMaxTaskHours($db, $tenantId) : (float)$val;
            $triggered = isset($input['estimated_hours']) && (float)$input['estimated_hours'] > $threshold;
            if ($triggered && $val === 'max_task_hours') {
                $msg = "ชั่วโมงประมาณเกิน {$threshold} ชม. แนะนำให้แตกเป็นงานย่อย";
            }
        } elseif ($field === 'end_before_start' && $op === 'invalid') {
            $s = $input['start_date'] ?? null; $e = $input['end_date'] ?? null;
            $triggered = $s && $e && $e < $s;
        } elseif ($field === 'title_duplicate' && $op === 'duplicate') {
            // Only warn on create (no $taskId); skip during update since the task is being edited, not duplicated.
            if ($taskId) {
                $triggered = false;
            } elseif (!empty($input['title']) && !empty($input['project_id'])) {
                $s = $db->prepare("SELECT COUNT(*) FROM tasks
                    WHERE project_id = ? AND title = ? AND start_date = ? AND end_date = ? AND assignee = ? AND deleted_at IS NULL");
                $s->execute([
                    $input['project_id'],
                    $input['title'],
                    $input['start_date'] ?? date('Y-m-d'),
                    $input['end_date']   ?? $input['start_date'] ?? date('Y-m-d'),
                    $input['assignee']   ?? '',
                ]);
                $triggered = (int)$s->fetchColumn() > 0;
            }
        }

        if ($triggered) {
            if ($type === 'block') $blocks[] = $msg;
            else $warnings[] = $msg;
        }
    }
    return ['warnings' => $warnings, 'blocks' => $blocks];
}

// Get IP and User Agent for logging
$ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';

// --- GET ---
if ($method === 'GET') {
    $id = $_GET['id'] ?? null;
    $projectId = $_GET['project_id'] ?? null;

    if ($id) {
        getTaskWithAccess($db, $id, $userId, $tenantId, $isAdmin); // access check
        $stmt = $db->prepare('
            SELECT t.*,
                   u.display_name AS user_display_name,
                   u.email AS user_email,
                   p.name AS project_name,
                   pt.title AS parent_title,
                   (SELECT COUNT(*) FROM tasks sc WHERE sc.parent_task_id = t.id AND sc.deleted_at IS NULL AND sc.is_subtask = 0 AND sc.status != \'cancelled\') AS subtask_count,
                   COALESCE((SELECT SUM(sc2.actual_hours) FROM tasks sc2 WHERE sc2.parent_task_id = t.id AND sc2.deleted_at IS NULL AND sc2.is_subtask = 0 AND sc2.status != \'cancelled\'), 0) AS subtask_actual_hours,
                   COALESCE((SELECT SUM(sc3.estimated_hours) FROM tasks sc3 WHERE sc3.parent_task_id = t.id AND sc3.deleted_at IS NULL AND sc3.is_subtask = 0 AND sc3.status != \'cancelled\'), 0) AS subtask_estimated_hours
            FROM tasks t
            LEFT JOIN users u  ON t.user_id       = u.id
            LEFT JOIN projects p ON t.project_id  = p.id
            LEFT JOIN tasks pt ON t.parent_task_id = pt.id
            WHERE t.id = ?
        ');
        $stmt->execute([$id]);
        jsonResponse($stmt->fetch());
    }

    if ($projectId) {
        if (!canAccessProject($db, $projectId, $userId, $tenantId, $isAdmin)) {
            jsonError('Forbidden', 403);
        }
        $stmt = $db->prepare('
            SELECT t.*,
                   p.name AS project_name,
                   pt.title AS parent_title,
                   COALESCE(sc.subtask_count, 0)            AS subtask_count,
                   COALESCE(sc.subtask_actual_hours, 0)     AS subtask_actual_hours,
                   COALESCE(sc.subtask_estimated_hours, 0)  AS subtask_estimated_hours
            FROM tasks t
            LEFT JOIN projects p ON t.project_id = p.id
            LEFT JOIN tasks pt ON t.parent_task_id = pt.id
            LEFT JOIN (
                SELECT parent_task_id,
                       COUNT(*) AS subtask_count,
                       SUM(actual_hours) AS subtask_actual_hours,
                       SUM(estimated_hours) AS subtask_estimated_hours
                FROM tasks
                WHERE deleted_at IS NULL AND is_subtask = 0 AND status != \'cancelled\'
                  AND parent_task_id IS NOT NULL
                GROUP BY parent_task_id
            ) sc ON sc.parent_task_id = t.id
            WHERE t.project_id = ? AND t.deleted_at IS NULL
            ORDER BY t.start_date ASC
        ');
        $stmt->execute([$projectId]);
        jsonResponse($stmt->fetchAll());
    }

    // ── Paginated all-tasks (used by งานของฉัน / งานทั้งหมด views) ──────────
    // Accepts: ?page= ?per_page= ?search= ?status= ?type= ?assignee= ?my=1
    $page    = max(1, intval($_GET['page']    ?? 1));
    $perPageRaw = intval($_GET['per_page'] ?? 50);
    $allMode    = $perPageRaw >= 99999;
    $perPage    = $allMode ? 500 : min(500, max(10, $perPageRaw)); // hard cap: 500 rows
    $offset     = ($page - 1) * $perPage;

    $search     = trim($_GET['search']      ?? '');
    $status     = trim($_GET['status']      ?? '');
    $type       = trim($_GET['type']        ?? '');
    $assignee   = trim($_GET['assignee']    ?? '');
    $myOnly     = (int)($_GET['my']         ?? 0) === 1;
    $parentOnly   = (int)($_GET['parent_only']   ?? 0) === 1;
    $subtaskOnly  = (int)($_GET['subtask_only']  ?? 0) === 1;
    $withSubtasks = (int)($_GET['with_subtasks'] ?? 0) === 1;
    $parentId     = trim($_GET['parent_id']     ?? '');  // on-demand subtask fetch
    $yearFrom    = trim($_GET['year_from']     ?? '');
    $yearTo      = trim($_GET['year_to']       ?? '');

    // ── On-demand: children of a specific parent task ────────────────────────
    if ($parentId !== '') {
        $childStmt = $db->prepare('
            SELECT t.*, p.name AS project_name, pt.title AS parent_title
            FROM tasks t
            LEFT JOIN projects p  ON t.project_id    = p.id
            LEFT JOIN tasks   pt  ON t.parent_task_id = pt.id
            WHERE t.parent_task_id = ?
              AND t.tenant_id = ?
              AND t.deleted_at IS NULL
            ORDER BY t.created_at ASC
        ');
        $childStmt->execute([$parentId, $tenantId]);
        jsonResponse($childStmt->fetchAll());
    }

    // ── Build WHERE conditions ───────────────────────────────────────────────
    $where  = ['t.deleted_at IS NULL', 't.tenant_id = ?'];
    $params = [$tenantId];

    // Task/subtask model: is_subtask=1 = hour-log subtask, is_subtask=0 = root/child task
    // - subtask_only : show only is_subtask=1 (hour log entries)
    // - with_subtasks : show is_subtask=0 rows (root tasks + structural child tasks)
    // - my=1 : show root tasks for current user
    // - default : show only root tasks (parent_task_id IS NULL)
    if ($subtaskOnly) {
        $where[] = 't.is_subtask = 1';
    } elseif ($withSubtasks) {
        $where[] = 't.is_subtask = 0';
    } elseif ($myOnly) {
        $where[] = 't.is_subtask = 0';
    } else {
        $where[] = 't.parent_task_id IS NULL';
    }

    if ($myOnly) {
        $meStmt = $db->prepare('SELECT display_name, email FROM users WHERE id = ?');
        $meStmt->execute([$userId]);
        $me = $meStmt->fetch();
        $myName  = $me['display_name'] ?? '';
        $myEmail = $me['email'] ?? '';
        $where[] = '(t.user_id = ? OR t.assignee = ? OR t.assignee = ?)';
        $params[] = $userId; $params[] = $myName; $params[] = $myEmail;
    } elseif (!$isAdmin) {
        $where[] = '(
            (t.project_id IS NOT NULL AND (
                p.user_id = ?
                OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = ?)
            ))
            OR (t.project_id IS NULL AND t.user_id = ?)
        )';
        $params[] = $userId; $params[] = $userId; $params[] = $userId;
    }

    if ($search !== '') {
        $where[] = '(t.title LIKE ? OR p.name LIKE ? OR t.assignee LIKE ?)';
        $like = "%$search%";
        $params[] = $like; $params[] = $like; $params[] = $like;
    }
    if ($status   !== '') { $where[] = 't.status = ?';    $params[] = $status; }
    if ($type     !== '') { $where[] = 't.task_type = ?'; $params[] = $type; }
    if ($assignee !== '') { $where[] = 't.assignee = ?';  $params[] = $assignee; }
    if ($yearFrom !== '') { $where[] = 't.end_date >= ?'; $params[] = $yearFrom; }
    if ($yearTo   !== '') { $where[] = 't.start_date <= ?'; $params[] = $yearTo; }

    $whereClause = 'WHERE ' . implode(' AND ', $where);

    // ── Slim SELECT ──────────────────────────────────────────────────────────
    $selectCols = 't.id, t.title, t.description, t.status, t.priority,
                   t.start_date, t.end_date, t.original_end_date,
                   t.assignee, t.assignee_user_id, t.task_type, t.is_ad_hoc, t.is_subtask,
                   t.parent_task_id, t.user_id, t.project_id,
                   t.estimated_hours, t.actual_hours, t.estimated_days,
                   t.progress_percentage, t.completed_date,
                   t.created_at, t.updated_at,
                   p.name AS project_name,
                   u.display_name AS user_display_name,
                   u.email AS user_email,
                   pt.title AS parent_title,
                   COALESCE(sc.subtask_count, 0)            AS subtask_count,
                   COALESCE(sc.subtask_actual_hours, 0)     AS subtask_actual_hours,
                   COALESCE(sc.subtask_estimated_hours, 0)  AS subtask_estimated_hours';

    $joinClause = 'FROM tasks t
                   LEFT JOIN projects p  ON t.project_id     = p.id
                   LEFT JOIN users u     ON t.user_id         = u.id
                   LEFT JOIN tasks pt    ON t.parent_task_id  = pt.id
                   LEFT JOIN (
                       SELECT parent_task_id,
                              COUNT(*) AS subtask_count,
                              SUM(actual_hours) AS subtask_actual_hours,
                              SUM(estimated_hours) AS subtask_estimated_hours
                       FROM tasks
                       WHERE deleted_at IS NULL AND is_subtask = 0 AND status != \'cancelled\'
                         AND parent_task_id IS NOT NULL
                       GROUP BY parent_task_id
                   ) sc ON sc.parent_task_id = t.id';

    // ── COUNT ────────────────────────────────────────────────────────────────
    $countStmt = $db->prepare("SELECT COUNT(*) $joinClause $whereClause");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    // ── Data ─────────────────────────────────────────────────────────────────
    if ($allMode) {
        $dataStmt = $db->prepare("SELECT $selectCols $joinClause $whereClause ORDER BY t.created_at DESC");
        $dataStmt->execute($params);
    } else {
        $dataStmt = $db->prepare("SELECT $selectCols $joinClause $whereClause ORDER BY t.created_at DESC LIMIT ? OFFSET ?");
        $dataStmt->execute(array_merge($params, [$perPage, $offset]));
    }
    $rows = $dataStmt->fetchAll();

    jsonResponse([
        'data'        => $rows,
        'total'       => $total,
        'page'        => $page,
        'per_page'    => $allMode ? $total : $perPage,
        'total_pages' => $allMode ? 1 : max(1, (int)ceil($total / $perPage)),
    ]);
}

// --- POST ---
if ($method === 'POST') {
    $body = getRequestBody();
    $projectId = $body['project_id'] ?? '';

    if (!canAccessProject($db, $projectId, $userId, $tenantId, $isAdmin)) {
        jsonError('Forbidden', 403);
    }

    // Validate estimated_days must be > 0
    $estimatedDays = intval($body['estimated_days'] ?? 1);
    if ($estimatedDays <= 0) {
        $estimatedDays = 1; // Default to 1 if invalid
    }

    // Determine if this is an ad-hoc task
    $isAdHoc = isset($body['is_ad_hoc']) ? (int)$body['is_ad_hoc'] : 0;

    // Enforce task_type from centralized catalog
    $taskTypeInput = normalizeTaskTypeInput((string)($body['task_type'] ?? 'task'));
    $allowedTaskTypes = getAllowedTaskTypes($db, false, $tenantId);
    if (!in_array($taskTypeInput, $allowedTaskTypes, true)) {
        jsonError('ประเภทงานไม่ถูกต้อง กรุณาเลือกจากรายการที่กำหนดในระบบ', 422);
    }

    // For ad-hoc tasks, ensure original_end_date is set from project's current end_date if not provided
    $originalEndDate = $body['original_end_date'] ?? null;
    if ($isAdHoc && !$originalEndDate) {
        $projStmt = $db->prepare('SELECT end_date FROM projects WHERE id = ?');
        $projStmt->execute([$projectId]);
        $project = $projStmt->fetch();
        if ($project) {
            $originalEndDate = $project['end_date'];
        }
    }

    // Run validation rules
    $validation = runValidationRules($db, $tenantId, $userId, $body);
    if (!empty($validation['blocks'])) {
        http_response_code(422);
        echo json_encode(['error' => implode(' | ', $validation['blocks']), 'blocks' => $validation['blocks']]);
        exit;
    }
    $validationWarnings = $validation['warnings'];

    // Duplicate guard: prevent identical tasks (same title+project+start+end+assignee)
    $startDate = $body['start_date'] ?? date('Y-m-d');
    $endDate   = $body['end_date']   ?? $startDate;

    $dupCheck = $db->prepare('
        SELECT id FROM tasks
        WHERE project_id = ? AND title = ? AND start_date = ? AND end_date = ? AND assignee = ? AND deleted_at IS NULL
        LIMIT 1
    ');
    $dupCheck->execute([
        $projectId,
        $body['title'] ?? '',
        $startDate,
        $endDate,
        $body['assignee'] ?? '',
    ]);
    if ($dupCheck->fetch()) {
        jsonError('งานนี้มีอยู่แล้วในโปรเจกต์ (ชื่อ, วันที่, ผู้รับผิดชอบซ้ำกัน)', 409);
    }

    // Calculate estimated_days and estimated_hours (working days only — skip weekends/holidays)
    // Rule: Use provided hours when given; fall back to working_days * 8 only if not provided.
    $assigneeUserId = $body['assignee_user_id'] ?? null;
    $estDays  = countWorkingDays($db, $tenantId, $startDate, $endDate, $assigneeUserId);
    $estHours = isset($body['estimated_hours']) && $body['estimated_hours'] !== ''
        ? floatval($body['estimated_hours'])
        : countWorkingHours($db, $tenantId, $startDate, $endDate, $assigneeUserId);
    $actualHours = floatval($body['actual_hours'] ?? 0);

    $maxTaskHours = getMaxTaskHours($db, $tenantId);
    // Business Rule: single-day tasks cannot exceed configured max hours
    if ($startDate === $endDate && $estHours > $maxTaskHours) {
        jsonError("Single-day task cannot exceed {$maxTaskHours} hours. Please split into subtasks.", 422);
    }

    $id = generateUUID();

    // Detect available columns to handle old schemas gracefully
    $colCheck = $db->query("SHOW COLUMNS FROM tasks LIKE 'task_type'")->fetch();
    $hasTaskType = $colCheck !== false;

    if ($hasTaskType) {
        $stmt = $db->prepare('
            INSERT INTO tasks (id, tenant_id, project_id, user_id, title, description, status, priority, assignee, assignee_user_id, start_date, end_date, estimated_days, estimated_hours, actual_hours, base_actual_hours, is_ad_hoc, original_end_date, days_spent, completed_date, task_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $id, $tenantId, $projectId, $userId,
            $body['title'] ?? '',
            $body['description'] ?? '',
            $body['status'] ?? 'pending',
            $body['priority'] ?? 'medium',
            $body['assignee'] ?? '',
            $body['assignee_user_id'] ?? null,
            $startDate, $endDate,
            $estDays, $estHours,
            $actualHours,
            $actualHours,
            $isAdHoc, $originalEndDate,
            0,
            $body['completed_date'] ?? null,
            $taskTypeInput,
        ]);
    } else {
        $stmt = $db->prepare('
            INSERT INTO tasks (id, tenant_id, project_id, user_id, title, description, status, priority, assignee, assignee_user_id, start_date, end_date, estimated_days, estimated_hours, actual_hours, base_actual_hours, is_ad_hoc, original_end_date, days_spent, completed_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $id, $tenantId, $projectId, $userId,
            $body['title'] ?? '',
            $body['description'] ?? '',
            $body['status'] ?? 'pending',
            $body['priority'] ?? 'medium',
            $body['assignee'] ?? '',
            $body['assignee_user_id'] ?? null,
            $startDate, $endDate,
            $estDays, $estHours,
            $actualHours,
            $actualHours,
            $isAdHoc, $originalEndDate,
            0,
            $body['completed_date'] ?? null,
        ]);
    }

    $stmt = $db->prepare('SELECT * FROM tasks WHERE id = ?');
    $stmt->execute([$id]);
    $newTask = $stmt->fetch();

    // Business Rule: If created ad-hoc task, extend project end_date
    if ($newTask && $newTask['is_ad_hoc']) {
        handleAdHocTaskChange($db, $newTask, []);
    }

    // Return updated task with new end_date
    $stmt = $db->prepare('SELECT * FROM tasks WHERE id = ?');
    $stmt->execute([$id]);
    $task = $stmt->fetch();
    
    // Log activity
    $taskTitle = $body['title'] ?? 'งาน';
    $logStmt = $db->prepare('INSERT INTO user_activity_logs (id, user_id, tenant_id, action, description, ip_address, user_agent, created_at) VALUES (UUID(), ?, ?, ?, ?, ?, ?, NOW())');
    $logStmt->execute([
        $userId,
        $tenantId,
        'create_task', 
        'สร้างงาน: ' . $taskTitle, 
        $ipAddress, 
        $userAgent
    ]);

    // Inbox notification: notify assignee when task is assigned to someone else
    $assignee = $body['assignee'] ?? '';
    $assigneeUserId = $body['assignee_user_id'] ?? null;
    if (($assignee || $assigneeUserId) && $assignee !== $userId) {
        $creatorStmt = $db->prepare('SELECT display_name, email FROM users WHERE id = ?');
        $creatorStmt->execute([$userId]);
        $creator = $creatorStmt->fetch();
        $projectStmt = $db->prepare('SELECT name FROM projects WHERE id = ?');
        $projectStmt->execute([$projectId]);
        $project = $projectStmt->fetch();
        // Resolve recipient user ID: use assignee_user_id if available, fall back to display_name lookup
        $recipientId = $assigneeUserId;
        if (!$recipientId) {
            $resStmt = $db->prepare('SELECT id FROM users WHERE display_name = ? OR email = ? LIMIT 1');
            $resStmt->execute([$assignee, $assignee]);
            $recipientId = $resStmt->fetchColumn();
        }
        if ($recipientId) {
            inboxNotify(
                $db, $tenantId, $recipientId,
                $creator['display_name'] ?? 'ระบบ', $creator['email'] ?? '',
                'มีงานใหม่: ' . $taskTitle,
                'ถูกมอบหมายงาน "' . $taskTitle . '"' . ($project ? ' ในโปรเจกต์ "' . $project['name'] . '"' : ''),
                'notification', 'medium', $id
            );
        }
    }

    try {
        fireAutomationRules($db, $tenantId, $userId, 'task_created', $id);
    } catch (Throwable $e) {
        error_log('[automation] task_created failed for task ' . $id . ': ' . $e->getMessage());
    }

    if (!empty($validationWarnings ?? [])) {
        $task['_warnings'] = $validationWarnings;
    }

    // แจ้งเตือน admin/manager ว่ามีการสร้าง task ใหม่
    try {
        $actorStmt = $db->prepare('SELECT display_name FROM users WHERE id = ?');
        $actorStmt->execute([$userId]);
        $actorName = $actorStmt->fetchColumn() ?: 'ผู้ใช้';
        notifyAdminsTaskActivity($db, $task, $actorName, 'created');
    } catch (Throwable $e) {
        error_log('[notify-task] created failed: ' . $e->getMessage());
    }

    http_response_code(201);
    jsonResponse($task, 201);
}

// --- PUT ---
if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id parameter');

    $currentTask = getTaskWithAccess($db, $id, $userId, $tenantId, $isAdmin); // verify access

    $body = getRequestBody();

    // Concurrent edit detection: if caller sends updated_at, compare with server value.
    // If they differ, someone else saved after the caller last loaded the task.
    if (!empty($body['_updated_at'])) {
        $serverTs = strtotime($currentTask['updated_at'] ?? '');
        $clientTs = strtotime($body['_updated_at']);
        if ($serverTs !== false && $clientTs !== false && $serverTs > $clientTs) {
            ob_end_clean();
            http_response_code(409);
            echo json_encode([
                'error'          => 'งานนี้ถูกแก้ไขโดยผู้ใช้อื่นหลังจากที่คุณเปิดดู กรุณาโหลดข้อมูลใหม่แล้วแก้ไขอีกครั้ง',
                'conflict'       => true,
                'server_updated' => $currentTask['updated_at'],
                'client_updated' => $body['_updated_at'],
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
        unset($body['_updated_at']); // don't try to write this pseudo-field
    }

    // Guard malformed subtask state: is_subtask=1 requires valid parent_task_id.
    $effectiveParentTaskId = array_key_exists('parent_task_id', $body)
        ? trim((string)($body['parent_task_id'] ?? ''))
        : trim((string)($currentTask['parent_task_id'] ?? ''));
    $effectiveIsSubtask = array_key_exists('is_subtask', $body)
        ? (int)$body['is_subtask']
        : (int)($currentTask['is_subtask'] ?? 0);

    if ($effectiveIsSubtask === 1 && $effectiveParentTaskId === '') {
        jsonError('ไม่สามารถตั้งค่า is_subtask=1 โดยไม่มี parent_task_id ได้ กรุณาระบุงานแม่ให้ชัดเจน', 422);
    }

    if (array_key_exists('parent_task_id', $body) && $effectiveParentTaskId !== '') {
        if ($effectiveParentTaskId === $id) {
            jsonError('ไม่สามารถตั้งงานตัวเองเป็นงานแม่ได้', 422);
        }
        $parentStmt = $db->prepare('SELECT id FROM tasks WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1');
        $parentStmt->execute([$effectiveParentTaskId, $tenantId]);
        if (!$parentStmt->fetchColumn()) {
            jsonError('parent_task_id ไม่ถูกต้อง หรืออ้างถึงงานที่ถูกลบแล้ว', 422);
        }
        $body['parent_task_id'] = $effectiveParentTaskId;
    }

    if (array_key_exists('task_type', $body)) {
        $taskTypeInput = normalizeTaskTypeInput((string)$body['task_type']);
        $allowedTaskTypes = getAllowedTaskTypes($db, false, $tenantId);
        if (!in_array($taskTypeInput, $allowedTaskTypes, true)) {
            jsonError('ประเภทงานไม่ถูกต้อง กรุณาเลือกจากรายการที่กำหนดในระบบ', 422);
        }
        $body['task_type'] = $taskTypeInput;
    }

    $fields = [];
    $values = [];

    // Run validation rules
    $taskId = $id;
    $validation = runValidationRules($db, $tenantId, $userId, $body, $taskId);
    if (!empty($validation['blocks'])) {
        http_response_code(422);
        echo json_encode(['error' => implode(' | ', $validation['blocks']), 'blocks' => $validation['blocks']]);
        exit;
    }
    $validationWarnings = $validation['warnings'];

    // Validate estimated_days if provided (must be > 0)
    if (isset($body['estimated_days'])) {
        $newEstimatedDays = intval($body['estimated_days']);
        if ($newEstimatedDays <= 0) {
            jsonError('estimated_days ต้องมีค่ามากกว่า 0');
        }
    }

    $allowed = [
        'title', 'description', 'status', 'priority', 'assignee', 'assignee_user_id',
        'start_date', 'end_date', 'original_end_date',
        'estimated_days', 'estimated_hours', 'actual_hours',
        'progress_percentage', 'is_ad_hoc', 'completed_date',
        'paused_at', 'paused_by', 'pause_reason', 'delay_reason', 'auto_shifted',
        'parent_task_id', 'is_subtask', 'project_id',
    ];
    // admin-only fields
    if ($isAdmin) {
        $allowed[] = 'user_id';
    }
    
    // Check if task_type column exists
    try {
        $db->query('SELECT task_type FROM tasks LIMIT 1');
        $allowed[] = 'task_type';
    } catch (PDOException $e) {
        // Column doesn't exist yet
    }
    foreach ($allowed as $field) {
        if (array_key_exists($field, $body)) {
            $fields[] = "`$field` = ?";
            $values[] = $body[$field];
        }
    }

    if (array_key_exists('actual_hours', $body)) {
        $fields[] = '`base_actual_hours` = ?';
        $values[] = floatval($body['actual_hours']);
    }

    if (empty($fields)) jsonError('No fields to update');

    // Effort Recalculation:
    // - Leaf tasks (no subtasks): estimated_hours from date range (days * 8) or user input
    // - Parent tasks (has subtasks): estimated_hours + actual_hours = SUM from children via recalcTaskHoursFromChildren
    // - Cancelled subtasks (status='cancelled') excluded from sums
    $parentTaskId = $currentTask['parent_task_id'] ?? null;
    $hasEstimatedHoursInput = array_key_exists('estimated_hours', $body);

    // Check if this task has subtasks (is a parent)
    $childStmt = $db->prepare('SELECT COUNT(*) FROM tasks WHERE parent_task_id = ? AND deleted_at IS NULL AND is_subtask = 0');
    $childStmt->execute([$id]);
    $hasSubtasks = (int)$childStmt->fetchColumn() > 0;

    $upStart = $body['start_date'] ?? $currentTask['start_date'];
    $upEnd   = $body['end_date']   ?? $currentTask['end_date'];

    if (!$hasSubtasks) {
        // Leaf task: apply effort formula
        if ($upStart === $upEnd) {
            $newEstDays  = 1;
            $newEstHours = $hasEstimatedHoursInput
                ? floatval($body['estimated_hours'])
                : floatval($currentTask['estimated_hours'] ?? 8);

            if (!array_key_exists('estimated_days', $body)) {
                $fields[] = "`estimated_days` = ?";
                $values[] = $newEstDays;
            }
            if (!array_key_exists('estimated_hours', $body)) {
                $fields[] = "`estimated_hours` = ?";
                $values[] = $newEstHours;
            }
        } else {
            // Multiple days: use working days (skip weekends + holidays)
            $assigneeUserId = $body['assignee_user_id'] ?? $currentTask['assignee_user_id'] ?? null;
            $newEstDays  = countWorkingDays($db, $tenantId, $upStart, $upEnd, $assigneeUserId);
            $newEstHours = $hasEstimatedHoursInput
                ? floatval($body['estimated_hours'])
                : countWorkingHours($db, $tenantId, $upStart, $upEnd, $assigneeUserId);

            $foundDays = false; $foundHours = false;
            foreach ($fields as $idx => $f) {
                if ($f === '`estimated_days` = ?') { $values[$idx] = $newEstDays; $foundDays = true; }
                if ($f === '`estimated_hours` = ?') { $values[$idx] = $newEstHours; $foundHours = true; }
            }
            if (!$foundDays) { $fields[] = '`estimated_days` = ?'; $values[] = $newEstDays; }
            if (!$foundHours) { $fields[] = '`estimated_hours` = ?'; $values[] = $newEstHours; }
        }
    } else {
        // Parent task: do NOT override estimated_hours here.
        // recalcTaskHoursFromChildren() will set estimated_hours from subtask sum after save.
        // Only update estimated_days from date range (working days only).
        if (!array_key_exists('estimated_days', $body)) {
            $fields[] = '`estimated_days` = ?';
            $values[] = countWorkingDays($db, $tenantId, $upStart, $upEnd, $body['assignee_user_id'] ?? $currentTask['assignee_user_id'] ?? null);
        }
    }

    $maxTaskHours = getMaxTaskHours($db, $tenantId);
    // Business Rule: single-day tasks cannot exceed configured max hours
    $finalEstHours = $hasEstimatedHoursInput
        ? floatval($body['estimated_hours'])
        : floatval($currentTask['estimated_hours'] ?? 8);
    foreach ($fields as $fi => $fv) {
        if ($fv === '`estimated_hours` = ?') { $finalEstHours = floatval($values[$fi]); break; }
    }
    if ($upStart === $upEnd && $finalEstHours > $maxTaskHours) {
        jsonError("Single-day task cannot exceed {$maxTaskHours} hours. Please split into subtasks.", 422);
    }

    $values[] = $id;
    $sql = 'UPDATE tasks SET ' . implode(', ', $fields) . ' WHERE id = ?';
    try {
        $db->prepare($sql)->execute($values);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            jsonError('มีงานที่มีชื่อ วันที่ และผู้รับผิดชอบเดียวกันในโครงการนี้อยู่แล้ว กรุณาเปลี่ยนชื่องานหรือวันที่', 409);
        }
        throw $e;
    }

    // When parent task is marked completed, cascade to all subtasks
    if (isset($body['status']) && $body['status'] === 'completed' && ($currentTask['status'] ?? '') !== 'completed') {
        $db->prepare('UPDATE tasks SET status = ?, completed_date = NOW(), updated_at = NOW() WHERE parent_task_id = ? AND deleted_at IS NULL AND status != ?')
           ->execute(['completed', $id, 'completed']);
    }

    // When parent task is marked cancelled, cascade to all subtasks
    if (isset($body['status']) && $body['status'] === 'cancelled' && ($currentTask['status'] ?? '') !== 'cancelled') {
        $db->prepare('UPDATE tasks SET status = ?, updated_at = NOW() WHERE parent_task_id = ? AND deleted_at IS NULL AND status NOT IN (?, ?)')
           ->execute(['cancelled', $id, 'completed', 'cancelled']);
    }

    // Recalculate parent hours and progress when subtask hours/dates change.
    // Wrapped in a transaction so concurrent PUT requests on the same task tree
    // don't produce partial / interleaved rollup results (race condition guard).
    $newParentTaskId = $body['parent_task_id'] ?? null;
    $parentChanged = $newParentTaskId && $newParentTaskId !== $parentTaskId;

    $db->beginTransaction();
    try {
        if ($hasSubtasks) {
            recalcTaskHoursFromChildren($db, $id);
            recalcTaskProgress($db, $id);
            if ($parentTaskId && $parentChanged) {
                recalcTaskHoursFromChildren($db, $parentTaskId);
                recalcTaskProgress($db, $parentTaskId);
            }
        } else {
            if ($parentTaskId) {
                recalcTaskHoursFromChildren($db, $parentTaskId);
                recalcTaskProgress($db, $parentTaskId);
            }
            if ($parentChanged) {
                recalcTaskHoursFromChildren($db, $newParentTaskId);
                recalcTaskProgress($db, $newParentTaskId);
            }
        }
        $db->commit();
    } catch (Throwable $rollupErr) {
        $db->rollBack();
        throw $rollupErr;
    }

    // Fire automation rules (errors are non-fatal — task save already succeeded)
    try {
        if (isset($body['status']) && $body['status'] !== ($currentTask['status'] ?? '')) {
            fireAutomationRules($db, $tenantId, $userId, 'status_changed', $id);
        }
        fireAutomationRules($db, $tenantId, $userId, 'task_updated', $id);
    } catch (Throwable $e) {
        error_log('[automation] task_updated failed for task ' . $id . ': ' . $e->getMessage());
    }

    // Get the task to check if it's ad-hoc and get project info
    $taskStmt = $db->prepare('SELECT * FROM tasks WHERE id = ?');
    $taskStmt->execute([$id]);
    $updatedTask = $taskStmt->fetch();

    // Business Rule: Handle ad-hoc task changes
    if ($updatedTask && $updatedTask['is_ad_hoc']) {
        handleAdHocTaskChange($db, $updatedTask, $body);
    }

    // Inbox notification: notify new assignee when reassigned to someone else
    $newAssignee = $body['assignee'] ?? '';
    $newAssigneeUserId = $body['assignee_user_id'] ?? null;
    if (($newAssignee || $newAssigneeUserId) && $newAssignee !== $userId && $newAssignee !== ($currentTask['assignee'] ?? '')) {
        $creatorStmt = $db->prepare('SELECT display_name, email FROM users WHERE id = ?');
        $creatorStmt->execute([$userId]);
        $creator = $creatorStmt->fetch();
        // Resolve recipient user ID
        $recipientId = $newAssigneeUserId;
        if (!$recipientId) {
            $resStmt = $db->prepare('SELECT id FROM users WHERE display_name = ? OR email = ? LIMIT 1');
            $resStmt->execute([$newAssignee, $newAssignee]);
            $recipientId = $resStmt->fetchColumn();
        }
        if ($recipientId) {
            inboxNotify(
                $db, $tenantId, $recipientId,
                $creator['display_name'] ?? 'ระบบ', $creator['email'] ?? '',
                'ถูกมอบหมายงาน: ' . ($updatedTask['title'] ?? ''),
                'คุณได้รับมอบหมายงาน "' . ($updatedTask['title'] ?? '') . '"',
                'notification', 'medium', $id
            );
        }
    }

    $stmt = $db->prepare('SELECT * FROM tasks WHERE id = ?');
    $stmt->execute([$id]);
    $updatedRow = $stmt->fetch();

    if (!empty($validationWarnings ?? [])) {
        $updatedRow['_warnings'] = $validationWarnings;
    }

    // แจ้งเตือน admin/manager เมื่อมีการอัปเดต task
    try {
        $actorStmt = $db->prepare('SELECT display_name FROM users WHERE id = ?');
        $actorStmt->execute([$userId]);
        $actorName  = $actorStmt->fetchColumn() ?: 'ผู้ใช้';
        $actionType = isset($body['status']) && $body['status'] === 'completed' ? 'completed' : 'updated';
        notifyAdminsTaskActivity($db, $updatedRow, $actorName, $actionType);
    } catch (Throwable $e) {
        error_log('[notify-task] updated failed: ' . $e->getMessage());
    }

    jsonResponse($updatedRow);
}

// --- DELETE ---
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id parameter');

    $task = getTaskWithAccess($db, $id, $userId, $tenantId, $isAdmin); // verify access
    $isAdHoc = (bool)$task['is_ad_hoc'];
    $projectId = $task['project_id'];

    // Soft-delete the task and all its descendants (any depth) to preserve audit trail.
    // Consistent with task-hours.php and subtasks.php which also use soft-delete.
    softDeleteTaskTree($db, $id);

    // Recalculate parent hours and progress if deleted task had a parent
    if ($task['parent_task_id']) {
        recalcTaskHoursFromChildren($db, $task['parent_task_id']);
        recalcTaskProgress($db, $task['parent_task_id']);
    }

    // Business Rule: If deleted ad-hoc task, recalculate project end_date
    if ($isAdHoc) {
        recalculateProjectEndDateForAdHoc($db, $projectId);
    }

    jsonResponse(['deleted' => true]);
}

/**
 * Recursively soft-delete a task and ALL its descendants (WBS subtasks + hour entries).
 * Consistent with task-hours.php and subtasks.php soft-delete strategy.
 */
function softDeleteTaskTree(PDO $db, string $taskId): void {
    $db->prepare('UPDATE tasks SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL')
       ->execute([$taskId]);
    $stmt = $db->prepare('SELECT id FROM tasks WHERE parent_task_id = ? AND deleted_at IS NULL');
    $stmt->execute([$taskId]);
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $childId) {
        softDeleteTaskTree($db, $childId);
    }
}

/**
 * Handle ad-hoc task changes - extend project end_date when ad-hoc task is created/updated.
 * Uses SUM of ALL ad-hoc tasks (including current) since the task is already saved at call time.
 */
function handleAdHocTaskChange(PDO $db, array $task, array $body): void {
    $projectId = $task['project_id'];

    // Get current project info
    $projStmt = $db->prepare('SELECT * FROM projects WHERE id = ?');
    $projStmt->execute([$projectId]);
    $project = $projStmt->fetch();

    if (!$project) return;

    $originalEndDate = $project['original_end_date'];

    // Ensure original_end_date is set the first time an ad-hoc task is added
    if (!$originalEndDate) {
        $originalEndDate = $project['end_date'];
        $db->prepare('UPDATE projects SET original_end_date = ? WHERE id = ? AND original_end_date IS NULL')
           ->execute([$originalEndDate, $projectId]);
    }

    // Sum ALL ad-hoc tasks (task is already persisted, so include it)
    $adhocStmt = $db->prepare('
        SELECT COALESCE(SUM(estimated_days), 0) as total_adhoc_days
        FROM tasks
        WHERE project_id = ? AND is_ad_hoc = 1
    ');
    $adhocStmt->execute([$projectId]);
    $totalAdhocDays = intval($adhocStmt->fetchColumn());

    // Cap total ad-hoc extension at 90 days to prevent runaway deadline drift
    $totalAdhocDays = min($totalAdhocDays, 90);

    $newEndDate = date('Y-m-d', strtotime($originalEndDate . ' +' . $totalAdhocDays . ' days'));

    $db->prepare('UPDATE projects SET end_date = ? WHERE id = ?')
       ->execute([$newEndDate, $projectId]);
}

/**
 * Recalculate project end_date after an ad-hoc task is deleted.
 * Always bases calculation on original_end_date to avoid compounding drift.
 */
function recalculateProjectEndDateForAdHoc(PDO $db, string $projectId): void {
    $projStmt = $db->prepare('SELECT * FROM projects WHERE id = ?');
    $projStmt->execute([$projectId]);
    $project = $projStmt->fetch();

    if (!$project) return;

    // Must have original_end_date as base; if missing, nothing to recalculate
    $originalEndDate = $project['original_end_date'];
    if (!$originalEndDate) return;

    $adhocStmt = $db->prepare('
        SELECT COALESCE(SUM(estimated_days), 0) as total_adhoc_days
        FROM tasks
        WHERE project_id = ? AND is_ad_hoc = 1
    ');
    $adhocStmt->execute([$projectId]);
    $totalAdhocDays = min(intval($adhocStmt->fetchColumn()), 90);

    $newEndDate = date('Y-m-d', strtotime($originalEndDate . ' +' . $totalAdhocDays . ' days'));

    $db->prepare('UPDATE projects SET end_date = ? WHERE id = ?')
       ->execute([$newEndDate, $projectId]);
}

/**
 * Recalculate a parent task's progress from WBS subtasks (is_subtask=0).
 * Walks up the tree recursively so ancestor progress stays correct.
 */
function recalcTaskProgress(PDO $db, string $taskId): void {
    // Hours-weighted progress: SUM(estimated_hours of completed) / SUM(estimated_hours of all)
    // Falls back to count-based when no estimated_hours are set.
    $stmt = $db->prepare('
        SELECT
            COUNT(*)                                                      AS total,
            COALESCE(SUM(estimated_hours), 0)                            AS total_hours,
            SUM(CASE WHEN status = "completed" THEN 1       ELSE 0 END)  AS completed_count,
            SUM(CASE WHEN status = "completed" THEN COALESCE(estimated_hours, 0) ELSE 0 END) AS completed_hours
        FROM tasks
        WHERE parent_task_id = ? AND deleted_at IS NULL AND is_subtask = 0
          AND status != "cancelled"
    ');
    $stmt->execute([$taskId]);
    $result = $stmt->fetch();

    $progress = 0;
    $total = (int)($result['total'] ?? 0);
    if ($total > 0) {
        $totalHours     = (float)($result['total_hours']     ?? 0);
        $completedHours = (float)($result['completed_hours'] ?? 0);
        if ($totalHours > 0) {
            // Hours-weighted (preferred): reflects actual workload correctly
            $progress = (int)round(($completedHours / $totalHours) * 100);
        } else {
            // Fallback: count-based when no estimated_hours set
            $progress = (int)round(((int)$result['completed_count'] / $total) * 100);
        }
    }

    $stmt = $db->prepare('UPDATE tasks SET progress_percentage = ?, updated_at = NOW() WHERE id = ?');
    $stmt->execute([$progress, $taskId]);

    // Walk up to grandparent
    $stmt = $db->prepare('SELECT parent_task_id FROM tasks WHERE id = ?');
    $stmt->execute([$taskId]);
    $grandParentId = $stmt->fetchColumn();
    if ($grandParentId) {
        recalcTaskProgress($db, $grandParentId);
    }
}

/**
 * Recalculate a parent task's estimated_hours and actual_hours from its children.
 * Delegates to the unified helper in task-hours-rollup.php.
 *
 * - estimated_hours = SUM(children.estimated_hours) rounded to 2dp
 * - actual_hours   = SUM(children.actual_hours) rounded to 2dp
 * - Fallback: leaf tasks use days*8 (est) and base_actual_hours (act)
 * - Filters: deleted_at IS NULL, is_subtask=0, status != \'cancelled\'
 * - Walks up the tree recursively so ancestor hours stay correct.
 */
function recalcTaskHoursFromChildren(PDO $db, string $taskId): void {
    recalcTaskHoursFromChildrenUnified($db, $taskId);
}

jsonError('Method not allowed', 405);
