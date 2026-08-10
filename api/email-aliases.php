<?php
// GET    /api/email-aliases.php?user_id=...  - list aliases for a user (admin)
// POST   /api/email-aliases.php              - create alias (admin)  body: { user_id, alias_email, label }
// DELETE /api/email-aliases.php?id=...       - delete alias (admin)
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$db        = getDB();
requireAdmin($db, $tokenData['user_id'], $tokenData['tenant_id']);

$method = getMethod();

// GET — list all aliases for a user
if ($method === 'GET') {
    $userId = $_GET['user_id'] ?? null;
    if (!$userId) jsonError('Missing user_id', 400);

    $stmt = $db->prepare('
        SELECT id, user_id, alias_email, label, created_at
        FROM user_email_aliases
        WHERE user_id = ?
        ORDER BY created_at ASC
    ');
    $stmt->execute([$userId]);
    jsonResponse($stmt->fetchAll());
}

// POST — create new alias
if ($method === 'POST') {
    $body       = getRequestBody();
    $userId     = trim($body['user_id']     ?? '');
    $aliasEmail = strtolower(trim($body['alias_email'] ?? ''));
    $label      = trim($body['label']       ?? '');

    if (!$userId) jsonError('Missing user_id', 400);
    if (!$aliasEmail || !filter_var($aliasEmail, FILTER_VALIDATE_EMAIL)) {
        jsonError('alias_email ไม่ถูกต้อง', 400);
    }

    // Ensure user exists
    $check = $db->prepare('SELECT id FROM users WHERE id = ?');
    $check->execute([$userId]);
    if (!$check->fetch()) jsonError('ไม่พบผู้ใช้', 404);

    // Ensure alias is not already a primary email
    $checkPrimary = $db->prepare('SELECT id FROM users WHERE email = ?');
    $checkPrimary->execute([$aliasEmail]);
    if ($checkPrimary->fetch()) jsonError('อีเมลนี้ถูกใช้เป็นอีเมลหลักอยู่แล้ว', 400);

    // Ensure alias is unique
    $checkAlias = $db->prepare('SELECT id FROM user_email_aliases WHERE alias_email = ?');
    $checkAlias->execute([$aliasEmail]);
    if ($checkAlias->fetch()) jsonError('อีเมล Alias นี้ถูกใช้แล้ว', 400);

    $id = generateUUID();
    $stmt = $db->prepare('INSERT INTO user_email_aliases (id, user_id, alias_email, label, created_at) VALUES (?, ?, ?, ?, NOW())');
    $stmt->execute([$id, $userId, $aliasEmail, $label]);

    jsonResponse([
        'id'          => $id,
        'user_id'     => $userId,
        'alias_email' => $aliasEmail,
        'label'       => $label,
        'created_at'  => date('Y-m-d H:i:s'),
    ]);
}

// DELETE — remove alias
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id', 400);

    $stmt = $db->prepare('DELETE FROM user_email_aliases WHERE id = ?');
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) jsonError('ไม่พบ Alias', 404);

    jsonResponse(['deleted' => true]);
}

jsonError('Method not allowed', 405);
