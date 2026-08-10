<?php
/**
 * Batch Task Create API
 * POST body: { project_id: string, tasks: [{ title, status?, priority?, start_date?, end_date?, estimated_days?, assignee_user_id?, completed_date?, description?, task_type? }] }
 * Returns: { created: count, ids: string[] }
 */
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId   = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db       = getDB();
$method   = getMethod();

if ($method !== 'POST') jsonError('Method not allowed', 405);

$body      = getRequestBody();
$projectId = $body['project_id'] ?? '';
$tasks     = $body['tasks'] ?? [];

if (empty($projectId)) jsonError('project_id is required', 400);
if (!is_array($tasks) || count($tasks) === 0) jsonError('tasks array is required and must not be empty', 400);
if (count($tasks) > 50) jsonError('Maximum 50 tasks per batch', 400);

if (!canAccessProject($db, $projectId, $userId, $tenantId, isTenantAdmin($db, $userId, $tenantId))) {
    jsonError('Forbidden', 403);
}

// Fetch caller display_name once
$callerStmt = $db->prepare('SELECT display_name FROM users WHERE id = ?');
$callerStmt->execute([$userId]);
$callerRow = $callerStmt->fetch();
$callerName = $callerRow ? $callerRow['display_name'] : '';

$createdIds = [];
$errors     = [];

foreach ($tasks as $idx => $task) {
    $title = trim($task['title'] ?? '');
    if (empty($title)) {
        $errors[] = "Task #" . ($idx + 1) . ": title is required";
        continue;
    }

    $status        = $task['status']           ?? 'pending';
    $priority      = $task['priority']         ?? 'medium';
    $startDate     = $task['start_date']       ?? date('Y-m-d');
    $endDate       = $task['end_date']         ?? $startDate;
    $estimatedHoursInput = isset($task['estimated_hours']) ? floatval($task['estimated_hours']) : null;
    $estimatedDays = max(1, intval($task['estimated_days'] ?? 1));
    $description   = $task['description']      ?? '';
    $taskType      = $task['task_type']        ?? 'task';
    $completedDate = $task['completed_date']   ?? ($status === 'completed' ? $endDate : null);
    $assigneeUserId = $task['assignee_user_id'] ?? $userId;

    // Resolve assignee display_name
    $assigneeName = $callerName;
    if ($assigneeUserId && $assigneeUserId !== $userId) {
        $aStmt = $db->prepare('SELECT display_name FROM users WHERE id = ? AND tenant_id = ?');
        $aStmt->execute([$assigneeUserId, $tenantId]);
        $aRow = $aStmt->fetch();
        if ($aRow) $assigneeName = $aRow['display_name'];
    }

    // Allowed task types
    $allowedTypes = ['task','meeting','holiday','leave','onsite','ot','weekend_work','research','interrupt'];
    if (!in_array($taskType, $allowedTypes, true)) $taskType = 'task';

    // estimated_hours: use explicit value if given, else derive from days
    $estimatedHours = $estimatedHoursInput !== null ? $estimatedHoursInput : ($estimatedDays * 8);

    $id = generateUUID();
    try {
        $stmt = $db->prepare('
            INSERT INTO tasks
              (id, tenant_id, project_id, user_id, title, description, status, priority,
               assignee, assignee_user_id, start_date, end_date, estimated_days, estimated_hours,
               actual_hours, base_actual_hours, is_ad_hoc, original_end_date, days_spent,
               completed_date, task_type, is_subtask, created_at, updated_at)
            VALUES
              (?, ?, ?, ?, ?, ?, ?, ?,
               ?, ?, ?, ?, ?, ?,
               0, 0, 0, ?, 0,
               ?, ?, 0, NOW(), NOW())
        ');
        $stmt->execute([
            $id, $tenantId, $projectId, $userId,
            $title, $description, $status, $priority,
            $assigneeName, $assigneeUserId,
            $startDate, $endDate, $estimatedDays, $estimatedHours,
            $endDate,       // original_end_date
            $completedDate,
            $taskType,
        ]);
        $createdIds[] = $id;
    } catch (PDOException $e) {
        $errors[] = "Task #" . ($idx + 1) . " \"$title\": " . $e->getMessage();
    }
}

$response = ['created' => count($createdIds), 'ids' => $createdIds];
if (!empty($errors)) $response['errors'] = $errors;

jsonResponse($response);
