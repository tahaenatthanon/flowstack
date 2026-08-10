<?php
// /api/task-history.php
// GET  - list history (?task_id= required)
// POST - create history entry
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db = getDB();
$method = getMethod();

// --- GET ---
if ($method === 'GET') {
    $taskId = $_GET['task_id'] ?? null;
    if (!$taskId) jsonError('Missing task_id parameter');

    // Ensure task belongs to this tenant
    $chk = $db->prepare('SELECT id FROM tasks WHERE id = ? AND tenant_id = ?');
    $chk->execute([$taskId, $tenantId]);
    if (!$chk->fetch()) jsonError('Task not found', 404);

    $stmt = $db->prepare('
        SELECT th.*,
               u.display_name AS changed_by_name,
               u.email        AS changed_by_email
        FROM task_history th
        LEFT JOIN users u ON th.changed_by = u.id
        WHERE th.task_id = ?
        ORDER BY th.created_at DESC
    ');
    $stmt->execute([$taskId]);
    jsonResponse($stmt->fetchAll());
}

// --- POST ---
if ($method === 'POST') {
    $body = getRequestBody();
    $id = generateUUID();

    $stmt = $db->prepare('
        INSERT INTO task_history (id, task_id, action, field_name, old_value, new_value, changed_by, reason, related_task_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([
        $id,
        $body['task_id'] ?? '',
        $body['action'] ?? 'UPDATED',
        $body['field_name'] ?? null,
        $body['old_value'] ?? null,
        $body['new_value'] ?? null,
        $userId,
        $body['reason'] ?? null,
        $body['related_task_id'] ?? null,
    ]);

    $stmt = $db->prepare('SELECT * FROM task_history WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch(), 201);
}

jsonError('Method not allowed', 405);
