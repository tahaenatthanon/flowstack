<?php
/**
 * Batch Task Update API
 * POST body: { ids: string[], updates: { status?, priority?, assignee?, end_date? } }
 */
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId   = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db       = getDB();
$method   = getMethod();

if ($method !== 'POST') jsonError('Method not allowed', 405);

$isAdmin = isTenantAdmin($db, $userId, $tenantId);

$body    = getRequestBody();
$ids     = $body['ids'] ?? [];
$updates = $body['updates'] ?? [];

if (empty($ids) || !is_array($ids)) jsonError('ids array is required');
if (empty($updates) || !is_array($updates)) jsonError('updates object is required');
if (count($ids) > 100) jsonError('ไม่สามารถอัปเดตเกิน 100 รายการพร้อมกัน');

$allowed = ['status', 'priority', 'assignee', 'end_date', 'task_type', 'assignee_user_id'];
$fields  = [];
$values  = [];

foreach ($updates as $k => $v) {
    if (!in_array($k, $allowed)) continue;
    $fields[] = "`$k` = ?";
    $values[] = $v;
}

if (empty($fields)) jsonError('No valid fields to update');

$fields[] = 'updated_at = NOW()';

// Build WHERE for ids (only tasks belonging to tenant, non-deleted)
$placeholders = implode(',', array_fill(0, count($ids), '?'));
$where        = "tenant_id = ? AND id IN ($placeholders) AND deleted_at IS NULL";
if (!$isAdmin) {
    $where   .= " AND (user_id = ? OR assignee_user_id = ?)";
}

$sql    = "UPDATE tasks SET " . implode(', ', $fields) . " WHERE $where";
$params = array_merge($values, [$tenantId], $ids);
if (!$isAdmin) $params = array_merge($params, [$userId, $userId]);

$stmt = $db->prepare($sql);
$stmt->execute($params);
$affected = $stmt->rowCount();

jsonResponse(['updated' => $affected, 'total' => count($ids)]);
