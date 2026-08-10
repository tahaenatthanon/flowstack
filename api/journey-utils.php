<?php
// api/journey-utils.php
// Shared functions สำหรับ company_journey feature
// ไม่มี route handler — include เท่านั้น

/**
 * Normalize task status จาก DB enum ('in-progress') → frontend ('in_progress')
 */
function normalizeTaskStatus(string $status): string {
    return match($status) {
        'in-progress' => 'in_progress',
        'overdue'     => 'overdue',
        default       => $status,
    };
}

/**
 * Auto-advance journey stage เมื่อ entity เปลี่ยน status
 *
 * @param PDO    $db
 * @param string $tenantId
 * @param string $fromStage   'marketing'|'sales'|'project'|'support'
 * @param string $entityType  'opportunity'|'project'|'support_ticket'
 * @param string $entityId    UUID ของ entity
 * @return void  (silently ignore ถ้าไม่มี journey link — journey เป็น optional)
 */
function journeyAutoAdvance(PDO $db, string $tenantId, string $fromStage, string $entityType, string $entityId): void {
    try {
        // หา journey link ที่ผูกกับ entity นี้
        $stmt = $db->prepare('
            SELECT jl.id AS link_id, jl.instance_id, wi.current_stage
            FROM workflow_journey_links jl
            JOIN workflow_instances wi ON jl.instance_id = wi.id
            WHERE jl.entity_type = ?
              AND jl.entity_id   = ?
              AND jl.stage       = ?
              AND jl.stage_status = \'active\'
              AND wi.tenant_id   = ?
            LIMIT 1
        ');
        $stmt->execute([$entityType, $entityId, $fromStage, $tenantId]);
        $link = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$link) return; // ไม่มี journey — skip

        $stageOrder = ['marketing', 'sales', 'project', 'support', 'renewal'];
        $idx = array_search($fromStage, $stageOrder);
        $nextStage = $stageOrder[$idx + 1] ?? null;

        // Mark current link completed
        $db->prepare('
            UPDATE workflow_journey_links
            SET stage_status = \'completed\', completed_at = NOW()
            WHERE id = ?
        ')->execute([$link['link_id']]);

        // อัปเดต current_stage ใน instance
        if ($nextStage) {
            $db->prepare('
                UPDATE workflow_instances
                SET current_stage = ?, updated_at = NOW()
                WHERE id = ?
            ')->execute([$nextStage, $link['instance_id']]);
        } else {
            // ถึง renewal แล้ว → complete journey
            $db->prepare('
                UPDATE workflow_instances
                SET status = \'completed\', current_stage = \'renewal\', completed_at = NOW(), updated_at = NOW()
                WHERE id = ?
            ')->execute([$link['instance_id']]);
        }

        // บันทึก step log
        $db->prepare('
            INSERT INTO workflow_step_logs
              (id, instance_id, step_id, step_name, assignee_id, started_at, completed_at, duration_minutes, status)
            VALUES (UUID(), ?, ?, ?, NULL, NOW(), NOW(), 0, \'completed\')
        ')->execute([$link['instance_id'], $fromStage, 'advance:' . $fromStage . '->' . ($nextStage ?? 'done')]);

    } catch (Exception $e) {
        // Journey auto-advance เป็น optional — ไม่ throw ให้ caller
        error_log('[journeyAutoAdvance] ' . $e->getMessage());
    }
}

/**
 * เคลียร์ journey stage links ที่ผูกกับ entity ที่กำลังจะถูกลบ
 * เรียกจาก DELETE handler ของ opportunity/project/support_ticket
 * เพื่อไม่ให้เหลือ link ค้างที่ชี้ไป entity ที่ไม่มีอยู่แล้ว (orphan)
 *
 * @param PDO    $db
 * @param string $entityType  'opportunity'|'project'|'support_ticket'
 * @param string $entityId
 * @return void
 */
function journeyCleanupEntityLinks(PDO $db, string $entityType, string $entityId): void {
    try {
        $db->prepare('DELETE FROM workflow_journey_links WHERE entity_type = ? AND entity_id = ?')
           ->execute([$entityType, $entityId]);
    } catch (Exception $e) {
        // optional cleanup — ไม่ throw ให้ caller
        error_log('[journeyCleanupEntityLinks] ' . $e->getMessage());
    }
}

/**
 * ดึง tasks ของ entity พร้อม subtasks สำหรับแสดงใน journey detail
 *
 * @param PDO    $db
 * @param string $tenantId
 * @param string $entityType  'project'|'opportunity'|'support_ticket'
 * @param string $entityId
 * @return array  tasks[] แต่ละ task มี subtasks[]
 */
function getJourneyEntityTasks(PDO $db, string $tenantId, string $entityType, string $entityId): array {
    if ($entityType === 'project') {
        // parent tasks ของ project (ไม่รวม subtask)
        $stmt = $db->prepare('
            SELECT t.id, t.title AS name, t.status, t.assignee_user_id,
                   u.display_name AS first_name, NULL AS last_name,
                   t.estimated_hours, t.actual_hours,
                   t.start_date, t.end_date AS due_date, t.completed_date,
                   t.description AS notes, t.parent_task_id
            FROM tasks t
            LEFT JOIN users u ON t.assignee_user_id = u.id
            WHERE t.project_id = ?
              AND t.tenant_id  = ?
              AND t.parent_task_id IS NULL
              AND t.deleted_at IS NULL
            ORDER BY t.sort_order, t.created_at
        ');
        $stmt->execute([$entityId, $tenantId]);
        $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($tasks as &$task) {
            $task['status'] = normalizeTaskStatus($task['status']);
        }
        unset($task);

        // subtasks สำหรับแต่ละ parent
        foreach ($tasks as &$task) {
            $subStmt = $db->prepare('
                SELECT t.id, t.title AS name, t.status, t.actual_hours, t.estimated_hours,
                       u.display_name AS first_name, NULL AS last_name, t.description AS notes, t.completed_date
                FROM tasks t
                LEFT JOIN users u ON t.assignee_user_id = u.id
                WHERE t.parent_task_id = ?
                  AND t.tenant_id = ?
                  AND t.deleted_at IS NULL
                ORDER BY t.sort_order, t.created_at
            ');
            $subStmt->execute([$task['id'], $tenantId]);
            $subs = $subStmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($subs as &$sub) { $sub['status'] = normalizeTaskStatus($sub['status']); }
            unset($sub);
            $task['subtasks'] = $subs;
        }
        unset($task);
        return $tasks;
    }

    if ($entityType === 'opportunity') {
        // Tasks are linked via the opportunity's project_id
        $stmt = $db->prepare('
            SELECT t.id, t.title AS name, t.status, t.actual_hours, t.estimated_hours,
                   u.display_name AS first_name, NULL AS last_name, t.description AS notes,
                   t.completed_date, t.start_date, t.end_date AS due_date
            FROM tasks t
            LEFT JOIN users u ON t.assignee_user_id = u.id
            JOIN sales_opportunities o ON o.project_id = t.project_id
            WHERE o.id = ?
              AND o.tenant_id = ?
              AND t.tenant_id = ?
              AND t.parent_task_id IS NULL
              AND t.deleted_at IS NULL
            ORDER BY t.created_at
        ');
        $stmt->execute([$entityId, $tenantId, $tenantId]);
        $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($tasks as &$t) { $t['status'] = normalizeTaskStatus($t['status']); $t['subtasks'] = []; }
        unset($t);
        return $tasks;
    }

    if ($entityType === 'support_ticket') {
        // Tasks are linked via the support ticket's project_id
        $stmt = $db->prepare('
            SELECT t.id, t.title AS name, t.status, t.actual_hours, t.estimated_hours,
                   u.display_name AS first_name, NULL AS last_name, t.description AS notes,
                   t.completed_date, t.start_date, t.end_date AS due_date
            FROM tasks t
            LEFT JOIN users u ON t.assignee_user_id = u.id
            JOIN support_tickets st ON st.project_id = t.project_id
            WHERE st.id = ?
              AND st.tenant_id = ?
              AND t.tenant_id = ?
              AND t.parent_task_id IS NULL
              AND t.deleted_at IS NULL
            ORDER BY t.created_at
        ');
        $stmt->execute([$entityId, $tenantId, $tenantId]);
        $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($tasks as &$t) { $t['status'] = normalizeTaskStatus($t['status']); $t['subtasks'] = []; }
        unset($t);
        return $tasks;
    }

    return [];
}
