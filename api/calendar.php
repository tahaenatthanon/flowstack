<?php
// api/calendar.php
// GET    ?start=YYYY-MM-DD&end=YYYY-MM-DD  — list events in range
// GET    ?id=UUID                           — get single event
// POST                                      — create event
// PUT    ?id=UUID                           — update event
// DELETE ?id=UUID                           — soft-delete (status=cancelled)

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/work-type-catalog.php';

$tokenData = requireAuth();
$userId    = $tokenData['user_id'];
$tenantId  = $tokenData['tenant_id'];
$db        = getDB();

// Check if user is admin (tenant-scoped) — same pattern as tasks.php
$isAdmin = isTenantAdmin($db, $userId, $tenantId);
$method    = getMethod();
$allowedTaskTypes = getAllowedTaskTypes($db, false, $tenantId);
$allowedCalendarEventTypes = getAllowedCalendarEventTypes($db, false, $tenantId);

if ($method === 'GET') {
    $id = $_GET['id'] ?? null;
    if ($id) {
        $stmt = $db->prepare(
            "SELECT * FROM calendar_events WHERE id = ? AND tenant_id = ? AND status != 'cancelled'"
        );
        $stmt->execute([$id, $tenantId]);
        $event = $stmt->fetch();
        if (!$event) jsonError('Event not found', 404);
        if (!$isAdmin && $event['created_by'] !== $userId && $event['event_type'] !== 'holiday') {
            jsonError('Forbidden', 403);
        }
        if ($event['attendees']) $event['attendees'] = json_decode($event['attendees'], true);
        jsonResponse($event);
    }

    $start     = $_GET['start'] ?? date('Y-m-01');
    $end       = $_GET['end']   ?? date('Y-m-t');
    $projectId = $_GET['project_id'] ?? null;
    $userIdFilter = $_GET['user_id'] ?? null;

    if ($isAdmin) {
        $sql = "SELECT e.*, u.display_name AS creator_name, au.display_name AS assignee_name
                FROM calendar_events e
                LEFT JOIN users u ON u.id = e.created_by
                LEFT JOIN users au ON au.id = e.assignee_user_id
                WHERE e.tenant_id = ?
                  AND e.start_at <= ?
                  AND e.end_at   >= ?
                  AND e.status   != 'cancelled'";
        $params = [$tenantId, $end . ' 23:59:59', $start . ' 00:00:00'];
        if ($projectId) {
            $sql .= " AND e.project_id = ?";
            $params[] = $projectId;
        }
        if ($userIdFilter) {
            $sql .= " AND (e.created_by = ? OR e.assignee_user_id = ?)";
            $params[] = $userIdFilter;
            $params[] = $userIdFilter;
        }
        $sql .= " ORDER BY e.start_at";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
    } else {
        // Non-admin: see all events in tenant (team calendar, not personal)
        $sql = "SELECT e.*, u.display_name AS creator_name, au.display_name AS assignee_name
                FROM calendar_events e
                LEFT JOIN users u ON u.id = e.created_by
                LEFT JOIN users au ON au.id = e.assignee_user_id
                WHERE e.tenant_id = ?
                  AND e.start_at <= ?
                  AND e.end_at   >= ?
                  AND e.status   != 'cancelled'";
        $params = [$tenantId, $end . ' 23:59:59', $start . ' 00:00:00'];
        if ($projectId) {
            $sql .= " AND e.project_id = ?";
            $params[] = $projectId;
        }
        if ($userIdFilter) {
            $sql .= " AND (e.created_by = ? OR e.assignee_user_id = ?)";
            $params[] = $userIdFilter;
            $params[] = $userIdFilter;
        }
        $sql .= " ORDER BY e.start_at";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
    }

    $events = $stmt->fetchAll();
    foreach ($events as &$e) {
        $e['source'] = 'calendar';
        if ($e['attendees']) $e['attendees'] = json_decode($e['attendees'], true);
    }
    unset($e);

    // Also read tasks as calendar items (all task_types).
    // Pull: task, meeting, leave, holiday, research, interrupt, weekend_work, onsite, ot
    // Permission model combines tasks.php project access + base calendar visibility
    // + task creator always sees their own tasks + holidays are public.
    $baseCalId  = getBaseCalendarProjectId($db, $tenantId);
    // Build project membership set once (avoids per-row EXISTS subquery)
    $memberProjectIds = [];
    if (!$isAdmin) {
        $mpStmt = $db->prepare('SELECT project_id FROM project_members WHERE user_id = ?');
        $mpStmt->execute([$userId]);
        $memberProjectIds = array_column($mpStmt->fetchAll(PDO::FETCH_ASSOC), 'project_id');
        // Also include projects the user owns
        $ownStmt = $db->prepare('SELECT id FROM projects WHERE user_id = ? AND tenant_id = ? AND deleted_at IS NULL');
        $ownStmt->execute([$userId, $tenantId]);
        $ownedIds = array_column($ownStmt->fetchAll(PDO::FETCH_ASSOC), 'id');
        $memberProjectIds = array_unique(array_merge($memberProjectIds, $ownedIds));
    }

    // Always include leave/holiday task types for calendar display even though
    // they are excluded from task creation via allowedTaskTypes.
    $calendarTaskTypes = array_unique(array_merge($allowedTaskTypes, ['leave', 'holiday']));
    $taskTypePlaceholders = implode(',', array_fill(0, count($calendarTaskTypes), '?'));
    $taskSql = "SELECT
            t.id, t.title,
            CONCAT(t.start_date, ' 00:00:00') AS start_at,
            CONCAT(COALESCE(t.end_date, t.start_date), ' 23:59:59') AS end_at,
            CASE
              WHEN t.task_type IS NULL OR t.task_type = '' THEN 'task'
              ELSE t.task_type
            END AS event_type,
            t.description,
            NULL AS location,
            1 AS all_day,
            CASE WHEN t.status = 'completed' THEN 'confirmed' ELSE 'tentative' END AS status,
            NULL AS attendees,
            t.project_id,
            t.user_id AS created_by,
            u.display_name AS creator_name,
            'task' AS source,
            t.parent_task_id,
            t.assignee,
            t.assignee_user_id
         FROM tasks t
         LEFT JOIN users u ON u.id = t.user_id
         WHERE t.tenant_id = ?
           AND t.deleted_at IS NULL
           AND t.is_subtask = 0
           AND t.start_date IS NOT NULL
           AND t.start_date <= ?
           AND (t.end_date IS NULL OR t.end_date >= ?)
           AND (t.task_type IS NULL OR t.task_type = '' OR t.task_type IN ($taskTypePlaceholders))";

    $taskParams = array_merge([$tenantId, $end, $start], $calendarTaskTypes);

    if (!$isAdmin) {
        if (!empty($memberProjectIds)) {
            $mpPlaceholders = implode(',', array_fill(0, count($memberProjectIds), '?'));
            $taskSql .= " AND (
                t.task_type = 'holiday'
                OR t.project_id = ?
                OR t.project_id IN ($mpPlaceholders)
                OR (t.project_id IS NULL AND t.user_id = ?)
                OR t.user_id = ?
            )";
            $taskParams = array_merge($taskParams, [$baseCalId], $memberProjectIds, [$userId, $userId]);
        } else {
            $taskSql .= " AND (
                t.task_type = 'holiday'
                OR t.project_id = ?
                OR (t.project_id IS NULL AND t.user_id = ?)
                OR t.user_id = ?
            )";
            $taskParams = array_merge($taskParams, [$baseCalId, $userId, $userId]);
        }
    }
    if ($projectId) {
        $taskSql .= " AND t.project_id = ?";
        $taskParams[] = $projectId;
    }
    if ($userIdFilter) {
        $taskSql .= " AND (t.assignee_user_id = ? OR t.user_id = ?)";
        $taskParams[] = $userIdFilter;
        $taskParams[] = $userIdFilter;
    }
    $taskSql .= " ORDER BY t.start_date";
    $taskStmt = $db->prepare($taskSql);
    $taskStmt->execute($taskParams);
    $tasks = $taskStmt->fetchAll();

    // De-duplicate meeting rows: if the same meeting already exists in calendar_events,
    // hide the task-side row from calendar feed.
    $calendarMeetingSignatures = [];
    foreach ($events as $event) {
        if (($event['event_type'] ?? '') !== 'meeting') {
            continue;
        }
        $eventTitle = trim((string)($event['title'] ?? ''));
        $eventDate = substr((string)($event['start_at'] ?? ''), 0, 10);
        $eventUser = (string)($event['created_by'] ?? '');
        if ($eventTitle === '' || $eventDate === '' || $eventUser === '') {
            continue;
        }
        $calendarMeetingSignatures[
            strtolower($eventTitle) . '|' . $eventDate . '|' . $eventUser
        ] = true;
    }

    $tasks = array_values(array_filter($tasks, static function (array $task) use ($calendarMeetingSignatures): bool {
        if (($task['event_type'] ?? '') !== 'meeting') {
            return true;
        }
        $taskTitle = trim((string)($task['title'] ?? ''));
        $taskDate = substr((string)($task['start_at'] ?? ''), 0, 10);
        $taskUser = (string)($task['assignee_user_id'] ?? $task['created_by'] ?? '');
        if ($taskTitle === '' || $taskDate === '' || $taskUser === '') {
            return true;
        }
        $signature = strtolower($taskTitle) . '|' . $taskDate . '|' . $taskUser;
        return !isset($calendarMeetingSignatures[$signature]);
    }));

    jsonResponse(array_merge($events, $tasks));
}

