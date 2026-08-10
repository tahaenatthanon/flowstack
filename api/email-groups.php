<?php
// GET /api/email-groups.php - List all email groups
// POST /api/email-groups.php - Create new email group
// GET /api/email-groups.php?id=xxx - Get single email group
// PUT /api/email-groups.php?id=xxx - Update email group
// DELETE /api/email-groups.php?id=xxx - Delete email group
// POST /api/email-groups.php?action=add_members - Add members to group
// DELETE /api/email-groups.php?action=remove_member - Remove member from group
// GET /api/email-groups.php?action=get_members - Get group members

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Use requireAuth for consistent tenant-aware auth
$tokenData = requireAuth();
$userId = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];

// Handle different actions
if ($method === 'GET' && $action === 'get_members') {
    getGroupMembers($db);
} elseif ($method === 'POST' && $action === 'add_members') {
    addGroupMembers($db, $userId);
} elseif ($method === 'DELETE' && $action === 'remove_member') {
    removeGroupMember($db);
} elseif ($method === 'GET') {
    if (isset($_GET['id'])) {
        getEmailGroup($db, $tenantId);
    } else {
        listEmailGroups($db, $tenantId);
    }
} elseif ($method === 'POST') {
    createEmailGroup($db, $userId, $tenantId);
} elseif ($method === 'PUT') {
    updateEmailGroup($db, $tenantId);
} elseif ($method === 'DELETE') {
    deleteEmailGroup($db, $tenantId);
} else {
    jsonError('Method not allowed', 405);
}

/**
 * List all email groups
 */
function listEmailGroups($db, string $tenantId = '') {
    $search = $_GET['search'] ?? '';
    
    $sql = "SELECT g.*, 
            (SELECT COUNT(*) FROM email_group_members WHERE group_id = g.id) as member_count,
            u.display_name as creator_name
            FROM email_groups g
            LEFT JOIN users u ON g.created_by = u.id
            WHERE g.tenant_id = ?";
    
    $params = [$tenantId];
    if ($search) {
        $sql .= " AND (g.name LIKE ? OR g.description LIKE ?)";
        $params[] = "%$search%";
        $params[] = "%$search%";
    }
    
    $sql .= " ORDER BY g.created_at DESC";
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $groups = $stmt->fetchAll();
    
    jsonSuccess($groups);
}

/**
 * Get single email group with members
 */
