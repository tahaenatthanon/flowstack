<?php
/**
 * GET /api/sales-activity-eval.php
 * Returns per-company customer activity evaluation metrics combined with opportunity pipeline data.
 *
 * Query params:
 *   start_date  (optional) - filter opportunities by expected_close_date start
 *   end_date    (optional) - filter opportunities by expected_close_date end
 *   company_id  (optional) - filter to a single company
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$tenantId = $tokenData['tenant_id'];

$db = getDB();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') jsonError('Method not allowed', 405);

$startDate = $_GET['start_date'] ?? null;
$endDate   = $_GET['end_date']   ?? null;
$companyId = $_GET['company_id'] ?? null;

// ────────────────────────────────────────────────
// 1. Opportunity data per company
// ────────────────────────────────────────────────
$oppWhere  = 'WHERE o.tenant_id = ?';
$oppParams = [$tenantId];

if ($startDate) {
    $oppWhere .= ' AND (o.expected_close_date IS NULL OR o.expected_close_date >= ?)';
    $oppParams[] = $startDate;
}
if ($endDate) {
    $oppWhere .= ' AND (o.expected_close_date IS NULL OR o.expected_close_date <= ?)';
    $oppParams[] = $endDate;
}
if ($companyId) {
    $oppWhere .= ' AND o.company_id = ?';
    $oppParams[] = $companyId;
}

$oppSql = "
    SELECT
        o.company_id,
        COUNT(*)                                               AS opp_count,
        SUM(CASE WHEN o.stage = 'won'  THEN 1 ELSE 0 END)    AS opp_won,
        SUM(CASE WHEN o.stage = 'lost' THEN 1 ELSE 0 END)    AS opp_lost,
        SUM(o.value)                                          AS opp_value,
        -- Sales activities linked to these opportunities
        COUNT(DISTINCT sa.id)                                 AS sales_act_count,
        SUM(CASE WHEN sa.activity_type = 'email'          THEN 1 ELSE 0 END) AS sa_email,
        SUM(CASE WHEN sa.activity_type = 'call'           THEN 1 ELSE 0 END) AS sa_call,
        SUM(CASE WHEN sa.activity_type = 'meeting'        THEN 1 ELSE 0 END) AS sa_meeting,
        SUM(CASE WHEN sa.activity_type = 'note'           THEN 1 ELSE 0 END) AS sa_note,
        SUM(CASE WHEN sa.activity_type = 'quotation_sent' THEN 1 ELSE 0 END) AS sa_quotation,
        SUM(CASE WHEN sa.activity_type = 'other'          THEN 1 ELSE 0 END) AS sa_other
    FROM sales_opportunities o
    LEFT JOIN sales_activities sa ON sa.opportunity_id = o.id
    $oppWhere
    GROUP BY o.company_id
";
$stmt = $db->prepare($oppSql);
$stmt->execute($oppParams);
$oppByCompany = [];
foreach ($stmt->fetchAll() as $row) {
    $oppByCompany[$row['company_id']] = $row;
}

// ────────────────────────────────────────────────
// 2. Email tracking stats per company
//    (via customers → email_tracking)
// ────────────────────────────────────────────────
$emailWhere  = 'WHERE c.tenant_id = ?';
$emailParams = [$tenantId];

if ($startDate) {
    $emailWhere .= ' AND et.sent_at >= ?';
    $emailParams[] = $startDate . ' 00:00:00';
}
if ($endDate) {
    $emailWhere .= ' AND et.sent_at <= ?';
    $emailParams[] = $endDate . ' 23:59:59';
}
if ($companyId) {
    $emailWhere .= ' AND c.company_id = ?';
    $emailParams[] = $companyId;
}

$emailSql = "
    SELECT
        c.company_id,
        COUNT(*)                                                              AS emails_sent,
        SUM(CASE WHEN et.status IN ('sent','delivered') THEN 1 ELSE 0 END)   AS emails_delivered,
        SUM(CASE WHEN et.opened_at  IS NOT NULL THEN 1 ELSE 0 END)           AS emails_opened,
        SUM(CASE WHEN et.clicked_at IS NOT NULL THEN 1 ELSE 0 END)           AS emails_clicked,
        SUM(CASE WHEN et.bounced_at IS NOT NULL THEN 1 ELSE 0 END)           AS emails_bounced
    FROM email_tracking et
    JOIN customers c ON c.id = et.customer_id
    $emailWhere
    GROUP BY c.company_id
";
$stmt = $db->prepare($emailSql);
$stmt->execute($emailParams);
$emailByCompany = [];
foreach ($stmt->fetchAll() as $row) {
    $emailByCompany[$row['company_id']] = $row;
}

// ────────────────────────────────────────────────
// 3. Customer activities per company
// ────────────────────────────────────────────────
$caWhere  = 'WHERE c.tenant_id = ?';
$caParams = [$tenantId];

if ($startDate) {
    $caWhere .= ' AND ca.created_at >= ?';
    $caParams[] = $startDate . ' 00:00:00';
}
if ($endDate) {
    $caWhere .= ' AND ca.created_at <= ?';
    $caParams[] = $endDate . ' 23:59:59';
}
if ($companyId) {
    $caWhere .= ' AND c.company_id = ?';
    $caParams[] = $companyId;
}

$caSql = "
    SELECT
        c.company_id,
        COUNT(*)                                                                          AS ca_total,
        SUM(CASE WHEN ca.activity_type = 'email_sent'    THEN 1 ELSE 0 END)              AS ca_email_sent,
        SUM(CASE WHEN ca.activity_type = 'email_opened'  THEN 1 ELSE 0 END)              AS ca_email_opened,
        SUM(CASE WHEN ca.activity_type = 'email_clicked' THEN 1 ELSE 0 END)              AS ca_email_clicked,
        SUM(CASE WHEN ca.activity_type = 'email_replied' THEN 1 ELSE 0 END)              AS ca_email_replied,
        SUM(CASE WHEN ca.activity_type = 'email_bounced' THEN 1 ELSE 0 END)              AS ca_email_bounced
    FROM customer_activities ca
    JOIN customers c ON c.id = ca.customer_id AND ca.customer_id IS NOT NULL
    $caWhere
    GROUP BY c.company_id
";
$stmt = $db->prepare($caSql);
$stmt->execute($caParams);
$caByCompany = [];
foreach ($stmt->fetchAll() as $row) {
    $caByCompany[$row['company_id']] = $row;
}

// ────────────────────────────────────────────────
// 4. Survey responses per company
// ────────────────────────────────────────────────
$surveyWhere  = 'WHERE sr.tenant_id = ?';
$surveyParams = [$tenantId];

if ($startDate) {
    $surveyWhere .= ' AND (sr.submitted_at >= ? OR sr.created_at >= ?)';
    $surveyParams[] = $startDate . ' 00:00:00';
    $surveyParams[] = $startDate . ' 00:00:00';
}
if ($endDate) {
    $surveyWhere .= ' AND (sr.submitted_at <= ? OR sr.created_at <= ?)';
    $surveyParams[] = $endDate . ' 23:59:59';
    $surveyParams[] = $endDate . ' 23:59:59';
}
if ($companyId) {
    $surveyWhere .= ' AND sr.company_id = ?';
    $surveyParams[] = $companyId;
}

$surveySql = "
    SELECT
        sr.company_id,
        COUNT(*)                                                                      AS survey_count,
        SUM(CASE WHEN sr.status = 'submitted' THEN 1 ELSE 0 END)                    AS survey_responded,
        AVG(CASE WHEN sr.status = 'submitted' AND sr.pain_point_score IS NOT NULL
                 THEN sr.pain_point_score ELSE NULL END)                              AS avg_pain_score
    FROM survey_responses sr
    $surveyWhere
    GROUP BY sr.company_id
";
$stmt = $db->prepare($surveySql);
$stmt->execute($surveyParams);
$surveyByCompany = [];
foreach ($stmt->fetchAll() as $row) {
    $surveyByCompany[$row['company_id']] = $row;
}

// ────────────────────────────────────────────────
// 5. Load all companies + customer count
// ────────────────────────────────────────────────
$coWhereClause = 'WHERE co.tenant_id = ?';
$coWhereParams = [$tenantId];
if ($companyId) {
    $coWhereClause .= ' AND co.id = ?';
    $coWhereParams[] = $companyId;
}
// JOIN param comes first in SQL, then WHERE params
$coParams = array_merge([$tenantId], $coWhereParams);

$coSql = "
    SELECT co.id, co.name,
           COUNT(cu.id) AS customers_count
    FROM companies co
    LEFT JOIN customers cu ON cu.company_id = co.id AND cu.tenant_id = ? AND cu.is_active = 1
    $coWhereClause
    GROUP BY co.id, co.name
    ORDER BY co.name
";
$stmt = $db->prepare($coSql);
$stmt->execute($coParams);
$companies = $stmt->fetchAll();

// ────────────────────────────────────────────────
// 6. Merge everything per company
// ────────────────────────────────────────────────
$result = [];

foreach ($companies as $co) {
    $cid    = $co['id'];
    $opp    = $oppByCompany[$cid]    ?? null;
    $email  = $emailByCompany[$cid]  ?? null;
    $ca     = $caByCompany[$cid]     ?? null;
    $survey = $surveyByCompany[$cid] ?? null;

    // skip companies with zero data (unless explicitly requested)
    if (!$opp && !$email && !$ca && !$survey && !$companyId) continue;

    $emailsSent      = (int)($email['emails_sent']      ?? 0);
    $emailsDelivered = (int)($email['emails_delivered'] ?? 0);
    $emailsOpened    = (int)($email['emails_opened']    ?? 0);
    $emailsClicked   = (int)($email['emails_clicked']   ?? 0);
    $emailsBounced   = (int)($email['emails_bounced']   ?? 0);

    $openRate  = $emailsDelivered > 0 ? round($emailsOpened  / $emailsDelivered * 100, 1) : 0;
    $clickRate = $emailsDelivered > 0 ? round($emailsClicked / $emailsDelivered * 100, 1) : 0;

    $oppCount = (int)($opp['opp_count'] ?? 0);
    $oppWon   = (int)($opp['opp_won']   ?? 0);
    $oppLost  = (int)($opp['opp_lost']  ?? 0);
    $oppValue = (float)($opp['opp_value'] ?? 0);

    $salesActTotal  = (int)($opp['sales_act_count'] ?? 0);
    $caTotal        = (int)($ca['ca_total']         ?? 0);
    $surveyCount    = (int)($survey['survey_count']    ?? 0);
    $surveyResponded= (int)($survey['survey_responded'] ?? 0);
    $avgPainScore   = $survey['avg_pain_score'] !== null ? round((float)$survey['avg_pain_score'], 1) : null;

    // Engagement score: weighted composite
    // email (0.30+0.25) + replies (max 15) + CRM acts (max 10) + survey (max 15) + pain score (max 5)
    $caReplied = (int)($ca['ca_email_replied'] ?? 0);
    $surveyScore = $surveyResponded > 0 ? min($surveyResponded * 5, 15) : 0;
    $painScore   = ($avgPainScore !== null && $avgPainScore > 0) ? round($avgPainScore * 0.05, 1) : 0;
    $engagementScore = round(
        $openRate  * 0.30 +
        $clickRate * 0.25 +
        ($caReplied > 0 ? min($caReplied * 5, 15) : 0) +
        ($salesActTotal > 0 ? min($salesActTotal * 2, 10) : 0) +
        $surveyScore +
        $painScore,
        1
    );

    $result[] = [
        'company_id'          => $cid,
        'company_name'        => $co['name'],
        'customers_count'     => (int)$co['customers_count'],
        // email tracking
        'emails_sent'         => $emailsSent,
        'emails_delivered'    => $emailsDelivered,
        'emails_opened'       => $emailsOpened,
        'emails_clicked'      => $emailsClicked,
        'emails_bounced'      => $emailsBounced,
        'open_rate'           => $openRate,
        'click_rate'          => $clickRate,
        // customer activities (from campaign events)
        'ca_total'            => $caTotal,
        'ca_email_sent'       => (int)($ca['ca_email_sent']    ?? 0),
        'ca_email_opened'     => (int)($ca['ca_email_opened']  ?? 0),
        'ca_email_clicked'    => (int)($ca['ca_email_clicked'] ?? 0),
        'ca_email_replied'    => $caReplied,
        'ca_email_bounced'    => (int)($ca['ca_email_bounced'] ?? 0),
        // sales activities (CRM)
        'sales_act_total'     => $salesActTotal,
        'sa_email'            => (int)($opp['sa_email']     ?? 0),
        'sa_call'             => (int)($opp['sa_call']      ?? 0),
        'sa_meeting'          => (int)($opp['sa_meeting']   ?? 0),
        'sa_note'             => (int)($opp['sa_note']      ?? 0),
        'sa_quotation'        => (int)($opp['sa_quotation'] ?? 0),
        'sa_other'            => (int)($opp['sa_other']     ?? 0),
        // opportunities
        'opp_count'           => $oppCount,
        'opp_won'             => $oppWon,
        'opp_lost'            => $oppLost,
        'opp_value'           => $oppValue,
        'win_rate'            => $oppCount > 0 ? round($oppWon / $oppCount * 100, 1) : 0,
        // surveys
        'survey_count'        => $surveyCount,
        'survey_responded'    => $surveyResponded,
        'survey_response_rate'=> $surveyCount > 0 ? round($surveyResponded / $surveyCount * 100, 1) : 0,
        'avg_pain_score'      => $avgPainScore,
        // composite
        'engagement_score'    => $engagementScore,
    ];
}

// ────────────────────────────────────────────────
// 6. Summary aggregates
// ────────────────────────────────────────────────
$totalCompanies  = count($result);
$totalOppCount   = array_sum(array_column($result, 'opp_count'));
$totalOppWon     = array_sum(array_column($result, 'opp_won'));
$avgOpenRate     = $totalCompanies > 0 ? round(array_sum(array_column($result, 'open_rate'))  / $totalCompanies, 1) : 0;
$avgClickRate    = $totalCompanies > 0 ? round(array_sum(array_column($result, 'click_rate')) / $totalCompanies, 1) : 0;
$overallWinRate  = $totalOppCount  > 0 ? round($totalOppWon / $totalOppCount * 100, 1) : 0;
$totalSalesActs  = array_sum(array_column($result, 'sales_act_total'));
$totalCaActs     = array_sum(array_column($result, 'ca_total'));

// Activity type aggregates for chart
$actBreakdown = [
    'email'          => array_sum(array_column($result, 'sa_email')),
    'call'           => array_sum(array_column($result, 'sa_call')),
    'meeting'        => array_sum(array_column($result, 'sa_meeting')),
    'note'           => array_sum(array_column($result, 'sa_note')),
    'quotation_sent' => array_sum(array_column($result, 'sa_quotation')),
    'other'          => array_sum(array_column($result, 'sa_other')),
];

jsonSuccess([
    'summary' => [
        'companies_total'    => $totalCompanies,
        'avg_open_rate'      => $avgOpenRate,
        'avg_click_rate'     => $avgClickRate,
        'win_rate'           => $overallWinRate,
        'total_sales_acts'   => $totalSalesActs,
        'total_ca_acts'      => $totalCaActs,
        'activity_breakdown' => $actBreakdown,
    ],
    'companies' => $result,
]);
