<?php
/**
 * Timesheet API (legacy compatibility) — backed by task/subtask model.
 *
 * Every entry is stored as a child task (parent_task_id != NULL, is_subtask=0).
 * Hours stored in actual_hours + estimated_hours (decimal). No more days_spent conversion.
 *
 * GET    ?project_id=  list entries (subtasks) for a project
 * GET    (no params)   list all entries the caller can see
 * GET    ?date_from=&date_to=&user_id=  filter by date range / user
 * POST   create entry (subtask)
 * PUT    ?id=  update entry
 * DELETE ?id=  soft-delete entry
 */
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/task-hours-rollup.php';

$tokenData = requireAuth();
$userId    = $tokenData['user_id'];
$tenantId  = $tokenData['tenant_id'];
$db        = getDB();
$method    = getMethod();

$adminStmt = $db->prepare('SELECT is_admin FROM tenant_users WHERE user_id = ? AND tenant_id = ?');
$adminStmt->execute([$userId, $tenantId]);
$isAdmin = (int)($adminStmt->fetchColumn() ?? 0) === 1;

// ── helpers ──────────────────────────────────────────────────────────────────

function getEntryWithAccess(PDO $db, string $id, string $userId, string $tenantId, bool $isAdmin): array {
    $stmt = $db->prepare('SELECT * FROM tasks WHERE id = ? AND tenant_id = ? AND is_subtask = 0 AND parent_task_id IS NOT NULL AND deleted_at IS NULL');
    $stmt->execute([$id, $tenantId]);
    $row = $stmt->fetch();
    if (!$row) jsonError('ไม่พบรายการ', 404);
    if (!$isAdmin && $row['user_id'] !== $userId) jsonError('Forbidden', 403);
    return $row;
}

/** Recalculate parent task hours from children via unified helper. */
function rollupParent(PDO $db, ?string $parentId): void {
    if ($parentId) {
        recalcTaskHoursFromChildrenUnified($db, $parentId);
    }
}

/** Convert a subtask row (with joined fields) to timesheet-entry shape */
function rowToEntry(array $t): array {
    return [
        'id'           => $t['id'],
        'parent_task_id' => $t['parent_task_id'],
        'user_id'      => $t['user_id'],
        'work_date'    => $t['start_date'],
        'date'         => $t['start_date'],      // backward compat
        'hours_worked' => (float)($t['actual_hours'] ?? 0),
        'start_time'   => $t['start_time'] ?? null,
        'end_time'     => $t['end_time']   ?? null,
        'work_type'    => $t['task_type']  ?? 'work',
        'description'  => $t['description'] ?? '',
        'created_at'   => $t['created_at'],
        'task_title'   => $t['parent_title'] ?? $t['title'] ?? '',
        'entry_title'  => $t['title'] ?? '',
        'project_id'   => $t['project_id']   ?? null,
        'project_name' => $t['project_name'] ?? null,
        'user_name'    => $t['user_name']    ?? null,
    ];
}

$baseSelect = "
    SELECT s.*,
           p.name         AS project_name,
           u.display_name AS user_name,
           pt.title       AS parent_title
    FROM tasks s
    LEFT JOIN projects p  ON s.project_id     = p.id
    LEFT JOIN users u     ON s.user_id        = u.id
    LEFT JOIN tasks pt    ON s.parent_task_id = pt.id
    WHERE s.is_subtask = 0 AND s.parent_task_id IS NOT NULL AND s.deleted_at IS NULL AND s.tenant_id = " . $db->quote($tenantId) . "
";

// ── GET ───────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $conditions = [];
    $params     = [];

    $projectId = $_GET['project_id'] ?? null;
    $dateFrom  = $_GET['date_from']  ?? null;
    $dateTo    = $_GET['date_to']    ?? null;
    $filterUid = $_GET['user_id']    ?? null;

    if ($projectId) {
        if (!canAccessProject($db, $projectId, $userId, $tenantId, $isAdmin)) jsonError('Forbidden', 403);
        $conditions[] = 's.project_id = ?'; $params[] = $projectId;
    } elseif (!$isAdmin) {
        $conditions[] = 's.user_id = ?'; $params[] = $userId;
    }

    if ($filterUid && $isAdmin) { $conditions[] = 's.user_id = ?'; $params[] = $filterUid; }
    if ($dateFrom)  { $conditions[] = 's.start_date >= ?'; $params[] = $dateFrom; }
    if ($dateTo)    { $conditions[] = 's.start_date <= ?'; $params[] = $dateTo; }

    $where = $conditions ? ' AND ' . implode(' AND ', $conditions) : '';
    $stmt  = $db->prepare($baseSelect . $where . ' ORDER BY s.start_date DESC, s.created_at DESC');
    $stmt->execute($params);
    jsonResponse(array_map('rowToEntry', $stmt->fetchAll()));
}

