<?php
// POST /api/upload.php
// Multipart/form-data field: "avatar"
// Uploads avatar for the authenticated user.
// Returns: { avatar_url: "..." }
require_once __DIR__ . '/auth.php';

if (getMethod() !== 'POST') {
    jsonError('Method not allowed', 405);
}

$tokenData = requireAuth();
$userId = $tokenData['user_id'];
$db = getDB();

if (!isset($_FILES['avatar'])) {
    jsonError('ไม่พบไฟล์รูปภาพ', 400);
}

$file = $_FILES['avatar'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    jsonError('อัปโหลดไฟล์ล้มเหลว: ' . $file['error'], 400);
}

// Validate size: max 2MB
if ($file['size'] > 2 * 1024 * 1024) {
    jsonError('ไฟล์มีขนาดเกิน 2MB', 400);
}

// Validate MIME type
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($file['tmp_name']);
$allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
if (!in_array($mimeType, $allowed)) {
    jsonError('รองรับเฉพาะไฟล์ภาพ (JPEG, PNG, GIF, WebP)', 400);
}

$extMap = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/gif'  => 'gif',
    'image/webp' => 'webp',
];
$ext = $extMap[$mimeType];

// Delete existing avatar files for this user (any extension)
$uploadsDir = __DIR__ . '/uploads/avatars/';
foreach (glob($uploadsDir . $userId . '_*') as $oldFile) {
    @unlink($oldFile);
}

// Save new file
$filename = $userId . '_' . time() . '.' . $ext;
$destPath = $uploadsDir . $filename;

if (!move_uploaded_file($file['tmp_name'], $destPath)) {
    jsonError('ไม่สามารถบันทึกไฟล์ได้', 500);
}

// Store relative path in DB so it works across any hostname (dev/staging/production)
$avatarRelPath = '/flowstack/api/uploads/avatars/' . $filename;

// Update database with relative path (no hardcoded hostname)
$stmt = $db->prepare('UPDATE users SET avatar_url = ? WHERE id = ?');
$stmt->execute([$avatarRelPath, $userId]);

// Return full URL for immediate use in the response (using current request host)
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'];
jsonResponse(['avatar_url' => $protocol . '://' . $host . $avatarRelPath]);