if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];

    foreach (['title', 'event_type', 'start_at', 'end_at'] as $field) {
        if (empty($data[$field])) jsonError("Missing required field: $field");
    }

    if (!in_array($data['event_type'], $allowedCalendarEventTypes, true)) {
        jsonError('Invalid event_type. Allowed: ' . implode(', ', $allowedCalendarEventTypes), 422);
    }

    if ($data['event_type'] === 'holiday' && !$isAdmin) {
        jsonError('Only admin can create company holidays', 403);
    }

    $id = generateUUID();
    $stmt = $db->prepare(
        "INSERT INTO calendar_events
         (id, tenant_id, created_by, assignee_user_id, project_id, title, description, location,
          event_type, start_at, end_at, all_day, recurrence, status, attendees)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $id,
        $tenantId,
        $userId,
        $data['assignee_user_id'] ?? null,
        $data['project_id'] ?? null,
        $data['title'],
        $data['description'] ?? null,
        $data['location'] ?? null,
        $data['event_type'],
        $data['start_at'],
        $data['end_at'],
        (int)($data['all_day'] ?? 0),
        $data['recurrence'] ?? null,
        $data['status'] ?? 'confirmed',
        isset($data['attendees']) ? json_encode($data['attendees']) : null,
    ]);

    $stmt2 = $db->prepare("SELECT * FROM calendar_events WHERE id = ?");
    $stmt2->execute([$id]);
    $created = $stmt2->fetch();
    if ($created['attendees']) $created['attendees'] = json_decode($created['attendees'], true);
    jsonResponse($created, 201);
}

