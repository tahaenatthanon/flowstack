<?php
// CRUD /api/task-dependencies.php
// GET    ?task_id=           — dependencies where task is blocked (what it's waiting on)
// GET    ?depends_on_task_id= — tasks blocked BY this task
// GET    ?project_id=        — all dependencies in a project
// GET    ?id=                — single dependency
// POST                       — create dependency
// PUT    ?id=                — update (resolve etc.)
// DELETE ?id=                — soft-delete
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId   = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db       = getDB();
$method   = getMethod();

$isAdmin = isTenantAdmin($db, $userId, $tenantId);

// ── GET ───────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $taskId          = $_GET['task_id']           ?? null;
    $dependsOnTaskId = $_GET['depends_on_task_id'] ?? null;
    $id              = $_GET['id']                ?? null;
    $projectId       = $_GET['project_id']        ?? null;
    $includeResolved = isset($_GET['include_resolved']);

    // Single
    if ($id) {
        $stmt = $db->prepare('SELECT * FROM task_dependencies WHERE id = ?');
        $stmt->execute([$id]);
        $dep = $stmt->fetch();
        if (!$dep) jsonError('Dependency not found', 404);
        getTaskWithAccess($db, $dep['blocked_task_id'], $userId, $tenantId, $isAdmin);
        jsonResponse($dep);
    }

    // What is this task blocked BY? (blocked_task_id = taskId)
    if ($taskId) {
        getTaskWithAccess($db, $taskId, $userId, $tenantId, $isAdmin);
        $q = '
            SELECT td.*, t.title AS blocking_title, t.status AS blocking_status,
                   t.start_date AS blocking_start, t.end_date AS blocking_end,
                   p.name AS project_name
            FROM task_dependencies td
            JOIN tasks t ON td.blocking_task_id = t.id
            JOIN projects p ON t.project_id = p.id
            WHERE td.blocked_task_id = ?';
        if (!$includeResolved) $q .= ' AND td.resolved_at IS NULL';
        $q .= ' ORDER BY td.created_at ASC';
        $stmt = $db->prepare($q);
        $stmt->execute([$taskId]);
        jsonResponse($stmt->fetchAll());
    }

    // What tasks is this task blocking? (blocking_task_id = dependsOnTaskId)
    if ($dependsOnTaskId) {
        getTaskWithAccess($db, $dependsOnTaskId, $userId, $tenantId, $isAdmin);
        $q = '
            SELECT td.*, t.title AS blocked_title, t.status AS blocked_status,
                   t.start_date AS blocked_start, t.end_date AS blocked_end,
                   p.name AS project_name
            FROM task_dependencies td
            JOIN tasks t ON td.blocked_task_id = t.id
            JOIN projects p ON t.project_id = p.id
            WHERE td.blocking_task_id = ?';
        if (!$includeResolved) $q .= ' AND td.resolved_at IS NULL';
        $q .= ' ORDER BY td.created_at ASC';
        $stmt = $db->prepare($q);
        $stmt->execute([$dependsOnTaskId]);
        jsonResponse($stmt->fetchAll());
    }

    // All deps in a project
    if ($projectId) {
        if (!canAccessProject($db, $projectId, $userId, $tenantId, $isAdmin)) jsonError('Forbidden', 403);
        $q = '
            SELECT td.*,
                   t1.title AS blocked_title,   t1.status AS blocked_status,
                   t1.start_date AS blocked_start, t1.end_date AS blocked_end,
                   t2.title AS blocking_title,  t2.status AS blocking_status,
                   t2.start_date AS blocking_start, t2.end_date AS blocking_end
            FROM task_dependencies td
            JOIN tasks t1 ON td.blocked_task_id   = t1.id
            JOIN tasks t2 ON td.blocking_task_id  = t2.id
            WHERE t1.project_id = ?';
        if (!$includeResolved) $q .= ' AND td.resolved_at IS NULL';
        $q .= ' ORDER BY td.created_at ASC';
        $stmt = $db->prepare($q);
        $stmt->execute([$projectId]);
        jsonResponse($stmt->fetchAll());
    }

    // List all
    $stmt = $db->query('
        SELECT td.*,
               t1.title AS blocked_title,  t1.status AS blocked_status,
               t2.title AS blocking_title, t2.status AS blocking_status,
               p.name   AS project_name
        FROM task_dependencies td
        JOIN tasks t1    ON td.blocked_task_id  = t1.id
        JOIN tasks t2    ON td.blocking_task_id = t2.id
        JOIN projects p  ON t1.project_id       = p.id
        ORDER BY td.created_at DESC
        LIMIT 200
    ');
    jsonResponse($stmt->fetchAll());
}

