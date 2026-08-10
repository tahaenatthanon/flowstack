<?php
// /api/support-library.php — Support manual / handbook library (คู่มือ).
// Read-only listing migrated from Domino AttachFile docs.
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$tenantId  = $tokenData['tenant_id'];
$db        = getDB();
$method    = getMethod();

if ($method !== 'GET') jsonError('Method not allowed', 405);

$where  = ['l.tenant_id = ?'];
$params = [$tenantId];

if (!empty($_GET['search'])) {
    $q = '%' . $_GET['search'] . '%';
    $where[] = '(l.subject LIKE ? OR l.company LIKE ? OR l.cn LIKE ? OR l.file_name LIKE ?)';
    $params  = array_merge($params, [$q, $q, $q, $q]);
}
if (!empty($_GET['company_id'])) {
    $where[] = 'l.company_id = ?';
    $params[] = $_GET['company_id'];
}

$stmt = $db->prepare("
    SELECT l.*, c.name AS company_name
    FROM support_library l
    LEFT JOIN companies c ON l.company_id = c.id
    WHERE " . implode(' AND ', $where) . "
    ORDER BY COALESCE(l.doc_date, l.created_at) DESC, l.subject ASC
");
$stmt->execute($params);
jsonResponse($stmt->fetchAll());
