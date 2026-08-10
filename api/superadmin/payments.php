<?php
require_once __DIR__ . '/../auth.php';
$superAdmin = requireSuperAdmin();
$db     = getDB();
$method = getMethod();
$action = $_GET['action'] ?? null;

if ($method === 'GET') {
    $status = $_GET['status'] ?? null; // null = all
    $sql = "
        SELECT p.id, p.invoice_id, p.method, p.amount, p.slip_url,
               p.status, p.submitted_at, p.verified_at, p.note,
               i.plan, i.due_date,
               t.name AS tenant_name, t.id AS tenant_id
        FROM payments p
        JOIN invoices i ON i.id = p.invoice_id
        JOIN tenants t ON t.id = i.tenant_id
    ";
    $params = [];
    if ($status) {
        $sql .= ' WHERE p.status = ?';
        $params[] = $status;
    }
    $sql .= ' ORDER BY p.submitted_at DESC LIMIT 100';
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

if ($method === 'POST' && $action === 'approve') {
    $body      = getRequestBody();
    $paymentId = $body['payment_id'] ?? null;
    if (!$paymentId) jsonError('payment_id required', 400);

    $payStmt = $db->prepare('SELECT p.*, i.tenant_id, i.plan FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE p.id = ?');
    $payStmt->execute([$paymentId]);
    $payment = $payStmt->fetch(PDO::FETCH_ASSOC);
    if (!$payment) jsonError('Payment not found', 404);

    $db->beginTransaction();
    try {
        $db->prepare("UPDATE payments SET status='approved', verified_at=NOW(), verified_by=? WHERE id=?")
           ->execute([$superAdmin['user_id'], $paymentId]);
        $db->prepare("UPDATE invoices SET status='paid', updated_at=NOW() WHERE id=?")
           ->execute([$payment['invoice_id']]);
        $db->prepare("
            UPDATE subscriptions
            SET plan=?, status='active',
                expires_at = DATE_ADD(GREATEST(COALESCE(expires_at, NOW()), NOW()), INTERVAL 1 MONTH)
            WHERE tenant_id=?
        ")->execute([$payment['plan'], $payment['tenant_id']]);
        $db->prepare("UPDATE tenants SET plan=?, status='active' WHERE id=?")
           ->execute([$payment['plan'], $payment['tenant_id']]);
        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('approve failed: ' . $e->getMessage(), 500);
    }
    jsonResponse(['ok' => true]);
}

if ($method === 'POST' && $action === 'reject') {
    $body      = getRequestBody();
    $paymentId = $body['payment_id'] ?? null;
    $note      = trim($body['note'] ?? 'ปฏิเสธโดย superadmin');
    if (!$paymentId) jsonError('payment_id required', 400);
    $db->prepare("UPDATE payments SET status='rejected', verified_at=NOW(), verified_by=?, note=? WHERE id=?")
       ->execute([$superAdmin['user_id'], $note, $paymentId]);
    jsonResponse(['ok' => true]);
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('id required', 400);
    $stmt = $db->prepare('SELECT status FROM payments WHERE id = ?');
    $stmt->execute([$id]);
    $pay = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$pay) jsonError('ไม่พบรายการ', 404);
    if ($pay['status'] === 'approved') jsonError('ไม่สามารถลบรายการที่อนุมัติแล้ว', 400);
    $db->prepare('DELETE FROM payments WHERE id = ?')->execute([$id]);
    jsonResponse(['ok' => true]);
}

jsonError('Method not allowed', 405);
