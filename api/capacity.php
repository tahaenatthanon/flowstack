<?php
/**
 * api/capacity.php
 * ─────────────────────────────────────────────────────────────────────────────
 * Calendar-aware capacity & effective-hours calculator.
 *
 * GET /api/capacity.php
 *   ?user_id=<uuid>          (required)
 *   &start_date=YYYY-MM-DD   (required)
 *   &end_date=YYYY-MM-DD     (required)
 *   &estimated_hours=<float> (optional – triggers effective-hours calculation)
 *   &exclude_task_id=<uuid>  (optional – omit this task when summing daily load)
 *   &check_date=YYYY-MM-DD   (optional – check single-day used/available hours)
 *
 * Returns JSON with capacity details, per-day breakdown, and optional warning.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/task-hours-rollup.php';

$tokenData = requireAuth();

$db       = getDB();
$userId   = $_GET['user_id']       ?? '';
$start    = $_GET['start_date']    ?? '';
$end      = $_GET['end_date']      ?? '';
$rawHours = isset($_GET['estimated_hours']) ? floatval($_GET['estimated_hours']) : null;
$excludeId = $_GET['exclude_task_id'] ?? null;
$checkDate = $_GET['check_date']   ?? null;

if (!$userId || !$start || !$end) {
    jsonError('user_id, start_date, end_date are required', 400);
}
if ($end < $start) {
    jsonError('end_date must be >= start_date', 400);
}

// Security: user can only query their own capacity unless admin
$me       = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$isAdmin = isTenantAdmin($db, $me, $tenantId);

if (!$isAdmin && $me !== $userId) {
    jsonError('Forbidden', 403);
}

// Apply tenant timezone so all date-boundary checks (holidays, schedules) use the correct local date.
// Without this, a UTC+7 tenant on a UTC server would shift "today" by 7 hours.
$tzStmt = $db->prepare('SELECT timezone FROM company_settings WHERE tenant_id = ? LIMIT 1');
$tzStmt->execute([$tenantId]);
$tenantTz = $tzStmt->fetchColumn() ?: 'Asia/Bangkok';
// Validate before applying — fall back to Bangkok if IANA name is unrecognised
try {
    date_default_timezone_set($tenantTz);
    new DateTimeZone($tenantTz); // throws if invalid
} catch (Exception $e) {
    date_default_timezone_set('Asia/Bangkok');
    $tenantTz = 'Asia/Bangkok';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tableExists(PDO $db, string $table): bool {
    $stmt = $db->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1');
    $stmt->execute([$table]);
    return (bool)$stmt->fetchColumn();
}

/**
 * Fetch company holidays (calendar_events is the primary source).
 * Returns Set of date strings.
 */
function fetchHolidays(PDO $db, string $tenantId, string $start, string $end): array {
    $holidays = [];

    // 1) Primary source: calendar_events
    $stmt = $db->prepare(
        "SELECT DATE(start_at) AS d
         FROM calendar_events
         WHERE tenant_id = ?
           AND event_type = 'holiday'
           AND status != 'cancelled'
           AND DATE(start_at) BETWEEN ? AND ?"
    );
    $stmt->execute([$tenantId, $start, $end]);
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $d) {
        $holidays[$d] = true;
    }

    // 2) Fallback source: dedicated table (if present)
    if (tableExists($db, 'company_holidays')) {
        $stmt2 = $db->prepare(
            "SELECT holiday_date FROM company_holidays
             WHERE tenant_id = ? AND holiday_date BETWEEN ? AND ?"
        );
        $stmt2->execute([$tenantId, $start, $end]);
        foreach ($stmt2->fetchAll(PDO::FETCH_COLUMN) as $d) {
            $holidays[$d] = true;
        }
    }

    // 3) Legacy fallback: tasks with task_type='holiday'
    $stmt2 = $db->prepare(
        "SELECT DISTINCT start_date FROM tasks
         WHERE tenant_id = ? AND task_type = 'holiday'
           AND deleted_at IS NULL AND start_date BETWEEN ? AND ?"
    );
    $stmt2->execute([$tenantId, $start, $end]);
    foreach ($stmt2->fetchAll(PDO::FETCH_COLUMN) as $d) {
        $holidays[$d] = true;
    }

    return $holidays;
}

/**
 * Fetch approved leaves for a user.
 * Returns map: date => leave_hours (8 = full day, 4 = half day).
 */
