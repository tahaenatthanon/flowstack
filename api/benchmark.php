<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

$db       = getDB();
$auth     = requireAuth();
$tenantId = $auth['tenant_id'];

// ── Tasks on-time rate ────────────────────────────────────────────────────────
$taskStmt = $db->prepare("
    SELECT
        COUNT(*) total,
        SUM(CASE WHEN status='completed' AND (completed_date IS NULL OR completed_date <= end_date) THEN 1 ELSE 0 END) on_time
    FROM tasks WHERE deleted_at IS NULL AND tenant_id = ? AND is_subtask = 0 AND status='completed'
");
$taskStmt->execute([$tenantId]);
$taskStats = $taskStmt->fetch();
$onTimeRate = $taskStats['total'] > 0
    ? round($taskStats['on_time'] / $taskStats['total'] * 100, 1) : 0;

// ── SLA compliance ────────────────────────────────────────────────────────────
$slaStmt = $db->prepare("
    SELECT COUNT(*) total,
        SUM(CASE
            WHEN priority='critical' AND TIMESTAMPDIFF(HOUR,created_at,COALESCE(resolved_at,NOW())) <= 2  THEN 1
            WHEN priority='high'     AND TIMESTAMPDIFF(HOUR,created_at,COALESCE(resolved_at,NOW())) <= 4  THEN 1
            WHEN priority='medium'   AND TIMESTAMPDIFF(HOUR,created_at,COALESCE(resolved_at,NOW())) <= 8  THEN 1
            WHEN priority='low'      AND TIMESTAMPDIFF(HOUR,created_at,COALESCE(resolved_at,NOW())) <= 24 THEN 1
            ELSE 0
        END) met
    FROM support_tickets WHERE status='resolved' AND tenant_id = ?
");
$slaStmt->execute([$tenantId]);
$sla = $slaStmt->fetch();
$slaRate = $sla['total'] > 0 ? round($sla['met'] / $sla['total'] * 100, 1) : 0;

// ── Project completion rate ───────────────────────────────────────────────────
$projStmt = $db->prepare("
    SELECT COUNT(*) total, SUM(status='completed') completed
    FROM projects WHERE deleted_at IS NULL AND tenant_id = ?
");
$projStmt->execute([$tenantId]);
$projStats = $projStmt->fetch();
$projCompletionRate = $projStats['total'] > 0
    ? round($projStats['completed'] / $projStats['total'] * 100, 1) : 0;

// ── Avg ticket resolution hours ───────────────────────────────────────────────
$avgStmt = $db->prepare("
    SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)) avg_hrs
    FROM support_tickets WHERE status='resolved' AND tenant_id = ? AND resolved_at IS NOT NULL
");
$avgStmt->execute([$tenantId]);
$avgResolutionHrs = round((float)($avgStmt->fetchColumn() ?? 0), 1);

// ── Email campaign open rate ──────────────────────────────────────────────────
$emailStmt = $db->prepare("
    SELECT SUM(total_sent) sent, SUM(total_opens) opens, SUM(total_clicks) clicks
    FROM email_campaigns WHERE status='sent' AND tenant_id = ?
");
$emailStmt->execute([$tenantId]);
$emailStats = $emailStmt->fetch();
$sent    = (float)($emailStats['sent']   ?? 0);
$openRate = $sent > 0 ? round((float)$emailStats['opens']  / $sent * 100, 1) : 0;
$ctr      = $sent > 0 ? round((float)$emailStats['clicks'] / $sent * 100, 1) : 0;

// ── Opportunity win rate ──────────────────────────────────────────────────────
$oppStmt = $db->prepare("
    SELECT COUNT(*) total, SUM(stage='won') won
    FROM sales_opportunities WHERE stage IN ('won','lost') AND tenant_id = ?
");
$oppStmt->execute([$tenantId]);
$oppStats = $oppStmt->fetch();
$winRate = $oppStats['total'] > 0 ? round($oppStats['won'] / $oppStats['total'] * 100, 1) : 0;

jsonResponse([
    'benchmarks' => [
        ['metric'=>'อัตราส่งงานตรงเวลา',        'label'=>'ส่งงานตรงเวลา',        'yours'=>$onTimeRate,         'industry'=>75,  'unit'=>'%',   'better'=>'higher'],
        ['metric'=>'sla_compliance',              'label'=>'SLA Compliance',        'yours'=>$slaRate,            'industry'=>85,  'unit'=>'%',   'better'=>'higher'],
        ['metric'=>'project_completion',          'label'=>'ปิดโปรเจกต์สำเร็จ',    'yours'=>$projCompletionRate, 'industry'=>70,  'unit'=>'%',   'better'=>'higher'],
        ['metric'=>'avg_resolution_hrs',          'label'=>'เวลาเฉลี่ยแก้ Ticket', 'yours'=>$avgResolutionHrs,  'industry'=>12,  'unit'=>'ชม.', 'better'=>'lower'],
        ['metric'=>'email_open_rate',             'label'=>'Email Open Rate',       'yours'=>$openRate,          'industry'=>22,  'unit'=>'%',   'better'=>'higher'],
        ['metric'=>'email_ctr',                   'label'=>'Email Click-Through',   'yours'=>$ctr,               'industry'=>3,   'unit'=>'%',   'better'=>'higher'],
        ['metric'=>'win_rate',                    'label'=>'Win Rate (Sales)',       'yours'=>$winRate,           'industry'=>30,  'unit'=>'%',   'better'=>'higher'],
    ],
    'meta' => [
        'tasks_completed'  => (int)$taskStats['total'],
        'tickets_resolved' => (int)($sla['total'] ?? 0),
        'campaigns_sent'   => (int)$sent,
        'opportunities'    => (int)($oppStats['total'] ?? 0),
    ]
]);
