<?php
// CRUD /api/automation.php
// Automation Rules API - visual workflow builder for no-code automation
// 
// Endpoints:
// GET    - list automation rules (?project_id= filter, or ?trigger= type)
// POST   - create automation rule
// PUT    - update automation rule (?id= required)
// DELETE - delete automation rule (?id= required)
// POST   - toggle rule active status
// POST   - test automation rule
// GET    - get execution history

require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db = getDB();
$method = getMethod();

// Check if user is admin (tenant-scoped)
$isAdmin = isTenantAdmin($db, $userId, $tenantId);

// --- GET: List Automation Rules ---
if ($method === 'GET') {
    $id = $_GET['id'] ?? null;
    $projectId = $_GET['project_id'] ?? null;
    $trigger = $_GET['trigger'] ?? null;
    $isActive = $_GET['is_active'] ?? null;
    
    // Get single rule (scoped to tenant)
    if ($id) {
        $stmt = $db->prepare('SELECT * FROM automation_rules WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL');
        $stmt->execute([$id, $tenantId]);
        $rule = $stmt->fetch();
        if (!$rule) jsonError('Automation rule not found', 404);
        
        $rule['execution_count'] = $rule['trigger_count'] ?? 0;
        $rule['trigger_event']   = $rule['trigger_type'];
        $rule['conditions']      = $rule['trigger_conditions'] ? json_decode($rule['trigger_conditions'], true) : [];
        $rule['actions']         = $rule['actions'] ? json_decode($rule['actions'], true) : [];
        
        jsonResponse($rule);
    }
    
    // List rules
    $query = 'SELECT * FROM automation_rules WHERE tenant_id = ? AND deleted_at IS NULL';
    $params = [$tenantId];
    
    if ($projectId) {
        $query .= ' AND (project_id = ? OR project_id IS NULL)';
        $params[] = $projectId;
    }
    
    if ($trigger) {
        $query .= ' AND trigger_type = ?';
        $params[] = $trigger;
    }
    
    if ($isActive !== null) {
        $query .= ' AND is_active = ?';
        $params[] = $isActive;
    }
    
    $query .= ' ORDER BY created_at DESC';
    
    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $rules = $stmt->fetchAll();
    
    foreach ($rules as &$rule) {
        $rule['execution_count'] = $rule['trigger_count'] ?? 0;
        $rule['trigger_event']   = $rule['trigger_type'];
        $rule['conditions']      = $rule['trigger_conditions'] ? json_decode($rule['trigger_conditions'], true) : [];
        $rule['actions']         = $rule['actions'] ? json_decode($rule['actions'], true) : [];
    }
    
    jsonResponse($rules);
}

