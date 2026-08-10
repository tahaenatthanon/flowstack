<?php
require_once __DIR__ . '/../auth.php';
$user     = requireAuth();
$db       = getDB();
$tenantId = $user['tenant_id'];

if (getMethod() !== 'POST') jsonError('Method not allowed', 405);

$body      = getRequestBody();
$invoiceId = $body['invoice_id'] ?? null;
$method    = $body['method']     ?? null;
$slipUrl   = $body['slip_url']   ?? null;
$note      = $body['note']       ?? null;

if (!$invoiceId || !$method) jsonError('invoice_id and method required', 400);
if (!in_array($method, ['qr', 'bank_transfer'], true)) jsonError('method ไม่ถูกต้อง', 400);

$invStmt = $db->prepare('SELECT id, amount FROM invoices WHERE id = ? AND tenant_id = ?');
$invStmt->execute([$invoiceId, $tenantId]);
$invoice = $invStmt->fetch(PDO::FETCH_ASSOC);
if (!$invoice) jsonError('ไม่พบ invoice', 404);

$existStmt = $db->prepare("SELECT id FROM payments WHERE invoice_id = ? AND status = 'pending'");
$existStmt->execute([$invoiceId]);
if ($existStmt->fetch()) jsonError('มีการชำระเงินที่รอการยืนยันอยู่แล้ว', 400);

$payId = generateUUID();
$db->prepare("
    INSERT INTO payments (id, invoice_id, method, amount, slip_url, note, status, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())
")->execute([$payId, $invoiceId, $method, $invoice['amount'], $slipUrl, $note]);

jsonResponse(['id' => $payId, 'status' => 'pending'], 201);
