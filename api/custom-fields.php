<?php
// CRUD /api/custom-fields.php
// Global Custom Fields API - create once, use across all projects
// 
// Endpoints:
// GET    - list custom fields (?project_id= optional, or global fields)
// POST   - create custom field
// PUT    - update custom field (?id= required)
// DELETE - delete custom field (?id= required)
// POST   - set field value for a task

require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db = getDB();
$method = getMethod();

// Check if user is admin (tenant-scoped)
$isAdmin = isTenantAdmin($db, $userId, $tenantId);

// Allow any authenticated user to access custom fields

// --- GET: List Custom Fields ---
if ($method === 'GET') {
    $id = $_GET['id'] ?? null;
    $projectId = $_GET['project_id'] ?? null;
    $fieldType = $_GET['field_type'] ?? null;
    
    // Get single field
    if ($id) {
        $stmt = $db->prepare('SELECT * FROM custom_fields WHERE id = ? AND deleted_at IS NULL');
        $stmt->execute([$id]);
        $field = $stmt->fetch();
        if (!$field) jsonError('Custom field not found', 404);
        
        // Get usage count
        $stmt = $db->prepare('SELECT COUNT(*) FROM task_custom_field_values WHERE custom_field_id = ?');
        $stmt->execute([$id]);
        $field['usage_count'] = $stmt->fetchColumn();
        
        jsonResponse($field);
    }
    
    // List fields
    $query = 'SELECT * FROM custom_fields WHERE tenant_id = ? AND deleted_at IS NULL';
    $params = [$tenantId];
    
    if ($projectId !== null) {
        // Include project-specific and global fields
        $query .= ' AND (project_id = ? OR project_id IS NULL)';
        $params[] = $projectId;
    }
    
    if ($fieldType) {
        $query .= ' AND field_type = ?';
        $params[] = $fieldType;
    }
    
    $query .= ' ORDER BY created_at ASC';
    
    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $fields = $stmt->fetchAll();
    
    // Add usage count for each field
    foreach ($fields as &$field) {
        $stmt = $db->prepare('SELECT COUNT(*) FROM task_custom_field_values WHERE custom_field_id = ?');
        $stmt->execute([$field['id']]);
        $field['usage_count'] = $stmt->fetchColumn();
    }
    
    jsonResponse($fields);
}

