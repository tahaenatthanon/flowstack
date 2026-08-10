<?php
// /api/sales-activities.php
// CRUD for sales opportunity activities
// GET    - list activities (?opportunity_id= required)
// POST   - create activity
// DELETE - delete activity (?id= required)
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db = getDB();
$method = getMethod();

// Check if user is admin (tenant-scoped)
$isAdmin = isTenantAdmin($db, $userId, $tenantId);

// Helper: verify user can access an opportunity
function canAccessOpportunity(PDO $db, string $opportunityId, string $userId, string $tenantId, bool $isAdmin): bool {
    if ($isAdmin) return true;
    $stmt = $db->prepare('
        SELECT 1 FROM sales_opportunities o
        LEFT JOIN opportunity_members om ON o.id = om.opportunity_id
        WHERE o.id = ? AND o.tenant_id = ? AND (o.assigned_to = ? OR om.user_id = ?)
    ');
    $stmt->execute([$opportunityId, $tenantId, $userId, $userId]);
    return (bool)$stmt->fetch();
}

// --- GET ---
if ($method === 'GET') {
    $opportunityId = $_GET['opportunity_id'] ?? null;

    if ($opportunityId) {
        // Single opportunity — check access
        if (!canAccessOpportunity($db, $opportunityId, $userId, $tenantId, $isAdmin)) {
            jsonError('ไม่มีสิทธิ์เข้าถึงโอกาสการขาย', 403);
        }
        $stmt = $db->prepare('
            SELECT a.*, u.display_name as created_by_name
            FROM sales_activities a
            LEFT JOIN users u ON u.id = a.created_by
            WHERE a.opportunity_id = ? AND a.tenant_id = ?
            ORDER BY a.activity_date DESC
        ');
        $stmt->execute([$opportunityId, $tenantId]);
    } else {
        // List all activities tenant-wide
        if ($isAdmin) {
            $stmt = $db->prepare('
                SELECT a.*, u.display_name as created_by_name
                FROM sales_activities a
                LEFT JOIN users u ON u.id = a.created_by
                WHERE a.tenant_id = ?
                ORDER BY a.activity_date DESC
            ');
            $stmt->execute([$tenantId]);
        } else {
            $stmt = $db->prepare('
                SELECT DISTINCT a.*, u.display_name as created_by_name
                FROM sales_activities a
                LEFT JOIN users u ON u.id = a.created_by
                LEFT JOIN opportunity_members om ON a.opportunity_id = om.opportunity_id
                WHERE a.tenant_id = ? AND (
                    om.user_id = ?
                    OR a.opportunity_id IN (SELECT id FROM sales_opportunities WHERE assigned_to = ? AND tenant_id = ?)
                )
                ORDER BY a.activity_date DESC
            ');
            $stmt->execute([$tenantId, $userId, $userId, $tenantId]);
        }
    }

    jsonResponse($stmt->fetchAll());
}

// --- POST ---
if ($method === 'POST') {
    $body = getRequestBody();
    $opportunityId = $body['opportunity_id'] ?? null;
    
    if (!$opportunityId) jsonError('Missing opportunity_id parameter', 400);

    // Check if user has access to this opportunity
    if (!canAccessOpportunity($db, $opportunityId, $userId, $tenantId, $isAdmin)) {
        jsonError('ไม่มีสิทธิ์เพิ่มกิจกรรมในโอกาสการขายนี้', 403);
    }

    $id = generateUUID();

    $stmt = $db->prepare('
        INSERT INTO sales_activities (id, tenant_id, opportunity_id, activity_type, subject, description, activity_date, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([
        $id,
        $tenantId,
        $body['opportunity_id'] ?? '',
        $body['activity_type'] ?? 'other',
        $body['subject'] ?? '',
        $body['description'] ?? null,
        $body['activity_date'] ?? date('Y-m-d H:i:s'),
        $userId,
    ]);

    $stmt = $db->prepare('SELECT a.*, u.display_name as created_by_name FROM sales_activities a LEFT JOIN users u ON u.id = a.created_by WHERE a.id = ?');
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch(), 201);
}

// --- DELETE ---
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id parameter');

    // Get activity info first
    $stmt = $db->prepare('SELECT * FROM sales_activities WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$id, $tenantId]);
    $activity = $stmt->fetch();
    if (!$activity) {
        jsonError('ไม่พบกิจกรรม', 404);
    }

    // Check if user has access to this opportunity
    if (!canAccessOpportunity($db, $activity['opportunity_id'], $userId, $tenantId, $isAdmin)) {
        jsonError('ไม่มีสิทธิ์ลบกิจกรรมนี้', 403);
    }

    $stmt = $db->prepare('DELETE FROM sales_activities WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse(['message' => 'Activity deleted']);
}

// --- PUT ---
if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id parameter');

    // Get activity info first
    $stmt = $db->prepare('SELECT * FROM sales_activities WHERE id = ?');
    $stmt->execute([$id]);
    $activity = $stmt->fetch();
    if (!$activity) {
        jsonError('ไม่พบกิจกรรม', 404);
    }

    // Check if user has access to this opportunity (old)
    if (!canAccessOpportunity($db, $activity['opportunity_id'], $userId, $tenantId, $isAdmin)) {
        jsonError('ไม่มีสิทธิ์แก้ไขกิจกรรมนี้', 403);
    }

    $body = getRequestBody();
    $newOpportunityId = $body['opportunity_id'] ?? $activity['opportunity_id'];

    // If opportunity changed, check access to new opportunity too
    if ($newOpportunityId !== $activity['opportunity_id']) {
        if (!canAccessOpportunity($db, $newOpportunityId, $userId, $tenantId, $isAdmin)) {
            jsonError('ไม่มีสิทธิ์เข้าถึงโอกาสการขายที่เลือก', 403);
        }
    }

    $stmt = $db->prepare('
        UPDATE sales_activities 
        SET opportunity_id = ?, activity_type = ?, subject = ?, description = ?, activity_date = ?
        WHERE id = ?
    ');
    $stmt->execute([
        $newOpportunityId,
        $body['activity_type'] ?? 'other',
        $body['subject'] ?? '',
        $body['description'] ?? null,
        $body['activity_date'] ?? date('Y-m-d H:i:s'),
        $id,
    ]);

    $stmt = $db->prepare('SELECT a.*, u.display_name as created_by_name FROM sales_activities a LEFT JOIN users u ON u.id = a.created_by WHERE a.id = ?');
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch());
}

jsonError('Method not allowed', 405);