// ── POST ──────────────────────────────────────────────────────────────────────
if ($method === 'POST') {
    $body = getRequestBody();

    $hoursWorked = (float)($body['hours_worked'] ?? 0);
    if ($hoursWorked <= 0) jsonError('กรุณาระบุชั่วโมงทำงาน (มากกว่า 0)');
    if ($hoursWorked > 24) jsonError('ชั่วโมงต้องไม่เกิน 24');

    $workDate    = $body['date']        ?? date('Y-m-d');
    $workType    = $body['work_type']   ?? 'work';
    $description = $body['description'] ?? '';
    $startTime   = $body['start_time']  ?? null;
    $endTime     = $body['end_time']    ?? null;
    $parentId    = $body['task_id']     ?? null;  // parent task (the actual work item)
    $projectId   = $body['project_id']  ?? null;

    if ($parentId && !isValidUUID($parentId)) jsonError('รหัสงาน (task_id) ไม่ถูกต้อง: ' . $parentId, 400);

    // Resolve project from parent task if not supplied
    if ($parentId && !$projectId) {
        $r = $db->prepare('SELECT project_id FROM tasks WHERE id = ? AND deleted_at IS NULL');
        $r->execute([$parentId]);
        $row = $r->fetch();
        if ($row) $projectId = $row['project_id'];
    }

    // Build entry title
    $typeLabels = [
        'leave' => 'ลาหยุด', 'holiday' => 'วันหยุด',
        'onsite' => 'งานลูกค้า (Onsite)', 'meeting' => 'ประชุม',
        'ot' => 'งานล่วงเวลา (OT)', 'work' => 'งานปกติ',
    ];
    $entryTitle = !empty($description) ? $description : ($typeLabels[$workType] ?? 'บันทึกเวลา');

    // Get caller display_name for assignee field
    $uStmt = $db->prepare('SELECT display_name FROM users WHERE id = ?');
    $uStmt->execute([$userId]);
    $displayName = $uStmt->fetchColumn() ?? '';

    $id = generateUUID();
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
                ?, ?,
                ?, ?,
                0, 0, ?,
                0, 0,
                NOW(), NOW())
    ')->execute([
        $id, $tenantId, $projectId, $parentId, $userId, $entryTitle, $description,
        'completed', 'medium', $displayName,
        $workDate, $workDate, $workDate,
        $hoursWorked, $hoursWorked, $hoursWorked,
        $startTime, $endTime,
        $workType,
    ]);

    rollupParent($db, $parentId);

    $stmt = $db->prepare($baseSelect . ' AND s.id = ?');
    $stmt->execute([$id]);
    jsonResponse(rowToEntry($stmt->fetch()), 201);
}

// ── PUT ───────────────────────────────────────────────────────────────────────
if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id');

    $entry = getEntryWithAccess($db, $id, $userId, $tenantId, $isAdmin);
    $body  = getRequestBody();

    $fields = [];
    $values = [];

    if (isset($body['hours_worked'])) {
        $h = (float)$body['hours_worked'];
        if ($h <= 0) jsonError('ชั่วโมงต้องมากกว่า 0');
        if ($h > 24) jsonError('ชั่วโมงต้องไม่เกิน 24');
        $fields[] = '`actual_hours` = ?';    $values[] = $h;
        $fields[] = '`estimated_hours` = ?'; $values[] = $h;
        $fields[] = '`base_actual_hours` = ?'; $values[] = $h;
    }
    if (isset($body['date'])) {
        $fields[] = '`start_date` = ?'; $values[] = $body['date'];
        $fields[] = '`end_date` = ?';   $values[] = $body['date'];
    }
    if (isset($body['start_time'])) { $fields[] = '`start_time` = ?'; $values[] = $body['start_time'] ?: null; }
    if (isset($body['end_time']))   { $fields[] = '`end_time` = ?';   $values[] = $body['end_time']   ?: null; }
    if (isset($body['work_type']))  { $fields[] = '`task_type` = ?';  $values[] = $body['work_type']; }
    if (isset($body['description'])) {
        $fields[] = '`description` = ?'; $values[] = $body['description'];
        $fields[] = '`title` = ?';       $values[] = $body['description'] ?: 'บันทึกเวลา';
    }

    if (empty($fields)) jsonError('ไม่มีข้อมูลที่จะอัปเดต');

    $fields[] = '`updated_at` = NOW()';
    $values[] = $id;
    $db->prepare('UPDATE tasks SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);

    rollupParent($db, $entry['parent_task_id']);

    $stmt = $db->prepare($baseSelect . ' AND s.id = ?');
    $stmt->execute([$id]);
    jsonResponse(rowToEntry($stmt->fetch()));
}

// ── DELETE ────────────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id');

    $entry = getEntryWithAccess($db, $id, $userId, $tenantId, $isAdmin);
    $db->prepare('UPDATE tasks SET deleted_at = NOW() WHERE id = ? AND tenant_id = ?')->execute([$id, $tenantId]);

    rollupParent($db, $entry['parent_task_id']);

    jsonResponse(['deleted' => true]);
}

jsonError('Method not allowed', 405);
