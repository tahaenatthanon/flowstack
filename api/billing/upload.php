<?php
require_once __DIR__ . '/../auth.php';
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed', 405);
if (!isset($_FILES['slip']) || $_FILES['slip']['error'] !== UPLOAD_ERR_OK) jsonError('ไม่พบไฟล์', 400);

$file    = $_FILES['slip'];
$allowed = ['image/jpeg','image/png','image/webp','image/gif','application/pdf'];
$mime    = mime_content_type($file['tmp_name']);
if (!in_array($mime, $allowed)) jsonError("ไฟล์ประเภท $mime ไม่รองรับ", 400);
if ($file['size'] > 5 * 1024 * 1024) jsonError('ไฟล์ต้องไม่เกิน 5MB', 400);

$ext    = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$stored = uniqid('slip_') . '.' . $ext;
$dir    = __DIR__ . '/../../uploads/billing/';
if (!is_dir($dir)) mkdir($dir, 0777, true);

if (!move_uploaded_file($file['tmp_name'], $dir . $stored)) jsonError('บันทึกไฟล์ล้มเหลว', 500);

jsonResponse(['url' => '/uploads/billing/' . $stored]);
