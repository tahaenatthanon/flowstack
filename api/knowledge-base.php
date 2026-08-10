<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

$db     = getDB();
$method = getMethod();
$auth   = requireAuth();
$userId = $auth['user_id'];
$tenantId = $auth['tenant_id'];

if ($method === 'GET') {
    $id = $_GET['id'] ?? null;
    if ($id) {
        $stmt = $db->prepare('SELECT * FROM knowledge_base WHERE id = ? AND tenant_id = ?');
        $stmt->execute([$id, $tenantId]);
        $row = $stmt->fetch();
        if (!$row) jsonError('ไม่พบบทความ', 404);
        // increment views
        $db->prepare('UPDATE knowledge_base SET views = views + 1 WHERE id = ?')->execute([$id]);
        jsonResponse($row);
    }
    $search   = $_GET['search']   ?? '';
    $category = $_GET['category'] ?? '';
    $sql = 'SELECT id, title, category, views, is_starred, created_by, created_at, updated_at FROM knowledge_base WHERE tenant_id = ?';
    $params = [$tenantId];
    if ($search) { $sql .= ' AND (title LIKE ? OR content LIKE ?)'; $like = "%$search%"; $params[] = $like; $params[] = $like; }
    if ($category && $category !== 'ทั้งหมด') { $sql .= ' AND category = ?'; $params[] = $category; }
    $sql .= ' ORDER BY is_starred DESC, views DESC';
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

if ($method === 'POST') {
    $body = getRequestBody();
    if (empty($body['title'])) jsonError('กรุณาระบุชื่อบทความ');
    $id = generateUUID();
    $db->prepare('INSERT INTO knowledge_base (id, tenant_id, title, content, category, is_starred, created_by) VALUES (?,?,?,?,?,?,?)')
       ->execute([$id, $tenantId, $body['title'], $body['content'] ?? '', $body['category'] ?? 'ทั่วไป', $body['is_starred'] ?? 0, $userId]);
    $stmt = $db->prepare('SELECT * FROM knowledge_base WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch(), 201);
}

if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id');
    $body    = getRequestBody();
    $allowed = ['title','content','category','is_starred'];
    $fields  = []; $values = [];
    foreach ($allowed as $f) { if (array_key_exists($f, $body)) { $fields[] = "`$f` = ?"; $values[] = $body[$f]; } }
    if (empty($fields)) jsonError('ไม่มีข้อมูลที่จะอัปเดต');
    $values[] = $id; $values[] = $tenantId;
    $db->prepare('UPDATE knowledge_base SET ' . implode(', ', $fields) . ' WHERE id = ? AND tenant_id = ?')->execute($values);
    $stmt = $db->prepare('SELECT * FROM knowledge_base WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch());
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id');
    $db->prepare('DELETE FROM knowledge_base WHERE id = ? AND tenant_id = ?')->execute([$id, $tenantId]);
    jsonResponse(['deleted' => true]);
}

jsonError('Method not allowed', 405);
