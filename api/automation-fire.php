<?php
// automation-fire.php — internal helper, not a public endpoint
// Include this file and call fireAutomationRules() after task events.
// Requires: $db (PDO), config.php already loaded (for generateUUID / inboxNotify).

/**
 * Fire automation rules matching $triggerEvent for the given task.
 *
 * @param PDO    $db
 * @param string $tenantId
 * @param string $userId      User who triggered the event
 * @param string $triggerEvent  e.g. 'task_created', 'status_changed', 'task_updated'
 * @param string $taskId
 */
function fireAutomationRules(PDO $db, string $tenantId, string $userId, string $triggerEvent, string $taskId): void {
    try {
        $stmt = $db->prepare('
            SELECT * FROM automation_rules
            WHERE trigger_type = ? AND tenant_id = ? AND is_active = 1 AND deleted_at IS NULL
        ');
        $stmt->execute([$triggerEvent, $tenantId]);
        $rules = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($rules)) return;

        $taskStmt = $db->prepare('SELECT * FROM tasks WHERE id = ?');
        $taskStmt->execute([$taskId]);
        $task = $taskStmt->fetch(PDO::FETCH_ASSOC);
        if (!$task) return;

        foreach ($rules as $rule) {
            if ($rule['project_id'] && $rule['project_id'] !== $task['project_id']) continue;

            $conditions = json_decode($rule['trigger_conditions'] ?? '[]', true) ?: [];
            if (!empty($conditions) && !automationEvalConditions($conditions, $task)) continue;

            $actions = json_decode($rule['actions'] ?? '[]', true) ?: [];
            if (empty($actions)) continue;

            $executedActions = automationExecActions($db, $actions, $task, $userId, $tenantId);

            // Log execution
            $execId = generateUUID();
            $db->prepare('
                INSERT INTO automation_executions (id, rule_id, tenant_id, task_id, trigger_event, actions_executed, executed_by, executed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            ')->execute([$execId, $rule['id'], $tenantId, $taskId, $triggerEvent, json_encode($executedActions), $userId]);

            // Increment trigger count
            $db->prepare('UPDATE automation_rules SET trigger_count = trigger_count + 1, last_triggered = NOW() WHERE id = ?')
               ->execute([$rule['id']]);
        }
    } catch (Throwable $e) {
        error_log('[fireAutomationRules] ' . $e->getMessage());
    }
}

function automationEvalConditions(array $conditions, array $task): bool {
    foreach ($conditions as $condition) {
        $field    = $condition['field'] ?? '';
        $operator = $condition['operator'] ?? 'equals';
        $value    = $condition['value'] ?? null;
        $taskVal  = $task[$field] ?? null;

        $passed = false;
        switch ($operator) {
            case 'equals':       $passed = $taskVal == $value; break;
            case 'not_equals':   $passed = $taskVal != $value; break;
            case 'contains':     $passed = $taskVal !== null && strpos((string)$taskVal, (string)$value) !== false; break;
            case 'greater_than': $passed = $taskVal > $value; break;
            case 'less_than':    $passed = $taskVal < $value; break;
            case 'is_empty':     $passed = empty($taskVal); break;
            case 'is_not_empty': $passed = !empty($taskVal); break;
            case 'in':           $passed = is_array($value) && in_array($taskVal, $value); break;
        }

        if (($condition['logic'] ?? 'and') === 'and' && !$passed) return false;
    }
    return true;
}

function automationExecActions(PDO $db, array $actions, array $task, string $userId, string $tenantId): array {
    $executed = [];

    foreach ($actions as $action) {
        $type   = $action['type'] ?? '';
        $result = ['type' => $type, 'success' => false];

        try {
            switch ($type) {
                case 'update_status':
                    $newStatus = $action['value'] ?? 'pending';
                    $db->prepare('UPDATE tasks SET status = ?, updated_at = NOW() WHERE id = ?')
                       ->execute([$newStatus, $task['id']]);
                    $result['success'] = true;
                    $result['new_status'] = $newStatus;
                    break;

                case 'update_field':
                    $field = $action['field'] ?? '';
                    $value = $action['value'] ?? null;
                    $allowed = ['status','priority','assignee','title','description','start_date','end_date','estimated_hours'];
                    if (!in_array($field, $allowed, true)) { $result['error'] = "Field not allowed: $field"; break; }
                    $db->prepare("UPDATE tasks SET `$field` = ?, updated_at = NOW() WHERE id = ?")
                       ->execute([$value, $task['id']]);
                    $result['success'] = true;
                    break;

                case 'assign_to':
                    $assignee = $action['assignee'] ?? '';
                    if (!$assignee) break;
                    $db->prepare('UPDATE tasks SET assignee = ?, updated_at = NOW() WHERE id = ?')
                       ->execute([$assignee, $task['id']]);
                    // Notify new assignee
                    $actorStmt = $db->prepare('SELECT display_name, email FROM users WHERE id = ?');
                    $actorStmt->execute([$userId]);
                    $actor = $actorStmt->fetch(PDO::FETCH_ASSOC);
                    inboxNotify($db, $tenantId, $assignee,
                        $actor['display_name'] ?? 'ระบบ', $actor['email'] ?? '',
                        'Automation: ถูกมอบหมายงาน: ' . ($task['title'] ?? ''),
                        'Automation ได้มอบหมายงาน "' . ($task['title'] ?? '') . '" ให้คุณ',
                        'notification', 'medium', $task['id']
                    );
                    $result['success'] = true;
                    break;

                case 'set_due_date':
                    $days = max(1, intval($action['days'] ?? 2));
                    $newDate = date('Y-m-d', strtotime("+{$days} days"));
                    $db->prepare('UPDATE tasks SET end_date = ?, updated_at = NOW() WHERE id = ?')
                       ->execute([$newDate, $task['id']]);
                    $result['success'] = true;
                    $result['new_due_date'] = $newDate;
                    break;

                case 'send_notification':
                    $msg      = $action['message'] ?? ('มีการเปลี่ยนแปลงในงาน: ' . ($task['title'] ?? ''));
                    $recipient = $action['assignee'] ?? $task['assignee'] ?? '';
                    if ($recipient) {
                        $actorStmt = $db->prepare('SELECT display_name, email FROM users WHERE id = ?');
                        $actorStmt->execute([$userId]);
                        $actor = $actorStmt->fetch(PDO::FETCH_ASSOC);
                        inboxNotify($db, $tenantId, $recipient,
                            $actor['display_name'] ?? 'ระบบ', $actor['email'] ?? '',
                            'Automation: ' . ($task['title'] ?? ''),
                            $msg,
                            'notification', 'medium', $task['id']
                        );
                        $result['success'] = true;
                        $result['recipient'] = $recipient;
                    }
                    break;

                case 'create_subtask':
                    $subtaskTitle = $action['title'] ?? 'งานย่อยจาก Automation';
                    $subtaskId    = generateUUID();
                    $db->prepare('
                        INSERT INTO tasks (id, tenant_id, project_id, user_id, title, status, parent_task_id, is_subtask, level, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, NOW(), NOW())
                    ')->execute([$subtaskId, $tenantId, $task['project_id'], $userId, $subtaskTitle, 'pending', $task['id']]);
                    $result['success']    = true;
                    $result['subtask_id'] = $subtaskId;
                    break;
            }
        } catch (Throwable $e) {
            $result['error'] = $e->getMessage();
            error_log('[automationExecActions] ' . $e->getMessage());
        }

        $executed[] = $result;
    }

    return $executed;
}
