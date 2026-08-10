<?php
// CRUD /api/opportunity-members.php
// GET    - list members of an opportunity (?opportunity_id=)
// POST   - add member to opportunity
// DELETE - remove member from opportunity (?id=)
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db = getDB();
$method = getMethod();

// Check if user is admin
$isAdmin = isTenantAdmin($db, $userId, $tenantId);

// --- GET ---
if ($method === 'GET') {
    $opportunityId = $_GET['opportunity_id'] ?? null;
    if (!$opportunityId) jsonError('Missing opportunity_id parameter', 400);

    // Check if user has access to this opportunity
    if (!$isAdmin) {
        $stmt = $db->prepare('
            SELECT 1 FROM sales_opportunities o
            LEFT JOIN opportunity_members om ON o.id = om.opportunity_id
            WHERE o.id = ? AND o.tenant_id = ? AND (o.assigned_to = ? OR om.user_id = ?)
        ');
        $stmt->execute([$opportunityId, $tenantId, $userId, $userId]);
        if (!$stmt->fetch()) {
            jsonError('ไม่มีสิทธิ์เข้าถึงโอกาสการขาย', 403);
        }
    }

    $stmt = $db->prepare('
        SELECT om.*, u.display_name, u.email, u.position
        FROM opportunity_members om
        INNER JOIN users u ON om.user_id = u.id
        WHERE om.opportunity_id = ?
        ORDER BY om.role DESC, u.display_name ASC
    ');
    $stmt->execute([$opportunityId]);
    jsonResponse($stmt->fetchAll());
}

// --- POST ---
if ($method === 'POST') {
    $body = getRequestBody();
    $opportunityId = $body['opportunity_id'] ?? null;
    $memberUserId = $body['user_id'] ?? null;
    $role = $body['role'] ?? 'member';

    if (!$opportunityId || !$memberUserId) {
        jsonError('Missing opportunity_id or user_id', 400);
    }

    // Check if user has access to this opportunity
    if (!$isAdmin) {
        $stmt = $db->prepare('
            SELECT 1 FROM sales_opportunities o
            LEFT JOIN opportunity_members om ON o.id = om.opportunity_id
            WHERE o.id = ? AND o.tenant_id = ? AND (o.assigned_to = ? OR om.user_id = ?)
        ');
        $stmt->execute([$opportunityId, $tenantId, $userId, $userId]);
        if (!$stmt->fetch()) {
            jsonError('ไม่มีสิทธิ์เพิ่มสมาชิกโอกาสการขาย', 403);
        }
    }

    // Check if user exists
    $stmt = $db->prepare('SELECT id FROM users WHERE id = ?');
    $stmt->execute([$memberUserId]);
    if (!$stmt->fetch()) {
        jsonError('ไม่พบผู้ใช้', 404);
    }

    // Check if already a member
    $stmt = $db->prepare('SELECT id FROM opportunity_members WHERE opportunity_id = ? AND user_id = ?');
    $stmt->execute([$opportunityId, $memberUserId]);
    if ($stmt->fetch()) {
        jsonError('ผู้ใช้นี้เป็นสมาชิกอยู่แล้ว', 400);
    }

    $id = generateUUID();
    $stmt = $db->prepare('INSERT INTO opportunity_members (id, opportunity_id, user_id, role) VALUES (?, ?, ?, ?)');
    $stmt->execute([$id, $opportunityId, $memberUserId, $role]);

    $stmt = $db->prepare('SELECT * FROM opportunity_members WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch(), 201);
}

// --- DELETE ---
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id parameter', 400);

    // Get member info — verify opportunity belongs to tenant (prevents IDOR)
    $stmt = $db->prepare('
        SELECT om.* FROM opportunity_members om
        JOIN sales_opportunities so ON om.opportunity_id = so.id
        WHERE om.id = ? AND so.tenant_id = ?
    ');
    $stmt->execute([$id, $tenantId]);
    $member = $stmt->fetch();
    if (!$member) {
        jsonError('ไม่พบสมาชิกโอกาสการขาย', 404);
    }

    // Get opportunity owner/assigned user
    $stmt = $db->prepare('SELECT assigned_to FROM sales_opportunities WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$member['opportunity_id'], $tenantId]);
    $opportunity = $stmt->fetch();

    // Check if user is opportunity owner/assigned user or admin
    if (!$isAdmin && $opportunity['assigned_to'] !== $userId) {
        jsonError('ไม่มีสิทธิ์ลบสมาชิกโอกาสการขาย - ต้องเป็นผู้รับผิดชอบหรือผู้ดูแลระบบ', 403);
    }

    $stmt = $db->prepare('DELETE FROM opportunity_members WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse(['deleted' => true]);
}

jsonError('Method not allowed', 405);
