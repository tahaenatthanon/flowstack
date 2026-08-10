<?php
/**
 * ImpactOS API โ€” KPI Calculation Engine
 * GET ?view=ceo|leaderboard|dev|sales|support&month=YYYY-MM&user_id=
 *
 * NOTE: Hours are calculated from leaf tasks only.
 * Rule: if a task has subtasks, use subtasks; if not, use task's own hours.
 */
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId    = $tokenData['user_id'];
$tenantId  = $tokenData['tenant_id'];
$db        = getDB();

$view    = $_GET['view']    ?? 'ceo';
$month   = $_GET['month']   ?? date('Y-m');
$uid     = $_GET['user_id'] ?? $userId;

// ── Period setup (year overrides month) ───────────────────────────────────────
// Pass ?year=YYYY for full-year aggregation; ?month=YYYY-MM for monthly (default).
if (isset($_GET['year'])) {
    $year = (int)$_GET['year'];
    if ($year === 0) {
        // "ทั้งหมด" — no date restriction
        $s_period   = '2000-01-01';
        $e_period   = '2099-12-31';
        $normFactor = 12;
        $month      = date('Y') . '-01';
    } else {
        $s_period   = "$year-01-01";
        $e_period   = "$year-12-31";
        $normFactor = 12;         // KPI hours norm: 12×160h = 1920h for 100%
        $month      = "$year-01"; // backward compat for views using monthRange()
    }
} else {
    $year       = (int)substr($month, 0, 4);
    [$s_period, $e_period] = monthRange($month);
    $normFactor = 1;
}

$isAdmin = isTenantAdmin($db, $userId, $tenantId);

// Scope ?user_id to this tenant — non-admins can only view their own data;
// admins can view other users but only within the same tenant.
if ($uid !== $userId) {
    if (!$isAdmin) {
        // Non-admin tried to view someone else's KPI → deny
        jsonError('Forbidden', 403);
    }
    // Admin: verify the requested user belongs to the same tenant
    $uidCheck = $db->prepare('SELECT 1 FROM tenant_users WHERE user_id = ? AND tenant_id = ?');
    $uidCheck->execute([$uid, $tenantId]);
    if (!$uidCheck->fetchColumn()) {
        jsonError('ผู้ใช้ไม่อยู่ใน tenant เดียวกัน', 403);
    }
}

// โ”€โ”€โ”€ Helpers โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€

function monthRange(string $month): array {
    $start = $month . '-01';
    $end   = date('Y-m-t', strtotime($start));
    return [$start, $end];
}

/**
 * Build WHERE clause matching tasks by assignee_user_id.
 * Display-name fallback removed after backfill migration (99.99% rows migrated).
 * Usage: $where = resolveAssigneeClause('t', $uid, $params);
 */
function resolveAssigneeClause(string $alias, string $uid, array &$params): string {
    $params[] = $uid;
    return "AND {$alias}.assignee_user_id = ?";
}

/**
 * Sum hours from leaf tasks only (task/subtask unified model).
 * A task is considered leaf when it has no non-deleted child with is_subtask = 0.
 */
function sumLeafTaskHours(PDO $db, string $tenantId, string $s, string $e, ?string $assigneeUserId = null): float {
    $sql = "
        SELECT COALESCE(SUM(t.actual_hours), 0) AS total_hours
        FROM tasks t
        WHERE t.tenant_id = ?
          AND t.is_subtask = 0
          AND t.deleted_at IS NULL
          AND t.start_date BETWEEN ? AND ?
          AND NOT EXISTS (
              SELECT 1
              FROM tasks c
              WHERE c.parent_task_id = t.id
                AND c.is_subtask = 0
                AND c.deleted_at IS NULL
          )
    ";

    $params = [$tenantId, $s, $e];
    if ($assigneeUserId !== null) {
        $sql .= ' AND t.assignee_user_id = ?';
        $params[] = $assigneeUserId;
    }

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    return (float)$stmt->fetchColumn();
}

function countActiveUsersByLeafTaskHours(PDO $db, string $tenantId, string $s, string $e): int {
    $stmt = $db->prepare(" 
        SELECT COUNT(DISTINCT t.assignee_user_id)
        FROM tasks t
        WHERE t.tenant_id = ?
          AND t.is_subtask = 0
          AND t.deleted_at IS NULL
          AND t.start_date BETWEEN ? AND ?
          AND COALESCE(t.actual_hours, 0) > 0
          AND t.assignee_user_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM tasks c
              WHERE c.parent_task_id = t.id
                AND c.is_subtask = 0
                AND c.deleted_at IS NULL
          )
    ");
    $stmt->execute([$tenantId, $s, $e]);
    return (int)$stmt->fetchColumn();
}

/**
 * ai_score: percentile rank within tenant for the period.
 * Returns 0–100 based on where the user ranks among all users who used AI.
 * Users with 0 messages score 0. Everyone else is ranked by count and
 * mapped linearly to 1–100, so scores spread across the full range
 * rather than collapsing at 100 when the median is very low.
 */
