<?php
// GET /api/marketing-attribution.php           — marketing attribution analytics
// GET /api/marketing-attribution.php?period=90 — last N days
require_once __DIR__ . '/auth.php';

$user     = requireAuth();
$db       = getDB();
$tenantId = $user['tenant_id'];
$period   = max(30, min(730, (int)($_GET['period'] ?? 365)));

// ── Per lead_source funnel ─────────────────────────────────────────────────────
$srcStmt = $db->prepare("
    SELECT
        COALESCE(NULLIF(TRIM(o.lead_source),''), '(ไม่ระบุ)') AS source,
        COUNT(*)                                                  AS total_leads,
        SUM(CASE WHEN o.stage = 'won'  THEN 1 ELSE 0 END)        AS won,
        SUM(CASE WHEN o.stage = 'lost' THEN 1 ELSE 0 END)        AS lost,
        ROUND(SUM(CASE WHEN o.stage = 'won' THEN o.value ELSE 0 END), 2) AS won_value,
        COUNT(DISTINCT p.id)                                      AS projects,
        COUNT(DISTINCT st.id)                                     AS tickets,
        ROUND(AVG(CASE WHEN o.stage = 'won'
                       THEN DATEDIFF(o.actual_close_date, o.created_at) END), 1) AS avg_days_to_close
    FROM sales_opportunities o
    LEFT JOIN projects       p  ON p.opportunity_id = o.id
    LEFT JOIN support_tickets st ON st.project_id = p.id
    WHERE o.tenant_id = ?
      AND o.created_at >= NOW() - INTERVAL ? DAY
    GROUP BY source
    ORDER BY won_value DESC, won DESC
");
$srcStmt->execute([$tenantId, $period]);
$bySource = $srcStmt->fetchAll(PDO::FETCH_ASSOC);

// ── Per email campaign ─────────────────────────────────────────────────────────
$camStmt = $db->prepare("
    SELECT
        ec.id                                                      AS campaign_id,
        ec.name                                                    AS campaign_name,
        ec.status                                                  AS campaign_status,
        ec.sent_at,
        ec.total_sent,
        ec.total_opens,
        ec.total_clicks,
        COUNT(o.id)                                                AS leads,
        SUM(CASE WHEN o.stage = 'won'  THEN 1 ELSE 0 END)         AS won,
        ROUND(SUM(CASE WHEN o.stage = 'won' THEN o.value ELSE 0 END), 2) AS won_value,
        ROUND(
            SUM(CASE WHEN o.stage = 'won' THEN 1 ELSE 0 END)
            / NULLIF(COUNT(o.id), 0) * 100
        , 1) AS win_rate
    FROM email_campaigns ec
    LEFT JOIN sales_opportunities o
           ON o.campaign_id = ec.id AND o.tenant_id = ?
    WHERE ec.tenant_id = ?
      AND ec.status = 'sent'
      AND ec.sent_at >= NOW() - INTERVAL ? DAY
    GROUP BY ec.id, ec.name, ec.status, ec.sent_at, ec.total_sent, ec.total_opens, ec.total_clicks
    ORDER BY won_value DESC, leads DESC
");
$camStmt->execute([$tenantId, $tenantId, $period]);
$byCampaign = $camStmt->fetchAll(PDO::FETCH_ASSOC);

// ── Monthly trend: new leads by source (last 12 months) ───────────────────────
$trendStmt = $db->prepare("
    SELECT
        DATE_FORMAT(o.created_at, '%Y-%m')                         AS month,
        COALESCE(NULLIF(TRIM(o.lead_source),''), '(ไม่ระบุ)')      AS source,
        COUNT(*)                                                    AS leads,
        SUM(CASE WHEN o.stage = 'won' THEN 1 ELSE 0 END)           AS won
    FROM sales_opportunities o
    WHERE o.tenant_id = ?
      AND o.created_at >= NOW() - INTERVAL 12 MONTH
    GROUP BY month, source
    ORDER BY month ASC
");
$trendStmt->execute([$tenantId]);
$trend = $trendStmt->fetchAll(PDO::FETCH_ASSOC);

// ── Summary totals ─────────────────────────────────────────────────────────────
$totStmt = $db->prepare("
    SELECT
        COUNT(*)                                                AS total_leads,
        SUM(CASE WHEN stage = 'won'  THEN 1 ELSE 0 END)        AS total_won,
        SUM(CASE WHEN stage = 'lost' THEN 1 ELSE 0 END)        AS total_lost,
        ROUND(SUM(CASE WHEN stage = 'won' THEN value ELSE 0 END), 2) AS total_won_value,
        COUNT(DISTINCT COALESCE(NULLIF(TRIM(lead_source),''), '(ไม่ระบุ)')) AS source_count
    FROM sales_opportunities
    WHERE tenant_id = ? AND created_at >= NOW() - INTERVAL ? DAY
");
$totStmt->execute([$tenantId, $period]);
$totals = $totStmt->fetch(PDO::FETCH_ASSOC);

jsonResponse([
    'period'      => $period,
    'summary'     => $totals,
    'by_source'   => $bySource,
    'by_campaign' => $byCampaign,
    'trend'       => $trend,
]);
