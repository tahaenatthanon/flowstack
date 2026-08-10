<?php
// CRUD /api/recurring-tasks.php
// Recurring Tasks API - manages recurring/repeating tasks
// 
// Endpoints:
// GET    - list recurring tasks (?project_id= filter)
// POST   - create recurring task template
// PUT    - update recurring task (?id= required)
// DELETE - delete recurring task (?id= required)
// POST   - manually trigger creation of next instance
// GET    - get instances of a recurring task

require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db = getDB();
$method = getMethod();

// Check if user is admin (tenant-scoped)
$isAdmin = isTenantAdmin($db, $userId, $tenantId);

// --- GET: List Recurring Tasks ---
if ($method === 'GET') {
    $id = $_GET['id'] ?? null;
    $projectId = $_GET['project_id'] ?? null;
    $isActive = $_GET['is_active'] ?? null;
    $taskId = $_GET['task_id'] ?? null; // Get recurring template for a specific task
    
    // Get single recurring task
    if ($id) {
        $stmt = $db->prepare('SELECT * FROM recurring_tasks WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL');
        $stmt->execute([$id, $tenantId]);
        $recurring = $stmt->fetch();
        if (!$recurring) jsonError('Recurring task not found', 404);
        
        // Verify access
        if (!canAccessProject($db, $recurring['project_id'], $userId, $tenantId, $isAdmin)) {
            jsonError('Forbidden', 403);
        }
        
        // Get instance count
        $stmt = $db->prepare('SELECT COUNT(*) FROM tasks WHERE recurring_task_id = ? AND deleted_at IS NULL');
        $stmt->execute([$id]);
        $recurring['instance_count'] = $stmt->fetchColumn();
        
        // Get last instance
        $stmt = $db->prepare('
            SELECT * FROM tasks 
            WHERE recurring_task_id = ? AND deleted_at IS NULL 
            ORDER BY created_at DESC LIMIT 1
        ');
        $stmt->execute([$id]);
        $recurring['last_instance'] = $stmt->fetch();
        
        // Get next occurrence
        $recurring['next_occurrence'] = calculateNextOccurrence($recurring);
        
        jsonResponse($recurring);
    }
    
    // Get recurring template for a task (look up by source_task_id)
    if ($taskId) {
        $stmt = $db->prepare('SELECT * FROM recurring_tasks WHERE source_task_id = ? AND deleted_at IS NULL');
        $stmt->execute([$taskId]);
        $row = $stmt->fetch();
        jsonResponse($row ?: null);
    }
    
    // List all recurring tasks
    $query = 'SELECT * FROM recurring_tasks WHERE tenant_id = ? AND deleted_at IS NULL';
    $params = [$tenantId];
    
    if ($projectId) {
        if (!canAccessProject($db, $projectId, $userId, $tenantId, $isAdmin)) {
            jsonError('Forbidden', 403);
        }
        $query .= ' AND project_id = ?';
        $params[] = $projectId;
    }
    
    if ($isActive !== null) {
        $query .= ' AND is_active = ?';
        $params[] = $isActive;
    }
    
    $query .= ' ORDER BY next_occurrence ASC, created_at DESC';
    
    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $recurringTasks = $stmt->fetchAll();
    
    // Add next occurrence for each
    foreach ($recurringTasks as &$rt) {
        $rt['next_occurrence'] = calculateNextOccurrence($rt);
        
        $stmt = $db->prepare('SELECT COUNT(*) FROM tasks WHERE recurring_task_id = ? AND deleted_at IS NULL');
        $stmt->execute([$rt['id']]);
        $rt['instance_count'] = $stmt->fetchColumn();
    }
    
    jsonResponse($recurringTasks);
}

// --- POST: Create Recurring Task ---
if ($method === 'POST') {
    $body = getRequestBody();
    
    $projectId = $body['project_id'] ?? '';
    if (!canAccessProject($db, $projectId, $userId, $tenantId, $isAdmin)) {
        jsonError('Forbidden', 403);
    }
    
    $id = generateUUID();
    $title = $body['title'] ?? 'Recurring Task';
    $description = $body['description'] ?? '';
    $frequency = $body['frequency'] ?? 'weekly'; // daily, weekly, biweekly, monthly, quarterly, yearly
    $interval = intval($body['interval'] ?? 1); // Every X days/weeks/etc
    $dayOfWeek = $body['day_of_week'] ?? null; // 0-6 for weekly
    $dayOfMonth = $body['day_of_month'] ?? null; // 1-31 for monthly
    $startDate = $body['start_date'] ?? date('Y-m-d');
    $endDate = $body['end_date'] ?? null;
    $dueDateOffset = intval($body['due_date_offset'] ?? 0); // Days after start to set due date
    $assignee = $body['assignee'] ?? '';
    $priority = $body['priority'] ?? 'medium';
    $status = $body['status'] ?? 'pending';
    $estimatedDays = intval($body['estimated_days'] ?? 1);
    $taskType = $body['task_type'] ?? 'task';
    $copyChecklist = isset($body['copy_checklist']) ? (int)$body['copy_checklist'] : 1;
    $copyAttachments = isset($body['copy_attachments']) ? (int)$body['copy_attachments'] : 0;
    $copyCustomFields = isset($body['copy_custom_fields']) ? (int)$body['copy_custom_fields'] : 1;
    
    // Validate frequency
    $validFrequencies = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];
    if (!in_array($frequency, $validFrequencies)) {
        jsonError('Invalid frequency', 400);
    }
    
    // Calculate next occurrence
    $nextOccurrence = calculateNextDate($startDate, $frequency, $interval, $dayOfWeek, $dayOfMonth);
    
    $stmt = $db->prepare('
        INSERT INTO recurring_tasks (
            id, tenant_id, project_id, user_id, title, description, frequency, interval_value,
            day_of_week, day_of_month, start_date, end_date, due_date_offset,
            assignee, priority, status, estimated_days, task_type,
            copy_checklist, copy_attachments, copy_custom_fields,
            next_occurrence, is_active, created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW()
        )
    ');
    
    $stmt->execute([
        $id, $tenantId, $projectId, $userId, $title, $description, $frequency, $interval,
        $dayOfWeek, $dayOfMonth, $startDate, $endDate, $dueDateOffset,
        $assignee, $priority, $status, $estimatedDays, $taskType,
        $copyChecklist, $copyAttachments, $copyCustomFields,
        $nextOccurrence
    ]);
    
    // Optionally create first instance immediately
    if (isset($body['create_first_instance']) && $body['create_first_instance']) {
        createTaskInstance($db, $id, $startDate, $dueDateOffset, $userId, $assignee, $priority, $estimatedDays, $taskType, $title, $description);
    }
    
    // Return created recurring task
    $stmt = $db->prepare('SELECT * FROM recurring_tasks WHERE id = ?');
    $stmt->execute([$id]);
    $recurring = $stmt->fetch();
    $recurring['next_occurrence'] = calculateNextOccurrence($recurring);
    
    jsonResponse($recurring, 201);
}

// --- PUT: Update Recurring Task ---
if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Recurring Task ID required', 400);
    
    $body = getRequestBody();
    
    $stmt = $db->prepare('SELECT * FROM recurring_tasks WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL');
    $stmt->execute([$id, $tenantId]);
    $recurring = $stmt->fetch();
    if (!$recurring) jsonError('Recurring task not found', 404);
    
    if (!canAccessProject($db, $recurring['project_id'], $userId, $tenantId, $isAdmin)) {
        jsonError('Forbidden', 403);
    }
    
    $updates = [];
    $params = [];
    
    $allowedFields = [
        'title', 'description', 'frequency', 'interval_value', 'day_of_week',
        'day_of_month', 'start_date', 'end_date', 'due_date_offset',
        'assignee', 'priority', 'status', 'estimated_days', 'task_type',
        'copy_checklist', 'copy_attachments', 'copy_custom_fields', 'is_active'
    ];
    
    foreach ($allowedFields as $f) {
        if (isset($body[$f])) {
            $updates[] = "$f = ?";
            $params[] = $body[$f];
        }
    }
    
    // Recalculate next occurrence if frequency-related fields changed
    if (isset($body['frequency']) || isset($body['interval_value']) || isset($body['day_of_week']) || isset($body['day_of_month'])) {
        $frequency = $body['frequency'] ?? $recurring['frequency'];
        $interval = $body['interval_value'] ?? $recurring['interval_value'];
        $dayOfWeek = $body['day_of_week'] ?? $recurring['day_of_week'];
        $dayOfMonth = $body['day_of_month'] ?? $recurring['day_of_month'];
        $startDate = $body['start_date'] ?? $recurring['start_date'];
        
        $nextOccurrence = calculateNextDate($startDate, $frequency, $interval, $dayOfWeek, $dayOfMonth);
        $updates[] = 'next_occurrence = ?';
        $params[] = $nextOccurrence;
    }
    
    if (count($updates) > 0) {
        $updates[] = 'updated_at = NOW()';
        $params[] = $id;
        
        $stmt = $db->prepare('UPDATE recurring_tasks SET ' . implode(', ', $updates) . ' WHERE id = ?');
        $stmt->execute($params);
    }
    
    $stmt = $db->prepare('SELECT * FROM recurring_tasks WHERE id = ?');
    $stmt->execute([$id]);
    $recurring = $stmt->fetch();
    $recurring['next_occurrence'] = calculateNextOccurrence($recurring);
    
    jsonResponse($recurring);
}

