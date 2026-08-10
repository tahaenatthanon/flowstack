<?php
// CRUD /api/project-members.php
// GET    - list members of a project (?project_id= required)
// POST   - add member to project
// DELETE - remove member from project (?id= required)
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
    $projectId = $_GET['project_id'] ?? null;
    if (!$projectId) jsonError('Missing project_id parameter', 400);

    // Check if user has access to this project
    if (!$isAdmin) {
        $stmt = $db->prepare('
            SELECT 1 FROM projects p
            LEFT JOIN project_members pm ON p.id = pm.project_id
            WHERE p.id = ? AND p.tenant_id = ? AND (p.user_id = ? OR pm.user_id = ?)
        ');
        $stmt->execute([$projectId, $tenantId, $userId, $userId]);
        if (!$stmt->fetch()) {
            jsonError('ไม่มีสิทธิ์เข้าถึงโครงการ', 403);
        }
    }

    $stmt = $db->prepare('
        SELECT pm.*, u.display_name, u.email, u.position
        FROM project_members pm
        INNER JOIN users u ON pm.user_id = u.id
        WHERE pm.project_id = ?
        ORDER BY pm.role DESC, u.display_name ASC
    ');
    $stmt->execute([$projectId]);
    jsonResponse($stmt->fetchAll());
}

// --- POST ---
if ($method === 'POST') {
    $body = getRequestBody();
    $projectId = $body['project_id'] ?? null;
    $memberUserId = $body['user_id'] ?? null;
    $role = $body['role'] ?? 'member';

    if (!$projectId || !$memberUserId) {
        jsonError('Missing project_id or user_id', 400);
    }

    // Check if user has access to this project
    if (!$isAdmin) {
        $stmt = $db->prepare('
            SELECT 1 FROM projects p
            LEFT JOIN project_members pm ON p.id = pm.project_id
            WHERE p.id = ? AND p.tenant_id = ? AND (p.user_id = ? OR pm.user_id = ?)
        ');
        $stmt->execute([$projectId, $tenantId, $userId, $userId]);
        if (!$stmt->fetch()) {
            jsonError('ไม่มีสิทธิ์เพิ่มสมาชิกโครงการ', 403);
        }
    }

    // Check if user exists
    $stmt = $db->prepare('SELECT id FROM users WHERE id = ?');
    $stmt->execute([$memberUserId]);
    if (!$stmt->fetch()) {
        jsonError('ไม่พบผู้ใช้', 404);
    }

    // Check if already a member
    $stmt = $db->prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?');
    $stmt->execute([$projectId, $memberUserId]);
    if ($stmt->fetch()) {
        jsonError('ผู้ใช้นี้เป็นสมาชิกโครงการอยู่แล้ว', 400);
    }

    $stmt = $db->prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)');
    $stmt->execute([$projectId, $memberUserId, $role]);

    // Return the new member
    $stmt = $db->prepare('
        SELECT pm.*, u.display_name, u.email, u.position
        FROM project_members pm
        INNER JOIN users u ON pm.user_id = u.id
        WHERE pm.project_id = ? AND pm.user_id = ?
    ');
    $stmt->execute([$projectId, $memberUserId]);
    jsonResponse($stmt->fetch(), 201);
}

// --- DELETE ---
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id parameter', 400);

    // Get member info — verify project belongs to tenant (prevents IDOR)
    $stmt = $db->prepare('
        SELECT pm.* FROM project_members pm
        JOIN projects p ON pm.project_id = p.id
        WHERE pm.id = ? AND p.tenant_id = ?
    ');
    $stmt->execute([$id, $tenantId]);
    $member = $stmt->fetch();
    if (!$member) {
        jsonError('ไม่พบสมาชิกโครงการ', 404);
    }

    // Get project owner (already tenant-scoped via JOIN above)
    $stmt = $db->prepare('SELECT user_id FROM projects WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$member['project_id'], $tenantId]);
    $project = $stmt->fetch();

    // Check if user is project owner or admin
    if (!$isAdmin && $project['user_id'] !== $userId) {
        jsonError('ไม่มีสิทธิ์ลบสมาชิกโครงการ - ต้องเป็นเจ้าของโครงการหรือผู้ดูแลระบบ', 403);
    }

    $stmt = $db->prepare('DELETE FROM project_members WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse(['deleted' => true]);
}

jsonError('Method not allowed', 405);