function fetchUserLeaves(PDO $db, string $tenantId, string $userId, string $start, string $end): array {
    $leaves = [];

    // 1) Primary source: calendar_events (event_type='leave')
    //    Uses assignee_user_id first, falling back to created_by for legacy data
    $stmt = $db->prepare(
        "SELECT DATE(start_at) AS leave_date,
                CASE
                    WHEN all_day = 1 THEN 8.0
                    ELSE LEAST(8.0, GREATEST(0.0, TIMESTAMPDIFF(MINUTE, start_at, end_at) / 60.0))
                END AS hours
         FROM calendar_events
         WHERE tenant_id = ?
           AND (assignee_user_id = ? OR (assignee_user_id IS NULL AND created_by = ?))
           AND event_type = 'leave'
           AND status != 'cancelled'
           AND DATE(start_at) BETWEEN ? AND ?"
    );
    $stmt->execute([$tenantId, $userId, $userId, $start, $end]);
    foreach ($stmt->fetchAll() as $row) {
        $leaves[$row['leave_date']] = (float)$row['hours'];
    }

    // 2) Fallback source: dedicated user_leaves table (if present)
    if (tableExists($db, 'user_leaves')) {
        $stmt2 = $db->prepare(
            "SELECT leave_date, hours FROM user_leaves
             WHERE tenant_id = ? AND user_id = ? AND status = 'approved'
               AND leave_date BETWEEN ? AND ?"
        );
        $stmt2->execute([$tenantId, $userId, $start, $end]);
        foreach ($stmt2->fetchAll() as $row) {
            $leaves[$row['leave_date']] = max((float)$row['hours'], $leaves[$row['leave_date']] ?? 0);
        }
    }

    // 3) Legacy fallback: tasks with task_type='leave'
    $stmt2 = $db->prepare(
        "SELECT start_date, COALESCE(actual_hours, estimated_hours, 8) AS hours
         FROM tasks
         WHERE tenant_id = ? AND assignee_user_id = ?
           AND task_type = 'leave' AND deleted_at IS NULL
           AND start_date BETWEEN ? AND ?"
    );
    $stmt2->execute([$tenantId, $userId, $start, $end]);
    foreach ($stmt2->fetchAll() as $row) {
        // Take the greater of the two sources (avoid reducing an already-recorded leave)
        $leaves[$row['start_date']] = max((float)$row['hours'], $leaves[$row['start_date']] ?? 0);
    }

    return $leaves;
}

/**
 * Fetch calendar overrides for a user.
 * Returns map: date => ['type'=>'work'|'off', 'hours'=>float]
 */
function fetchOverrides(PDO $db, string $tenantId, string $userId, string $start, string $end): array {
    $overrides = [];
    if (!tableExists($db, 'calendar_overrides')) {
        return $overrides;
    }
    $stmt = $db->prepare(
        "SELECT override_date, override_type, hours
         FROM calendar_overrides
         WHERE tenant_id = ? AND user_id = ?
           AND override_date BETWEEN ? AND ?"
    );
    $stmt->execute([$tenantId, $userId, $start, $end]);
    foreach ($stmt->fetchAll() as $row) {
        $overrides[$row['override_date']] = [
            'type'  => $row['override_type'],
            'hours' => (float)$row['hours'],
        ];
    }
    return $overrides;
}

/**
 * Build per-day capacity map.
 *
 * Priority order (highest wins):
 *   1. calendar_overrides (explicit override)
 *   2. schedule-based non-working days (resolved from work_schedules)
 *   3. company holiday (= 0h unless overridden)
 *   4. user leave (reduces remaining capacity)
 *   5. work schedule hours (from work_schedules)
 *
 * @return array<string, array{capacity:float, reason:string}>
 */
function buildDayCapacities(
    PDO    $db,
    string $tenantId,
    string $userId,
    string $start,
    string $end,
    string $timezone = 'Asia/Bangkok'
): array {
    $holidays  = fetchHolidays($db, $tenantId, $start, $end);
    $leaves    = fetchUserLeaves($db, $tenantId, $userId, $start, $end);
    $overrides = fetchOverrides($db, $tenantId, $userId, $start, $end);

    $schedule = resolveSchedule($db, $tenantId, $userId);

    $tz      = new DateTimeZone($timezone);
    $result  = [];
    $current = new DateTime($start, $tz);
    $endDt   = new DateTime($end, $tz);

    while ($current <= $endDt) {
        $d   = $current->format('Y-m-d');
        $dow = (int)$current->format('N'); // 1=Mon … 7=Sun

        if (isset($overrides[$d])) {
            $ov = $overrides[$d];
            if ($ov['type'] === 'work') {
                // Forced work day — still deduct approved leave (e.g. called in on Saturday but then fell ill)
                $leaveHours = $leaves[$d] ?? 0.0;
                $capacity   = max(0.0, (float)$ov['hours'] - $leaveHours);
                $reason     = $leaveHours >= (float)$ov['hours']
                    ? 'override_work_full_leave'
                    : ($leaveHours > 0 ? 'override_work_partial_leave' : 'override_work');
                $result[$d] = ['capacity' => round($capacity, 2), 'reason' => $reason];
                $current->modify('+1 day');
                continue;
            }
            // type === 'off' — forced off regardless of schedule
            $result[$d] = ['capacity' => 0.0, 'reason' => 'override_off'];
            $current->modify('+1 day');
            continue;
        }

        $schedDay = $schedule[$dow] ?? ['is_working' => 0, 'work_hours' => 0.0];
        if (!$schedDay['is_working']) {
            $result[$d] = ['capacity' => 0.0, 'reason' => 'non_working'];
            $current->modify('+1 day');
            continue;
        }

        if (isset($holidays[$d])) {
            $result[$d] = ['capacity' => 0.0, 'reason' => 'holiday'];
            $current->modify('+1 day');
            continue;
        }

        // Normal working day — apply leave deduction
        $leaveHours  = $leaves[$d] ?? 0.0;
        $dayHours    = (float)$schedDay['work_hours'];
        $capacity    = max(0.0, $dayHours - $leaveHours);
        $reason      = $leaveHours >= $dayHours ? 'full_leave' : ($leaveHours > 0 ? 'partial_leave' : 'working');
        $result[$d]  = ['capacity' => round($capacity, 2), 'reason' => $reason];
        $current->modify('+1 day');
    }

    return $result;
}

