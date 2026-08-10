<?php
require_once __DIR__ . '/auth.php';
$tokenData = requireAuth();
$db = getDB();
$tenantId = $tokenData['tenant_id'];
$stmt = $db->prepare("
    SELECT t.title, 
           (SELECT COUNT(*) FROM tasks sc WHERE sc.parent_task_id = t.id AND sc.deleted_at IS NULL) AS subtask_count
    FROM tasks t
    WHERE t.tenant_id = ? AND t.deleted_at IS NULL AND t.parent_task_id IS NULL
    HAVING subtask_count = 1
    LIMIT 3
");
$stmt->execute([$tenantId]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
header('Content-Type: application/json');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);
