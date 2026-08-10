<?php
// /api/inbox.php — Inbox messages CRUD
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db     = getDB();
$method = getMethod();

// ── GET ───────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $id = $_GET['id'] ?? null;
    
    if ($id) {
        // Get single message
        $stmt = $db->prepare("
            SELECT * FROM inbox_messages
            WHERE id = ? AND user_id = ? AND tenant_id = ?
        ");
        $stmt->execute([$id, $userId, $tenantId]);
        $msg = $stmt->fetch();
        if (!$msg) jsonError('ไม่พบข้อความ', 404);
        
        // Mark as read if unread
        if (!$msg['is_read']) {
            $upd = $db->prepare("UPDATE inbox_messages SET is_read = 1 WHERE id = ?");
            $upd->execute([$id]);
        }
        
        jsonResponse($msg);
    }
    
    // List messages with filters
    $where  = ['user_id = ?', 'tenant_id = ?'];
    $params = [$userId, $tenantId];
    
    if (!empty($_GET['type'])) {
        $where[] = 'type = ?';
        $params[] = $_GET['type'];
    }
    if (isset($_GET['is_read']) && $_GET['is_read'] !== '') {
        $where[] = 'is_read = ?';
        $params[] = (int)$_GET['is_read'];
    }
    if (!empty($_GET['priority'])) {
        $where[] = 'priority = ?';
        $params[] = $_GET['priority'];
    }
    
    $whereClause = implode(' AND ', $where);
    $stmt = $db->prepare("
        SELECT * FROM inbox_messages
        WHERE $whereClause
        ORDER BY created_at DESC
    ");
    $stmt->execute($params);
    $messages = $stmt->fetchAll();
    
    jsonResponse($messages);
}

// ── GET users list (for compose) ─────────────────────────────────────────
if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'users') {
    $stmt = $db->prepare("
        SELECT u.id, u.display_name, u.email, u.position
        FROM users u
        JOIN tenant_users tu ON tu.user_id = u.id AND tu.tenant_id = ?
        WHERE u.is_active = 1 AND u.id != ?
        ORDER BY u.display_name
    ");
    $stmt->execute([$tenantId, $userId]);
    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

// ── PUT mark-all-read ─────────────────────────────────────────────────────
if ($method === 'PUT' && isset($_GET['action']) && $_GET['action'] === 'read_all') {
    $stmt = $db->prepare("UPDATE inbox_messages SET is_read = 1 WHERE user_id = ? AND tenant_id = ?");
    $stmt->execute([$userId, $tenantId]);
    jsonResponse(['message' => 'ทำเครื่องหมายอ่านทั้งหมดสำเร็จ']);
}

// ── POST (compose & send to recipient) ───────────────────────────────────
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];

    // Compose mode: sender is current user, recipient is another user
    if (!empty($input['recipient_user_id'])) {
        if (empty($input['subject'])) jsonError('กรุณาระบุหัวข้อ', 400);

        // Get sender info
        $senderStmt = $db->prepare("SELECT display_name, email FROM users WHERE id = ?");
        $senderStmt->execute([$userId]);
        $sender = $senderStmt->fetch(PDO::FETCH_ASSOC);
        if (!$sender) jsonError('ไม่พบข้อมูลผู้ส่ง', 400);

        // Verify recipient is in same tenant
        $recStmt = $db->prepare("SELECT u.id FROM users u JOIN tenant_users tu ON tu.user_id = u.id AND tu.tenant_id = ? WHERE u.id = ? AND u.is_active = 1");
        $recStmt->execute([$tenantId, $input['recipient_user_id']]);
        if (!$recStmt->fetch()) jsonError('ไม่พบผู้รับ', 404);

        $id = generateUUID();
        $stmt = $db->prepare("
            INSERT INTO inbox_messages (id, tenant_id, user_id, sender_name, sender_email, subject, preview, type, priority, related_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'message', ?, ?, 'open')
        ");
        $stmt->execute([
            $id, $tenantId,
            $input['recipient_user_id'],
            $sender['display_name'],
            $sender['email'],
            $input['subject'],
            $input['preview'] ?? '',
            $input['priority'] ?? 'medium',
            $input['related_id'] ?? null,
        ]);
        jsonResponse(['id' => $id, 'message' => 'ส่งข้อความสำเร็จ']);
    }

    // System/internal create (legacy — requires explicit sender fields)
    if (empty($input['subject']) || empty($input['sender_name']) || empty($input['sender_email'])) {
        jsonError('กรุณาระบุข้อมูลให้ครบถ้วน', 400);
    }
    $id = $input['id'] ?? generateUUID();
    $stmt = $db->prepare("
        INSERT INTO inbox_messages (id, tenant_id, user_id, sender_name, sender_email, subject, preview, type, priority, related_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $id, $tenantId, $userId,
        $input['sender_name'], $input['sender_email'],
        $input['subject'], $input['preview'] ?? '',
        $input['type'] ?? 'message', $input['priority'] ?? 'medium',
        $input['related_id'] ?? null, $input['status'] ?? 'open',
    ]);
    jsonResponse(['id' => $id, 'message' => 'สร้างข้อความสำเร็จ']);
}

// ── PUT (mark as read/unread) ────────────────────────────────────────────
if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('ต้องระบุ ID', 400);
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (isset($input['is_read'])) {
        $stmt = $db->prepare("UPDATE inbox_messages SET is_read = ? WHERE id = ? AND user_id = ?");
        $stmt->execute([(int)$input['is_read'], $id, $userId]);
    }
    
    if (isset($input['is_starred'])) {
        $stmt = $db->prepare("UPDATE inbox_messages SET is_starred = ? WHERE id = ? AND user_id = ?");
        $stmt->execute([(int)$input['is_starred'], $id, $userId]);
    }
    
    jsonResponse(['message' => 'อัปเดตสำเร็จ']);
}

// ── DELETE ───────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('ต้องระบุ ID', 400);
    
    $stmt = $db->prepare("DELETE FROM inbox_messages WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $userId]);
    
    jsonResponse(['message' => 'ลบข้อความสำเร็จ']);
}

jsonError('วิธีการไม่ถูกต้อง', 405);
