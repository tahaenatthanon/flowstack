<?php
/**
 * Unified task-hours rollup helper.
 *
 * Recalculates estimated_hours, actual_hours, estimated_days, and days_spent
 * for a parent task from its children.
 * All hour values = ROUND(SUM(children), 2). Day values = ROUND(hours / 8).
 * Falls back to the parent's own stored values when no active, non-cancelled children remain.
 *
 * Filters: deleted_at IS NULL, is_subtask = 0, status != 'cancelled'
 * Walks up to grandparent recursively.
 *
 * Used by tasks.php, subtasks.php, task-hours.php, task-hours-batch.php
 */

/**
 * Fetch all holidays in a date range, merging calendar_events and legacy company_holidays.
 * @return array<string, bool> keyed by date (Y-m-d)
 */
function fetchHolidaySet(PDO $db, string $tenantId, string $startDate, string $endDate): array {
    // Fetch holidays from calendar_events
    $stmt = $db->prepare(
        "SELECT DISTINCT DATE(start_at) FROM calendar_events
         WHERE tenant_id = ? AND event_type = 'holiday' AND DATE(start_at) BETWEEN ? AND ?"
    );
    $stmt->execute([$tenantId, $startDate, $endDate]);
    $holidays = array_flip($stmt->fetchAll(PDO::FETCH_COLUMN));

    // Also check legacy company_holidays table if it exists
    try {
        $stmt2 = $db->prepare(
            "SELECT DISTINCT holiday_date FROM company_holidays WHERE tenant_id = ? AND holiday_date BETWEEN ? AND ?"
        );
        $stmt2->execute([$tenantId, $startDate, $endDate]);
        foreach ($stmt2->fetchAll(PDO::FETCH_COLUMN) as $d) {
            $holidays[$d] = true;
        }
    } catch (PDOException $e) {
        if ($e->getCode() !== '42S02') throw $e; // only ignore "table doesn't exist"
    }

    return $holidays;
}

/**
 * Return per-day schedule map for a user (or tenant default if no user).
 * @return array<int, array{is_working:int, work_hours:float}>  keyed by day_of_week 1–7
 */
