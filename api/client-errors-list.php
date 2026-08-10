<?php
// GET  /api/client-errors-list.php?hours=24  — list recent frontend crash logs (admin only)
// DELETE /api/client-errors-list.php          — purge all rows older than now (admin only)

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId    = $tokenData['user_id'];
$tenantId  = $tokenData['tenant_id'];
$db        = getDB();

// Admin only
if (!isTenantAdmin($db, $userId, $tenantId)) {
    jsonError('Admin only', 403);
}

$method = getMethod();

if ($method === 'GET') {
    $hours = max(1, min(720, (int)($_GET['hours'] ?? 24)));

    $stmt = $db->prepare("
        SELECT id, section, message, stack, component_stack,
               user_id, ip_address, created_at
        FROM client_errors
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
          AND (tenant_id = ? OR tenant_id IS NULL)
        ORDER BY created_at DESC
        LIMIT 200
    ");
    $stmt->execute([$hours, $tenantId]);
    $rows = $stmt->fetchAll();

    $countStmt = $db->prepare("
        SELECT COUNT(*) FROM client_errors
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
          AND (tenant_id = ? OR tenant_id IS NULL)
    ");
    $countStmt->execute([$hours, $tenantId]);
    $total = (int)$countStmt->fetchColumn();

    jsonResponse(['total' => $total, 'errors' => $rows]);
}

if ($method === 'DELETE') {
    $db->prepare("DELETE FROM client_errors WHERE tenant_id = ? OR tenant_id IS NULL")
       ->execute([$tenantId]);
    jsonResponse(['ok' => true]);
}

jsonError('Method not allowed', 405);
