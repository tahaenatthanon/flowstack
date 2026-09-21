<?php
// api/products.php
// CRUD สำหรับ product catalog — ใช้เป็นข้อมูลสินค้าตอน AI generate เนื้อหาแคมเปญ
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

$db       = getDB();
$auth     = requireAuth();
$userId   = $auth['user_id'];
$tenantId = $auth['tenant_id'];
$method   = getMethod();

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($method === 'GET') {
    $stmt = $db->prepare("SELECT * FROM products WHERE tenant_id=? ORDER BY status ASC, name ASC");
    $stmt->execute([$tenantId]);
    jsonResponse($stmt->fetchAll());
}

if ($method === 'POST') {
    $body = getRequestBody();
    $name = trim($body['name'] ?? '');
    if ($name === '') jsonError('กรุณาระบุชื่อสินค้า');

    $id = generateUUID();
    $db->prepare(
        'INSERT INTO products (id, tenant_id, name, description, usp, price, image_url, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $id, $tenantId, $name,
        $body['description'] ?? null,
        $body['usp'] ?? null,
        ($body['price'] ?? '') !== '' ? $body['price'] : null,
        $body['image_url'] ?? null,
        $body['status'] ?? 'active',
        $userId,
    ]);

    $stmt = $db->prepare('SELECT * FROM products WHERE id=? AND tenant_id=?');
    $stmt->execute([$id, $tenantId]);
    jsonResponse($stmt->fetch(), 201);
}

if ($method === 'PUT') {
    $id = $_GET['id'] ?? '';
    if (!$id) jsonError('Missing id');

    $check = $db->prepare('SELECT id FROM products WHERE id=? AND tenant_id=?');
    $check->execute([$id, $tenantId]);
    if (!$check->fetch()) jsonError('Product not found', 404);

    $body = getRequestBody();
    $name = trim($body['name'] ?? '');
    if ($name === '') jsonError('กรุณาระบุชื่อสินค้า');

    $db->prepare(
        'UPDATE products SET name=?, description=?, usp=?, price=?, image_url=?, status=?, updated_at=NOW()
         WHERE id=? AND tenant_id=?'
    )->execute([
        $name,
        $body['description'] ?? null,
        $body['usp'] ?? null,
        ($body['price'] ?? '') !== '' ? $body['price'] : null,
        $body['image_url'] ?? null,
        $body['status'] ?? 'active',
        $id, $tenantId,
    ]);

    $stmt = $db->prepare('SELECT * FROM products WHERE id=? AND tenant_id=?');
    $stmt->execute([$id, $tenantId]);
    jsonResponse($stmt->fetch());
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? '';
    if (!$id) jsonError('Missing id');

    // email_campaigns.product_id ไม่มี FK constraint (ดู migration) จึงลบ product ได้โดยไม่กระทบ
    // แคมเปญที่เคยอ้างถึง — แคมเปญเดิมยังอ่าน/แก้ไข/ส่งได้ปกติ เพียงแค่ product_id จะกลายเป็นค่าที่ไม่มีอยู่จริงแล้ว
    $db->prepare('DELETE FROM products WHERE id=? AND tenant_id=?')->execute([$id, $tenantId]);
    jsonResponse(['deleted' => true]);
}

jsonError('Method not allowed', 405);
