<?php
// GET /api/journey-analytics.php           — cross-module journey metrics
// GET /api/journey-analytics.php?period=90 — last N days (default 365)
require_once __DIR__ . '/auth.php';

$user     = requireAuth();
$db       = getDB();
$tenantId = $user['tenant_id'];
$period   = max(30, min(730, (int)($_GET['period'] ?? 365)));

// ── Drill-down: ?drill=<stage_id> returns individual records ──────────────────
if (!empty($_GET['drill'])) {
    $stage = $_GET['drill'];
    $limit = min(100, max(10, (int)($_GET['limit'] ?? 50)));

    switch ($stage) {
        case 'lead_to_won':
            $stmt = $db->prepare("
                SELECT o.id, o.name, o.stage, o.value,
                       DATEDIFF(COALESCE(o.actual_close_date, NOW()), o.created_at) AS days_elapsed,
                       o.expected_close_date, o.actual_close_date, o.created_at,
                       c.name AS company_name, u.display_name AS assigned_name
                FROM sales_opportunities o
                LEFT JOIN companies c ON c.id = o.company_id
                LEFT JOIN users u ON u.id = o.assigned_to
                WHERE o.tenant_id = ? AND o.created_at >= NOW() - INTERVAL ? DAY
                ORDER BY days_elapsed DESC LIMIT ?
            ");
            $stmt->execute([$tenantId, $period, $limit]);
            break;

        case 'won_to_project':
            $stmt = $db->prepare("
                SELECT o.id, o.name AS opp_name, o.value,
                       p.id AS project_id, p.name AS project_name, p.status AS project_status,
                       DATEDIFF(p.start_date, o.actual_close_date) AS gap_days,
                       o.actual_close_date, p.start_date, c.name AS company_name
                FROM sales_opportunities o
                JOIN projects p ON p.opportunity_id = o.id AND p.tenant_id = ?
                LEFT JOIN companies c ON c.id = o.company_id
                WHERE o.tenant_id = ? AND o.stage = 'won'
                  AND o.actual_close_date IS NOT NULL AND p.start_date IS NOT NULL
                  AND o.created_at >= NOW() - INTERVAL ? DAY
                ORDER BY gap_days DESC LIMIT ?
            ");
            $stmt->execute([$tenantId, $tenantId, $period, $limit]);
            break;

        case 'project_delivery':
            $stmt = $db->prepare("
                SELECT p.id, p.name, p.status,
                       DATEDIFF(COALESCE(p.completed_at, NOW()), p.start_date) AS duration_days,
                       DATEDIFF(p.end_date, p.start_date) AS planned_days,
                       p.start_date, p.end_date, p.completed_at,
                       c.name AS company_name, u.display_name AS manager_name
                FROM projects p
                LEFT JOIN companies c ON c.id = p.company_id
                LEFT JOIN users u ON u.id = p.manager_id
                WHERE p.tenant_id = ? AND p.kind = 'project' AND p.deleted_at IS NULL
                  AND p.start_date IS NOT NULL
                  AND p.start_date >= NOW() - INTERVAL ? DAY
                ORDER BY duration_days DESC LIMIT ?
            ");
            $stmt->execute([$tenantId, $period, $limit]);
            break;

        case 'project_to_ticket':
            $stmt = $db->prepare("
                SELECT p.id, p.name AS project_name, p.status, p.completed_at,
                       c.name AS company_name,
                       COUNT(st.id) AS ticket_count,
                       MIN(st.created_at) AS first_ticket_at,
                       DATEDIFF(MIN(st.created_at), p.completed_at) AS days_to_first_ticket
                FROM projects p
                LEFT JOIN support_tickets st ON st.project_id = p.id
                LEFT JOIN companies c ON c.id = p.company_id
                WHERE p.tenant_id = ? AND p.status = 'completed'
                  AND p.completed_at IS NOT NULL
                  AND p.completed_at >= NOW() - INTERVAL ? DAY
                GROUP BY p.id, p.name, p.status, p.completed_at, c.name
                ORDER BY ticket_count DESC, days_to_first_ticket ASC LIMIT ?
            ");
            $stmt->execute([$tenantId, $period, $limit]);
            break;

        case 'ticket_resolution':
            $stmt = $db->prepare("
                SELECT st.id, st.ticket_number, st.title, st.priority, st.status,
                       ROUND(TIMESTAMPDIFF(MINUTE, st.created_at, COALESCE(st.resolved_at, st.closed_at)) / 60.0, 1) AS hours_elapsed,
                       st.sla_hours,
                       CASE WHEN st.resolved_at IS NOT NULL
                            AND TIMESTAMPDIFF(MINUTE, st.created_at, st.resolved_at) > st.sla_hours * 60
                            THEN 1 ELSE 0 END AS sla_breached,
                       st.created_at, st.resolved_at,
                       c.name AS company_name, u.display_name AS assigned_name
                FROM support_tickets st
                LEFT JOIN companies c ON c.id = st.company_id
                LEFT JOIN users u ON u.id = st.assigned_to
                WHERE st.tenant_id = ? AND st.status IN ('resolved','closed')
                  AND st.created_at >= NOW() - INTERVAL ? DAY
                ORDER BY hours_elapsed DESC LIMIT ?
            ");
            $stmt->execute([$tenantId, $period, $limit]);
            break;

        case 'renew_upsell':
            $stmt = $db->prepare("
                SELECT o.id, o.name, o.stage, o.value,
                       orig.name AS original_deal, orig.actual_close_date AS original_close,
                       DATEDIFF(o.created_at, orig.actual_close_date) AS days_since_close,
                       c.name AS company_name, u.display_name AS assigned_name
                FROM sales_opportunities o
                JOIN sales_opportunities orig ON orig.id = o.renewal_of
                LEFT JOIN companies c ON c.id = o.company_id
                LEFT JOIN users u ON u.id = o.assigned_to
                WHERE o.tenant_id = ? AND o.created_at >= NOW() - INTERVAL ? DAY
                ORDER BY o.created_at DESC LIMIT ?
            ");
            $stmt->execute([$tenantId, $period, $limit]);
            break;

        default:
            jsonError('Unknown stage', 400);
    }

    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

// ── helpers ───────────────────────────────────────────────────────────────────

function heatLevel(float $value, float $warnAt, float $criticalAt): string {
    if ($value >= $criticalAt) return 'critical';
    if ($value >= $warnAt)     return 'warn';
    return 'ok';
}

// ── Stage 1: Lead → Won ───────────────────────────────────────────────────────
// Metric: avg days from created_at to actual_close_date for won deals
// Benchmark: ok < 30d, warn < 60d, critical ≥ 60d

$s1 = $db->prepare("
    SELECT
        COUNT(*) as total,
        ROUND(AVG(DATEDIFF(actual_close_date, created_at)), 1) as avg_days,
        SUM(CASE WHEN actual_close_date > expected_close_date THEN 1 ELSE 0 END) as late_count,
        SUM(CASE WHEN stage = 'lost' THEN 1 ELSE 0 END) as lost_count
    FROM sales_opportunities
    WHERE tenant_id = ? AND stage IN ('won','lost')
      AND created_at >= NOW() - INTERVAL ? DAY
");
$s1->execute([$tenantId, $period]);
$stage1 = $s1->fetch(PDO::FETCH_ASSOC) ?: ['total'=>0,'avg_days'=>0,'late_count'=>0,'lost_count'=>0];

$s1won = $db->prepare("
    SELECT COUNT(*) as won FROM sales_opportunities
    WHERE tenant_id = ? AND stage = 'won'
      AND created_at >= NOW() - INTERVAL ? DAY
");
$s1won->execute([$tenantId, $period]);
$wonCount = (int)($s1won->fetchColumn() ?: 0);

// ── Stage 2: Won → Project start (gap) ────────────────────────────────────────
// Metric: avg days between actual_close_date and project start_date
// Benchmark: ok < 7d, warn < 21d, critical ≥ 21d

$s2 = $db->prepare("
    SELECT
        COUNT(*) as total,
        ROUND(AVG(DATEDIFF(p.start_date, o.actual_close_date)), 1) as avg_gap_days,
        SUM(CASE WHEN DATEDIFF(p.start_date, o.actual_close_date) > 21 THEN 1 ELSE 0 END) as slow_count
    FROM sales_opportunities o
    JOIN projects p ON p.opportunity_id = o.id AND p.tenant_id = ?
    WHERE o.tenant_id = ? AND o.stage = 'won'
      AND o.actual_close_date IS NOT NULL
      AND p.start_date IS NOT NULL
      AND o.created_at >= NOW() - INTERVAL ? DAY
");
$s2->execute([$tenantId, $tenantId, $period]);
$stage2 = $s2->fetch(PDO::FETCH_ASSOC) ?: ['total'=>0,'avg_gap_days'=>0,'slow_count'=>0];

// ── Stage 3: Project delivery duration ────────────────────────────────────────
// Metric: avg days from start_date to completed_at (or NOW() if still running)
// Benchmark: ok < 60d, warn < 90d, critical ≥ 90d

$s3 = $db->prepare("
    SELECT
        COUNT(*) as total,
        ROUND(AVG(DATEDIFF(COALESCE(completed_at, NOW()), start_date)), 1) as avg_days,
        SUM(CASE WHEN status = 'delayed' THEN 1 ELSE 0 END) as delayed_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count
    FROM projects
    WHERE tenant_id = ?
      AND kind = 'project'
      AND deleted_at IS NULL
      AND start_date IS NOT NULL
      AND start_date >= NOW() - INTERVAL ? DAY
");
$s3->execute([$tenantId, $period]);
$stage3 = $s3->fetch(PDO::FETCH_ASSOC) ?: ['total'=>0,'avg_days'=>0,'delayed_count'=>0,'completed_count'=>0];

// ── Stage 4: Project → First ticket (post-delivery issues) ───────────────────
// Metric: % of completed projects that got a ticket within 90 days of completion
// Lower = better. ok < 20%, warn < 40%, critical ≥ 40%

$s4 = $db->prepare("
    SELECT
        COUNT(DISTINCT p.id) as projects_with_tickets,
        ROUND(AVG(DATEDIFF(first_ticket.first_created, p.completed_at)), 1) as avg_days_to_ticket
    FROM projects p
    JOIN (
        SELECT project_id, MIN(created_at) as first_created
        FROM support_tickets
        WHERE tenant_id = ? AND project_id IS NOT NULL
        GROUP BY project_id
    ) first_ticket ON first_ticket.project_id = p.id
    WHERE p.tenant_id = ?
      AND p.status = 'completed'
      AND p.completed_at IS NOT NULL
      AND p.completed_at >= NOW() - INTERVAL ? DAY
");
$s4->execute([$tenantId, $tenantId, $period]);
$stage4 = $s4->fetch(PDO::FETCH_ASSOC) ?: ['projects_with_tickets'=>0,'avg_days_to_ticket'=>0];

$s4base = $db->prepare("
    SELECT COUNT(*) FROM projects
    WHERE tenant_id = ? AND status = 'completed'
      AND completed_at IS NOT NULL
      AND completed_at >= NOW() - INTERVAL ? DAY
");
$s4base->execute([$tenantId, $period]);
$completedProjectCount = (int)($s4base->fetchColumn() ?: 0);
$ticketRate = $completedProjectCount > 0
    ? round(($stage4['projects_with_tickets'] / $completedProjectCount) * 100, 1)
    : 0.0;

// ── Stage 5: Ticket resolution ────────────────────────────────────────────────
// Metric: avg hours to resolve; SLA breach rate
// Benchmark: ok < 100% SLA, warn < 150%, critical ≥ 150%

$s5 = $db->prepare("
    SELECT
        COUNT(*) as total,
        ROUND(AVG(TIMESTAMPDIFF(MINUTE, created_at, COALESCE(resolved_at, closed_at))), 1) as avg_minutes,
        SUM(CASE WHEN resolved_at IS NOT NULL
                  AND TIMESTAMPDIFF(MINUTE, created_at, resolved_at) > sla_hours * 60 THEN 1 ELSE 0 END
        ) as sla_breach_count,
        ROUND(AVG(sla_hours) * 60, 1) as avg_sla_minutes
    FROM support_tickets
    WHERE tenant_id = ?
      AND status IN ('resolved','closed')
      AND created_at >= NOW() - INTERVAL ? DAY
");
$s5->execute([$tenantId, $period]);
$stage5 = $s5->fetch(PDO::FETCH_ASSOC) ?: ['total'=>0,'avg_minutes'=>0,'sla_breach_count'=>0,'avg_sla_minutes'=>480];

$avgResolutionHours = round(($stage5['avg_minutes'] ?: 0) / 60, 1);
$slaBreachRate = ($stage5['total'] > 0)
    ? round(($stage5['sla_breach_count'] / $stage5['total']) * 100, 1)
    : 0.0;

// ── Conversion funnel counts ──────────────────────────────────────────────────

$funnelLeads = $db->prepare("
    SELECT COUNT(*) FROM sales_opportunities
    WHERE tenant_id = ? AND created_at >= NOW() - INTERVAL ? DAY
");
$funnelLeads->execute([$tenantId, $period]);
$totalLeads = (int)$funnelLeads->fetchColumn();

$funnelProjects = $db->prepare("
    SELECT COUNT(*) FROM projects
    WHERE tenant_id = ? AND kind = 'project' AND deleted_at IS NULL
      AND created_at >= NOW() - INTERVAL ? DAY
");
$funnelProjects->execute([$tenantId, $period]);
$totalProjects = (int)$funnelProjects->fetchColumn();

$funnelTickets = $db->prepare("
    SELECT COUNT(*) FROM support_tickets
    WHERE tenant_id = ? AND created_at >= NOW() - INTERVAL ? DAY
");
$funnelTickets->execute([$tenantId, $period]);
$totalTickets = (int)$funnelTickets->fetchColumn();

// ── Stage 6: Renew / Upsell ───────────────────────────────────────────────────
// Metric: renewal rate = won renewals / completed projects (in period)
// Benchmark (higher = better): ok ≥ 50%, warn ≥ 20%, critical < 20%
// We invert: lower renewal_rate → higher heat

$s6 = $db->prepare("
    SELECT
        COUNT(*) as total_renewals,
        SUM(CASE WHEN stage = 'won' THEN 1 ELSE 0 END) as won_renewals,
        ROUND(AVG(value), 2) as avg_value
    FROM sales_opportunities
    WHERE tenant_id = ? AND renewal_of IS NOT NULL
      AND created_at >= NOW() - INTERVAL ? DAY
");
$s6->execute([$tenantId, $period]);
$stage6 = $s6->fetch(PDO::FETCH_ASSOC) ?: ['total_renewals'=>0,'won_renewals'=>0,'avg_value'=>0];

$renewalRate = $completedProjectCount > 0
    ? round(($stage6['won_renewals'] / $completedProjectCount) * 100, 1)
    : 0.0;
// Invert for heat: low renewal rate is bad
$renewHeat = $renewalRate >= 50 ? 'ok' : ($renewalRate >= 20 ? 'warn' : 'critical');

$funnelRenewals = (int)$stage6['won_renewals'];

// ── Build response ────────────────────────────────────────────────────────────

$stages = [
    [
        'id'          => 'lead_to_won',
        'label'       => 'Lead → Won',
        'icon'        => 'target',
        'metric'      => (float)($stage1['avg_days'] ?: 0),
        'unit'        => 'วัน',
        'description' => 'เฉลี่ยเวลาปิด Deal',
        'count'       => (int)$stage1['total'],
        'won_count'   => $wonCount,
        'heat_level'  => heatLevel((float)($stage1['avg_days'] ?: 0), 30, 60),
        'bench_warn'  => 30,
        'bench_crit'  => 60,
        'detail'      => [
            'late_count' => (int)$stage1['late_count'],
            'lost_count' => (int)$stage1['lost_count'],
            'win_rate'   => $stage1['total'] > 0
                ? round($wonCount / $stage1['total'] * 100, 1) : 0,
        ],
    ],
    [
        'id'          => 'won_to_project',
        'label'       => 'Won → เริ่มโปรเจกต์',
        'icon'        => 'rocket',
        'metric'      => (float)($stage2['avg_gap_days'] ?: 0),
        'unit'        => 'วัน',
        'description' => 'ช่องว่างหลังปิด Deal',
        'count'       => (int)$stage2['total'],
        'heat_level'  => heatLevel((float)($stage2['avg_gap_days'] ?: 0), 7, 21),
        'bench_warn'  => 7,
        'bench_crit'  => 21,
        'detail'      => [
            'slow_count' => (int)$stage2['slow_count'],
        ],
    ],
    [
        'id'          => 'project_delivery',
        'label'       => 'โปรเจกต์ → ส่งมอบ',
        'icon'        => 'folder',
        'metric'      => (float)($stage3['avg_days'] ?: 0),
        'unit'        => 'วัน',
        'description' => 'ระยะเวลาดำเนินโปรเจกต์',
        'count'       => (int)$stage3['total'],
        'heat_level'  => heatLevel((float)($stage3['avg_days'] ?: 0), 60, 90),
        'bench_warn'  => 60,
        'bench_crit'  => 90,
        'detail'      => [
            'delayed_count'   => (int)$stage3['delayed_count'],
            'completed_count' => (int)$stage3['completed_count'],
        ],
    ],
    [
        'id'          => 'project_to_ticket',
        'label'       => 'ส่งมอบ → Ticket แรก',
        'icon'        => 'bug',
        'metric'      => $ticketRate,
        'unit'        => '% โปรเจกต์',
        'description' => 'โปรเจกต์ที่มี Ticket หลังส่งมอบ',
        'count'       => $completedProjectCount,
        'heat_level'  => heatLevel($ticketRate, 20, 40),
        'bench_warn'  => 20,
        'bench_crit'  => 40,
        'lower_is_better' => true,
        'detail'      => [
            'projects_with_tickets' => (int)$stage4['projects_with_tickets'],
            'avg_days_to_ticket'    => (float)($stage4['avg_days_to_ticket'] ?: 0),
        ],
    ],
    [
        'id'          => 'ticket_resolution',
        'label'       => 'Ticket → แก้ไขแล้ว',
        'icon'        => 'headphones',
        'metric'      => $avgResolutionHours,
        'unit'        => 'ชั่วโมง',
        'description' => 'เฉลี่ยเวลาแก้ไข Ticket',
        'count'       => (int)$stage5['total'],
        'heat_level'  => heatLevel($slaBreachRate, 10, 30),
        'bench_warn'  => 10,
        'bench_crit'  => 30,
        'detail'      => [
            'sla_breach_count' => (int)$stage5['sla_breach_count'],
            'sla_breach_rate'  => $slaBreachRate,
            'avg_sla_hours'    => round(($stage5['avg_sla_minutes'] ?: 480) / 60, 1),
        ],
    ],
    [
        'id'              => 'renew_upsell',
        'label'           => 'Renew / Upsell',
        'icon'            => 'refresh',
        'metric'          => $renewalRate,
        'unit'            => '% renewal',
        'description'     => 'อัตราการต่อสัญญา/ขยายงาน',
        'count'           => (int)$stage6['total_renewals'],
        'heat_level'      => $renewHeat,
        'bench_warn'      => 20,
        'bench_crit'      => 0,
        'higher_is_better'=> true,
        'detail'          => [
            'won_renewals'  => (int)$stage6['won_renewals'],
            'avg_value'     => (float)($stage6['avg_value'] ?: 0),
        ],
    ],
];

jsonResponse([
    'period'   => $period,
    'funnel'   => [
        'leads'    => $totalLeads,
        'won'      => $wonCount,
        'projects' => $totalProjects,
        'tickets'  => $totalTickets,
        'renewals' => $funnelRenewals,
    ],
    'stages' => $stages,
]);
