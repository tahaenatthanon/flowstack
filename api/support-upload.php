<?php
// /api/support-upload.php — File upload for tickets & contracts
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId   = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db       = getDB();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed', 405);

$ticketId   = $_POST['ticket_id']   ?? null;
$contractId = $_POST['contract_id'] ?? null;
$folder     = $_POST['folder']     ?? null; // general-purpose: product_ref, etc.

if (!$ticketId && !$contractId && !$folder) jsonError('ticket_id, contract_id หรือ folder จำเป็น');

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    jsonError('ไม่พบไฟล์หรืออัปโหลดล้มเหลว');
}

$file     = $_FILES['file'];
$maxSize  = 20 * 1024 * 1024; // 20 MB
$allowed  = [
    'image/jpeg','image/png','image/gif','image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain','text/csv',
    'application/zip','application/x-rar-compressed',
];

if ($file['size'] > $maxSize) jsonError('ไฟล์ใหญ่เกิน 20MB');

$mime = mime_content_type($file['tmp_name']);
if (!in_array($mime, $allowed)) jsonError("ไฟล์ประเภท $mime ไม่รองรับ");

// Safe filename
$ext      = pathinfo($file['name'], PATHINFO_EXTENSION);
$safeName = preg_replace('/[^a-zA-Z0-9._-]/', '_', pathinfo($file['name'], PATHINFO_FILENAME));
$stored   = uniqid() . '_' . $safeName . '.' . strtolower($ext);

// General-purpose folder upload (e.g., product_ref)
if ($folder) {
    $dir  = __DIR__ . '/../uploads/' . preg_replace('/[^a-zA-Z0-9_-]/', '', $folder) . '/';
    $path = $dir . $stored;
    if (!is_dir($dir)) mkdir($dir, 0777, true);
    if (!move_uploaded_file($file['tmp_name'], $path)) {
        jsonError('บันทึกไฟล์ล้มเหลว');
    }
    jsonResponse(['url' => '/uploads/' . $folder . '/' . $stored, 'file' => $stored]);
}

// Verify ticket/contract belongs to this tenant before accepting upload
if ($ticketId) {
    $ownerCheck = $db->prepare('SELECT id FROM support_tickets WHERE id = ? AND tenant_id = ?');
    $ownerCheck->execute([$ticketId, $tenantId]);
    if (!$ownerCheck->fetch()) jsonError('Forbidden', 403);
}
if ($contractId) {
    $ownerCheck = $db->prepare('SELECT id FROM support_contracts WHERE id = ? AND tenant_id = ?');
    $ownerCheck->execute([$contractId, $tenantId]);
    if (!$ownerCheck->fetch()) jsonError('Forbidden', 403);
}

// Support ticket/contract attachment
$dir      = __DIR__ . '/../uploads/support/';
$path     = $dir . $stored;

if (!move_uploaded_file($file['tmp_name'], $path)) {
    jsonError('บันทึกไฟล์ล้มเหลว');
}

$id = generateUUID();
$db->prepare("
    INSERT INTO support_attachments (id, ticket_id, contract_id, file_name, file_path, file_size, mime_type, uploaded_by)
    VALUES (?,?,?,?,?,?,?,?)
")->execute([
    $id,
    $ticketId,
    $contractId,
    $file['name'],
    'uploads/support/' . $stored,
    $file['size'],
    $mime,
    $userId,
]);

jsonResponse([
    'id'        => $id,
    'file_name' => $file['name'],
    'file_path' => 'uploads/support/' . $stored,
    'file_size' => $file['size'],
    'mime_type' => $mime,
]);