/**
 * Sum actual or estimated hours already assigned to this user on a given date
 * (leaf tasks only — tasks that have no children).
 *
 * @param string|null $excludeTaskId  skip this task ID when summing
 */
function sumUsedHoursOnDate(
    PDO    $db,
    string $tenantId,
    string $userId,
    string $date,
    ?string $excludeTaskId = null
): float {
    // Leaf task = either has a parent OR has no children
    $sql = "
        SELECT COALESCE(SUM(COALESCE(actual_hours, estimated_hours, 0)), 0)
        FROM tasks
        WHERE tenant_id = ?
          AND assignee_user_id = ?
          AND start_date <= ?
          AND end_date   >= ?
          AND deleted_at IS NULL
          AND task_type NOT IN ('leave','holiday')
          AND (
              parent_task_id IS NOT NULL         -- is a subtask (leaf by definition)
              OR NOT EXISTS (                    -- root task with no children
                  SELECT 1 FROM tasks c
                  WHERE c.parent_task_id = tasks.id AND c.deleted_at IS NULL
              )
          )
    ";
    $params = [$tenantId, $userId, $date, $date];

    if ($excludeTaskId) {
        $sql    .= " AND id != ?";
        $params[] = $excludeTaskId;
    }

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    return round((float)$stmt->fetchColumn(), 2);
}

// ─── Main response ────────────────────────────────────────────────────────────

$dayCaps       = buildDayCapacities($db, $tenantId, $userId, $start, $end, $tenantTz);
$totalCapacity = array_sum(array_column($dayCaps, 'capacity'));
$workingDays   = count(array_filter($dayCaps, fn($v) => $v['capacity'] > 0));

// Single-date daily-load check
if ($checkDate) {
    $cap     = $dayCaps[$checkDate] ?? ['capacity' => 0.0, 'reason' => 'unknown'];
    $used    = sumUsedHoursOnDate($db, $tenantId, $userId, $checkDate, $excludeId);
    $avail   = round(max(0, $cap['capacity'] - $used), 2);
    jsonResponse([
        'date'       => $checkDate,
        'capacity'   => $cap['capacity'],
        'reason'     => $cap['reason'],
        'used'       => $used,
        'available'  => $avail,
        'overloaded' => $used > $cap['capacity'] && $cap['capacity'] > 0,
    ]);
}

// Effective-hours calculation (distribute rawHours across valid work days)
$effectiveHours = null;
$overCapacity   = false;
$dailyLoad      = [];

if ($rawHours !== null) {
    $effectiveHours = round(min($rawHours, $totalCapacity), 2);
    $overCapacity   = $rawHours > $totalCapacity;

    // Per-day used + available (for concurrency check across task range)
    $current = new DateTime($start);
    $endDt   = new DateTime($end);
    while ($current <= $endDt) {
        $d   = $current->format('Y-m-d');
        $cap = $dayCaps[$d]['capacity'] ?? 0.0;
        if ($cap > 0) {
            $used  = sumUsedHoursOnDate($db, $tenantId, $userId, $d, $excludeId);
            $avail = round(max(0, $cap - $used), 2);
            $dailyLoad[$d] = [
                'capacity'   => $cap,
                'used'       => $used,
                'available'  => $avail,
                'overloaded' => $used > $cap,
            ];
        }
        $current->modify('+1 day');
    }
}

jsonResponse([
    'user_id'          => $userId,
    'start_date'       => $start,
    'end_date'         => $end,
    'working_days'     => $workingDays,
    'total_capacity'   => round($totalCapacity, 2),
    'raw_hours'        => $rawHours,
    'effective_hours'  => $effectiveHours,
    'over_capacity'    => $overCapacity,
    'warning'          => $overCapacity,
    'day_capacities'   => $dayCaps,     // per-day capacity & reason
    'daily_load'       => $dailyLoad,   // per-day used/available (only when estimated_hours given)
]);
