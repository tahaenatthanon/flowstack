<?php
// GET /api/customer-journey.php?company_id=<id>
// Returns full journey timeline for one company: opps → projects → tickets → renewals
require_once __DIR__ . '/auth.php';

$user      = requireAuth();
$db        = getDB();
$tenantId  = $user['tenant_id'];
$companyId = $_GET['company_id'] ?? '';

if (!$companyId) jsonError('company_id required', 400);

// Verify company belongs to tenant
$chk = $db->prepare('SELECT id, name FROM companies WHERE id = ? AND tenant_id = ?');
$chk->execute([$companyId, $tenantId]);
$company = $chk->fetch(PDO::FETCH_ASSOC);
if (!$company) jsonError('Not found', 404);

// ── Opportunities ──────────────────────────────────────────────────────────────
$opps = $db->prepare("
    SELECT o.id, o.name, o.stage, o.value, o.probability,
           o.created_at, o.expected_close_date, o.actual_close_date,
           o.lead_source, o.renewal_of,
           u.display_name AS assigned_name,
           p.id AS linked_project_id, p.name AS linked_project_name,
           parent_o.name AS renewal_of_name
    FROM sales_opportunities o
    LEFT JOIN users u ON u.id = o.assigned_to
    LEFT JOIN projects p ON p.opportunity_id = o.id AND p.tenant_id = ?
    LEFT JOIN sales_opportunities parent_o ON parent_o.id = o.renewal_of
    WHERE o.company_id = ? AND o.tenant_id = ?
    ORDER BY o.created_at ASC
");
$opps->execute([$tenantId, $companyId, $tenantId]);
$opportunities = $opps->fetchAll(PDO::FETCH_ASSOC);

// ── Projects ───────────────────────────────────────────────────────────────────
$projs = $db->prepare("
    SELECT p.id, p.name, p.status, p.start_date, p.end_date, p.completed_at,
           p.created_at, p.opportunity_id,
           p.project_value, p.actual_progress,
           u.display_name AS manager_name,
           COUNT(DISTINCT st.id) AS ticket_count
    FROM projects p
    LEFT JOIN users u ON u.id = p.manager_id
    LEFT JOIN support_tickets st ON st.project_id = p.id
    WHERE p.company_id = ? AND p.tenant_id = ?
      AND p.kind = 'project' AND p.deleted_at IS NULL
    GROUP BY p.id, p.name, p.status, p.start_date, p.end_date, p.completed_at,
             p.created_at, p.opportunity_id, p.project_value, p.actual_progress, u.display_name
    ORDER BY p.created_at ASC
");
$projs->execute([$companyId, $tenantId]);
$projects = $projs->fetchAll(PDO::FETCH_ASSOC);

// ── Support Tickets ────────────────────────────────────────────────────────────
$tickets = $db->prepare("
    SELECT st.id, st.ticket_number, st.title, st.priority, st.status,
           st.created_at, st.resolved_at, st.closed_at, st.project_id,
           st.sla_hours, st.csat_score,
           ROUND(TIMESTAMPDIFF(MINUTE, st.created_at,
                 COALESCE(st.resolved_at, st.closed_at)) / 60.0, 1) AS hours_elapsed,
           CASE WHEN st.resolved_at IS NOT NULL
                AND TIMESTAMPDIFF(MINUTE, st.created_at, st.resolved_at) > st.sla_hours * 60
                THEN 1 ELSE 0 END AS sla_breached,
           u.display_name AS assigned_name
    FROM support_tickets st
    LEFT JOIN users u ON u.id = st.assigned_to
    WHERE st.company_id = ? AND st.tenant_id = ?
    ORDER BY st.created_at ASC
");
$tickets->execute([$companyId, $tenantId]);
$ticketRows = $tickets->fetchAll(PDO::FETCH_ASSOC);

// ── Summary metrics ────────────────────────────────────────────────────────────
$totalValue   = array_sum(array_column(
    array_filter($opportunities, fn($o) => $o['stage'] === 'won'), 'value'));
$wonCount     = count(array_filter($opportunities, fn($o) => $o['stage'] === 'won'));
$renewalCount = count(array_filter($opportunities, fn($o) => $o['renewal_of'] !== null));
$openTickets  = count(array_filter($ticketRows, fn($t) => $t['status'] === 'open'));
$breachCount  = count(array_filter($ticketRows, fn($t) => (int)$t['sla_breached'] === 1));
$csatScores   = array_filter(array_column($ticketRows, 'csat_score'), fn($v) => $v !== null);
$avgCsat      = count($csatScores) ? round(array_sum($csatScores) / count($csatScores), 1) : null;

// First interaction date
$allDates = array_merge(
    array_column($opportunities, 'created_at'),
    array_column($projects,     'created_at'),
    array_column($ticketRows,   'created_at')
);
$firstDate = $allDates ? min($allDates) : null;

jsonResponse([
    'company'      => $company,
    'summary'      => [
        'first_interaction' => $firstDate,
        'total_won_value'   => (float)$totalValue,
        'won_deals'         => $wonCount,
        'total_deals'       => count($opportunities),
        'total_projects'    => count($projects),
        'total_tickets'     => count($ticketRows),
        'open_tickets'      => $openTickets,
        'renewals'          => $renewalCount,
        'sla_breaches'      => $breachCount,
        'avg_csat'          => $avgCsat,
    ],
    'opportunities' => $opportunities,
    'projects'      => $projects,
    'tickets'       => $ticketRows,
]);
