<?php
require_once __DIR__ . '/../auth.php';
$user     = requireAuth();
$db       = getDB();
$method   = getMethod();
$tenantId = $user['tenant_id'];

if ($method === 'GET') {
    $stmt = $db->prepare("
        SELECT i.*,
               (SELECT p.status FROM payments p WHERE p.invoice_id = i.id ORDER BY p.submitted_at DESC LIMIT 1) AS last_payment_status,
               (SELECT p.id FROM payments p WHERE p.invoice_id = i.id AND p.status='pending' LIMIT 1) AS pending_payment_id
        FROM invoices i
        WHERE i.tenant_id = ?
        ORDER BY i.created_at DESC
    ");
    $stmt->execute([$tenantId]);
    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

if ($method === 'POST') {
    $body  = getRequestBody();
    $plan  = $body['plan'] ?? null;
    if (!$plan) jsonError('plan ไม่ถูกต้อง', 400);

    // Validate plan exists in plan_limits (supports dynamic plans, not hardcoded enum)
    $priceStmt = $db->prepare('SELECT price_thb FROM plan_limits WHERE plan = ? AND is_active = 1');
    $priceStmt->execute([$plan]);
    $priceRow = $priceStmt->fetch(PDO::FETCH_ASSOC);
    if (!$priceRow) jsonError('plan ไม่ถูกต้อง', 400);
    $price = (float)$priceRow['price_thb'];

    $invoiceId = generateUUID();
    $db->prepare("
        INSERT INTO invoices (id, tenant_id, plan, amount, due_date, status)
        VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY), 'pending')
    ")->execute([$invoiceId, $tenantId, $plan, $price]);

    $stmt = $db->prepare('SELECT * FROM invoices WHERE id = ?');
    $stmt->execute([$invoiceId]);
    jsonResponse($stmt->fetch(PDO::FETCH_ASSOC), 201);
}

jsonError('Method not allowed', 405);