// --- DELETE: Delete Recurring Task ---
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Recurring Task ID required', 400);
    
    $stmt = $db->prepare('SELECT * FROM recurring_tasks WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL');
    $stmt->execute([$id, $tenantId]);
    $recurring = $stmt->fetch();
    if (!$recurring) jsonError('Recurring task not found', 404);
    
    if (!canAccessProject($db, $recurring['project_id'], $userId, $tenantId, $isAdmin)) {
        jsonError('Forbidden', 403);
    }
    
    // Soft delete
    $stmt = $db->prepare('UPDATE recurring_tasks SET deleted_at = NOW() WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$id, $tenantId]);
    
    jsonResponse(['success' => true, 'message' => 'Recurring task deleted']);
}

// --- POST: Manually Trigger Next Instance ---
if ($method === 'POST' && isset($_GET['trigger'])) {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Recurring Task ID required', 400);
    
    $stmt = $db->prepare('SELECT * FROM recurring_tasks WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL');
    $stmt->execute([$id, $tenantId]);
    $recurring = $stmt->fetch();
    if (!$recurring) jsonError('Recurring task not found', 404);
    
    if (!canAccessProject($db, $recurring['project_id'], $userId, $tenantId, $isAdmin)) {
        jsonError('Forbidden', 403);
    }
    
    // Create new instance
    $instance = createTaskInstance(
        $db, 
        $id, 
        $recurring['next_occurrence'], 
        $recurring['due_date_offset'],
        $userId,
        $recurring['assignee'],
        $recurring['priority'],
        $recurring['estimated_days'],
        $recurring['task_type'],
        $recurring['title'],
        $recurring['description']
    );
    
    // Calculate and update next occurrence
    $nextOccurrence = calculateNextDate(
        $recurring['next_occurrence'], 
        $recurring['frequency'], 
        $recurring['interval_value'],
        $recurring['day_of_week'],
        $recurring['day_of_month']
    );
    
    // Check if we should continue
    $shouldContinue = true;
    if ($recurring['end_date'] && $nextOccurrence > $recurring['end_date']) {
        $shouldContinue = false;
    }
    
    $stmt = $db->prepare('UPDATE recurring_tasks SET next_occurrence = ?, is_active = ?, updated_at = NOW() WHERE id = ?');
    $stmt->execute([$nextOccurrence, $shouldContinue ? 1 : 0, $id]);
    
    jsonResponse([
        'success' => true,
        'instance' => $instance,
        'next_occurrence' => $nextOccurrence
    ]);
}