// ── POST ──────────────────────────────────────────────────────────────────────
if ($method === 'POST') {
    if (isset($_GET['resolve'])) {
        $body         = getRequestBody();
        $dependencyId = $body['dependency_id'] ?? '';
        if (!$dependencyId) jsonError('dependency_id required', 400);
        $stmt = $db->prepare('SELECT * FROM task_dependencies WHERE id = ?');
        $stmt->execute([$dependencyId]);
        $dep = $stmt->fetch();
        if (!$dep) jsonError('Dependency not found', 404);
        getTaskWithAccess($db, $dep['blocked_task_id'], $userId, $tenantId, $isAdmin);
        $db->prepare('UPDATE task_dependencies SET resolved_at = NOW(), reason_description = CONCAT(COALESCE(reason_description,""), ?) WHERE id = ?')
           ->execute(["\nResolved: " . ($body['notes'] ?? ''), $dependencyId]);
        jsonResponse(['success' => true]);
    }

    $body             = getRequestBody();
    $blockedTaskId    = $body['task_id']           ?? $body['blocked_task_id']   ?? '';
    $blockingTaskId   = $body['depends_on_task_id'] ?? $body['blocking_task_id'] ?? '';
    $reasonCode       = $body['reason_code']        ?? 'DEPENDENCY';
    $reasonDesc       = $body['notes']              ?? $body['reason_description'] ?? '';
    $impactDays       = (int)($body['impact_days']  ?? 0);

    if (!$blockedTaskId || !$blockingTaskId) jsonError('task_id (blocked) and depends_on_task_id (blocking) required', 400);
    if ($blockedTaskId === $blockingTaskId)  jsonError('A task cannot depend on itself', 400);

    getTaskWithAccess($db, $blockedTaskId,  $userId, $tenantId, $isAdmin);
    getTaskWithAccess($db, $blockingTaskId, $userId, $tenantId, $isAdmin);

    // Duplicate check
    $dup = $db->prepare('SELECT id FROM task_dependencies WHERE blocked_task_id = ? AND blocking_task_id = ? AND resolved_at IS NULL');
    $dup->execute([$blockedTaskId, $blockingTaskId]);
    if ($dup->fetch()) jsonError('This dependency already exists', 400);

    // Circular check
    if (hasCircularDependency($db, $blockedTaskId, $blockingTaskId)) jsonError('This would create a circular dependency', 400);

    $id = generateUUID();
    $db->prepare('INSERT INTO task_dependencies (id, blocked_task_id, blocking_task_id, reason_code, reason_description, impact_days, created_by) VALUES (?,?,?,?,?,?,?)')
       ->execute([$id, $blockedTaskId, $blockingTaskId, $reasonCode, $reasonDesc, $impactDays, $userId]);

    $stmt = $db->prepare('SELECT * FROM task_dependencies WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch(), 201);
}

// ── PUT ───────────────────────────────────────────────────────────────────────
if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('id required', 400);
    $stmt = $db->prepare('SELECT * FROM task_dependencies WHERE id = ?');
    $stmt->execute([$id]);
    $dep = $stmt->fetch();
    if (!$dep) jsonError('Dependency not found', 404);
    getTaskWithAccess($db, $dep['blocked_task_id'], $userId, $tenantId, $isAdmin);

    $body = getRequestBody();
    $fields = []; $params = [];
    foreach (['reason_code','reason_description','impact_days'] as $f) {
        if (array_key_exists($f, $body)) { $fields[] = "$f = ?"; $params[] = $body[$f]; }
    }
    if (!empty($body['resolved'])) { $fields[] = 'resolved_at = NOW()'; }

    if ($fields) {
        $params[] = $id;
        $db->prepare('UPDATE task_dependencies SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    }
    $stmt = $db->prepare('SELECT * FROM task_dependencies WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch());
}

// ── DELETE ────────────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('id required', 400);
    $stmt = $db->prepare('SELECT * FROM task_dependencies WHERE id = ?');
    $stmt->execute([$id]);
    $dep = $stmt->fetch();
    if (!$dep) jsonError('Dependency not found', 404);
    getTaskWithAccess($db, $dep['blocked_task_id'], $userId, $tenantId, $isAdmin);
    $db->prepare('UPDATE task_dependencies SET resolved_at = NOW() WHERE id = ?')->execute([$id]);
    jsonResponse(['success' => true]);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function hasCircularDependency(PDO $db, string $blockedId, string $blockingId): bool {
    $checked = [];
    $toCheck = [$blockedId];
    while ($toCheck) {
        $current = array_pop($toCheck);
        if ($current === $blockingId) return true;
        if (in_array($current, $checked)) continue;
        $checked[] = $current;
        $stmt = $db->prepare('SELECT blocking_task_id FROM task_dependencies WHERE blocked_task_id = ? AND resolved_at IS NULL');
        $stmt->execute([$current]);
        foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $t) $toCheck[] = $t;
    }
    return false;
}

jsonError('Method not allowed', 405);