if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id');

    $stmt = $db->prepare("SELECT * FROM calendar_events WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$id, $tenantId]);
    $event = $stmt->fetch();
    if (!$event) jsonError('Event not found', 404);
    if (!$isAdmin && $event['created_by'] !== $userId) jsonError('Forbidden', 403);

    $data = json_decode(file_get_contents('php://input'), true) ?? [];

    if (array_key_exists('event_type', $data)) {
        if (!in_array($data['event_type'], $allowedCalendarEventTypes, true)) {
            jsonError('Invalid event_type. Allowed: ' . implode(', ', $allowedCalendarEventTypes), 422);
        }
        if ($data['event_type'] === 'holiday' && !$isAdmin) {
            jsonError('Only admin can set company holidays', 403);
        }
    }

    $fields = ['title', 'description', 'location', 'event_type', 'start_at', 'end_at',
               'all_day', 'recurrence', 'status', 'attendees', 'project_id', 'assignee_user_id'];
    $sets = [];
    $vals = [];
    foreach ($fields as $f) {
        if (array_key_exists($f, $data)) {
            $sets[] = "`$f` = ?";
            $vals[] = ($f === 'attendees' && is_array($data[$f])) ? json_encode($data[$f]) : $data[$f];
        }
    }
    if (empty($sets)) jsonError('No fields to update');
    $vals[] = $id;
    $db->prepare("UPDATE calendar_events SET " . implode(', ', $sets) . " WHERE id = ?")->execute($vals);

    $stmt2 = $db->prepare("SELECT * FROM calendar_events WHERE id = ?");
    $stmt2->execute([$id]);
    $updated = $stmt2->fetch();
    if ($updated['attendees']) $updated['attendees'] = json_decode($updated['attendees'], true);
    jsonResponse($updated);
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id');

    $stmt = $db->prepare("SELECT * FROM calendar_events WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$id, $tenantId]);
    $event = $stmt->fetch();
    if (!$event) jsonError('Event not found', 404);
    if (!$isAdmin && $event['created_by'] !== $userId) jsonError('Forbidden', 403);

    $db->prepare("UPDATE calendar_events SET status = 'cancelled' WHERE id = ?")->execute([$id]);
    jsonResponse(['deleted' => true]);
}

jsonError('Method not allowed', 405);