// --- GET: Get Instances ---
if ($method === 'GET' && isset($_GET['instances'])) {
    $recurringId = $_GET['recurring_id'] ?? null;
    if (!$recurringId) jsonError('Recurring ID required', 400);
    
    $stmt = $db->prepare('
        SELECT * FROM tasks 
        WHERE recurring_task_id = ? AND deleted_at IS NULL
        ORDER BY start_date DESC
    ');
    $stmt->execute([$recurringId]);
    jsonResponse($stmt->fetchAll());
}

// --- POST: Process Due Recurring Tasks (Cron Job Endpoint) ---
if ($method === 'POST' && isset($_GET['process_due'])) {
    // Record cron start
    $cronRunId = null;
    try {
        $db->prepare("INSERT INTO cron_runs (job_name, started_at) VALUES ('recurring-tasks', NOW())")->execute();
        $cronRunId = $db->lastInsertId();
    } catch (Throwable $e) {}

    // Fetch IDs only first (no lock yet — just a cheap scan)
    $idStmt = $db->prepare('
        SELECT id FROM recurring_tasks
        WHERE is_active = 1
          AND deleted_at IS NULL
          AND (end_date IS NULL OR end_date >= CURDATE())
          AND next_occurrence <= CURDATE()
    ');
    $idStmt->execute();
    $dueIds = $idStmt->fetchAll(PDO::FETCH_COLUMN);

    $created = [];
    foreach ($dueIds as $rtId) {
        // Lock the row before processing so a second concurrent cron run skips it
        $db->beginTransaction();
        try {
            $lockStmt = $db->prepare('
                SELECT * FROM recurring_tasks
                WHERE id = ? AND is_active = 1 AND deleted_at IS NULL
                  AND next_occurrence <= CURDATE()
                FOR UPDATE
            ');
            $lockStmt->execute([$rtId]);
            $rt = $lockStmt->fetch();

            if (!$rt) {
                // Another process already handled this row; skip
                $db->rollBack();
                continue;
            }

            $instance = createTaskInstance(
                $db,
                $rt['id'],
                $rt['next_occurrence'],
                $rt['due_date_offset'],
                $rt['user_id'],
                $rt['assignee'],
                $rt['priority'],
                $rt['estimated_days'],
                $rt['task_type'],
                $rt['title'],
                $rt['description']
            );

            $nextOccurrence = calculateNextDate(
                $rt['next_occurrence'],
                $rt['frequency'],
                $rt['interval_value'],
                $rt['day_of_week'],
                $rt['day_of_month']
            );

            $shouldContinue = !($rt['end_date'] && $nextOccurrence > $rt['end_date']);

            $db->prepare('UPDATE recurring_tasks SET next_occurrence = ?, is_active = ?, updated_at = NOW() WHERE id = ?')
               ->execute([$nextOccurrence, $shouldContinue ? 1 : 0, $rt['id']]);

            $db->commit();
            $created[] = $instance;
        } catch (\Throwable $e) {
            $db->rollBack();
            error_log('[recurring-tasks] process_due error for id=' . $rtId . ': ' . $e->getMessage());
        }
    }

    $errorCount = count(array_filter($created, fn($i) => isset($i['error'])));
    if ($cronRunId) {
        try {
            $db->prepare("UPDATE cron_runs SET finished_at = NOW(), records_processed = ?, errors = ? WHERE id = ?")
               ->execute([count($created), $errorCount, $cronRunId]);
        } catch (Throwable $e) {}
    }

    jsonResponse([
        'success'   => true,
        'processed' => count($created),
        'instances' => $created,
    ]);
}

// Helper: Calculate next occurrence date
function calculateNextDate(string $startDate, string $frequency, int $interval, ?int $dayOfWeek, ?int $dayOfMonth): string {
    $current = strtotime($startDate);
    if ($current === false || $current <= 0) {
        error_log("[recurring-tasks] calculateNextDate: invalid startDate '$startDate' — defaulting to tomorrow");
        return date('Y-m-d', strtotime('+1 day'));
    }
    $now = time();
    $limit = 5000; // safety: never loop more than 5000 times (covers ~13 years of daily tasks)
    $iterations = 0;

    // Move to next occurrence until it's in the future
    while ($current <= $now) {
        if (++$iterations > $limit) {
            error_log("[recurring-tasks] calculateNextDate: loop limit reached for startDate='$startDate' freq='$frequency' — returning tomorrow");
            return date('Y-m-d', strtotime('+1 day'));
        }
        $next = false;
        switch ($frequency) {
            case 'daily':
                $next = strtotime("+{$interval} days", $current);
                break;
            case 'weekly':
                $next = strtotime("+{$interval} weeks", $current);
                if ($next !== false && $dayOfWeek !== null) {
                    $weekStart = strtotime(date('Y-W-1', $next));
                    $next = $weekStart !== false ? strtotime("+{$dayOfWeek} days", $weekStart) : $next;
                }
                break;
            case 'biweekly':
                $next = strtotime("+2 weeks", $current);
                break;
            case 'monthly':
                $next = strtotime("+{$interval} months", $current);
                if ($next !== false && $dayOfMonth) {
                    $next = mktime(0, 0, 0, (int)date('m', $next), min($dayOfMonth, (int)date('t', $next)), (int)date('Y', $next));
                }
                break;
            case 'quarterly':
                $next = strtotime("+3 months", $current);
                break;
            case 'yearly':
                $next = strtotime("+{$interval} years", $current);
                break;
            default:
                // Unknown frequency — advance by 1 day to avoid infinite loop
                $next = strtotime('+1 day', $current);
        }
        if ($next === false || $next <= $current) {
            error_log("[recurring-tasks] calculateNextDate: strtotime returned false/non-advancing for freq='$frequency' — breaking");
            return date('Y-m-d', strtotime('+1 day'));
        }
        $current = $next;
    }

    return date('Y-m-d', $current);
}

function calculateNextOccurrence(array $recurring): ?string {
    if (!$recurring['is_active']) return null;
    return calculateNextDate(
        $recurring['start_date'],
        $recurring['frequency'],
        $recurring['interval_value'],
        $recurring['day_of_week'],
        $recurring['day_of_month']
    );
}

function createTaskInstance(PDO $db, string $recurringId, string $startDate, int $dueDateOffset, string $userId, string $assignee, string $priority, int $estimatedDays, string $taskType, string $title, string $description): array {
    $endDate = date('Y-m-d', strtotime($startDate . ' +' . $dueDateOffset . ' days'));

    // Duplicate guard: skip if an instance for this recurring task + start_date already exists
    $dupCheck = $db->prepare('
        SELECT id FROM tasks
        WHERE recurring_task_id = ? AND start_date = ? AND deleted_at IS NULL LIMIT 1
    ');
    $dupCheck->execute([$recurringId, $startDate]);
    $existing = $dupCheck->fetch();
    if ($existing) {
        return [
            'id' => $existing['id'],
            'title' => $title,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'skipped' => true,
        ];
    }

    $taskId = generateUUID();
    
    $stmt = $db->prepare('
        INSERT INTO tasks (
            id, user_id, title, description, status, priority, assignee,
            start_date, end_date, estimated_days, task_type,
            recurring_task_id, created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
        )
    ');
    
    $stmt->execute([
        $taskId, $userId, $title, $description, 'pending', $priority, $assignee,
        $startDate, $endDate, $estimatedDays, $taskType,
        $recurringId
    ]);
    
    return [
        'id' => $taskId,
        'title' => $title,
        'start_date' => $startDate,
        'end_date' => $endDate
    ];
}

jsonError('Method not allowed', 405);
