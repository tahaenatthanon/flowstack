<?php
// api/chat-history.php — Chat session & message CRUD
// GET    ?action=sessions           — list user's sessions (newest first)
// GET    ?action=messages&session_id=X — get messages for session
// GET    ?action=reports            — list user's saved AI reports
// POST   action=create_session      — create new session
// POST   action=save_message        — save a message to session
// POST   action=save_report         — save AI-generated report
// POST   action=update_title        — update session title
// DELETE ?id=X                      — delete a session
// DELETE ?action=report&id=X        — delete a report
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db = getDB();
$method = getMethod();

// --- GET ---
if ($method === 'GET') {
    $action = $_GET['action'] ?? '';

    if ($action === 'sessions') {
        $stmt = $db->prepare('
            SELECT id, title, model, message_count, created_at, updated_at
            FROM chat_sessions
            WHERE user_id = ? AND tenant_id = ?
            ORDER BY updated_at DESC
            LIMIT 50
        ');
        $stmt->execute([$userId, $tenantId]);
        jsonResponse($stmt->fetchAll());
    }

    if ($action === 'messages') {
        $sessionId = $_GET['session_id'] ?? '';
        if (empty($sessionId)) jsonError('Missing session_id');

        // Verify ownership
        $check = $db->prepare('SELECT id FROM chat_sessions WHERE id = ? AND user_id = ? AND tenant_id = ?');
        $check->execute([$sessionId, $userId, $tenantId]);
        if (!$check->fetch()) jsonError('Session not found', 404);

        $stmt = $db->prepare('
            SELECT id, role, content, table_data, created_at
            FROM chat_messages
            WHERE session_id = ?
            ORDER BY created_at ASC
        ');
        $stmt->execute([$sessionId]);
        $messages = $stmt->fetchAll();

        // Parse table_data JSON
        foreach ($messages as &$msg) {
            if ($msg['table_data']) {
                $msg['table_data'] = json_decode($msg['table_data'], true);
            }
        }

        jsonResponse($messages);
    }

    if ($action === 'reports') {
        $sessionId = $_GET['session_id'] ?? '';
        $limit = max(1, min(200, intval($_GET['limit'] ?? 100)));

        $sql = '
            SELECT id, session_id, title, report_type, content, table_data, created_at, updated_at
            FROM chat_reports
            WHERE tenant_id = ? AND user_id = ?
        ';
        $params = [$tenantId, $userId];

        if (!empty($sessionId)) {
            $sql .= ' AND session_id = ?';
            $params[] = $sessionId;
        }

        $sql .= ' ORDER BY created_at DESC LIMIT ?';
        $params[] = $limit;

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $reports = $stmt->fetchAll();

        foreach ($reports as &$report) {
            if ($report['table_data']) {
                $report['table_data'] = json_decode($report['table_data'], true);
            }
        }

        jsonResponse($reports);
    }

    jsonError('Invalid action');
}

// --- POST ---
if ($method === 'POST') {
    $body = getRequestBody();
    $action = $body['action'] ?? '';

    if ($action === 'create_session') {
        $id = generateUUID();
        $title = $body['title'] ?? 'แชทใหม่';
        $model = $body['model'] ?? '';

        $stmt = $db->prepare('
            INSERT INTO chat_sessions (id, tenant_id, user_id, title, model, message_count)
            VALUES (?, ?, ?, ?, ?, 0)
        ');
        $stmt->execute([$id, $tenantId, $userId, $title, $model]);

        $stmt = $db->prepare('SELECT * FROM chat_sessions WHERE id = ?');
        $stmt->execute([$id]);
        jsonResponse($stmt->fetch(), 201);
    }

    if ($action === 'save_message') {
        $sessionId = $body['session_id'] ?? '';
        $role = $body['role'] ?? '';
        $content = $body['content'] ?? '';
        $tableData = $body['table_data'] ?? null;

        if (empty($sessionId) || empty($role) || empty($content)) {
            jsonError('Missing session_id, role, or content');
        }

        // Verify ownership
        $check = $db->prepare('SELECT id FROM chat_sessions WHERE id = ? AND user_id = ? AND tenant_id = ?');
        $check->execute([$sessionId, $userId, $tenantId]);
        if (!$check->fetch()) jsonError('Session not found', 404);

        $id = generateUUID();
        $stmt = $db->prepare('
            INSERT INTO chat_messages (id, session_id, role, content, table_data)
            VALUES (?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $id,
            $sessionId,
            $role,
            $content,
            $tableData ? json_encode($tableData, JSON_UNESCAPED_UNICODE) : null,
        ]);

        // Update session message count and timestamp
        $db->prepare('
            UPDATE chat_sessions SET message_count = message_count + 1 WHERE id = ?
        ')->execute([$sessionId]);

        jsonResponse(['id' => $id], 201);
    }

    if ($action === 'save_report') {
        $sessionId = $body['session_id'] ?? null;
        $title = trim($body['title'] ?? 'รายงาน AI');
        $content = trim($body['content'] ?? '');
        $reportType = trim($body['report_type'] ?? 'analysis');
        $tableData = $body['table_data'] ?? null;

        if ($content === '') {
            jsonError('Missing report content');
        }

        if (!empty($sessionId)) {
            $check = $db->prepare('SELECT id FROM chat_sessions WHERE id = ? AND user_id = ? AND tenant_id = ?');
            $check->execute([$sessionId, $userId, $tenantId]);
            if (!$check->fetch()) jsonError('Session not found', 404);
        }

        $id = generateUUID();
        $stmt = $db->prepare('
            INSERT INTO chat_reports (id, tenant_id, user_id, session_id, title, report_type, content, table_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $id,
            $tenantId,
            $userId,
            $sessionId,
            $title,
            $reportType,
            $content,
            $tableData ? json_encode($tableData, JSON_UNESCAPED_UNICODE) : null,
        ]);

        jsonResponse(['id' => $id], 201);
    }

    if ($action === 'update_title') {
        $sessionId = $body['session_id'] ?? '';
        $title = $body['title'] ?? '';
        if (empty($sessionId) || empty($title)) jsonError('Missing session_id or title');

        $stmt = $db->prepare('UPDATE chat_sessions SET title = ? WHERE id = ? AND user_id = ?');
        $stmt->execute([$title, $sessionId, $userId]);
        jsonResponse(['success' => true]);
    }

    jsonError('Invalid action');
}

// --- DELETE ---
if ($method === 'DELETE') {
    $action = $_GET['action'] ?? '';
    $id = $_GET['id'] ?? '';
    if (empty($id)) jsonError('Missing id');

    if ($action === 'report') {
        $stmt = $db->prepare('DELETE FROM chat_reports WHERE id = ? AND user_id = ? AND tenant_id = ?');
        $stmt->execute([$id, $userId, $tenantId]);

        if ($stmt->rowCount() === 0) jsonError('Report not found', 404);
        jsonResponse(['success' => true]);
    }

    $stmt = $db->prepare('DELETE FROM chat_sessions WHERE id = ? AND user_id = ? AND tenant_id = ?');
    $stmt->execute([$id, $userId, $tenantId]);

    if ($stmt->rowCount() === 0) jsonError('Session not found', 404);
    jsonResponse(['success' => true]);
}

jsonError('Method not allowed', 405);
