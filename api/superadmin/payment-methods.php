<?php
require_once __DIR__ . '/../auth.php';
requireSuperAdmin();
$db     = getDB();
$method = getMethod();

if ($method === 'GET') {
    $stmt = $db->query('SELECT * FROM payment_methods_config ORDER BY sort_order');
    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

if ($method === 'PUT') {
    $body = getRequestBody();
    $id   = (int)($body['id'] ?? 0);
    if (!$id) jsonError('id required', 400);

    $updates = []; $params = [];
    $allowed = ['label', 'account_name', 'account_number', 'qr_image_url', 'is_active', 'sort_order'];
    foreach ($allowed as $field) {
        if (array_key_exists($field, $body)) {
            $updates[] = "$field = ?";
            $params[]  = $field === 'is_active' || $field === 'sort_order' ? (int)$body[$field] : $body[$field];
        }
    }
    if (empty($updates)) jsonError('Nothing to update', 400);
    $params[] = $id;
    $db->prepare('UPDATE payment_methods_config SET ' . implode(', ', $updates) . ' WHERE id = ?')->execute($params);
    $stmt = $db->prepare('SELECT * FROM payment_methods_config WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch(PDO::FETCH_ASSOC));
}

if ($method === 'POST') {
    $body   = getRequestBody();
    $mtype  = in_array($body['method'] ?? '', ['qr','bank_transfer']) ? $body['method'] : 'bank_transfer';
    $label  = trim($body['label'] ?? '');
    if (!$label) jsonError('label required', 400);
    $sortOrder = (int)$db->query('SELECT COALESCE(MAX(sort_order),0)+1 FROM payment_methods_config')->fetchColumn();
    $stmt = $db->prepare('INSERT INTO payment_methods_config (method, label, account_name, account_number, qr_image_url, is_active, sort_order) VALUES (?, ?, ?, ?, ?, 1, ?)');
    $stmt->execute([$mtype, $label, $body['account_name'] ?? null, $body['account_number'] ?? null, $body['qr_image_url'] ?? null, $sortOrder]);
    $newId = (int)$db->lastInsertId();
    $stmt  = $db->prepare('SELECT * FROM payment_methods_config WHERE id = ?');
    $stmt->execute([$newId]);
    jsonResponse($stmt->fetch(PDO::FETCH_ASSOC), 201);
}

if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) jsonError('id required', 400);
    $db->prepare('DELETE FROM payment_methods_config WHERE id = ?')->execute([$id]);
    jsonResponse(['ok' => true]);
}

jsonError('Method not allowed', 405);