function getEmailGroup($db, string $tenantId = '') {
    $id = $_GET['id'] ?? '';
    
    if (empty($id)) {
        jsonError('Group ID required', 400);
    }
    
    $stmt = $db->prepare("SELECT g.*, u.display_name as creator_name 
                          FROM email_groups g 
                          LEFT JOIN users u ON g.created_by = u.id 
                          WHERE g.id = ? AND g.tenant_id = ?");
    $stmt->execute([$id, $tenantId]);
    $group = $stmt->fetch();
    
    if (!$group) {
        jsonError('Group not found', 404);
    }
    
    // Get members
    $stmt = $db->prepare("
        SELECT egm.*, 
               c.first_name, c.last_name, c.email, c.phone, c.position,
               co.name as company_name
        FROM email_group_members egm
        JOIN customers c ON egm.customer_id = c.id
        LEFT JOIN companies co ON c.company_id = co.id
        WHERE egm.group_id = ?
        ORDER BY c.first_name, c.last_name
    ");
    $stmt->execute([$id]);
    $members = $stmt->fetchAll();
    
    jsonSuccess([
        'group' => $group,
        'members' => $members
    ]);
}

/**
 * Get members of a group
 */
function getGroupMembers($db) {
    $groupId = $_GET['group_id'] ?? '';
    
    if (empty($groupId)) {
        jsonError('Group ID required', 400);
    }
    
    $stmt = $db->prepare("
        SELECT egm.*, 
               c.first_name, c.last_name, c.email, c.phone, c.position,
               co.name as company_name
        FROM email_group_members egm
        JOIN customers c ON egm.customer_id = c.id
        LEFT JOIN companies co ON c.company_id = co.id
        WHERE egm.group_id = ?
        ORDER BY c.first_name, c.last_name
    ");
    $stmt->execute([$groupId]);
    $members = $stmt->fetchAll();
    
    jsonSuccess($members);
}

/**
 * Create new email group
 */
function createEmailGroup($db, $userId, string $tenantId = '') {
    $body = getRequestBody();
    
    $name = trim($body['name'] ?? '');
    $description = trim($body['description'] ?? '');
    
    if (empty($name)) {
        jsonError('Group name is required', 400);
    }
    
    $id = generateUUID();
    $stmt = $db->prepare("
        INSERT INTO email_groups (id, tenant_id, name, description, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
    ");
    $stmt->execute([$id, $tenantId, $name, $description, $userId]);
    
    // (no per-customer activity to log for group creation)
    
    $stmt = $db->prepare("SELECT * FROM email_groups WHERE id = ?");
    $stmt->execute([$id]);
    $group = $stmt->fetch();
    
    jsonSuccess($group, 201);
}

/**
 * Update email group
 */
function updateEmailGroup($db) {
    $body = getRequestBody();
    $id = $body['id'] ?? $_GET['id'] ?? '';
    
    if (empty($id)) {
        jsonError('Group ID required', 400);
    }
    
    $name = trim($body['name'] ?? '');
    $description = trim($body['description'] ?? '');
    
    if (empty($name)) {
        jsonError('Group name is required', 400);
    }
    
    $stmt = $db->prepare("UPDATE email_groups SET name = ?, description = ? WHERE id = ?");
    $stmt->execute([$name, $description, $id]);
    
    $stmt = $db->prepare("SELECT * FROM email_groups WHERE id = ?");
    $stmt->execute([$id]);
    $group = $stmt->fetch();
    
    jsonSuccess($group);
}

/**
 * Delete email group
 */
function deleteEmailGroup($db) {
    $id = $_GET['id'] ?? '';
    
    if (empty($id)) {
        jsonError('Group ID required', 400);
    }
    
    // Check if group exists
    $stmt = $db->prepare("SELECT id FROM email_groups WHERE id = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        jsonError('Group not found', 404);
    }
    
    // Delete members first (due to foreign key)
    $stmt = $db->prepare("DELETE FROM email_group_members WHERE group_id = ?");
    $stmt->execute([$id]);
    
    // Delete group
    $stmt = $db->prepare("DELETE FROM email_groups WHERE id = ?");
    $stmt->execute([$id]);
    
    jsonSuccess(['message' => 'Group deleted successfully']);
}

/**
 * Add members to group
 */
function addGroupMembers($db, $userId) {
    $body = getRequestBody();
    
    $groupId = $body['group_id'] ?? '';
    $customerIds = $body['customer_ids'] ?? [];
    
    if (empty($groupId)) {
        jsonError('Group ID required', 400);
    }
    
    if (empty($customerIds) || !is_array($customerIds)) {
        jsonError('Customer IDs required', 400);
    }
    
    // Check if group exists
    $stmt = $db->prepare("SELECT id FROM email_groups WHERE id = ?");
    $stmt->execute([$groupId]);
    if (!$stmt->fetch()) {
        jsonError('Group not found', 404);
    }
    
    $added = 0;
    $errors = [];
    
    foreach ($customerIds as $customerId) {
        // Check if customer exists
        $stmt = $db->prepare("SELECT id FROM customers WHERE id = ?");
        $stmt->execute([$customerId]);
        if (!$stmt->fetch()) {
            $errors[] = "Customer $customerId not found";
            continue;
        }
        
        // Check if already a member
        $stmt = $db->prepare("SELECT id FROM email_group_members WHERE group_id = ? AND customer_id = ?");
        $stmt->execute([$groupId, $customerId]);
        if ($stmt->fetch()) {
            continue;
        }
        
        // Add member
        $id = generateUUID();
        try {
            $stmt = $db->prepare("INSERT INTO email_group_members (id, group_id, customer_id, added_at) VALUES (?, ?, ?, NOW())");
            $stmt->execute([$id, $groupId, $customerId]);
            $added++;
            
            // Log activity
            logCustomerActivity($db, $customerId, 'group_added', $groupId, ['group_id' => $groupId]);
        } catch (Exception $e) {
            $errors[] = "Failed to add customer $customerId";
        }
    }
    
    jsonSuccess([
        'added' => $added,
        'errors' => $errors
    ]);
}

/**
 * Remove member from group
 */
function removeGroupMember($db) {
    $body = getRequestBody();
    
    $groupId = $body['group_id'] ?? '';
    $customerId = $body['customer_id'] ?? '';
    
    if (empty($groupId) || empty($customerId)) {
        jsonError('Group ID and Customer ID required', 400);
    }
    
    $stmt = $db->prepare("DELETE FROM email_group_members WHERE group_id = ? AND customer_id = ?");
    $stmt->execute([$groupId, $customerId]);
    
    jsonSuccess(['message' => 'Member removed successfully']);
}

/**
 * Log customer activity
 */
function logCustomerActivity($db, $customerId, $activityType, $referenceId, $details = []) {
    $id = generateUUID();
    $detailsJson = json_encode($details);
    
    $stmt = $db->prepare("
        INSERT INTO customer_activities (id, customer_id, activity_type, reference_id, details, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
    ");
    $stmt->execute([$id, $customerId, $activityType, $referenceId, $detailsJson]);
}