// --- POST: Create Automation Rule ---
if ($method === 'POST') {
    $body = getRequestBody();
    
    $projectId = $body['project_id'] ?? null;
    if ($projectId && !canAccessProject($db, $projectId, $userId, $tenantId, $isAdmin)) {
        jsonError('Forbidden', 403);
    }
    
    $name = trim($body['name'] ?? '');
    if ($name === '') jsonError('กรุณาระบุชื่อ Automation Rule', 400);
    if (mb_strlen($name) > 255) jsonError('ชื่อต้องไม่เกิน 255 ตัวอักษร', 400);

    $triggerType = $body['trigger_event'] ?? $body['trigger_type'] ?? '';
    $allowedTriggers = ['task_created', 'task_updated', 'task_completed', 'task_overdue', 'project_status_changed'];
    if ($triggerType === '' || !in_array($triggerType, $allowedTriggers, true)) {
        jsonError('trigger_type ไม่ถูกต้อง ต้องเป็น: ' . implode(', ', $allowedTriggers), 400);
    }

    $id = generateUUID();
    $description = $body['description'] ?? '';
    $conditions = $body['conditions'] ?? [];
    $actions = $body['actions'] ?? [];
    $isActive = isset($body['is_active']) ? (int)(bool)$body['is_active'] : 1;
    
    // Normalize conditions/actions — may arrive as JSON string from frontend
    if (is_string($conditions)) $conditions = json_decode($conditions, true) ?? [];
    if (is_string($actions))    $actions    = json_decode($actions, true)    ?? [];
    
    $stmt = $db->prepare('
        INSERT INTO automation_rules (
            id, tenant_id, project_id, created_by, name, description, trigger_type,
            trigger_conditions, actions, is_active,
            created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
        )
    ');
    
    $stmt->execute([
        $id, $tenantId, $projectId, $userId, $name, $description, $triggerType,
        json_encode($conditions), json_encode($actions), $isActive
    ]);
    
    $stmt = $db->prepare('SELECT * FROM automation_rules WHERE id = ?');
    $stmt->execute([$id]);
    $rule = $stmt->fetch();
    $rule['execution_count'] = 0;
    $rule['trigger_event']   = $rule['trigger_type'];
    $rule['conditions']      = json_decode($rule['trigger_conditions'] ?? '[]', true);
    $rule['actions']         = json_decode($rule['actions'], true);
    
    jsonResponse($rule, 201);
}

// --- PUT: Update Automation Rule ---
if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Rule ID required', 400);
    
    $body = getRequestBody();
    
    $stmt = $db->prepare('SELECT * FROM automation_rules WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL');
    $stmt->execute([$id, $tenantId]);
    $rule = $stmt->fetch();
    if (!$rule) jsonError('Automation rule not found', 404);
    
    if ($rule['project_id'] && !canAccessProject($db, $rule['project_id'], $userId, $tenantId, $isAdmin)) {
        jsonError('Forbidden', 403);
    }
    
    $updates = [];
    $params = [];
    
    $allowedFields = ['name', 'description', 'is_active'];
    foreach ($allowedFields as $f) {
        if (isset($body[$f])) {
            $updates[] = "$f = ?";
            $params[] = $body[$f];
        }
    }
    
    // trigger_event / trigger_type
    if (isset($body['trigger_event']) || isset($body['trigger_type'])) {
        $updates[] = 'trigger_type = ?';
        $params[] = $body['trigger_event'] ?? $body['trigger_type'];
    }
    
    // conditions
    if (isset($body['conditions'])) {
        $cond = $body['conditions'];
        if (is_string($cond)) $cond = json_decode($cond, true) ?? [];
        $updates[] = 'trigger_conditions = ?';
        $params[] = json_encode($cond);
    }
    
    // actions
    if (isset($body['actions'])) {
        $act = $body['actions'];
        if (is_string($act)) $act = json_decode($act, true) ?? [];
        $updates[] = 'actions = ?';
        $params[] = json_encode($act);
    }
    
    if (count($updates) > 0) {
        $updates[] = 'updated_at = NOW()';
        $params[] = $id;
        
        $stmt = $db->prepare('UPDATE automation_rules SET ' . implode(', ', $updates) . ' WHERE id = ? AND tenant_id = ?');
        $stmt->execute([...$params, $tenantId]);
    }
    
    $stmt = $db->prepare('SELECT * FROM automation_rules WHERE id = ?');
    $stmt->execute([$id]);
    $rule = $stmt->fetch();
    $rule['execution_count'] = $rule['trigger_count'] ?? 0;
    $rule['trigger_event']   = $rule['trigger_type'];
    $rule['conditions']      = json_decode($rule['trigger_conditions'] ?? '[]', true);
    $rule['actions']         = json_decode($rule['actions'], true);
    
    jsonResponse($rule);
}

// --- DELETE: Delete Automation Rule ---
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Rule ID required', 400);
    
    $stmt = $db->prepare('SELECT * FROM automation_rules WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL');
    $stmt->execute([$id, $tenantId]);
    $rule = $stmt->fetch();
    if (!$rule) jsonError('Automation rule not found', 404);
    
    if ($rule['project_id'] && !canAccessProject($db, $rule['project_id'], $userId, $tenantId, $isAdmin)) {
        jsonError('Forbidden', 403);
    }
    
    $stmt = $db->prepare('UPDATE automation_rules SET deleted_at = NOW() WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$id, $tenantId]);
    
    jsonResponse(['success' => true, 'message' => 'Automation rule deleted']);
}