function resolveSchedule(PDO $db, string $tenantId, ?string $userId): array {
    // Default fallback (hardcode Mon–Fri 8h) — used when no DB schedule exists
    $fallback = [];
    for ($d = 1; $d <= 7; $d++) {
        $fallback[$d] = ['is_working' => ($d <= 5 ? 1 : 0), 'work_hours' => ($d <= 5 ? 8.0 : 0.0)];
    }

    // Try user schedule first
    if ($userId) {
        $stmt = $db->prepare(
            'SELECT wsd.day_of_week, wsd.is_working, wsd.work_hours
             FROM user_work_schedules uws
             JOIN work_schedule_days wsd ON wsd.schedule_id = uws.schedule_id
             WHERE uws.user_id = ?'
        );
        $stmt->execute([$userId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if ($rows) {
            $map = [];
            foreach ($rows as $r) $map[(int)$r['day_of_week']] = ['is_working' => (int)$r['is_working'], 'work_hours' => (float)$r['work_hours']];
            return $map;
        }
    }

    // Try tenant default schedule
    $stmt = $db->prepare(
        'SELECT wsd.day_of_week, wsd.is_working, wsd.work_hours
         FROM work_schedules ws
         JOIN work_schedule_days wsd ON wsd.schedule_id = ws.id
         WHERE ws.tenant_id = ? AND ws.is_default = 1
         ORDER BY wsd.day_of_week'
    );
    $stmt->execute([$tenantId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if ($rows) {
        $map = [];
        foreach ($rows as $r) $map[(int)$r['day_of_week']] = ['is_working' => (int)$r['is_working'], 'work_hours' => (float)$r['work_hours']];
        return $map;
    }

    return $fallback;
}

/**
 * Count working days between two dates (inclusive), excluding weekends and company holidays.
 * Returns at least 1.
 */
function countWorkingDays(PDO $db, string $tenantId, string $startDate, string $endDate, ?string $userId = null): int {
    $schedule = resolveSchedule($db, $tenantId, $userId);
    $holidays = fetchHolidaySet($db, $tenantId, $startDate, $endDate);

    $count   = 0;
    $current = strtotime($startDate);
    $end     = strtotime($endDate);
    while ($current <= $end) {
        $dow = (int)date('N', $current); // 1=Mon…7=Sun
        $d   = date('Y-m-d', $current);
        if (!isset($holidays[$d]) && ($schedule[$dow]['is_working'] ?? 0)) {
            $count++;
        }
        $current += 86400;
    }
    return max(1, $count);
}

/**
 * Sum actual work_hours across all working days in [startDate, endDate],
 * respecting schedule, holidays, and calendar_overrides for the user.
 * Returns at least 1.0 hour.
 */
function countWorkingHours(PDO $db, string $tenantId, string $startDate, string $endDate, ?string $userId = null): float {
    $schedule = resolveSchedule($db, $tenantId, $userId);
    $holidays = fetchHolidaySet($db, $tenantId, $startDate, $endDate);

    // calendar_overrides for this user (if table exists)
    $overrides = [];
    if ($userId) {
        try {
            $stmt3 = $db->prepare(
                "SELECT override_date, override_type, hours FROM calendar_overrides
                 WHERE tenant_id = ? AND user_id = ? AND override_date BETWEEN ? AND ?"
            );
            $stmt3->execute([$tenantId, $userId, $startDate, $endDate]);
            foreach ($stmt3->fetchAll(PDO::FETCH_ASSOC) as $ov) {
                $overrides[$ov['override_date']] = $ov;
            }
        } catch (PDOException $e) {
            if ($e->getCode() !== '42S02') throw $e; // only ignore "table doesn't exist"
        }
    }

    $total   = 0.0;
    $current = strtotime($startDate);
    $end     = strtotime($endDate);
    while ($current <= $end) {
        $dow = (int)date('N', $current);
        $d   = date('Y-m-d', $current);

        if (isset($overrides[$d])) {
            $ov = $overrides[$d];
            $total += $ov['override_type'] === 'work' ? (float)$ov['hours'] : 0.0;
            $current += 86400;
            continue;
        }

        if (isset($holidays[$d])) { $current += 86400; continue; }

        if ($schedule[$dow]['is_working'] ?? 0) {
            $total += (float)($schedule[$dow]['work_hours'] ?? 8.0);
        }
        $current += 86400;
    }
    return max(1.0, $total);
}

function recalcTaskHoursFromChildrenUnified(PDO $db, string $taskId): void {
    // Read parent's current stored values (fallback when no children)
    $stmt = $db->prepare('SELECT tenant_id, assignee_user_id, estimated_hours, actual_hours, base_actual_hours, start_date, end_date FROM tasks WHERE id = ?');
    $stmt->execute([$taskId]);
    $parent = $stmt->fetch();
    if (!$parent) return;

    // Sum from active, non-cancelled children
    $stmt = $db->prepare('
        SELECT
            COUNT(*) as child_count,
            COALESCE(SUM(estimated_hours), 0) as total_est,
            COALESCE(SUM(actual_hours), 0) as total_act
        FROM tasks
        WHERE parent_task_id = ?
          AND deleted_at IS NULL
          AND is_subtask = 0
          AND status != \'cancelled\'
    ');
    $stmt->execute([$taskId]);
    $totals = $stmt->fetch();
    $childCount = (int)($totals['child_count'] ?? 0);

    // Resolve hours-per-day for this user's schedule (used for days_spent conversion)
    $scheduleMap  = resolveSchedule($db, $parent['tenant_id'], $parent['assignee_user_id'] ?? null);
    $workingDays  = array_filter($scheduleMap, fn($d) => $d['is_working']);
    $hoursPerDay  = count($workingDays) > 0
        ? array_sum(array_column($workingDays, 'work_hours')) / count($workingDays)
        : 8.0;
    $hoursPerDay  = max(1.0, $hoursPerDay);

    if ($childCount > 0) {
        // Parent with children: estimated + actual = SUM from children rounded to 2dp
        $finalEst = round((float)($totals['total_est'] ?? 0), 2);
        $finalAct = round((float)($totals['total_act'] ?? 0), 2);
        $finalEstDays   = max(1, (int)round($finalEst / $hoursPerDay));
        $finalDaysSpent = max(0, (int)round($finalAct / $hoursPerDay));
    } else {
        // Leaf task (no children):
        //   estimated_hours = hours from schedule (recomputable pure function of the date range)
        //   actual_hours   = base_actual_hours (original manual value before rollup)
        $finalEst = 0;
        $finalEstDays = 1;
        if ($parent['start_date'] && $parent['end_date']) {
            $assigneeUserId = $parent['assignee_user_id'] ?? null;
            $finalEstDays = countWorkingDays($db, $parent['tenant_id'], $parent['start_date'], $parent['end_date'], $assigneeUserId);
            $finalEst     = round(countWorkingHours($db, $parent['tenant_id'], $parent['start_date'], $parent['end_date'], $assigneeUserId), 2);
        }
        $finalAct = round((float)($parent['base_actual_hours'] ?? $parent['actual_hours'] ?? 0), 2);
        $finalDaysSpent = max(0, (int)round($finalAct / $hoursPerDay));
    }

    $stmt = $db->prepare('UPDATE tasks SET estimated_hours = ?, actual_hours = ?, estimated_days = ?, days_spent = ?, updated_at = NOW() WHERE id = ?');
    $stmt->execute([$finalEst, $finalAct, $finalEstDays, $finalDaysSpent, $taskId]);

    // Sync project.actual_hours from all non-cancelled root tasks
    $projStmt = $db->prepare('SELECT project_id FROM tasks WHERE id = ?');
    $projStmt->execute([$taskId]);
    $projectId = $projStmt->fetchColumn();
    if ($projectId) {
        $db->prepare(
            'UPDATE projects SET actual_hours = (
                SELECT COALESCE(SUM(t.actual_hours), 0)
                FROM tasks t
                WHERE t.project_id = ? AND t.deleted_at IS NULL
                  AND t.parent_task_id IS NULL AND t.status != \'cancelled\'
             ), updated_at = NOW()
             WHERE id = ?'
        )->execute([$projectId, $projectId]);
    }

    // Walk up to grandparent
    $stmt = $db->prepare('SELECT parent_task_id FROM tasks WHERE id = ?');
    $stmt->execute([$taskId]);
    $grandParentId = $stmt->fetchColumn();
    if ($grandParentId) {
        recalcTaskHoursFromChildrenUnified($db, $grandParentId);
    }
}
