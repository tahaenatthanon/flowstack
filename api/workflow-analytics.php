<?php
require_once __DIR__ . '/auth.php';

$user   = requireAuth();
$db     = getDB();
$action = $_GET['action'] ?? null;

/**
 * Per-stage analytics for a company_journey definition.
 * Journey instances have no canvas nodes / step_logs — progress lives in
 * workflow_journey_links across 5 fixed stages. Returns steps[] in stage order.
 */
function journeyStageSteps(PDO $db, string $tenantId, string $defId, array $defJson): array {
    $stageOrder = ['marketing','sales','project','support','renewal'];
    $stageThai  = ['marketing'=>'การตลาด','sales'=>'การขาย','project'=>'โปรเจค','support'=>'ซัพพอร์ต','renewal'=>'ต่ออายุ'];
    $slaDays    = $defJson['sla'] ?? ['marketing'=>10,'sales'=>30,'project'=>60,'support'=>90,'renewal'=>30];

    $sStmt = $db->prepare('
        SELECT jl.stage,
            COUNT(*) AS total_runs,
            SUM(jl.stage_status = \'completed\') AS completed_runs,
            SUM(jl.stage_status = \'active\')    AS active_runs,
            AVG(CASE WHEN jl.stage_status = \'completed\'
                     THEN TIMESTAMPDIFF(MINUTE, jl.linked_at, jl.completed_at)
                     ELSE TIMESTAMPDIFF(MINUTE, jl.linked_at, NOW()) END) AS avg_cycle_minutes,
            MIN(CASE WHEN jl.stage_status = \'completed\'
                     THEN TIMESTAMPDIFF(MINUTE, jl.linked_at, jl.completed_at) END) AS min_cycle_minutes,
            MAX(CASE WHEN jl.stage_status = \'completed\'
                     THEN TIMESTAMPDIFF(MINUTE, jl.linked_at, jl.completed_at) END) AS max_cycle_minutes,
            SUM(jl.stage_status = \'active\'
                AND jl.sla_days IS NOT NULL
                AND TIMESTAMPDIFF(MINUTE, jl.linked_at, NOW()) > jl.sla_days * 1440) AS stalled_count
        FROM workflow_journey_links jl
        JOIN workflow_instances wi ON jl.instance_id = wi.id
        WHERE wi.workflow_definition_id = ? AND wi.tenant_id = ? AND wi.status != \'cancelled\'
        GROUP BY jl.stage
    ');
    $sStmt->execute([$defId, $tenantId]);
    $byStage = [];
    foreach ($sStmt->fetchAll(PDO::FETCH_ASSOC) as $r) { $byStage[$r['stage']] = $r; }

    $steps = [];
    foreach ($stageOrder as $stage) {
        $stat   = $byStage[$stage] ?? null;
        $slaMin = (int)($slaDays[$stage] ?? 30) * 1440;
        $avgMin = $stat && $stat['avg_cycle_minutes'] !== null ? (float)$stat['avg_cycle_minutes'] : null;
        $ratio  = ($avgMin !== null && $slaMin > 0) ? $avgMin / $slaMin : null;
        $heat   = $ratio === null ? 'ok' : ($ratio >= 1.0 ? 'critical' : ($ratio >= 0.8 ? 'warn' : 'ok'));
        $steps[] = [
            'step_id'           => $stage,
            'step_name'         => $stageThai[$stage],
            'node_type'         => 'stage',
            'sla_minutes'       => $slaMin,
            'avg_cycle_minutes' => $avgMin !== null ? round($avgMin, 1) : null,
            'min_cycle_minutes' => $stat && $stat['min_cycle_minutes'] !== null ? (float)$stat['min_cycle_minutes'] : null,
            'max_cycle_minutes' => $stat && $stat['max_cycle_minutes'] !== null ? (float)$stat['max_cycle_minutes'] : null,
            'total_runs'        => $stat ? (int)$stat['total_runs'] : 0,
            'completed_runs'    => $stat ? (int)$stat['completed_runs'] : 0,
            'active_runs'       => $stat ? (int)$stat['active_runs'] : 0,
            'queue_depth'       => $stat ? (int)$stat['active_runs'] : 0,
            'stalled_count'     => $stat ? (int)$stat['stalled_count'] : 0,
            'heat_level'        => $heat,
            'sla_ratio'         => $ratio !== null ? round($ratio, 3) : null,
        ];
    }
    return $steps;
}

// ── Global bottleneck summary across all definitions ──────────────────────
if ($action === 'global') {
    $defStmt = $db->prepare('SELECT id, name, entity_type, definition FROM workflow_definitions WHERE tenant_id = ? ORDER BY entity_type, name');
    $defStmt->execute([$user['tenant_id']]);
    $defs = $defStmt->fetchAll(PDO::FETCH_ASSOC);

    $result = [];
    foreach ($defs as $def) {
        $defId   = $def['id'];
        $defJson = json_decode($def['definition'], true);
        $nodeMap = [];
        foreach (($defJson['nodes'] ?? []) as $n) { $nodeMap[$n['id']] = $n; }

        // Count instances
        $instStmt = $db->prepare('SELECT COUNT(*) FROM workflow_instances WHERE workflow_definition_id = ?');
        $instStmt->execute([$defId]);
        $totalInstances = (int)$instStmt->fetchColumn();

        // company_journey: build from 5 fixed stages (no canvas nodes / step_logs)
        if ($def['entity_type'] === 'company_journey') {
            $steps = $totalInstances > 0 ? journeyStageSteps($db, $user['tenant_id'], $defId, $defJson) : [];
            $critical = 0; $warn = 0; $ok = 0; $bottleneckStep = null; $maxRatio = 0;
            foreach ($steps as $s) {
                if ($s['heat_level'] === 'critical') $critical++;
                elseif ($s['heat_level'] === 'warn') $warn++;
                else $ok++;
                if ($s['sla_ratio'] !== null && $s['sla_ratio'] > $maxRatio) {
                    $maxRatio = $s['sla_ratio'];
                    $bottleneckStep = [
                        'step_id'           => $s['step_id'],
                        'step_name'         => $s['step_name'],
                        'avg_cycle_minutes' => $s['avg_cycle_minutes'],
                        'sla_minutes'       => $s['sla_minutes'],
                        'heat_level'        => $s['heat_level'],
                        'ratio'             => $s['sla_ratio'],
                    ];
                }
            }
            $result[] = [
                'definition_id'   => $defId,
                'definition_name' => $def['name'],
                'entity_type'     => $def['entity_type'],
                'total_instances' => $totalInstances,
                'bottleneck_step' => $bottleneckStep,
                'critical_count'  => $critical,
                'warn_count'      => $warn,
                'ok_count'        => $ok,
                'steps'           => $steps,
            ];
            continue;
        }

        if ($totalInstances === 0) {
            $result[] = [
                'definition_id'   => $defId,
                'definition_name' => $def['name'],
                'entity_type'     => $def['entity_type'],
                'total_instances' => 0,
                'bottleneck_step' => null,
                'critical_count'  => 0,
                'warn_count'      => 0,
                'ok_count'        => 0,
                'steps'           => [],
            ];
            continue;
        }

        $stmt = $db->prepare('
            SELECT wsl.step_id,
                MAX(wsl.step_name) AS step_name,
                COUNT(*) AS total_runs,
                AVG(CASE WHEN wsl.status = \'completed\' AND wsl.duration_minutes > 0 THEN wsl.duration_minutes END) AS avg_cycle_minutes,
                MAX(CASE WHEN wsl.status = \'completed\' THEN wsl.duration_minutes END) AS max_cycle_minutes,
                SUM(CASE WHEN wsl.status = \'in_progress\' THEN 1 ELSE 0 END) AS queue_depth
            FROM workflow_step_logs wsl
            JOIN workflow_instances wi ON wsl.instance_id = wi.id
            WHERE wi.workflow_definition_id = ?
              AND wi.status != \'cancelled\'
              AND (wi.status = \'active\' OR wi.completed_at >= DATE_SUB(NOW(), INTERVAL 90 DAY))
              AND (wi.entity_type != \'opportunity\' OR EXISTS (
                  SELECT 1 FROM sales_opportunities WHERE id = wi.entity_id AND stage != \'lost\'
              ))
            GROUP BY wsl.step_id
        ');
        $stmt->execute([$defId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $steps          = [];
        $critical       = 0;
        $warn           = 0;
        $ok             = 0;
        $bottleneckStep = null;
        $maxRatio       = 0;

        foreach ($rows as $row) {
            $nodeId    = $row['step_id'];
            $slaMin    = (int)($nodeMap[$nodeId]['data']['slaMinutes'] ?? 1440);
            $avgMinRaw = $row['avg_cycle_minutes'];
            $avgMin    = $avgMinRaw !== null ? (float)$avgMinRaw : null;
            $ratio     = ($avgMin !== null && $slaMin > 0) ? $avgMin / $slaMin : null;
            $heatLevel = $ratio === null ? 'ok' : ($ratio >= 1.0 ? 'critical' : ($ratio >= 0.8 ? 'warn' : 'ok'));
            $stepName  = ($row['step_name'] ?? null) ?: ($nodeMap[$nodeId]['data']['label'] ?? $nodeId);

            if ($heatLevel === 'critical') $critical++;
            elseif ($heatLevel === 'warn') $warn++;
            else $ok++;

            if ($ratio !== null && $ratio > $maxRatio) {
                $maxRatio = $ratio;
                $bottleneckStep = [
                    'step_id'           => $nodeId,
                    'step_name'         => $stepName,
                    'avg_cycle_minutes' => round($avgMin, 1),
                    'sla_minutes'       => $slaMin,
                    'heat_level'        => $heatLevel,
                    'ratio'             => round($ratio, 2),
                ];
            }

            $steps[] = [
                'step_id'           => $nodeId,
                'step_name'         => $stepName,
                'avg_cycle_minutes' => $avgMin !== null ? round($avgMin, 1) : null,
                'queue_depth'       => (int)$row['queue_depth'],
                'sla_minutes'       => $slaMin,
                'heat_level'        => $heatLevel,
            ];
        }

        $result[] = [
            'definition_id'   => $defId,
            'definition_name' => $def['name'],
            'entity_type'     => $def['entity_type'],
            'total_instances' => $totalInstances,
            'bottleneck_step' => $bottleneckStep,
            'critical_count'  => $critical,
            'warn_count'      => $warn,
            'ok_count'        => $ok,
            'steps'           => $steps,
        ];
    }
    jsonResponse($result);
}

// ── Full Flow Report: ordered steps + instance list ──────────────────────
if ($action === 'report') {
    $definition_id = $_GET['definition_id'] ?? null;
    if (!$definition_id) jsonError('definition_id required', 400);

    $defStmt = $db->prepare('SELECT id, name, entity_type, definition FROM workflow_definitions WHERE id = ? AND tenant_id = ?');
    $defStmt->execute([$definition_id, $user['tenant_id']]);
    $defRow = $defStmt->fetch(PDO::FETCH_ASSOC);
    if (!$defRow) jsonError('Workflow not found', 404);

    $defJson = json_decode($defRow['definition'], true);
    $nodes   = $defJson['nodes'] ?? [];
    $edges   = $defJson['edges'] ?? [];

    // ── company_journey: stage-based report (no node/step_logs model) ───────
    // Journey instances ใช้ 5 stage คงที่ + workflow_journey_links ไม่ใช่ canvas nodes
    // ดังนั้นต้องคำนวณ report จาก links โดยตรง ไม่งั้น steps จะว่างและ on_time=0
    if ($defRow['entity_type'] === 'company_journey') {
        $stageThai = ['marketing'=>'การตลาด','sales'=>'การขาย','project'=>'โปรเจค','support'=>'ซัพพอร์ต','renewal'=>'ต่ออายุ'];
        $steps = journeyStageSteps($db, $user['tenant_id'], $definition_id, $defJson);

        // Instance list
        $jiStmt = $db->prepare('
            SELECT wi.id, wi.entity_type, wi.entity_id, wi.status, wi.current_stage,
                   COALESCE(NULLIF(wi.journey_name, \'\'), c.name) AS entity_name,
                   c.name AS company_name,
                   wi.started_at, wi.completed_at,
                   TIMESTAMPDIFF(MINUTE, wi.started_at, COALESCE(wi.completed_at, NOW())) AS total_minutes,
                   DATEDIFF(NOW(), COALESCE(jl_cur.linked_at, wi.started_at)) * 1440 AS current_step_minutes
            FROM workflow_instances wi
            LEFT JOIN companies c ON wi.company_id = c.id
            LEFT JOIN workflow_journey_links jl_cur
                   ON jl_cur.instance_id = wi.id AND jl_cur.stage = wi.current_stage
            WHERE wi.workflow_definition_id = ? AND wi.tenant_id = ? AND wi.status != \'cancelled\'
            ORDER BY wi.started_at DESC
            LIMIT 50
        ');
        $jiStmt->execute([$definition_id, $user['tenant_id']]);
        $instances = $jiStmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($instances as &$ji) {
            $ji['entity_name']       = $ji['entity_name'] ?: '—';
            $ji['current_step_name'] = $stageThai[$ji['current_stage']] ?? $ji['current_stage'];
        }
        unset($ji);

        // Summary — count over ALL non-cancelled journeys of this definition (not just shown 50)
        $cntStmt = $db->prepare('
            SELECT COUNT(*) AS total,
                   SUM(status = \'active\')    AS active,
                   SUM(status = \'completed\') AS completed,
                   AVG(CASE WHEN status = \'completed\'
                            THEN TIMESTAMPDIFF(MINUTE, started_at, completed_at) END) AS avg_total
            FROM workflow_instances
            WHERE workflow_definition_id = ? AND tenant_id = ? AND status != \'cancelled\'
              AND entity_type = \'company_journey\'
        ');
        $cntStmt->execute([$definition_id, $user['tenant_id']]);
        $cnt = $cntStmt->fetch(PDO::FETCH_ASSOC);
        $totalInst   = (int)$cnt['total'];
        $completedIn = (int)$cnt['completed'];

        $bottleneck = null;
        foreach ($steps as $s) {
            if ($s['sla_ratio'] !== null && ($bottleneck === null || $s['sla_ratio'] > $bottleneck['sla_ratio'])) $bottleneck = $s;
        }

        jsonResponse([
            'definition_id'   => $definition_id,
            'definition_name' => $defRow['name'],
            'entity_type'     => $defRow['entity_type'],
            'summary' => [
                'total_instances'         => $totalInst,
                'active_instances'        => (int)$cnt['active'],
                'completed_instances'     => $completedIn,
                'avg_total_cycle_minutes' => $cnt['avg_total'] !== null ? round((float)$cnt['avg_total'], 1) : null,
                'on_time_rate'            => $totalInst > 0 ? round($completedIn / $totalInst * 100, 1) : null,
            ],
            'bottleneck' => $bottleneck,
            'steps'      => $steps,
            'instances'  => $instances,
        ]);
    }

    // Build adjacency: source -> [target]
    $adj = [];
    $inDegree = [];
    foreach ($nodes as $n) { $adj[$n['id']] = []; $inDegree[$n['id']] = 0; }
    foreach ($edges as $e) {
        $s = $e['source'] ?? null; $t = $e['target'] ?? null;
        if ($s && $t && isset($adj[$s])) { $adj[$s][] = $t; $inDegree[$t] = ($inDegree[$t] ?? 0) + 1; }
    }

    // Topological sort (Kahn's algorithm)
    $queue  = [];
    foreach ($inDegree as $nid => $deg) { if ($deg === 0) $queue[] = $nid; }
    $ordered = [];
    while (!empty($queue)) {
        $cur = array_shift($queue);
        $ordered[] = $cur;
        foreach (($adj[$cur] ?? []) as $next) {
            $inDegree[$next]--;
            if ($inDegree[$next] === 0) $queue[] = $next;
        }
    }

    $nodeMap = [];
    foreach ($nodes as $n) { $nodeMap[$n['id']] = $n; }

    // Per-step aggregate stats
    $stepStmt = $db->prepare('
        SELECT wsl.step_id,
            COUNT(*) AS total_runs,
            SUM(CASE WHEN wsl.status = \'completed\' THEN 1 ELSE 0 END) AS completed_runs,
            SUM(CASE WHEN wsl.status = \'in_progress\' THEN 1 ELSE 0 END) AS active_runs,
            AVG(CASE WHEN wsl.status = \'completed\' AND wsl.duration_minutes > 0 THEN wsl.duration_minutes END) AS avg_cycle_minutes,
            MIN(CASE WHEN wsl.status = \'completed\' AND wsl.duration_minutes > 0 THEN wsl.duration_minutes END) AS min_cycle_minutes,
            MAX(CASE WHEN wsl.status = \'completed\' AND wsl.duration_minutes > 0 THEN wsl.duration_minutes END) AS max_cycle_minutes
        FROM workflow_step_logs wsl
        JOIN workflow_instances wi ON wsl.instance_id = wi.id
        WHERE wi.workflow_definition_id = ? AND wi.tenant_id = ?
        GROUP BY wsl.step_id
    ');
    $stepStmt->execute([$definition_id, $user['tenant_id']]);
    $stepStats = [];
    foreach ($stepStmt->fetchAll(PDO::FETCH_ASSOC) as $r) { $stepStats[$r['step_id']] = $r; }

    // Stalled (in_progress > 24h)
    $stalledStmt = $db->prepare('
        SELECT wsl.step_id, COUNT(*) as cnt
        FROM workflow_step_logs wsl
        JOIN workflow_instances wi ON wsl.instance_id = wi.id
        WHERE wi.workflow_definition_id = ? AND wi.tenant_id = ?
          AND wsl.status = \'in_progress\'
          AND COALESCE(wsl.started_at, wsl.created_at) < DATE_SUB(NOW(), INTERVAL 24 HOUR)
        GROUP BY wsl.step_id
    ');
    $stalledStmt->execute([$definition_id, $user['tenant_id']]);
    $stalledCount = [];
    foreach ($stalledStmt->fetchAll(PDO::FETCH_ASSOC) as $r) { $stalledCount[$r['step_id']] = (int)$r['cnt']; }

    // Build ordered step report
    $steps = [];
    foreach ($ordered as $nid) {
        $node = $nodeMap[$nid] ?? null;
        if (!$node) continue;
        $nodeType = $node['type'] ?? '';
        $stat    = $stepStats[$nid] ?? null;
        $slaMin  = (int)($node['data']['slaMinutes'] ?? 1440);
        $avgMin  = $stat ? (float)$stat['avg_cycle_minutes'] : null;
        $ratio   = ($avgMin !== null && $slaMin > 0) ? $avgMin / $slaMin : null;
        $heatLevel = $ratio === null ? 'ok' : ($ratio >= 1.0 ? 'critical' : ($ratio >= 0.8 ? 'warn' : 'ok'));

        $steps[] = [
            'step_id'           => $nid,
            'step_name'         => $node['data']['label'] ?? $nid,
            'node_type'         => $nodeType,
            'sla_minutes'       => $slaMin,
            'avg_cycle_minutes' => $avgMin !== null ? round($avgMin, 1) : null,
            'min_cycle_minutes' => $stat ? (float)$stat['min_cycle_minutes'] : null,
            'max_cycle_minutes' => $stat ? (float)$stat['max_cycle_minutes'] : null,
            'total_runs'        => $stat ? (int)$stat['total_runs'] : 0,
            'completed_runs'    => $stat ? (int)$stat['completed_runs'] : 0,
            'active_runs'       => $stat ? (int)$stat['active_runs'] : 0,
            'stalled_count'     => $stalledCount[$nid] ?? 0,
            'heat_level'        => $heatLevel,
            'sla_ratio'         => $ratio !== null ? round($ratio, 3) : null,
        ];
    }

    // Instance list (up to 50 most recent) — กรอง entity ที่ถูกลบและ opportunity ที่ lost ออก
    $instStmt = $db->prepare('
        SELECT wi.id, wi.entity_type, wi.entity_id, wi.status, wi.current_step_id, wi.current_stage,
               wi.started_at, wi.completed_at,
               TIMESTAMPDIFF(MINUTE, wi.started_at, COALESCE(wi.completed_at, NOW())) AS total_minutes,
               CASE wi.entity_type
                   WHEN \'project\'         THEN (SELECT name  FROM projects             WHERE id = wi.entity_id LIMIT 1)
                   WHEN \'opportunity\'     THEN (SELECT name  FROM sales_opportunities  WHERE id = wi.entity_id LIMIT 1)
                   WHEN \'support_ticket\'  THEN (SELECT title FROM support_tickets      WHERE id = wi.entity_id LIMIT 1)
                   WHEN \'company_journey\' THEN wi.journey_name
                   ELSE wi.entity_id
               END AS entity_name,
               (SELECT step_name FROM workflow_step_logs wsl2 WHERE wsl2.instance_id = wi.id AND wsl2.step_id = wi.current_step_id LIMIT 1) AS current_step_name,
               (SELECT TIMESTAMPDIFF(MINUTE, COALESCE(wsl3.started_at, wsl3.created_at), NOW()) FROM workflow_step_logs wsl3 WHERE wsl3.instance_id = wi.id AND wsl3.status = \'in_progress\' ORDER BY wsl3.created_at DESC LIMIT 1) AS current_step_minutes
        FROM workflow_instances wi
        WHERE wi.workflow_definition_id = ? AND wi.tenant_id = ?
          AND wi.status != \'cancelled\'
          -- กรอง opportunity ที่ถูกลบหรือ lost
          AND (wi.entity_type != \'opportunity\' OR EXISTS (
              SELECT 1 FROM sales_opportunities WHERE id = wi.entity_id AND stage != \'lost\'
          ))
          -- กรอง project ที่ถูกลบ
          AND (wi.entity_type != \'project\' OR EXISTS (
              SELECT 1 FROM projects WHERE id = wi.entity_id
          ))
          -- กรอง support ticket ที่ถูกลบ
          AND (wi.entity_type != \'support_ticket\' OR EXISTS (
              SELECT 1 FROM support_tickets WHERE id = wi.entity_id
          ))
        ORDER BY wi.started_at DESC
        LIMIT 50
    ');
    $instStmt->execute([$definition_id, $user['tenant_id']]);
    $instances = $instStmt->fetchAll(PDO::FETCH_ASSOC);

    // Resolve NULL current_step_name: try node map first, then fall back to current_stage Thai label
    $stageThai = ['marketing'=>'การตลาด','sales'=>'การขาย','project'=>'โปรเจค','support'=>'ซัพพอร์ต','renewal'=>'ต่ออายุ'];
    foreach ($instances as &$inst) {
        if ($inst['current_step_name'] === null || $inst['current_step_name'] === '') {
            if ($inst['current_step_id'] !== null) {
                $inst['current_step_name'] = $nodeMap[$inst['current_step_id']]['data']['label'] ?? null;
            }
            // fallback to current_stage label (for company_journey instances without step logs)
            if (($inst['current_step_name'] === null || $inst['current_step_name'] === '') && isset($inst['current_stage'])) {
                $inst['current_step_name'] = $stageThai[$inst['current_stage']] ?? $inst['current_stage'];
            }
        }
    }
    unset($inst);

    // Summary stats
    $totalInst   = count($instances);
    $completedInst = count(array_filter($instances, fn($i) => $i['status'] === 'completed'));
    $activeInst  = count(array_filter($instances, fn($i) => $i['status'] === 'active'));
    $completedTimes = array_filter(array_map(fn($i) => $i['status'] === 'completed' ? (int)$i['total_minutes'] : null, $instances), fn($v) => $v !== null);
    $avgTotalCycle = count($completedTimes) > 0 ? round(array_sum($completedTimes) / count($completedTimes), 1) : null;
    $bottleneck = null;
    foreach ($steps as $s) {
        if ($s['sla_ratio'] !== null && ($bottleneck === null || $s['sla_ratio'] > $bottleneck['sla_ratio'])) $bottleneck = $s;
    }

    jsonResponse([
        'definition_id'   => $definition_id,
        'definition_name' => $defRow['name'],
        'entity_type'     => $defRow['entity_type'],
        'summary' => [
            'total_instances'    => $totalInst,
            'active_instances'   => $activeInst,
            'completed_instances'=> $completedInst,
            'avg_total_cycle_minutes' => $avgTotalCycle,
            'on_time_rate'       => $totalInst > 0 ? round($completedInst / $totalInst * 100, 1) : null,
        ],
        'bottleneck' => $bottleneck,
        'steps'      => $steps,
        'instances'  => $instances,
    ]);
}

// ── Per-definition analytics ──────────────────────────────────────────────
$definition_id = $_GET['definition_id'] ?? null;
if (!$definition_id) jsonError('definition_id required', 400);

$defStmt = $db->prepare('SELECT definition FROM workflow_definitions WHERE id = ? AND tenant_id = ?');
$defStmt->execute([$definition_id, $user['tenant_id']]);
$def     = json_decode($defStmt->fetchColumn(), true);
if (!$def) jsonError('Workflow not found', 404);
$nodeMap = [];
foreach ($def['nodes'] as $n) { $nodeMap[$n['id']] = $n; }

$stmt = $db->prepare('
    SELECT wsl.step_id,
        MAX(wsl.step_name) AS step_name,
        COUNT(*) AS total_runs,
        AVG(CASE WHEN wsl.status = \'completed\' AND wsl.duration_minutes > 0 THEN wsl.duration_minutes END) AS avg_cycle_minutes,
        MAX(CASE WHEN wsl.status = \'completed\' THEN wsl.duration_minutes END) AS max_cycle_minutes,
        SUM(CASE WHEN wsl.status = \'in_progress\' THEN 1 ELSE 0 END) AS queue_depth
    FROM workflow_step_logs wsl
    JOIN workflow_instances wi ON wsl.instance_id = wi.id
    WHERE wi.workflow_definition_id = ?
    GROUP BY wsl.step_id
');
$stmt->execute([$definition_id]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Trend: group by step + day using COALESCE(completed_at, created_at) so seed data is included
$trendStmt = $db->prepare('
    SELECT wsl.step_id,
           DATE(COALESCE(wsl.completed_at, wsl.created_at)) as day,
           AVG(wsl.duration_minutes) as avg_minutes
    FROM workflow_step_logs wsl
    JOIN workflow_instances wi ON wsl.instance_id = wi.id
    WHERE wi.workflow_definition_id = ?
      AND COALESCE(wsl.completed_at, wsl.created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      AND wsl.duration_minutes > 0
    GROUP BY wsl.step_id, day
    ORDER BY day ASC
');
$trendStmt->execute([$definition_id]);
$trendMap = [];
foreach ($trendStmt->fetchAll(PDO::FETCH_ASSOC) as $t) {
    $trendMap[$t['step_id']][] = ['date' => $t['day'], 'avg_minutes' => (float)$t['avg_minutes']];
}

// Stalled: COALESCE(started_at, created_at) so entries with NULL started_at are still detected
$stalledStmt = $db->prepare('
    SELECT wsl.step_id, wi.entity_type, wi.entity_id,
           TIMESTAMPDIFF(HOUR, COALESCE(wsl.started_at, wsl.created_at), NOW()) as hours_stalled,
           CASE wi.entity_type
               WHEN \'project\'        THEN (SELECT name FROM projects WHERE id = wi.entity_id LIMIT 1)
               WHEN \'opportunity\'    THEN (SELECT name FROM sales_opportunities WHERE id = wi.entity_id LIMIT 1)
               WHEN \'support_ticket\' THEN (SELECT title FROM support_tickets WHERE id = wi.entity_id LIMIT 1)
               ELSE wi.entity_id
           END AS entity_name
    FROM workflow_step_logs wsl
    JOIN workflow_instances wi ON wsl.instance_id = wi.id
    WHERE wi.workflow_definition_id = ?
      AND wsl.status = \'in_progress\'
      AND COALESCE(wsl.started_at, wsl.created_at) < DATE_SUB(NOW(), INTERVAL 24 HOUR)
');
$stalledStmt->execute([$definition_id]);
$stalledMap = [];
foreach ($stalledStmt->fetchAll(PDO::FETCH_ASSOC) as $s) {
    $stalledMap[$s['step_id']][] = [
        'entity_id'    => $s['entity_id'],
        'entity_name'  => $s['entity_name'] ?? substr($s['entity_id'], 0, 8),
        'days_stalled' => round($s['hours_stalled'] / 24, 1),
    ];
}

$steps = [];
foreach ($rows as $row) {
    $nodeId    = $row['step_id'];
    $slaMin    = (int)($nodeMap[$nodeId]['data']['slaMinutes'] ?? 1440);
    $avgMinRaw = $row['avg_cycle_minutes'];
    $avgMin    = $avgMinRaw !== null ? (float)$avgMinRaw : null;
    $ratio     = ($avgMin !== null && $slaMin > 0) ? $avgMin / $slaMin : null;
    $heatLevel = $ratio === null ? 'ok' : ($ratio >= 1.0 ? 'critical' : ($ratio >= 0.8 ? 'warn' : 'ok'));
    $steps[] = [
        'step_id'           => $nodeId,
        'step_name'         => ($row['step_name'] ?? null) ?: ($nodeMap[$nodeId]['data']['label'] ?? $nodeId),
        'avg_cycle_minutes' => $avgMin !== null ? round($avgMin, 1) : null,
        'max_cycle_minutes' => $row['max_cycle_minutes'] !== null ? (float)$row['max_cycle_minutes'] : null,
        'queue_depth'       => (int)$row['queue_depth'],
        'sla_minutes'       => $slaMin,
        'heat_level'        => $heatLevel,
        'trend_30d'         => $trendMap[$nodeId] ?? [],
        'stalled_entities'  => $stalledMap[$nodeId] ?? [],
    ];
}

$totalStmt = $db->prepare('SELECT COUNT(*) FROM workflow_instances WHERE workflow_definition_id = ?');
$totalStmt->execute([$definition_id]);
$totalInstances = (int)$totalStmt->fetchColumn();

jsonResponse(['definition_id' => $definition_id, 'total_instances' => $totalInstances, 'steps' => $steps]);