function calcAiScorePercentile(PDO $db, string $uid, string $s, string $e, string $tenantId): float {
    try {
        // Fetch counts for all active tenant users in the period
        $stmt = $db->prepare("
            SELECT cs.user_id, COUNT(DISTINCT cm.id) AS cnt
            FROM chat_messages cm
            JOIN chat_sessions cs ON cs.id = cm.session_id
            JOIN tenant_users tu  ON tu.user_id = cs.user_id AND tu.tenant_id = ?
            WHERE cm.role = 'user'
              AND cm.created_at BETWEEN ? AND ?
            GROUP BY cs.user_id
        ");
        $stmt->execute([$tenantId, $s . ' 00:00:00', $e . ' 23:59:59']);
        $rows = $stmt->fetchAll(PDO::FETCH_KEY_PAIR); // [user_id => cnt]
    } catch (\Throwable $ex) {
        $rows = [];
    }

    $myCount = (int)($rows[$uid] ?? 0);
    if ($myCount === 0) return 0.0;

    // Collect all non-zero counts including users not in chat at all (score 0)
    // Total active users in tenant
    try {
        $usersStmt = $db->prepare(
            "SELECT COUNT(*) FROM tenant_users WHERE tenant_id = ?"
        );
        $usersStmt->execute([$tenantId]);
        $totalUsers = max(1, (int)$usersStmt->fetchColumn());
    } catch (\Throwable $ex) {
        $totalUsers = max(1, count($rows));
    }

    // Rank: how many users scored strictly less than me (including zero-chat users)
    $zeroUsers  = $totalUsers - count($rows);          // users with 0 messages
    $belowMe    = $zeroUsers;                          // all zero-users rank below
    foreach ($rows as $uid2 => $cnt) {
        if ((int)$cnt < $myCount) $belowMe++;
    }

    // Percentile = (users below me / total users) × 100, capped at 100
    return round(min($belowMe / $totalUsers * 100, 100), 1);
}

/**
 * speed_score: เธเธฒเธเธ—เธตเนเธชเนเธเธ—เธฑเธเธเธณเธซเธเธ” / เธเธฒเธเธ—เธฑเนเธเธซเธกเธ”เธ—เธตเน complete เนเธเน€เธ”เธทเธญเธ
 * Uses tasks.assignee (display_name) to match user.
 */
function calcSpeedScore(PDO $db, string $uid, string $tenantId, string $s, string $e): float {
    $params = [];
    $assigneeWhere = resolveAssigneeClause('tasks', $uid, $params);
    // Exclude tasks living in Base Calendar (ปฏิทินทีม) so leave/meeting/etc. don't pollute
    // the Speed KPI of customer projects.
    $stmt = $db->prepare("
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN tasks.completed_date <= tasks.end_date THEN 1 ELSE 0 END) AS on_time
        FROM tasks
        LEFT JOIN projects p ON p.id = tasks.project_id
        WHERE 1=1 $assigneeWhere
          AND tasks.tenant_id = ?
          AND tasks.is_subtask = 0
          AND tasks.deleted_at IS NULL
          AND tasks.status = 'completed'
          AND tasks.completed_date BETWEEN ? AND ?
          AND (p.kind IS NULL OR p.kind = 'project')
    ");
    $params[] = $tenantId;
    $params[] = $s;
    $params[] = $e;
    $stmt->execute($params);
    $r = $stmt->fetch();
    if (!$r || (int)$r['total'] === 0) return 0;
    return round(((int)$r['on_time'] / (int)$r['total']) * 100, 1);
}

/**
 * impact_score: เธเธฑเนเธงเนเธกเธเธ—เธตเน log เนเธเน€เธ”เธทเธญเธ (normalize 160h โ’ 100)
 * Uses unified task/subtask model: sum only leaf task hours.
 */
function calcImpactScore(PDO $db, string $uid, string $tenantId, string $s, string $e, float $normHours = 160): float {
    $hrs = sumLeafTaskHours($db, $tenantId, $s, $e, $uid);
    return round(min($hrs / $normHours * 100, 100), 1);
}

function calcAiScore(PDO $db, string $uid, string $s, string $e, string $tenantId): float {
    return calcAiScorePercentile($db, $uid, $s, $e, $tenantId);
}

/**
 * collaboration: เธชเธฑเธ”เธชเนเธงเธเธเธฒเธเธ—เธตเนเธญเธขเธนเนเนเธ project เธ—เธตเนเธกเธต member > 1
 */
function calcCollabScore(PDO $db, string $uid, string $tenantId, string $s, string $e): ?float {
    // Total completed tasks for this user this period — exclude Base Calendar
    $params = [];
    $assigneeWhere = resolveAssigneeClause('t', $uid, $params);
    $totalStmt = $db->prepare("
        SELECT COUNT(DISTINCT t.id)
        FROM tasks t
        LEFT JOIN projects p ON p.id = t.project_id
        WHERE 1=1 $assigneeWhere
          AND t.tenant_id = ?
          AND t.is_subtask = 0
          AND t.deleted_at IS NULL
          AND t.status = 'completed'
          AND t.completed_date BETWEEN ? AND ?
          AND (p.kind IS NULL OR p.kind = 'project')
    ");
    $params[] = $tenantId;
    $params[] = $s;
    $params[] = $e;
    $totalStmt->execute($params);
    $total = (int)$totalStmt->fetchColumn();

    // Returns null when user has no completed tasks this month.
    // Frontend must display "N/A" (not a numeric default like 0 or 50).
    if ($total === 0) return null;

    // Tasks in projects with >1 member — also exclude Base Calendar
    $params2 = [];
    $assigneeWhere2 = resolveAssigneeClause('t', $uid, $params2);
    $teamStmt = $db->prepare("
        SELECT COUNT(DISTINCT t.id)
        FROM tasks t
        JOIN project_members pm ON t.project_id = pm.project_id
        JOIN projects p          ON p.id = t.project_id
        WHERE 1=1 $assigneeWhere2
          AND t.tenant_id = ?
          AND t.is_subtask = 0
          AND t.deleted_at IS NULL
          AND t.status = 'completed'
          AND t.completed_date BETWEEN ? AND ?
          AND p.kind = 'project'
    ");
    $params2[] = $tenantId;
    $params2[] = $s;
    $params2[] = $e;
    $teamStmt->execute($params2);
    $team = (int)$teamStmt->fetchColumn();

    return round(min($team / $total * 100, 100), 1);
}

/**
 * Load KPI weights for a user's department from kpi_weight_configs.
 * Returns [p, q, a, s] as fractions summing to 1.0.
 * Falls back to uniform 0.25 each if no config found.
 */
function loadKpiWeights(PDO $db, string $tenantId, string $userId): array {
    try {
        $stmt = $db->prepare("
            SELECT kw.p_weight, kw.q_weight, kw.a_weight, kw.s_weight, kw.b_weight
            FROM users u
            JOIN kpi_weight_configs kw
              ON kw.department = u.position
             AND kw.tenant_id  = ?
             AND kw.is_active  = 1
            WHERE u.id = ?
            LIMIT 1
        ");
        $stmt->execute([$tenantId, $userId]);
        $row = $stmt->fetch();
        if ($row) {
            $total = (float)$row['p_weight'] + (float)$row['q_weight']
                   + (float)$row['a_weight'] + (float)$row['s_weight']
                   + (float)$row['b_weight'];
            if ($total > 0) {
                return [
                    (float)$row['p_weight'] / $total,
                    (float)$row['q_weight'] / $total,
                    (float)$row['a_weight'] / $total,
                    (float)$row['s_weight'] / $total,
                    (float)$row['b_weight'] / $total,
                ];
            }
        }
    } catch (\Throwable $ex) {
        // fall through to default
    }
    return [0.25, 0.25, 0.25, 0.25, 0.0];
}

/**
 * BD score: measures lead-finding effectiveness for the period.
 * Formula: won_leads*30 + active_leads*10, capped at 100.
 */
function calcBdScore(PDO $db, string $userId, string $tenantId, string $start, string $end): float {
    $stmt = $db->prepare("
        SELECT
            SUM(CASE WHEN stage = 'won' THEN 1 ELSE 0 END) AS won,
            SUM(CASE WHEN stage NOT IN ('won','lost') THEN 1 ELSE 0 END) AS active
        FROM sales_opportunities
        WHERE created_by = ? AND tenant_id = ?
          AND DATE(created_at) BETWEEN ? AND ?
    ");
    $stmt->execute([$userId, $tenantId, $start, $end]);
    $row = $stmt->fetch();
    $score = ((int)($row['won'] ?? 0)) * 30 + ((int)($row['active'] ?? 0)) * 10;
    return (float)min(100, $score);
}

/**
 * PM Goal Score (Impact OS axis B for Project Managers).
 * Rate-based: win-rate of deals on the PM's managed projects + on-time rate of
 * the PM's finished projects. Attribution is via projects.manager_id.
 *   win_rate    = won / (won + lost)                  -- deals closed in period
 *   ontime_rate = on_time / (completed + cancelled)   -- projects finished in period
 *   on_time     = completed AND (original_end_date IS NULL OR end_date <= original_end_date)
 *   score       = round(win_rate*50 + ontime_rate*50)  (0..100)
 * Edge cases: if one denominator is 0, that half is dropped and the other scaled to 100.
 * Returns null when the PM has no closed deals AND no finished projects in the period
 * (caller re-normalizes the KPI across the B axis so the PM is not penalised).
 * See docs/superpowers/specs/2026-06-26-pm-goal-score-design.md
 */
function calcPmGoalScore(PDO $db, string $userId, string $tenantId, string $start, string $end): ?float {
    // Deals on projects this PM manages, closed (won|lost) within the period.
    $dStmt = $db->prepare("
        SELECT
            SUM(CASE WHEN so.stage = 'won'  THEN 1 ELSE 0 END) AS won,
            SUM(CASE WHEN so.stage = 'lost' THEN 1 ELSE 0 END) AS lost
        FROM sales_opportunities so
        JOIN projects p ON p.id = so.project_id
         AND p.manager_id = ? AND p.tenant_id = ?
        WHERE so.tenant_id = ?
          AND so.stage IN ('won','lost')
          AND COALESCE(so.actual_close_date, DATE(so.updated_at)) BETWEEN ? AND ?
    ");
    $dStmt->execute([$userId, $tenantId, $tenantId, $start, $end]);
    $d = $dStmt->fetch();
    $won  = (int)($d['won'] ?? 0);
    $lost = (int)($d['lost'] ?? 0);

    // Projects this PM manages, finished (completed|cancelled) within the period.
    $pStmt = $db->prepare("
        SELECT
            SUM(CASE WHEN status IN ('completed','cancelled') THEN 1 ELSE 0 END) AS finished,
            SUM(CASE WHEN status = 'completed'
                      AND (original_end_date IS NULL OR end_date <= original_end_date)
                     THEN 1 ELSE 0 END) AS on_time
        FROM projects
        WHERE manager_id = ? AND tenant_id = ?
          AND status IN ('completed','cancelled')
          AND DATE(updated_at) BETWEEN ? AND ?
    ");
    $pStmt->execute([$userId, $tenantId, $start, $end]);
    $p = $pStmt->fetch();
    $finished = (int)($p['finished'] ?? 0);
    $onTime   = (int)($p['on_time'] ?? 0);

    $closedDeals = $won + $lost;
    $hasDeals    = $closedDeals > 0;
    $hasProjects = $finished > 0;

    if (!$hasDeals && !$hasProjects) {
        return null; // no closed data this period — caller re-normalizes across axis B
    }

    $winRate    = $hasDeals    ? ($won / $closedDeals) : null;
    $onTimeRate = $hasProjects ? ($onTime / $finished) : null;

    if ($winRate !== null && $onTimeRate !== null) {
        $score = $winRate * 50 + $onTimeRate * 50;
    } elseif ($winRate !== null) {
        $score = $winRate * 100;   // only deals closed this period
    } else {
        $score = $onTimeRate * 100; // only projects finished this period
    }
    return round($score, 1);
}

/**
 * Resolve the axis-B score for a user: Project Managers use the PM Goal Score
 * (rate-based, may be null when no data); everyone else uses the BD lead score.
 */
function calcBAxisScore(PDO $db, string $userId, string $tenantId, string $start, string $end): ?float {
    $posStmt = $db->prepare("SELECT position FROM users WHERE id = ? LIMIT 1");
    $posStmt->execute([$userId]);
    $position = (string)($posStmt->fetchColumn() ?: '');
    if ($position === 'Project Manager') {
        return calcPmGoalScore($db, $userId, $tenantId, $start, $end);
    }
    return calcBdScore($db, $userId, $tenantId, $start, $end);
}

function calcKpi(float $speed, float $impact, float $ai, ?float $collab, array $weights = [0.3, 0.3, 0.2, 0.2, 0.0], ?float $bd = 0.0): float {
    $wP = $weights[0]; $wQ = $weights[1]; $wA = $weights[2]; $wS = $weights[3]; $wB = $weights[4] ?? 0.0;
    // axis mapping: P=impact (production/hours), Q=speed (quality/ontime), A=ai, S=collab, B=bd
    // When the B axis has no data (PM with nothing closed this period), drop it and
    // rescale the remaining P/Q/A/S weights so they still sum to 1 — no penalty.
    if ($bd === null) {
        $denom = 1.0 - $wB;
        $f = ($denom > 0) ? (1.0 / $denom) : 1.0;
        return round($wP * $f * $impact + $wQ * $f * $speed + $wA * $f * $ai + $wS * $f * ($collab ?? 0), 1);
    }
    return round($wP * $impact + $wQ * $speed + $wA * $ai + $wS * ($collab ?? 0) + $wB * $bd, 1);
}

/**
 * revenue_contribution: two-pass attribution.
 * Pass 1 — project_id link: tasks → project → won deal (task-weighted share).
 * Pass 2 — company fallback: deals with no project_id split equally among
 *           all users who completed tasks on any project for that company.
 * All-time (no period filter) so historical contributions are captured.
 */
function calcRevenueContribution(PDO $db, string $uid, string $tenantId): float {
    $total = 0.0;

    // ── Pass 1: project_id link ───────────────────────────────────────────────
    $p1 = [];
    $p1Where = resolveAssigneeClause('t', $uid, $p1);
    $p1Stmt  = $db->prepare("
        SELECT DISTINCT t.project_id
        FROM tasks t
        WHERE 1=1 $p1Where
          AND t.tenant_id  = ?
          AND t.is_subtask = 0
          AND t.deleted_at IS NULL
          AND t.status     = 'completed'
          AND t.project_id IS NOT NULL
    ");
    $p1[] = $tenantId;
    $p1Stmt->execute($p1);
    $myProjects = array_column($p1Stmt->fetchAll(), 'project_id');

    foreach ($myProjects as $projId) {
        $revStmt = $db->prepare(
            "SELECT COALESCE(SUM(value),0) FROM sales_opportunities WHERE project_id=? AND stage='won' AND tenant_id=?"
        );
        $revStmt->execute([$projId, $tenantId]);
        $projRevenue = (float)$revStmt->fetchColumn();
        if ($projRevenue <= 0.0) continue;

        $p2 = [];
        $w2 = resolveAssigneeClause('tasks', $uid, $p2);
        $utStmt = $db->prepare("SELECT COUNT(*) FROM tasks WHERE project_id=? $w2 AND is_subtask=0 AND deleted_at IS NULL AND status='completed'");
        $utStmt->execute(array_merge([$projId], $p2));
        $userTasks = (int)$utStmt->fetchColumn();

        $ttStmt = $db->prepare("SELECT COUNT(*) FROM tasks WHERE project_id=? AND is_subtask=0 AND deleted_at IS NULL AND status='completed'");
        $ttStmt->execute([$projId]);
        $totalTasks = max(1, (int)$ttStmt->fetchColumn());

        if ($userTasks > 0) {
            $total += ($userTasks / $totalTasks) * $projRevenue;
        }
    }

    // ── Pass 2: company_id fallback (deals with no project_id) ───────────────
    $myCompanies = [];
    if (!empty($myProjects)) {
        $inList = implode(',', array_fill(0, count($myProjects), '?'));
        $coStmt = $db->prepare("SELECT DISTINCT company_id FROM projects WHERE id IN ($inList) AND company_id IS NOT NULL");
        $coStmt->execute($myProjects);
        $myCompanies = array_column($coStmt->fetchAll(), 'company_id');
    }

    foreach ($myCompanies as $companyId) {
        $dealStmt = $db->prepare(
            "SELECT COALESCE(SUM(value),0) FROM sales_opportunities
             WHERE company_id=? AND stage='won' AND project_id IS NULL AND tenant_id=?"
        );
        $dealStmt->execute([$companyId, $tenantId]);
        $dealRevenue = (float)$dealStmt->fetchColumn();
        if ($dealRevenue <= 0.0) continue;

        $contribStmt = $db->prepare("
            SELECT COUNT(DISTINCT t.assignee_user_id)
            FROM tasks t
            JOIN projects p ON p.id = t.project_id
            WHERE p.company_id = ?
              AND t.tenant_id  = ?
              AND t.is_subtask = 0
              AND t.deleted_at IS NULL
              AND t.status     = 'completed'
              AND t.assignee_user_id IS NOT NULL
        ");
        $contribStmt->execute([$companyId, $tenantId]);
        $contribUsers = max(1, (int)$contribStmt->fetchColumn());

        $total += (1 / $contribUsers) * $dealRevenue;
    }

    return round($total, 2);
}

/**
 * Resolve active AI provider credentials (same logic as chat.php).
 * Returns ['api_key' => string, 'base_url' => string] or null.
 */
function resolveAiCredentials(PDO $db, string $tenantId = ''): ?array {
    try {
        $whereClause = $tenantId ? 'cs.tenant_id = ' . $db->quote($tenantId) : 'cs.id = 1';
        $stmt = $db->query("
            SELECT ap.api_base_url, ap.api_key_encrypted
            FROM company_settings cs
            JOIN ai_providers ap ON ap.id = cs.ai_active_provider_id
            WHERE $whereClause AND ap.api_key_encrypted IS NOT NULL AND ap.api_key_encrypted != ''
            LIMIT 1
        ");
        $row = $stmt ? $stmt->fetch() : null;
        if (!$row) return null;
        $plain = decryptApiKey($row['api_key_encrypted']);
        if ($plain === '' || $plain === false) return null;
        $baseUrl   = rtrim($row['api_base_url'] ?: 'https://api.kilo.ai/api/gateway', '/');
        return ['api_key' => trim($plain), 'base_url' => $baseUrl];
    } catch (\Throwable $ex) {
        return null;
    }
}

/** เนเธเธฅเธ score โ’ grade */
function grade(float $score): string {
    if ($score >= 90) return 'A+';
    if ($score >= 80) return 'A';
    if ($score >= 70) return 'B+';
    if ($score >= 60) return 'B';
    if ($score >= 50) return 'C';
    return 'D';
}

// โ”€โ”€โ”€ Views โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€

// โ”€โ”€ CEO Dashboard โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
if ($view === 'ceo') {
    $s = $s_period;
    $e = $e_period;

    // Revenue for selected period (from sales_opportunities won)
    $revStmt = $db->prepare("
        SELECT COALESCE(SUM(value), 0) AS revenue
        FROM sales_opportunities
        WHERE stage = 'won'
          AND tenant_id = ?
          AND DATE(COALESCE(actual_close_date, updated_at)) BETWEEN ? AND ?
    ");
    $revStmt->execute([$tenantId, $s, $e]);
    $revenueMonth = (float)$revStmt->fetchColumn();

    // Today revenue
    $todayStmt = $db->prepare("
        SELECT COALESCE(SUM(value), 0)
        FROM sales_opportunities
        WHERE stage = 'won' AND tenant_id = ? AND DATE(COALESCE(actual_close_date, updated_at)) = CURDATE()
    ");
    $todayStmt->execute([$tenantId]);
    $revenueToday = (float)$todayStmt->fetchColumn();

    // Active users this month (users with leaf task hours)
    $activeUsers = countActiveUsersByLeafTaskHours($db, $tenantId, $s, $e);

    // Tasks completed this month (non-subtask)
    $doneStmt = $db->prepare("
        SELECT COUNT(*) FROM tasks
        WHERE tenant_id = ? AND status = 'completed' AND is_subtask = 0
          AND deleted_at IS NULL AND completed_date BETWEEN ? AND ?
    ");
    $doneStmt->execute([$tenantId, $s, $e]);
    $tasksDone = (int)$doneStmt->fetchColumn();

    // Avg delivery time (days between start_date and completed_date)
    $avgStmt = $db->prepare("
        SELECT ROUND(AVG(DATEDIFF(completed_date, start_date)), 1)
        FROM tasks
        WHERE tenant_id = ? AND status = 'completed' AND is_subtask = 0
          AND deleted_at IS NULL AND completed_date BETWEEN ? AND ?
          AND DATEDIFF(completed_date, start_date) >= 0
    ");
    $avgStmt->execute([$tenantId, $s, $e]);
    $avgDelivery = (float)($avgStmt->fetchColumn() ?? 0);

    // Projects active (on-track, at-risk, delayed) — exclude Base Calendar
    $projStmt = $db->prepare("
        SELECT COUNT(*) FROM projects
        WHERE tenant_id = ? AND status NOT IN ('completed') AND deleted_at IS NULL
          AND kind = 'project'
          AND start_date <= ? AND end_date >= ?
    ");
    $projStmt->execute([$tenantId, $e, $s]);
    $activeProjects = (int)$projStmt->fetchColumn();

    // Monthly revenue trend (last 6 months)
    $trend = [];
    for ($i = 5; $i >= 0; $i--) {
        $m = date('Y-m', strtotime("-$i month"));
        [$ms, $me] = monthRange($m);
        $t = $db->prepare("
            SELECT COALESCE(SUM(value), 0)
            FROM sales_opportunities
            WHERE tenant_id = ? AND stage = 'won' AND DATE_FORMAT(COALESCE(actual_close_date, updated_at), '%Y-%m') = ?
        ");
        $t->execute([$tenantId, $m]);
        $trend[] = ['month' => $m, 'revenue' => (float)$t->fetchColumn()];
    }

    // Pipeline value
    $pipeStmt = $db->prepare("
        SELECT COALESCE(SUM(value * probability / 100), 0)
        FROM sales_opportunities
        WHERE tenant_id = ? AND stage NOT IN ('won', 'lost')
    ");
    $pipeStmt->execute([$tenantId]);
    $pipeline = (float)$pipeStmt->fetchColumn();

    // Hours this month from unified task/subtask model
    $totalHours = sumLeafTaskHours($db, $tenantId, $s, $e);

    jsonResponse([
        'revenue_today'    => $revenueToday,
        'revenue_month'    => $revenueMonth,
        'revenue_trend'    => $trend,
        'pipeline_value'   => $pipeline,
        'active_users'     => $activeUsers,
        'active_projects'  => $activeProjects,
        'tasks_done'       => $tasksDone,
        'avg_delivery_days'=> $avgDelivery,
        'total_hours'      => $totalHours,
    ]);
}

// โ”€โ”€ Leaderboard / KPI Rankings โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
if ($view === 'leaderboard') {
    $usersStmt = $db->prepare('SELECT u.id, u.display_name, u.position, tu.is_admin FROM users u JOIN tenant_users tu ON tu.user_id = u.id AND tu.tenant_id = ? WHERE u.is_active = 1 ORDER BY u.display_name');
    $usersStmt->execute([$tenantId]);
    $users = $usersStmt->fetchAll();

    $board = [];
    foreach ($users as $u) {
        $speed   = calcSpeedScore($db, $u['id'], $tenantId, $s_period, $e_period);
        $impact  = calcImpactScore($db, $u['id'], $tenantId, $s_period, $e_period, 160 * $normFactor);
        $ai      = calcAiScore($db, $u['id'], $s_period, $e_period, $tenantId);
        $collab  = calcCollabScore($db, $u['id'], $tenantId, $s_period, $e_period);
        $bd      = calcBAxisScore($db, $u['id'], $tenantId, $s_period, $e_period);
        $weights = loadKpiWeights($db, $tenantId, $u['id']);
        $total   = calcKpi($speed, $impact, $ai, $collab, $weights, $bd);

        // Tasks this period (non-subtask)
        $tParams = [];
        $tWhere = resolveAssigneeClause('tasks', $u['id'], $tParams);
        $ts = $db->prepare("SELECT COUNT(*) FROM tasks WHERE 1=1 $tWhere AND tenant_id = ? AND is_subtask = 0 AND deleted_at IS NULL AND completed_date BETWEEN ? AND ?");
        $tParams[] = $tenantId;
        $tParams[] = $s_period;
        $tParams[] = $e_period;
        $ts->execute($tParams);
        $taskCount = (int)$ts->fetchColumn();

        // Hours this period from unified task/subtask model
        $hours = sumLeafTaskHours($db, $tenantId, $s_period, $e_period, $u['id']);

        if ($taskCount === 0 && $hours === 0.0) continue; // skip inactive

        $board[] = [
            'user_id'              => $u['id'],
            'name'                 => $u['display_name'],
            'position'             => $u['position'],
            'speed_score'          => $speed,
            'impact_score'         => $impact,
            'ai_score'             => $ai,
            'collab_score'         => $collab,
            'total_score'          => $total,
            'grade'                => grade($total),
            'bd_score'             => $bd,
            'kpi_weights'          => ['p' => $weights[0], 'q' => $weights[1], 'a' => $weights[2], 's' => $weights[3], 'b' => $weights[4] ?? 0.0],
            'tasks_done'           => $taskCount,
            'hours'                => $hours,
            'revenue_contribution' => calcRevenueContribution($db, $u['id'], $tenantId),
        ];
    }

    usort($board, fn($a, $b) => $b['total_score'] <=> $a['total_score']);
    foreach ($board as $i => &$row) { $row['rank'] = $i + 1; }

    jsonResponse($board);
}

// โ”€โ”€ Dev Dashboard โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
if ($view === 'dev') {
    $s = $s_period;
    $e = $e_period;

    $speed   = calcSpeedScore($db, $uid, $tenantId, $s, $e);
    $impact  = calcImpactScore($db, $uid, $tenantId, $s, $e, 160 * $normFactor);
    $ai      = calcAiScore($db, $uid, $s, $e, $tenantId);
    $collab  = calcCollabScore($db, $uid, $tenantId, $s, $e);
    $bd      = calcBAxisScore($db, $uid, $tenantId, $s, $e);
    $weights = loadKpiWeights($db, $tenantId, $uid);
    $total   = calcKpi($speed, $impact, $ai, $collab, $weights, $bd);
    $revContrib = calcRevenueContribution($db, $uid, $tenantId);
    $tdParams = [];
    $tdWhere = resolveAssigneeClause('t', $uid, $tdParams);
    $ts = $db->prepare("
        SELECT t.*, p.name AS project_name
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE 1=1 $tdWhere
          AND t.tenant_id = ?
          AND t.is_subtask = 0
          AND t.deleted_at IS NULL
          AND t.completed_date BETWEEN ? AND ?
        ORDER BY t.completed_date DESC LIMIT 20
    ");
    $tdParams[] = $tenantId;
    $tdParams[] = $s;
    $tdParams[] = $e;
    $ts->execute($tdParams);
    $tasks = $ts->fetchAll();

        // Hours by project from leaf tasks (if a parent has subtasks, only subtasks are counted)
    $hrs = $db->prepare("
                SELECT p.name AS project_name, COALESCE(SUM(t.actual_hours), 0) AS hours
                FROM tasks t
                LEFT JOIN projects p ON t.project_id = p.id
                WHERE t.assignee_user_id = ?
                    AND t.tenant_id = ?
                    AND t.is_subtask = 0
                    AND t.deleted_at IS NULL
                    AND t.start_date BETWEEN ? AND ?
          AND p.id IS NOT NULL
                    AND NOT EXISTS (
                            SELECT 1
                            FROM tasks c
                            WHERE c.parent_task_id = t.id
                                AND c.is_subtask = 0
                                AND c.deleted_at IS NULL
                    )
        GROUP BY p.id, p.name ORDER BY hours DESC LIMIT 10
    ");
        $hrs->execute([$uid, $tenantId, $s, $e]);
    $hoursByProject = $hrs->fetchAll();

    // KPI trend (last 6 months — always monthly regardless of year filter)
    $kpiTrend = [];
    for ($i = 5; $i >= 0; $i--) {
        $m = date('Y-m', strtotime("-$i month"));
        [$ms, $me] = monthRange($m);
        $sp  = calcSpeedScore($db, $uid, $tenantId, $ms, $me);
        $im  = calcImpactScore($db, $uid, $tenantId, $ms, $me);
        $ai2 = calcAiScore($db, $uid, $ms, $me, $tenantId);
        $co  = calcCollabScore($db, $uid, $tenantId, $ms, $me);
        $bd2 = calcBAxisScore($db, $uid, $tenantId, $ms, $me);
        $kpiTrend[] = [
            'month'  => $m,
            'total'  => calcKpi($sp, $im, $ai2, $co, $weights, $bd2),
            'speed'  => $sp,
            'impact' => $im,
        ];
    }

    $myPosStmt = $db->prepare("SELECT position FROM users WHERE id = ? LIMIT 1");
    $myPosStmt->execute([$uid]);
    $myPosition = (string)($myPosStmt->fetchColumn() ?: '');

    jsonResponse([
        'speed_score'          => $speed,
        'impact_score'         => $impact,
        'ai_score'             => $ai,
        'collab_score'         => $collab,
        'total_score'          => $total,
        'grade'                => grade($total),
        'position'             => $myPosition,
        'bd_score'             => $bd,
        'kpi_weights'          => ['p' => $weights[0], 'q' => $weights[1], 'a' => $weights[2], 's' => $weights[3], 'b' => $weights[4] ?? 0.0],
        'revenue_contribution' => $revContrib,
        'tasks'                => $tasks,
        'hours_by_project'     => $hoursByProject,
        'kpi_trend'            => $kpiTrend,
    ]);
}

// โ”€โ”€ Sales Dashboard โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
if ($view === 'sales') {
    $s = $s_period;
    $e = $e_period;

    // Won deals for selected period (for KPI cards)
    $wonStmt = $db->prepare("
        SELECT COALESCE(SUM(value),0) AS rev, COUNT(*) AS cnt
        FROM sales_opportunities
        WHERE tenant_id = ? AND stage = 'won'
          AND DATE(COALESCE(actual_close_date, updated_at)) BETWEEN ? AND ?
    ");
    $wonStmt->execute([$tenantId, $s, $e]);
    $wonRow = $wonStmt->fetch();

    // Lost deals for selected period
    $lostStmt = $db->prepare("
        SELECT COUNT(*) AS cnt
        FROM sales_opportunities
        WHERE tenant_id = ? AND stage = 'lost'
          AND DATE(COALESCE(actual_close_date, updated_at)) BETWEEN ? AND ?
    ");
    $lostStmt->execute([$tenantId, $s, $e]);
    $lostCnt = (int)$lostStmt->fetchColumn();

    // All open pipeline for selected period
    // All open pipeline: expected close date within period (or no date set = still active)
    $openStmt = $db->prepare("
        SELECT value, probability
        FROM sales_opportunities
        WHERE tenant_id = ? AND stage NOT IN ('won', 'lost')
          AND (expected_close_date BETWEEN ? AND ? OR expected_close_date IS NULL)
    ");
    $openStmt->execute([$tenantId, $s, $e]);
    $openDeals = $openStmt->fetchAll();
    $openCnt  = count($openDeals);
    $pipeline = array_sum(array_map(fn($d) => (float)$d['value'] * (float)$d['probability'] / 100, $openDeals));

    $wonCnt      = (int)$wonRow['cnt'];
    $revWon      = (float)$wonRow['rev'];
    $totalClosed = $wonCnt + $lostCnt;
    $convRate    = $totalClosed > 0 ? round($wonCnt / $totalClosed * 100, 1) : 0;

    // By stage: won/lost filtered by close date; open stages show all active deals
    $byStageStmt = $db->prepare("
        SELECT stage, COUNT(*) AS cnt, COALESCE(SUM(value),0) AS val
        FROM sales_opportunities
        WHERE tenant_id = ? AND (
            (stage IN ('won','lost') AND DATE(COALESCE(actual_close_date, updated_at)) BETWEEN ? AND ?)
            OR (stage NOT IN ('won','lost') AND (expected_close_date BETWEEN ? AND ? OR expected_close_date IS NULL))
        )
        GROUP BY stage
    ");
    $byStageStmt->execute([$tenantId, $s, $e, $s, $e]);
    $rawByStage = $byStageStmt->fetchAll();
    $stageMap = [];
    foreach ($rawByStage as $r) {
        $stageMap[$r['stage']] = ['count' => (int)$r['cnt'], 'value' => (float)$r['val']];
    }
    $stages = ['lead','qualified','proposal','negotiation','won','lost'];
    $byStage = [];
    foreach ($stages as $st) {
        $byStage[] = [
            'stage' => $st,
            'count' => $stageMap[$st]['count'] ?? 0,
            'value' => $stageMap[$st]['value'] ?? 0.0,
        ];
    }

    // Top salespeople (won in selected period)
    $topStmt = $db->prepare("
        SELECT u.display_name, COUNT(*) AS deals, COALESCE(SUM(so.value),0) AS revenue
        FROM sales_opportunities so
        JOIN users u ON so.assigned_to = u.id
        WHERE so.tenant_id = ? AND so.stage = 'won'
          AND DATE(COALESCE(so.actual_close_date, so.updated_at)) BETWEEN ? AND ?
        GROUP BY u.id, u.display_name ORDER BY revenue DESC LIMIT 5
    ");
    $topStmt->execute([$tenantId, $s, $e]);
    $topSales = $topStmt->fetchAll();

    // BD Leaderboard — who found the leads (created_by)
    $bdStmt = $db->prepare("
        SELECT
            u.display_name,
            COUNT(*) AS leads_total,
            SUM(CASE WHEN so.stage = 'won' THEN 1 ELSE 0 END) AS leads_won,
            COALESCE(SUM(CASE WHEN so.stage = 'won' THEN so.value ELSE 0 END), 0) AS revenue_won,
            COALESCE(SUM(CASE WHEN so.stage NOT IN ('won','lost') THEN so.value ELSE 0 END), 0) AS pipeline_value
        FROM sales_opportunities so
        JOIN users u ON so.created_by = u.id
        WHERE so.tenant_id = ?
          AND DATE(so.created_at) BETWEEN ? AND ?
        GROUP BY so.created_by, u.display_name
        ORDER BY revenue_won DESC, leads_total DESC
        LIMIT 10
    ");
    $bdStmt->execute([$tenantId, $s, $e]);
    $bdLeaderboard = $bdStmt->fetchAll();

    jsonResponse([
        'revenue_won'     => $revWon,
        'pipeline_value'  => $pipeline,
        'deals_won'       => $wonCnt,
        'deals_lost'      => $lostCnt,
        'deals_open'      => $openCnt,
        'conversion_rate' => $convRate,
        'by_stage'        => $byStage,
        'top_salespeople' => $topSales,
        'bd_leaderboard'  => $bdLeaderboard,
    ]);
}

// โ”€โ”€ Support Dashboard โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
if ($view === 'support') {
    $s = $s_period;
    $e = $e_period;

    // Use actual support_tickets table
    $supportStmt = $db->prepare("
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status IN ('resolved','closed') THEN 1 ELSE 0 END) AS resolved,
            ROUND(AVG(CASE
                WHEN resolved_at IS NOT NULL
                THEN DATEDIFF(resolved_at, created_at)
                ELSE DATEDIFF(CURDATE(), created_at)
            END), 1) AS avg_response_days,
            SUM(CASE WHEN csat_score >= 4 THEN 1 ELSE 0 END) AS high_csat,
            SUM(CASE WHEN csat_score IS NOT NULL THEN 1 ELSE 0 END) AS rated
        FROM support_tickets
        WHERE tenant_id = ?
          AND DATE(created_at) BETWEEN ? AND ?
    ");
    $supportStmt->execute([$tenantId, $s, $e]);
    $sup = $supportStmt->fetch();

    $total    = (int)($sup['total'] ?? 0);
    $resolved = (int)($sup['resolved'] ?? 0);
    $resRate  = $total > 0 ? round($resolved / $total * 100, 1) : 0;
    $rated    = (int)($sup['rated'] ?? 0);
    $highCsat = (int)($sup['high_csat'] ?? 0);
    $csat     = $rated > 0 ? round($highCsat / $rated * 100, 1) : ($resRate); // fallback to resolution rate

    // By assignee
    $byAssigneeStmt = $db->prepare("
        SELECT
            COALESCE(u.display_name, st.reported_by, 'เนเธกเนเธฃเธฐเธเธธ') AS assignee,
            COUNT(*) AS tickets,
            SUM(CASE WHEN st.status IN ('resolved','closed') THEN 1 ELSE 0 END) AS resolved
        FROM support_tickets st
        LEFT JOIN users u ON u.id = st.assigned_to
        WHERE st.tenant_id = ?
          AND DATE(st.created_at) BETWEEN ? AND ?
        GROUP BY st.assigned_to, u.display_name
        ORDER BY tickets DESC LIMIT 10
    ");
    $byAssigneeStmt->execute([$tenantId, $s, $e]);

    // Trend (last 6 months)
    $trend = [];
    for ($i = 5; $i >= 0; $i--) {
        $m = date('Y-m', strtotime("-$i month"));
        [$ms, $me] = monthRange($m);
        $t = $db->prepare("
            SELECT COUNT(*), SUM(CASE WHEN status IN ('resolved','closed') THEN 1 ELSE 0 END)
            FROM support_tickets WHERE tenant_id = ? AND DATE(created_at) BETWEEN ? AND ?
        ");
        $t->execute([$tenantId, $ms, $me]);
        [$tc, $tr] = $t->fetch(PDO::FETCH_NUM);
        $trend[] = ['month' => $m, 'total' => (int)$tc, 'resolved' => (int)($tr ?? 0)];
    }

    jsonResponse([
        'total_tickets'    => $total,
        'resolved'         => $resolved,
        'resolution_rate'  => $resRate,
        'avg_response_days'=> (float)($sup['avg_response_days'] ?? 0),
        'csat_score'       => $csat,
        'by_assignee'      => $byAssigneeStmt->fetchAll(),
        'trend'            => $trend,
    ]);
}

// โ”€โ”€ System Overview (all modules) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
if ($view === 'overview') {
    $s = $s_period;
    $e = $e_period;
    // $year is set globally (from ?year= param or extracted from ?month=)

    // โ”€โ”€ Projects โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    $projRows = $db->prepare("SELECT status, COUNT(*) AS cnt FROM projects WHERE tenant_id=? AND deleted_at IS NULL AND kind='project' AND start_date BETWEEN ? AND ? GROUP BY status");
    $projRows->execute([$tenantId, $s, $e]);
    $projByStatus = [];
    $projTotal = 0;
    $projActive = 0;
    foreach ($projRows->fetchAll() as $r) {
        $projByStatus[$r['status']] = (int)$r['cnt'];
        $projTotal += (int)$r['cnt'];
        if ($r['status'] !== 'completed') $projActive += (int)$r['cnt'];
    }
    $projCmp = $db->prepare("SELECT COUNT(*) FROM projects WHERE tenant_id=? AND deleted_at IS NULL AND kind='project' AND status='completed' AND YEAR(COALESCE(completed_at, updated_at))=?");
    $projCmp->execute([$tenantId, $year]);
    $projCompletedMonth = (int)$projCmp->fetchColumn();

    // โ”€โ”€ Tasks โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    $taskRows = $db->prepare("SELECT status, COUNT(*) AS cnt FROM tasks WHERE tenant_id=? AND is_subtask=0 AND deleted_at IS NULL AND start_date BETWEEN ? AND ? GROUP BY status");
    $taskRows->execute([$tenantId, $s, $e]);
    $taskByStatus = [];
    $taskTotal = 0;
    foreach ($taskRows->fetchAll() as $r) {
        $taskByStatus[$r['status']] = (int)$r['cnt'];
        $taskTotal += (int)$r['cnt'];
    }
    $taskCmp = $db->prepare("SELECT COUNT(*) FROM tasks WHERE tenant_id=? AND is_subtask=0 AND deleted_at IS NULL AND status='completed' AND completed_date BETWEEN ? AND ?");
    $taskCmp->execute([$tenantId, $s, $e]);
    $taskCompletedMonth = (int)$taskCmp->fetchColumn();

    // โ”€โ”€ Sales โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    $salesRows = $db->prepare("SELECT stage, COUNT(*) AS cnt, COALESCE(SUM(value),0) AS value FROM sales_opportunities WHERE tenant_id=? AND (stage NOT IN ('won','lost') OR DATE(COALESCE(actual_close_date, updated_at)) BETWEEN ? AND ?) GROUP BY stage");
    $salesRows->execute([$tenantId, $s, $e]);
    $salesByStage = [];
    $salesTotalValue = 0.0;
    foreach ($salesRows->fetchAll() as $r) {
        $salesByStage[$r['stage']] = ['count' => (int)$r['cnt'], 'value' => (float)$r['value']];
        $salesTotalValue += (float)$r['value'];
    }
    $swon = $db->prepare("SELECT COUNT(*), COALESCE(SUM(value),0) FROM sales_opportunities WHERE tenant_id=? AND stage='won' AND DATE(COALESCE(actual_close_date, updated_at)) BETWEEN ? AND ?");
    $swon->execute([$tenantId, $s, $e]);
    [$wonCnt, $wonVal] = $swon->fetch(PDO::FETCH_NUM);

    // โ”€โ”€ Support Tickets โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    $stRows = $db->prepare("SELECT status, COUNT(*) AS cnt FROM support_tickets WHERE tenant_id=? AND DATE(created_at) BETWEEN ? AND ? GROUP BY status");
    $stRows->execute([$tenantId, $s, $e]);
    $stByStatus = [];
    $stTotal = 0;
    foreach ($stRows->fetchAll() as $r) {
        $stByStatus[$r['status']] = (int)$r['cnt'];
        $stTotal += (int)$r['cnt'];
    }
    $stMonth = $db->prepare("SELECT COUNT(*), SUM(CASE WHEN status IN ('resolved','closed') THEN 1 ELSE 0 END) FROM support_tickets WHERE tenant_id=? AND DATE(created_at) BETWEEN ? AND ?");
    $stMonth->execute([$tenantId, $s, $e]);
    [$stMonthCnt, $stMonthRes] = $stMonth->fetch(PDO::FETCH_NUM);

    // โ”€โ”€ Goals & OKR โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    $goalRows = $db->prepare("SELECT status, COUNT(*) AS cnt FROM goals WHERE tenant_id=? AND deleted_at IS NULL AND start_date BETWEEN ? AND ? GROUP BY status");
    $goalRows->execute([$tenantId, $s, $e]);
    $goalByStatus = [];
    $goalTotal = 0;
    foreach ($goalRows->fetchAll() as $r) {
        $goalByStatus[$r['status']] = (int)$r['cnt'];
        $goalTotal += (int)$r['cnt'];
    }
    // Avg progress of active goals
    $goalAvg = $db->prepare("SELECT ROUND(AVG(progress_percentage),1) FROM goals WHERE tenant_id=? AND deleted_at IS NULL AND status='active' AND start_date BETWEEN ? AND ?");
    $goalAvg->execute([$tenantId, $s, $e]);
    $goalAvgProgress = (float)($goalAvg->fetchColumn() ?? 0);

    // โ”€โ”€ Hours this month (task/subtask unified model) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    $hoursMonth = sumLeafTaskHours($db, $tenantId, $s, $e);

    // โ”€โ”€ Budget (all-time) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    $budgetStmt = $db->prepare("SELECT COALESCE(SUM(planned_cost),0) AS planned, COALESCE(SUM(actual_cost),0) AS actual FROM budget_items WHERE tenant_id=?");
    $budgetStmt->execute([$tenantId]);
    $budget = $budgetStmt->fetch();

    // โ”€โ”€ Departments headcount โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    $deptStmt = $db->prepare("
        SELECT u.position, COUNT(*) AS headcount
        FROM users u
        JOIN tenant_users tu ON u.id = tu.user_id AND tu.tenant_id = ?
        WHERE u.is_active = 1 AND u.position IS NOT NULL AND u.position != ''
        GROUP BY u.position ORDER BY headcount DESC
    ");
    $deptStmt->execute([$tenantId]);

    jsonResponse([
        'year' => $year,
        'projects' => [
            'total' => $projTotal, 'active' => $projActive, 'completed_month' => $projCompletedMonth,
            'by_status' => $projByStatus,
        ],
        'tasks' => [
            'total' => $taskTotal, 'completed_month' => $taskCompletedMonth,
            'by_status' => $taskByStatus,
        ],
        'sales' => [
            'total_value' => $salesTotalValue, 'won_month_count' => (int)$wonCnt, 'won_month_value' => (float)$wonVal,
            'by_stage' => $salesByStage,
        ],
        'support' => [
            'total' => $stTotal, 'created_month' => (int)$stMonthCnt, 'resolved_month' => (int)($stMonthRes ?? 0),
            'by_status' => $stByStatus,
        ],
        'goals' => [
            'total' => $goalTotal, 'avg_progress' => $goalAvgProgress,
            'by_status' => $goalByStatus,
        ],
        'hours_month' => $hoursMonth,
        'budget' => ['planned' => (float)$budget['planned'], 'actual' => (float)$budget['actual']],
        'departments' => $deptStmt->fetchAll(),
    ]);
}

// โ”€โ”€ Departments KPI (actual vs targets) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
if ($view === 'departments') {
    $s = $s_period;
    $e = $e_period;

    $usersStmt = $db->prepare("
        SELECT u.id, u.display_name, u.position
        FROM users u
        JOIN tenant_users tu ON u.id = tu.user_id AND tu.tenant_id = ?
        WHERE u.is_active = 1 AND u.position IS NOT NULL AND u.position != ''
        ORDER BY u.position, u.display_name
    ");
    $usersStmt->execute([$tenantId]);
    $users = $usersStmt->fetchAll();

    $deptData = [];
    foreach ($users as $u) {
        $pos = $u['position'];
        if (!isset($deptData[$pos])) {
            $deptData[$pos] = [
                'position' => $pos, 'headcount' => 0,
                'total_tasks' => 0, 'total_hours' => 0.0,
                'on_time_tasks' => 0, 'members' => [],
            ];
        }

        $dParams = [];
        $dWhere = resolveAssigneeClause('tasks', $u['id'], $dParams);
        $ts = $db->prepare("
            SELECT COUNT(*) AS total,
                   SUM(CASE WHEN completed_date <= end_date THEN 1 ELSE 0 END) AS on_time
            FROM tasks WHERE 1=1 $dWhere
              AND is_subtask=0 AND deleted_at IS NULL AND status='completed' AND completed_date BETWEEN ? AND ?
        ");
        $dParams[] = $s;
        $dParams[] = $e;
        $ts->execute($dParams);
        $tr = $ts->fetch();
        $tCount  = (int)($tr['total']   ?? 0);
        $onTime  = (int)($tr['on_time'] ?? 0);

        $hrs = sumLeafTaskHours($db, $tenantId, $s, $e, $u['id']);

        $deptData[$pos]['headcount']++;
        $deptData[$pos]['total_tasks']   += $tCount;
        $deptData[$pos]['total_hours']   += $hrs;
        $deptData[$pos]['on_time_tasks'] += $onTime;
        $deptData[$pos]['members'][] = ['id' => $u['id'], 'name' => $u['display_name'], 'tasks' => $tCount, 'hours' => $hrs];
    }

    jsonResponse(array_values($deptData));
}

// โ”€โ”€ AI Performance Analysis โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
if ($view === 'ai_analysis') {
    $s = $s_period;
    $e = $e_period;

    $speed   = calcSpeedScore($db, $uid, $tenantId, $s, $e);
    $impact  = calcImpactScore($db, $uid, $tenantId, $s, $e, 160 * $normFactor);
    $aiSc    = calcAiScore($db, $uid, $s, $e, $tenantId);
    $collab  = calcCollabScore($db, $uid, $tenantId, $s, $e);
    $bdSc    = calcBAxisScore($db, $uid, $tenantId, $s, $e);
    $weights = loadKpiWeights($db, $tenantId, $uid);
    $total   = calcKpi($speed, $impact, $aiSc, $collab, $weights, $bdSc);
    $rev     = calcRevenueContribution($db, $uid, $tenantId);
    $gr      = grade($total);

    $userStmt = $db->prepare("SELECT display_name, position FROM users WHERE id = ?");
    $userStmt->execute([$uid]);
    $userInfo = $userStmt->fetch();
    $name     = $userInfo['display_name'] ?? 'เธเธเธฑเธเธเธฒเธ';
    $position = $userInfo['position']     ?? 'เนเธกเนเธฃเธฐเธเธธ';

    $hours = round(sumLeafTaskHours($db, $tenantId, $s, $e, $uid), 1);

    $aParams = [];
    $aWhere = resolveAssigneeClause('tasks', $uid, $aParams);
    $tsStmt = $db->prepare("SELECT COUNT(*) FROM tasks WHERE 1=1 $aWhere AND is_subtask=0 AND deleted_at IS NULL AND status='completed' AND completed_date BETWEEN ? AND ?");
    $aParams[] = $s;
    $aParams[] = $e;
    $tsStmt->execute($aParams);
    $tasksDone = (int)$tsStmt->fetchColumn();

    $cred = resolveAiCredentials($db, $tenantId);
    if (!$cred) jsonError('AI provider not configured โ€” เธเธฃเธธเธ“เธฒเธ•เธฑเนเธเธเนเธฒ AI เนเธ Admin เธเนเธญเธ', 503);

    // Pick analyst model if configured
    try {
        $mStmt = $db->prepare("SELECT am.model_id FROM company_settings cs JOIN ai_models am ON am.id=cs.ai_analyst_model_id WHERE cs.tenant_id=? LIMIT 1");
        $mStmt->execute([$tenantId]);
        $mRow  = $mStmt ? $mStmt->fetch() : null;
        $model = ($mRow && !empty($mRow['model_id'])) ? $mRow['model_id'] : 'openai/gpt-4o-mini';
    } catch (\Throwable $ex) {
        $model = 'openai/gpt-4o-mini';
    }

    $fmtRev = $rev >= 1000000
        ? 'เธฟ'.number_format($rev/1000000, 1).'M'
        : ($rev >= 1000 ? 'เธฟ'.number_format($rev/1000, 0).'K' : 'เธฟ'.number_format($rev, 0));

    $prompt = <<<PROMPT
เธงเธดเน€เธเธฃเธฒเธฐเธซเนเธเธฅเธเธฒเธฃเธเธเธดเธเธฑเธ•เธดเธเธฒเธเธเธญเธ {$name} (เธ•เธณเนเธซเธเนเธ: {$position}) เธเธฃเธฐเธเธณเน€เธ”เธทเธญเธ {$month}

เธเนเธญเธกเธนเธฅ KPI:
- Speed Score (เธชเนเธเธเธฒเธเธ•เธฃเธเน€เธงเธฅเธฒ): {$speed}/100
- Impact Score (เธเธฑเนเธงเนเธกเธเธ—เธณเธเธฒเธ normalize 160h): {$impact}/100
- AI Usage Score (เธเธฒเธฃเนเธเน AI): {$aiSc}/100
- Collaboration Score (เธเธฒเธฃเธ—เธณเธเธฒเธเน€เธเนเธเธ—เธตเธก): {$collab}/100
- KPI เธฃเธงเธก: {$total}/100 (เน€เธเธฃเธ”: {$gr})
- เธเธฒเธเน€เธชเธฃเนเธเน€เธ”เธทเธญเธเธเธตเน: {$tasksDone} เธเธฒเธ
- เธเธฑเนเธงเนเธกเธเธ—เธตเนเธเธฑเธเธ—เธถเธ: {$hours} เธเธฑเนเธงเนเธกเธ
- เธฃเธฒเธขเนเธ”เนเธ—เธตเนเธกเธตเธชเนเธงเธเธฃเนเธงเธก (เธ•เธฅเธญเธ”เน€เธงเธฅเธฒ เธเนเธฒเธเนเธเธฃเน€เธเธเธ•เนเธ—เธตเนเธเธดเธ”เธ”เธตเธฅเนเธ”เน): {$fmtRev}

เธเธฃเธธเธ“เธฒเธงเธดเน€เธเธฃเธฒเธฐเธซเนเนเธฅเธฐเธชเนเธเธเธฅเธฅเธฑเธเธเนเน€เธเนเธ JSON เธฃเธนเธเนเธเธเธเธตเนเน€เธ—เนเธฒเธเธฑเนเธ:
{"summary":"เธชเธฃเธธเธ 2-3 เธเธฃเธฐเนเธขเธ","strengths":["เธเธธเธ”เนเธเนเธ 1","เธเธธเธ”เนเธเนเธ 2"],"weaknesses":["เธเธธเธ”เธ—เธตเนเธ•เนเธญเธเธเธฑเธ’เธเธฒ 1","เธเธธเธ”เธ—เธตเนเธ•เนเธญเธเธเธฑเธ’เธเธฒ 2"],"recommendations":["เธเธณเนเธเธฐเธเธณ 1","เธเธณเนเธเธฐเธเธณ 2","เธเธณเนเธเธฐเธเธณ 3"]}

เธ•เธญเธเน€เธเนเธเธ เธฒเธฉเธฒเนเธ—เธข เน€เธเธเธฒเธฐ JSON เนเธกเนเธ•เนเธญเธเธญเธเธดเธเธฒเธขเน€เธเธดเนเธกเน€เธ•เธดเธก
PROMPT;

    $payload = [
        'model'    => $model,
        'messages' => [
            ['role' => 'system', 'content' => 'คุณคือที่ปรึกษาด้าน KPI ผู้เชี่ยวชาญ ตอบเป็นภาษาไทยเท่านั้นและส่งผลลัพธ์เป็น JSON เท่านั้น ไม่มี markdown'],
            ['role' => 'user',   'content' => $prompt],
        ],
        'stream'     => false,
        'max_tokens' => 4096,
    ];

    $ch = curl_init($cred['base_url'] . '/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $cred['api_key'], 'Content-Type: application/json'],
        CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true,
        CURLOPT_TIMEOUT        => 60,
        CURLOPT_CONNECTTIMEOUT => 15,
    ]);
    $aiRaw = curl_exec($ch);
    curl_close($ch);

    $aiResp  = json_decode($aiRaw, true);
    $content = $aiResp['choices'][0]['message']['content'] ?? null;
    if (!$content) jsonError('AI returned empty response', 500);

    // Strip markdown code fences if present
    $content = preg_replace('/^```(?:json)?\s*/i', '', trim($content));
    $content = preg_replace('/\s*```$/i', '', $content);
    $parsed  = json_decode($content, true);

    jsonResponse($parsed ?: [
        'summary' => $content,
        'strengths' => [], 'weaknesses' => [], 'recommendations' => [],
    ]);
}

// ── Quality Dashboard ─────────────────────────────────────────────────────────
// Defect / rework rate: tasks paused (interrupted) as % of completed
if ($view === 'quality') {
    $s = $s_period;
    $e = $e_period;

    // Total completed tasks (non-subtask, exclude Base Calendar)
    $totalStmt = $db->prepare("
        SELECT COUNT(*) FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE t.tenant_id = ? AND t.is_subtask = 0 AND t.deleted_at IS NULL
          AND t.status = 'completed' AND t.completed_date BETWEEN ? AND ?
          AND p.kind = 'project'
    ");
    $totalStmt->execute([$tenantId, $s, $e]);
    $totalCompleted = max(1, (int)$totalStmt->fetchColumn());

    // Rework: tasks that were paused (paused_at IS NOT NULL) this month
    $reworkStmt = $db->prepare("
        SELECT COUNT(*) FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE t.tenant_id = ? AND t.is_subtask = 0 AND t.deleted_at IS NULL
          AND t.status = 'completed' AND t.paused_at IS NOT NULL
          AND t.completed_date BETWEEN ? AND ?
          AND p.kind = 'project'
    ");
    $reworkStmt->execute([$tenantId, $s, $e]);
    $reworkCount = (int)$reworkStmt->fetchColumn();
    $defectRate   = round($reworkCount / $totalCompleted * 100, 1);

    // On-time delivery: completed_date <= end_date
    $onTimeStmt = $db->prepare("
        SELECT COUNT(*) FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE t.tenant_id = ? AND t.is_subtask = 0 AND t.deleted_at IS NULL
          AND t.status = 'completed' AND t.completed_date BETWEEN ? AND ?
          AND t.completed_date <= t.end_date
          AND p.kind = 'project'
    ");
    $onTimeStmt->execute([$tenantId, $s, $e]);
    $onTimeCount = (int)$onTimeStmt->fetchColumn();
    $onTimeRate  = round($onTimeCount / $totalCompleted * 100, 1);

    // Defect trend (last 6 months)
    $defectTrend = [];
    for ($i = 5; $i >= 0; $i--) {
        $m  = date('Y-m', strtotime("-$i month"));
        [$ms, $me] = monthRange($m);
        $dt = $db->prepare("
            SELECT COUNT(*),
                   SUM(CASE WHEN paused_at IS NOT NULL THEN 1 ELSE 0 END)
            FROM tasks t
            JOIN projects p ON p.id = t.project_id
            WHERE t.tenant_id = ? AND t.is_subtask = 0 AND t.deleted_at IS NULL
              AND t.status = 'completed' AND t.completed_date BETWEEN ? AND ?
              AND p.kind = 'project'
        ");
        $dt->execute([$tenantId, $ms, $me]);
        [$dtTotal, $dtRework] = $dt->fetch(PDO::FETCH_NUM);
        $dtTotal = max(1, (int)$dtTotal);
        $defectTrend[] = [
            'month' => $m,
            'total' => (int)$dtTotal,
            'rework' => (int)($dtRework ?? 0),
            'defect_rate' => round((int)($dtRework ?? 0) / $dtTotal * 100, 1),
        ];
    }

    // By project: defect rate per project (top 10 by rework)
    $byProject = $db->prepare("
        SELECT p.name, COUNT(*) AS total,
               SUM(CASE WHEN t.paused_at IS NOT NULL THEN 1 ELSE 0 END) AS rework
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE t.tenant_id = ? AND t.is_subtask = 0 AND t.deleted_at IS NULL
          AND t.status = 'completed' AND t.completed_date BETWEEN ? AND ?
          AND p.kind = 'project'
        GROUP BY p.id, p.name HAVING total > 0 ORDER BY rework DESC LIMIT 10
    ");
    $byProject->execute([$tenantId, $s, $e]);
    $byProjectData = [];
    foreach ($byProject->fetchAll() as $r) {
        $rTotal = max(1, (int)$r['total']);
        $byProjectData[] = [
            'project' => $r['name'],
            'total'   => (int)$r['total'],
            'rework'  => (int)$r['rework'],
            'defect_rate' => round((int)$r['rework'] / $rTotal * 100, 1),
        ];
    }

    jsonResponse([
        'total_completed' => $totalCompleted,
        'rework_count'    => $reworkCount,
        'defect_rate'     => $defectRate,
        'on_time_count'   => $onTimeCount,
        'on_time_rate'    => $onTimeRate,
        'trend'           => $defectTrend,
        'by_project'      => $byProjectData,
    ]);
}

// ── Customer Dashboard ────────────────────────────────────────────────────────
// NPS (from csat_score), SLA hit rate, repeat business
if ($view === 'customer') {
    $s = $s_period;
    $e = $e_period;

    // ── NPS / CSAT ─────────────────────────────────────────────────────────
    $csatStmt = $db->prepare("
        SELECT
            COUNT(*) AS rated,
            AVG(csat_score) AS avg_score,
            SUM(CASE WHEN csat_score >= 4 THEN 1 ELSE 0 END) AS promoters,
            SUM(CASE WHEN csat_score = 3 THEN 1 ELSE 0 END) AS passives,
            SUM(CASE WHEN csat_score <= 2 THEN 1 ELSE 0 END) AS detractors
        FROM support_tickets
        WHERE tenant_id = ? AND csat_score IS NOT NULL
          AND DATE(created_at) BETWEEN ? AND ?
    ");
    $csatStmt->execute([$tenantId, $s, $e]);
    $csatRow = $csatStmt->fetch();
    $rated      = max(1, (int)($csatRow['rated'] ?? 0));
    $avgCsat    = round((float)($csatRow['avg_score'] ?? 0), 2);
    $promoters  = (int)($csatRow['promoters'] ?? 0);
    $detractors = (int)($csatRow['detractors'] ?? 0);
    // Net Promoter Score: %promoters - %detractors (scale -100..100)
    $nps = round(($promoters / $rated - $detractors / $rated) * 100, 1);

    // ── SLA Hit Rate ───────────────────────────────────────────────────────
    // SLA met if first_response_at is within sla_hours of created_at
    $slaStmt = $db->prepare("
        SELECT
            COUNT(*) AS total,
            SUM(CASE
                WHEN first_response_at IS NOT NULL
                 AND TIMESTAMPDIFF(HOUR, created_at, first_response_at) <= sla_hours
                THEN 1 ELSE 0
            END) AS sla_met
        FROM support_tickets
        WHERE tenant_id = ? AND first_response_at IS NOT NULL
          AND DATE(created_at) BETWEEN ? AND ?
    ");
    $slaStmt->execute([$tenantId, $s, $e]);
    $slaRow    = $slaStmt->fetch();
    $slaTotal  = max(1, (int)($slaRow['total'] ?? 0));
    $slaMet    = (int)($slaRow['sla_met'] ?? 0);
    $slaRate   = round($slaMet / $slaTotal * 100, 1);

    // Avg first response time (hours)
    $frtStmt = $db->prepare("
        SELECT ROUND(AVG(TIMESTAMPDIFF(MINUTE, created_at, first_response_at)) / 60, 1)
        FROM support_tickets
        WHERE tenant_id = ? AND first_response_at IS NOT NULL
          AND DATE(created_at) BETWEEN ? AND ?
    ");
    $frtStmt->execute([$tenantId, $s, $e]);
    $avgFrtHours = (float)($frtStmt->fetchColumn() ?? 0);

    // ── Repeat Business ────────────────────────────────────────────────────
    // Companies with >1 won opportunity (all-time, not month-filtered)
    $repeatStmt = $db->prepare("
        SELECT
            COUNT(*) AS total_companies,
            SUM(CASE WHEN won_count > 1 THEN 1 ELSE 0 END) AS repeat_companies
        FROM (
            SELECT company_id, COUNT(*) AS won_count
            FROM sales_opportunities
            WHERE tenant_id = ? AND stage = 'won' AND company_id IS NOT NULL
            GROUP BY company_id
        ) sub
    ");
    $repeatStmt->execute([$tenantId]);
    $repeatRow       = $repeatStmt->fetch();
    $totalCompanies  = max(1, (int)($repeatRow['total_companies'] ?? 0));
    $repeatCompanies = (int)($repeatRow['repeat_companies'] ?? 0);
    $repeatRate      = round($repeatCompanies / $totalCompanies * 100, 1);

    // Won revenue by company (top 10, all-time)
    $topCustomersStmt = $db->prepare("
        SELECT c.name, COUNT(*) AS deals, COALESCE(SUM(so.value), 0) AS revenue
        FROM sales_opportunities so
        JOIN companies c ON c.id = so.company_id
        WHERE so.tenant_id = ? AND so.stage = 'won'
        GROUP BY so.company_id, c.name ORDER BY revenue DESC LIMIT 10
    ");
    $topCustomersStmt->execute([$tenantId]);
    $topCustomers = $topCustomersStmt->fetchAll();

    // CSAT trend (last 6 months)
    $csatTrend = [];
    for ($i = 5; $i >= 0; $i--) {
        $m  = date('Y-m', strtotime("-$i month"));
        [$ms, $me] = monthRange($m);
        $ct = $db->prepare("
            SELECT COUNT(*), AVG(csat_score),
                   SUM(CASE WHEN csat_score >= 4 THEN 1 ELSE 0 END),
                   SUM(CASE WHEN csat_score <= 2 THEN 1 ELSE 0 END)
            FROM support_tickets
            WHERE tenant_id = ? AND csat_score IS NOT NULL
              AND DATE(created_at) BETWEEN ? AND ?
        ");
        $ct->execute([$tenantId, $ms, $me]);
        $ctRow = $ct->fetch();
        $ctRated      = max(1, (int)($ctRow[0] ?? 0));
        $ctPromoters  = (int)($ctRow[2] ?? 0);
        $ctDetractors = (int)($ctRow[3] ?? 0);
        $csatTrend[]  = [
            'month'    => $m,
            'avg_csat' => round((float)($ctRow[1] ?? 0), 2),
            'nps'      => round(($ctPromoters / $ctRated - $ctDetractors / $ctRated) * 100, 1),
        ];
    }

    jsonResponse([
        'csat' => [
            'rated'       => (int)($csatRow['rated'] ?? 0),
            'avg_score'   => $avgCsat,
            'nps'         => $nps,
            'promoters'   => $promoters,
            'passives'    => (int)($csatRow['passives'] ?? 0),
            'detractors'  => $detractors,
        ],
        'sla' => [
            'total_tickets'   => (int)($slaRow['total'] ?? 0),
            'sla_met'         => $slaMet,
            'sla_rate'        => $slaRate,
            'avg_frt_hours'   => $avgFrtHours,
        ],
        'repeat_business' => [
            'total_companies'   => $totalCompanies,
            'repeat_companies'  => $repeatCompanies,
            'repeat_rate'       => $repeatRate,
        ],
        'top_customers' => $topCustomers,
        'trend'         => $csatTrend,
    ]);
}

// ── Stale Task Detection ─────────────────────────────────────────────────────────
// Returns non-completed tasks not updated in >= $days days.
// Used by Admin → Stale Tasks panel to surface stuck work.
if ($view === 'stale_tasks') {
    $days = max(7, (int)($_GET['days'] ?? 30));

    $stmt = $db->prepare("
        SELECT t.id, t.title, t.status, t.priority, t.assignee, t.assignee_user_id,
               t.project_id, p.name AS project_name,
               t.start_date, t.end_date, t.updated_at,
               DATEDIFF(NOW(), t.updated_at) AS days_stale,
               u.display_name AS assignee_name
        FROM tasks t
        LEFT JOIN projects p ON p.id = t.project_id
        LEFT JOIN users u    ON u.id = t.assignee_user_id
        WHERE t.tenant_id = ?
          AND t.deleted_at IS NULL
          AND t.status NOT IN ('completed', 'cancelled')
          AND t.updated_at < DATE_SUB(NOW(), INTERVAL ? DAY)
        ORDER BY t.updated_at ASC
        LIMIT 100
    ");
    $stmt->execute([$tenantId, $days]);
    $rows = $stmt->fetchAll();

    jsonResponse([
        'threshold_days' => $days,
        'count'          => count($rows),
        'tasks'          => $rows,
        'checked_at'     => date('c'),
    ]);
}

// ── KPI Anomaly Detection ────────────────────────────────────────────────────────
// Returns users whose KPI total dropped ≥ 20 points vs. the prior week.
// Used by Admin → KPI Alerts panel.
if ($view === 'anomaly') {
    $drop_threshold = (float)($_GET['threshold'] ?? 20);

    // This week: Mon–Sun of current ISO week
    $thisMonday = date('Y-m-d', strtotime('monday this week'));
    $thisSunday = date('Y-m-d', strtotime('sunday this week'));
    // Last week
    $lastMonday = date('Y-m-d', strtotime('monday last week'));
    $lastSunday = date('Y-m-d', strtotime('sunday last week'));

    $usersStmt = $db->prepare('SELECT u.id, u.display_name, u.position FROM users u JOIN tenant_users tu ON tu.user_id = u.id AND tu.tenant_id = ? WHERE u.is_active = 1');
    $usersStmt->execute([$tenantId]);
    $allUsers = $usersStmt->fetchAll();

    $norm = 160;
    $alerts = [];
    foreach ($allUsers as $u) {
        $uid2 = $u['id'];

        // This week scores
        $s1 = calcSpeedScore($db, $uid2, $tenantId, $thisMonday, $thisSunday);
        $i1 = calcImpactScore($db, $uid2, $tenantId, $thisMonday, $thisSunday, $norm);
        $a1 = calcAiScore($db, $uid2, $thisMonday, $thisSunday, $tenantId);
        $c1 = calcCollabScore($db, $uid2, $tenantId, $thisMonday, $thisSunday);
        $b1 = calcBAxisScore($db, $uid2, $tenantId, $thisMonday, $thisSunday);
        $w1 = loadKpiWeights($db, $tenantId, $uid2);
        $thisTotal = calcKpi($s1, $i1, $a1, $c1, $w1, $b1);

        // Last week scores
        $s0 = calcSpeedScore($db, $uid2, $tenantId, $lastMonday, $lastSunday);
        $i0 = calcImpactScore($db, $uid2, $tenantId, $lastMonday, $lastSunday, $norm);
        $a0 = calcAiScore($db, $uid2, $lastMonday, $lastSunday, $tenantId);
        $c0 = calcCollabScore($db, $uid2, $tenantId, $lastMonday, $lastSunday);
        $b0 = calcBAxisScore($db, $uid2, $tenantId, $lastMonday, $lastSunday);
        $w0 = loadKpiWeights($db, $tenantId, $uid2);
        $lastTotal = calcKpi($s0, $i0, $a0, $c0, $w0, $b0);

        // Only flag users who had some activity last week (avoid 0→0 noise)
        if ($lastTotal <= 0) continue;

        $drop = round($lastTotal - $thisTotal, 1);
        if ($drop >= $drop_threshold) {
            $alerts[] = [
                'user_id'     => $uid2,
                'name'        => $u['display_name'],
                'position'    => $u['position'],
                'last_week'   => $lastTotal,
                'this_week'   => $thisTotal,
                'drop'        => $drop,
                'last_period' => "$lastMonday – $lastSunday",
                'this_period' => "$thisMonday – $thisSunday",
            ];
        }
    }

    usort($alerts, fn($a, $b) => $b['drop'] <=> $a['drop']);
    jsonResponse([
        'threshold' => $drop_threshold,
        'alerts'    => $alerts,
        'checked_at' => date('c'),
    ]);
}

jsonError('Unknown view', 400);