// --- POST: Create Custom Field ---
if ($method === 'POST') {
    $body = getRequestBody();
    
    $id = $body['id'] ?? generateUUID();
    $name = $body['name'] ?? '';
    $fieldType = $body['field_type'] ?? 'text'; // text, number, date, select, multiselect, currency, boolean
    $fieldOptions = $body['field_options'] ?? null; // JSON array for select options
    $isRequired = isset($body['is_required']) ? (int)$body['is_required'] : 0;
    $isGlobal = isset($body['is_global']) ? (int)$body['is_global'] : 1;
    $projectId = $body['project_id'] ?? null;
    $defaultValue = $body['default_value'] ?? null;
    $sortOrder = intval($body['sort_order'] ?? 0);
    
    if (empty($name)) {
        jsonError('Field name is required', 400);
    }
    
    // Validate field type
    $validTypes = ['text', 'number', 'date', 'select', 'multiselect', 'currency', 'boolean', 'url', 'email'];
    if (!in_array($fieldType, $validTypes)) {
        jsonError('Invalid field type', 400);
    }
    
    // Convert field_options to JSON if provided
    if ($fieldOptions && is_array($fieldOptions)) {
        $fieldOptions = json_encode($fieldOptions);
    }
    
    $stmt = $db->prepare('
        INSERT INTO custom_fields (
            id, tenant_id, name, field_type, field_options, is_required, is_global,
            project_id, default_value, sort_order, created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
        )
    ');
    
    $stmt->execute([
        $id, $tenantId, $name, $fieldType, $fieldOptions, $isRequired, $isGlobal,
        $projectId, $defaultValue, $sortOrder
    ]);
    
    // Return created field
    $stmt = $db->prepare('SELECT * FROM custom_fields WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch(), 201);
}

// --- PUT: Update Custom Field ---
if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Field ID required', 400);
    
    $body = getRequestBody();
    
    // Check if field exists
    $stmt = $db->prepare('SELECT * FROM custom_fields WHERE id = ? AND deleted_at IS NULL');
    $stmt->execute([$id]);
    $field = $stmt->fetch();
    if (!$field) jsonError('Custom field not found', 404);
    
    $updates = [];
    $params = [];
    
    $allowedFields = ['name', 'field_type', 'field_options', 'is_required', 'is_global', 'project_id', 'default_value', 'sort_order'];
    
    foreach ($allowedFields as $f) {
        if (isset($body[$f])) {
            $updates[] = "$f = ?";
            $params[] = $body[$f];
        }
    }
    
    if (count($updates) > 0) {
        $updates[] = 'updated_at = NOW()';
        $params[] = $id;
        
        $stmt = $db->prepare('UPDATE custom_fields SET ' . implode(', ', $updates) . ' WHERE id = ?');
        $stmt->execute($params);
    }
    
    $stmt = $db->prepare('SELECT * FROM custom_fields WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch());
}

// --- DELETE: Delete Custom Field ---
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Field ID required', 400);
    
    // Check if field exists
    $stmt = $db->prepare('SELECT * FROM custom_fields WHERE id = ? AND deleted_at IS NULL');
    $stmt->execute([$id]);
    if (!$stmt->fetch()) jsonError('Custom field not found', 404);
    
    // Soft delete field
    $stmt = $db->prepare('UPDATE custom_fields SET deleted_at = NOW() WHERE id = ?');
    $stmt->execute([$id]);
    
    // Also delete all values for this field
    $stmt = $db->prepare('UPDATE task_custom_field_values SET deleted_at = NOW() WHERE custom_field_id = ?');
    $stmt->execute([$id]);
    
    jsonResponse(['success' => true, 'message' => 'Custom field deleted']);
}

// --- POST: Set Field Value for Task ---
if ($method === 'POST' && isset($_GET['set_value'])) {
    $body = getRequestBody();
    
    $taskId = $body['task_id'] ?? '';
    $customFieldId = $body['custom_field_id'] ?? '';
    $value = $body['value'] ?? null;
    
    if (empty($taskId) || empty($customFieldId)) {
        jsonError('Task ID and Custom Field ID are required', 400);
    }
    
    // Verify field exists
    $stmt = $db->prepare('SELECT * FROM custom_fields WHERE id = ? AND deleted_at IS NULL');
    $stmt->execute([$customFieldId]);
    $field = $stmt->fetch();
    if (!$field) jsonError('Custom field not found', 404);
    
    // Check if value already exists
    $stmt = $db->prepare('SELECT id FROM task_custom_field_values WHERE task_id = ? AND custom_field_id = ? AND deleted_at IS NULL');
    $stmt->execute([$taskId, $customFieldId]);
    $existing = $stmt->fetch();
    
    if ($existing) {
        // Update existing value
        $stmt = $db->prepare('UPDATE task_custom_field_values SET value = ?, updated_at = NOW() WHERE id = ?');
        $stmt->execute([$value, $existing['id']]);
    } else {
        // Insert new value
        $valueId = generateUUID();
        $stmt = $db->prepare('
            INSERT INTO task_custom_field_values (id, task_id, custom_field_id, value, created_at, updated_at)
            VALUES (?, ?, ?, ?, NOW(), NOW())
        ');
        $stmt->execute([$valueId, $taskId, $customFieldId, $value]);
    }
    
    jsonResponse(['success' => true]);
}

// --- GET: Get Field Values for Task ---
if ($method === 'GET' && isset($_GET['task_values'])) {
    $taskId = $_GET['task_id'] ?? null;
    if (!$taskId) jsonError('Task ID required', 400);
    
    $stmt = $db->prepare('
        SELECT cfv.*, cf.name as field_name, cf.field_type, cf.field_options
        FROM task_custom_field_values cfv
        JOIN custom_fields cf ON cfv.custom_field_id = cf.id
        WHERE cfv.task_id = ? AND cfv.deleted_at IS NULL AND cf.deleted_at IS NULL
    ');
    $stmt->execute([$taskId]);
    jsonResponse($stmt->fetchAll());
}

jsonError('Method not allowed', 405);