// --- POST: Toggle Rule Active Status ---
if ($method === 'POST' && isset($_GET['toggle'])) {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Rule ID required', 400);
    
    $stmt = $db->prepare('SELECT * FROM automation_rules WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL');
    $stmt->execute([$id, $tenantId]);
    $rule = $stmt->fetch();
    if (!$rule) jsonError('Automation rule not found', 404);
    
    $newStatus = $rule['is_active'] ? 0 : 1;
    
    $stmt = $db->prepare('UPDATE automation_rules SET is_active = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$newStatus, $id, $tenantId]);
    
    jsonResponse(['success' => true, 'is_active' => $newStatus]);
}

// --- POST: Test Automation Rule ---
if ($method === 'POST' && isset($_GET['test'])) {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Rule ID required', 400);
    
    $body = getRequestBody();
    $testTaskId = $body['task_id'] ?? null;
    
    $stmt = $db->prepare('SELECT * FROM automation_rules WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL');
    $stmt->execute([$id, $tenantId]);
    $rule = $stmt->fetch();
    if (!$rule) jsonError('Automation rule not found', 404);
    
    // Get task data
    if (!$testTaskId) {
        jsonError('Task ID required for testing', 400);
    }
    
    // Scope task lookup to tenant
    $taskStmt = $db->prepare('SELECT t.* FROM tasks t JOIN projects p ON t.project_id = p.id WHERE t.id = ? AND p.tenant_id = ?');
    $taskStmt->execute([$testTaskId, $tenantId]);
    $task = $taskStmt->fetch();
    if (!$task) jsonError('Task not found', 404);
    
    // Evaluate conditions
    $conditions = json_decode($rule['trigger_conditions'] ?? '[]', true);
    $conditionsPassed = evaluateConditions($conditions, $task);
    
    // Simulate actions (don't actually execute)
    $actions = json_decode($rule['actions'], true);
    $simulatedActions = [];
    
    foreach ($actions as $action) {
        $simulatedActions[] = [
            'type' => $action['type'],
            'would_execute' => $conditionsPassed,
            'details' => $action
        ];
    }
    
    jsonResponse([
        'rule_name' => $rule['name'],
        'task_title' => $task['title'],
        'conditions_passed' => $conditionsPassed,
        'simulated_actions' => $simulatedActions
    ]);
}

// --- GET: Get Execution History ---
if ($method === 'GET' && isset($_GET['history'])) {
    $ruleId = $_GET['rule_id'] ?? null;
    $limit = min(intval($_GET['limit'] ?? 50), 200); // cap at 200
    
    $query = '
        SELECT ae.*, ar.name as rule_name
        FROM automation_executions ae
        JOIN automation_rules ar ON ae.rule_id = ar.id
        WHERE ar.tenant_id = ?
    ';
    $params = [$tenantId];
    
    if ($ruleId) {
        $query .= ' AND ae.rule_id = ?';
        $params[] = $ruleId;
    }
    
    $query .= ' ORDER BY ae.executed_at DESC LIMIT ?';
    $params[] = $limit;
    
    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $executions = $stmt->fetchAll();
    
    foreach ($executions as &$exec) {
        $exec['actions_executed'] = $exec['actions_executed'] ? json_decode($exec['actions_executed'], true) : [];
    }
    
    jsonResponse($executions);
}

// --- POST: Execute Automation (Triggered by events) ---
// This is called internally when task events occur
if ($method === 'POST' && isset($_GET['execute'])) {
    $body = getRequestBody();
    
    $triggerEvent = $body['trigger_event'] ?? '';
    $taskData = $body['task_data'] ?? [];
    $taskId = $body['task_id'] ?? '';
    
    // Find matching rules — scoped to tenant
    $stmt = $db->prepare('
        SELECT * FROM automation_rules 
        WHERE trigger_type = ? AND tenant_id = ? AND is_active = 1 AND deleted_at IS NULL
    ');
    $stmt->execute([$triggerEvent, $tenantId]);
    $rules = $stmt->fetchAll();
    
    $executed = [];
    
    foreach ($rules as $rule) {
        // Get fresh task data
        $taskStmt = $db->prepare('SELECT * FROM tasks WHERE id = ?');
        $taskStmt->execute([$taskId]);
        $task = $taskStmt->fetch();
        
        if (!$task) continue;
        
        // Check if rule applies to this project
        if ($rule['project_id'] && $rule['project_id'] !== $task['project_id']) {
            continue;
        }
        
        // Evaluate conditions
        $conditions = json_decode($rule['trigger_conditions'] ?? '[]', true);
        if (!empty($conditions) && !evaluateConditions($conditions, $task)) {
            continue;
        }
        
        // Execute actions
        $actions = json_decode($rule['actions'], true);
        $executedActions = executeActions($db, $actions, $task, $userId);
        
        // Log execution
        $execId = generateUUID();
        $db->prepare('
            INSERT INTO automation_executions (id, rule_id, tenant_id, task_id, trigger_event, actions_executed, executed_by, executed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ')->execute([$execId, $rule['id'], $tenantId, $taskId, $triggerEvent, json_encode($executedActions), $userId]);

        // Update trigger count
        $db->prepare('UPDATE automation_rules SET trigger_count = trigger_count + 1, last_triggered = NOW() WHERE id = ?')
           ->execute([$rule['id']]);

        $executed[] = [
            'rule_id' => $rule['id'],
            'rule_name' => $rule['name'],
            'actions' => $executedActions
        ];
    }
    
    jsonResponse([
        'success' => true,
        'trigger_event' => $triggerEvent,
        'rules_matched' => count($rules),
        'executed' => $executed
    ]);
}

// Helper: Evaluate conditions
function evaluateConditions(array $conditions, array $task): bool {
    if (empty($conditions)) return true;
    
    foreach ($conditions as $condition) {
        $field = $condition['field'];
        $operator = $condition['operator'];
        $value = $condition['value'] ?? null;
        
        $taskValue = $task[$field] ?? null;
        
        $passed = false;
        switch ($operator) {
            case 'equals':
                $passed = $taskValue == $value;
                break;
            case 'not_equals':
                $passed = $taskValue != $value;
                break;
            case 'contains':
                $passed = $taskValue && strpos($taskValue, $value) !== false;
                break;
            case 'greater_than':
                $passed = $taskValue > $value;
                break;
            case 'less_than':
                $passed = $taskValue < $value;
                break;
            case 'is_empty':
                $passed = empty($taskValue);
                break;
            case 'is_not_empty':
                $passed = !empty($taskValue);
                break;
            case 'in':
                $passed = is_array($value) && in_array($taskValue, $value);
                break;
        }
        
        // If using AND logic, all must pass
        // If OR logic, at least one must pass
        if (($condition['logic'] ?? 'and') === 'and' && !$passed) {
            return false;
        }
    }
    
    return true;
}

// Helper: Execute actions
function executeActions(PDO $db, array $actions, array $task, string $userId): array {
    $executed = [];
    
    foreach ($actions as $action) {
        $type = $action['type'];
        $result = ['type' => $type, 'success' => false];
        
        try {
            switch ($type) {
                case 'update_status':
                    $newStatus = $action['value'] ?? 'pending';
                    $stmt = $db->prepare('UPDATE tasks SET status = ?, updated_at = NOW() WHERE id = ?');
                    $stmt->execute([$newStatus, $task['id']]);
                    $result['success'] = true;
                    $result['new_status'] = $newStatus;
                    break;
                    
                case 'update_field':
                    $field = $action['field'];
                    $value = $action['value'];
                    // Whitelist allowed fields to prevent SQL injection
                    $allowedTaskFields = ['status', 'priority', 'assignee', 'title', 'description', 'start_date', 'end_date', 'estimated_hours'];
                    if (!in_array($field, $allowedTaskFields, true)) {
                        $result['error'] = "Field '$field' is not allowed";
                        break;
                    }
                    $stmt = $db->prepare("UPDATE tasks SET `$field` = ?, updated_at = NOW() WHERE id = ?");
                    $stmt->execute([$value, $task['id']]);
                    $result['success'] = true;
                    $result['field'] = $field;
                    $result['value'] = $value;
                    break;
                    
                case 'assign_to':
                    $assignee = $action['assignee'];
                    $stmt = $db->prepare('UPDATE tasks SET assignee = ?, updated_at = NOW() WHERE id = ?');
                    $stmt->execute([$assignee, $task['id']]);
                    $result['success'] = true;
                    $result['assignee'] = $assignee;
                    break;
                    
                case 'set_due_date':
                    $days = intval($action['days'] ?? 2);
                    $newDueDate = date('Y-m-d', strtotime("+{$days} days"));
                    $stmt = $db->prepare('UPDATE tasks SET end_date = ?, updated_at = NOW() WHERE id = ?');
                    $stmt->execute([$newDueDate, $task['id']]);
                    $result['success'] = true;
                    $result['new_due_date'] = $newDueDate;
                    break;
                    
                case 'add_comment':
                    $comment = $action['comment'] ?? '';
                    // Would add to comments table
                    $result['success'] = true;
                    $result['comment'] = $comment;
                    break;
                    
                case 'send_notification':
                    $msg       = $action['message'] ?? ('มีการเปลี่ยนแปลงในงาน: ' . ($task['title'] ?? ''));
                    $recipient = $action['assignee'] ?? $task['assignee'] ?? '';
                    if ($recipient) {
                        $actorStmt = $db->prepare('SELECT display_name, email FROM users WHERE id = ?');
                        $actorStmt->execute([$userId]);
                        $actor = $actorStmt->fetch();
                        inboxNotify($db, $tenantId, $recipient,
                            $actor['display_name'] ?? 'ระบบ', $actor['email'] ?? '',
                            'Automation: ' . ($task['title'] ?? ''),
                            $msg, 'notification', 'medium', $task['id']
                        );
                        $result['success']   = true;
                        $result['recipient'] = $recipient;
                    }
                    break;
                    
                case 'create_subtask':
                    $subtaskTitle = $action['title'] ?? 'งานย่อยจาก Automation';
                    $subtaskId = generateUUID();
                    $stmt = $db->prepare('
                        INSERT INTO tasks (
                            id, tenant_id, project_id, user_id, title, status, parent_task_id,
                            is_subtask, level, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, NOW(), NOW())
                    ');
                    $stmt->execute([
                        $subtaskId, $tenantId, $task['project_id'], $userId, $subtaskTitle,
                        'pending', $task['id']
                    ]);
                    $result['success'] = true;
                    $result['subtask_id'] = $subtaskId;
                    break;
                    
                case 'webhook':
                    // Would trigger webhook
                    $result['success'] = true;
                    $result['webhook_url'] = $action['url'] ?? '';
                    break;
            }
        } catch (Exception $e) {
            $result['error'] = $e->getMessage();
        }
        
        $executed[] = $result;
    }
    
    return $executed;
}

jsonError('Method not allowed', 405);
