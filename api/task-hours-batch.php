<?php
// POST /api/task-hours-batch.php
// Creates multiple subtasks (task hours entries) in one request
// body: { entries: [{ work_type?, task_id?, date, hours_worked, description?, start_time?, end_time? }] }
// Returns: { created: count, ids: [...] }
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/task-hours-rollup.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Only POST allowed', 405);

$tokenData = requireAuth();
$userId = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db = getDB();

// Get user display_name for assignee field
$uStmt = $db->prepare('SELECT display_name FROM users WHERE id = ?');
$uStmt->execute([$userId]);
$uRow        = $uStmt->fetch();
$displayName = $uRow['display_name'] ?? '';

$body    = getRequestBody();
$entries = $body['entries'] ?? [];

if (empty($entries) || !is_array($entries)) jsonError('entries array is required');
if (count($entries) > 100) jsonError('Too many entries (max 100)');

$validWorkTypes = ['task', 'meeting', 'ot', 'onsite', 'leave', 'holiday', 'weekend_work', 'research', 'interrupt'];
$typeLabels = [
    'onsite' => 'งานลูกค้า (Onsite)', 'meeting' => 'ประชุม',
    'ot' => 'งานล่วงเวลา (OT)', 'task' => 'งานปกติ',
    'leave' => 'ลาหยุด', 'holiday' => 'วันหยุด',
    'weekend_work' => 'งานวันหยุด', 'research' => 'วิจัย/ศึกษา', 'interrupt' => 'งานเร่งด่วน',
];

/** Recalculate parent task hours from children via unified helper. */
function rollupBatchParent(PDO $db, ?string $parentId): void {
    if ($parentId) {
        recalcTaskHoursFromChildrenUnified($db, $parentId);
    }
}

$created = [];
$errors  = [];

foreach ($entries as $i => $entry) {
    $workType    = in_array($entry['work_type'] ?? '', $validWorkTypes) ? ($entry['work_type'] ?? 'task') : 'task';
    $hoursWorked = floatval($entry['hours_worked'] ?? 0);
    $date        = $entry['date'] ?? date('Y-m-d');
    $description = $entry['description'] ?? '';
    $startTime   = $entry['start_time'] ?? null;
    $endTime     = $entry['end_time'] ?? null;

    // Resolve project_id via linked task if provided
    $projectId    = $entry['project_id'] ?? null;
    $parentTaskId = $entry['task_id'] ?? null;

    if (empty($parentTaskId)) {
        $errors[] = "entry[$i]: task_id is required — ต้องระบุ task หลักก่อนบันทึกชั่วโมง";
        continue;
    }
    if (!isValidUUID($parentTaskId)) {
        $errors[] = "entry[$i]: รหัสงาน (task_id) ไม่ถูกต้อง — '$parentTaskId'";
        continue;
    }
    if ($parentTaskId && !$projectId) {
        $tStmt = $db->prepare('SELECT project_id FROM tasks WHERE id = ? AND deleted_at IS NULL');
        $tStmt->execute([$parentTaskId]);
        $t = $tStmt->fetch();
        if ($t) $projectId = $t['project_id'];
    }

    $title = !empty($description) ? $description : ($typeLabels[$workType] ?? 'บันทึกเวลา');
    $id    = generateUUID();

    try {
        $db->prepare('
            INSERT INTO tasks
                (id, tenant_id, project_id, parent_task_id, user_id, title, description,
                 status, priority, assignee,
                 start_date, end_date, original_end_date,
                 estimated_hours, actual_hours, base_actual_hours,
                 start_time, end_time,
                 is_subtask, is_ad_hoc, task_type,
                 estimated_days, days_spent,
                 created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?,
                    ?, ?,
                    1, 0, ?,
                    0, 0,
                    NOW(), NOW())
        ')->execute([
            $id, $tenantId, $projectId ?: null, $parentTaskId, $userId, $title, $description,
            'completed', 'medium', $displayName,
            $date, $date, $date,
            $hoursWorked, $hoursWorked,
            $hoursWorked,
            $startTime, $endTime,
            $workType,
        ]);
        rollupBatchParent($db, $parentTaskId);
        $created[] = $id;
    } catch (PDOException $e) {
        $errors[] = "entry[$i]: " . $e->getMessage();
    }
}

$response = ['created' => count($created), 'ids' => $created];
if (!empty($errors)) $response['warnings'] = $errors;

jsonResponse($response, 201);
