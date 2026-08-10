<?php
/**
 * AI Proactive Notifications
 * GET  ?unread=1   → unread notifications for current user
 * POST ?action=read&id=UUID  → mark as read
 * POST ?action=read_all      → mark all as read
 */
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId   = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db       = getDB();
$method   = getMethod();

if ($method === 'GET') {
    $onlyUnread = ($_GET['unread'] ?? '0') === '1';
    $sql = "SELECT id, type, title, body, action_label, action_data, created_at
            FROM ai_notifications
            WHERE tenant_id = ? AND user_id = ? AND deleted_at IS NULL"
         . ($onlyUnread ? " AND read_at IS NULL" : "")
         . " ORDER BY created_at DESC LIMIT 20";
    $stmt = $db->prepare($sql);
    $stmt->execute([$tenantId, $userId]);
    jsonResponse($stmt->fetchAll());
}

if ($method === 'POST') {
    $action = $_GET['action'] ?? '';
    if ($action === 'read_all') {
        $db->prepare("UPDATE ai_notifications SET read_at = NOW() WHERE tenant_id = ? AND user_id = ? AND read_at IS NULL")
           ->execute([$tenantId, $userId]);
        jsonResponse(['cleared' => true]);
    }
    if ($action === 'read') {
        $id = $_GET['id'] ?? '';
        if (!$id) jsonError('Missing id');
        $db->prepare("UPDATE ai_notifications SET read_at = NOW() WHERE id = ? AND tenant_id = ? AND user_id = ?")
           ->execute([$id, $tenantId, $userId]);
        jsonResponse(['ok' => true]);
    }
    jsonError('Unknown action');
}

jsonError('Method not allowed', 405);
