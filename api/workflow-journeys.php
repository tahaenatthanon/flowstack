<?php
// api/workflow-journeys.php
// GET    - list journeys (?id= single detail, ?action=alerts)
// POST   - create journey OR link entity (?action=link)
// PUT    - update journey (?id=)
// DELETE - delete journey (?id=)

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/journey-utils.php';

$tokenData = requireAuth();
$userId    = $tokenData['user_id'];
$tenantId  = $tokenData['tenant_id'];
$db        = getDB();
$method    = getMethod();

// ─── GET ───────────────────────────────────────────────────────
if ($method === 'GET') {
    $id     = $_GET['id']     ?? null;
    $action = $_GET['action'] ?? null;

    // GET ?action=search_entities&entity_type=opportunity|project|support_ticket&q=
    if ($action === 'search_entities') {
        $entityType = $_GET['entity_type'] ?? '';
        $q = '%' . ($_GET['q'] ?? '') . '%';
        if ($entityType === 'opportunity') {
            $stmt = $db->prepare("
                SELECT o.id, o.name, o.stage AS status, c.name AS company_name, YEAR(o.expected_close_date) AS year_label
                FROM sales_opportunities o
                LEFT JOIN companies c ON o.company_id = c.id
                WHERE o.tenant_id = ? AND (o.name LIKE ? OR c.name LIKE ?)
                ORDER BY o.created_at DESC LIMIT 50
            ");
            $stmt->execute([$tenantId, $q, $q]);
        } elseif ($entityType === 'project') {
            $stmt = $db->prepare("
                SELECT p.id, p.name, p.status, c.name AS company_name, YEAR(p.start_date) AS year_label
                FROM projects p
                LEFT JOIN companies c ON p.company_id = c.id
                WHERE p.tenant_id = ? AND (p.name LIKE ? OR c.name LIKE ?)
                ORDER BY p.created_at DESC LIMIT 50
            ");
            $stmt->execute([$tenantId, $q, $q]);
        } elseif ($entityType === 'support_ticket') {
            $stmt = $db->prepare("
                SELECT t.id, t.title AS name, t.status, c.name AS company_name, YEAR(t.created_at) AS year_label
                FROM support_tickets t
                LEFT JOIN companies c ON t.company_id = c.id
                WHERE t.tenant_id = ? AND (t.title LIKE ? OR c.name LIKE ?)
                ORDER BY t.created_at DESC LIMIT 50
            ");
            $stmt->execute([$tenantId, $q, $q]);
        } else {
            jsonError('entity_type ไม่ถูกต้อง', 400);
        }
        jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    // GET ?action=alerts — journeys ที่ SLA เกิน หรือใกล้เกิน
    // ไม่แสดง marketing (lead) stage — ยังไม่เข้า pipeline จริง
    if ($action === 'alerts') {
        $stmt = $db->prepare('
            SELECT wi.id, wi.journey_name, wi.current_stage, wi.sla_violated,
                   wi.started_at, wi.updated_at,
                   c.name AS company_name,
                   DATEDIFF(NOW(), COALESCE(jl.linked_at, wi.started_at)) AS days_in_stage
            FROM workflow_instances wi
            LEFT JOIN companies c ON wi.company_id = c.id
            LEFT JOIN workflow_journey_links jl
                   ON jl.instance_id = wi.id AND jl.stage = wi.current_stage
            WHERE wi.tenant_id = ?
              AND wi.entity_type = \'company_journey\'
              AND wi.status = \'active\'
              AND wi.current_stage != \'marketing\'
              AND (wi.sla_violated = 1 OR DATEDIFF(NOW(), COALESCE(jl.linked_at, wi.started_at)) >= 7)
            ORDER BY wi.sla_violated DESC, days_in_stage DESC
            LIMIT 20
        ');
        $stmt->execute([$tenantId]);
        jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    // GET ?id= — single journey detail with per-stage tasks
    if ($id) {
        $stmt = $db->prepare('
            SELECT wi.*, c.name AS company_name, wd.definition AS def_json
            FROM workflow_instances wi
            LEFT JOIN companies c ON wi.company_id = c.id
            LEFT JOIN workflow_definitions wd ON wi.workflow_definition_id = wd.id
            WHERE wi.id = ? AND wi.tenant_id = ?
        ');
        $stmt->execute([$id, $tenantId]);
        $inst = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$inst) jsonError('ไม่พบ Journey', 404);

        // โหลด stage links ทั้งหมดของ journey นี้
        // กรอง entity ที่ถูกลบแล้วออก (subquery คืน NULL ถ้า entity ไม่มีอยู่)
        $linkStmt = $db->prepare('
            SELECT jl.*,
                   CASE jl.entity_type
                     WHEN \'project\'        THEN (SELECT name FROM projects WHERE id = jl.entity_id LIMIT 1)
                     WHEN \'opportunity\'    THEN (SELECT name FROM sales_opportunities WHERE id = jl.entity_id LIMIT 1)
                     WHEN \'support_ticket\' THEN (SELECT title FROM support_tickets WHERE id = jl.entity_id LIMIT 1)
                   END AS entity_name,
                   DATEDIFF(NOW(), jl.linked_at) AS days_in_stage
            FROM workflow_journey_links jl
            WHERE jl.instance_id = ?
              AND (
                (jl.entity_type = \'opportunity\'    AND EXISTS (SELECT 1 FROM sales_opportunities WHERE id = jl.entity_id))
                OR (jl.entity_type = \'project\'     AND EXISTS (SELECT 1 FROM projects WHERE id = jl.entity_id))
                OR (jl.entity_type = \'support_ticket\' AND EXISTS (SELECT 1 FROM support_tickets WHERE id = jl.entity_id))
                OR jl.entity_type IS NULL
                OR jl.entity_id IS NULL
              )
            ORDER BY FIELD(jl.stage, \'marketing\',\'sales\',\'project\',\'support\',\'renewal\')
        ');
        $linkStmt->execute([$id]);
        $links = $linkStmt->fetchAll(PDO::FETCH_ASSOC);

        // ดึง SLA config จาก definition
        $defJson = json_decode($inst['def_json'] ?? '{}', true);
        $slaDays = $defJson['sla'] ?? ['marketing'=>10,'sales'=>30,'project'=>60,'support'=>90,'renewal'=>30];

        // สร้าง stages array พร้อม tasks
        $stageOrder = ['marketing','sales','project','support','renewal'];
        $stages = [];
        foreach ($stageOrder as $stage) {
            $link = null;
            foreach ($links as $l) {
                if ($l['stage'] === $stage) { $link = $l; break; }
            }

            // determine status
            $currentStage = $inst['current_stage'] ?? 'marketing';
            $currentIdx = array_search($currentStage, $stageOrder);
            $stageIdx   = array_search($stage, $stageOrder);
            if ($link && $link['stage_status'] === 'completed') {
                $stageStatus = 'completed';
            } elseif ($stage === $currentStage) {
                $stageStatus = 'active';
            } elseif ($stageIdx < $currentIdx) {
                $stageStatus = 'completed';
            } else {
                $stageStatus = 'pending';
            }

            $slaDaysForStage = $slaDays[$stage] ?? null;
            $daysIn = $link ? (int)$link['days_in_stage'] : null;
            $slaExceeded = $slaDaysForStage && $daysIn !== null && $daysIn > $slaDaysForStage;

            $stageData = [
                'stage'         => $stage,
                'status'        => $stageStatus,
                'stage_status'  => $link['stage_status'] ?? null,
                'entity_type'   => $link['entity_type']  ?? null,
                'entity_id'     => $link['entity_id']    ?? null,
                'entity_name'   => $link['entity_name']  ?? null,
                'days_in_stage' => $daysIn,
                'sla_days'      => $slaDaysForStage,
                'sla_exceeded'  => $slaExceeded,
                'notes'         => $link['notes'] ?? null,
                'tasks'         => [],
            ];

            // ดึง tasks ถ้ามี entity link
            if ($link && $link['entity_id']) {
                $stageData['tasks'] = getJourneyEntityTasks($db, $tenantId, $link['entity_type'], $link['entity_id']);
            }

            $stages[$stage] = $stageData;
        }

        unset($inst['def_json']);
        $inst['stages'] = $stages;
        jsonResponse($inst);
    }

    // GET list — filter เหมือน Sales page: active deals ใช้ expected_close_date, won/lost ใช้ actual_close_date
    $year = !empty($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');

    $whereExtra = '';
    $extraParams = [];
    if (!empty($_GET['sla_violated'])) {
        $whereExtra .= ' AND wi.sla_violated = 1';
    }
    if (!empty($_GET['status'])) {
        $whereExtra .= ' AND wi.status = ?';
        $extraParams[] = $_GET['status'];
    }

    // params order: tenantId, year (active deals), year (won/lost), then optional extraParams
    $params = [$tenantId, $year, $year, ...$extraParams];

    $stmt = $db->prepare("
        SELECT wi.id, wi.journey_name, wi.current_stage, wi.sla_violated, wi.status,
               wi.started_at, wi.updated_at,
               c.name AS company_name,
               DATEDIFF(NOW(), COALESCE(jl_cur.linked_at, wi.started_at)) AS days_in_stage,
               (SELECT COUNT(*) FROM workflow_journey_links WHERE instance_id = wi.id AND stage_status = 'completed') AS stages_done
        FROM workflow_instances wi
        LEFT JOIN companies c ON wi.company_id = c.id
        -- Join current-stage link เพื่อคำนวณ days_in_stage ที่ถูกต้อง
        LEFT JOIN workflow_journey_links jl_cur
               ON jl_cur.instance_id = wi.id AND jl_cur.stage = wi.current_stage
        -- Join primary opportunity link สำหรับ date filtering
        LEFT JOIN (
            SELECT instance_id, MIN(entity_id) AS entity_id
            FROM workflow_journey_links
            WHERE entity_type = 'opportunity'
            GROUP BY instance_id
        ) opp_link ON opp_link.instance_id = wi.id
        LEFT JOIN sales_opportunities o ON o.id = opp_link.entity_id
        WHERE wi.tenant_id = ?
          AND wi.entity_type = 'company_journey'
          AND (
              -- active deals: expected_close_date ตรงปี (ไม่รวม lost)
              (o.stage NOT IN ('won','lost') AND YEAR(o.expected_close_date) = ?)
              OR
              -- won เท่านั้น: actual_close_date || expected_close_date ตรงปี หรือไม่มีวันปิด
              (o.stage = 'won' AND (
                  (o.actual_close_date IS NULL AND o.expected_close_date IS NULL)
                  OR YEAR(COALESCE(o.actual_close_date, o.expected_close_date)) = ?
              ))
              -- manual journeys (ไม่มี link opportunity เลย): แสดงเสมอ
              OR opp_link.entity_id IS NULL
          )
          $whereExtra
        ORDER BY wi.sla_violated DESC, o.stage, wi.started_at ASC
    ");
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

// ─── POST ───────────────────────────────────────────────────────
if ($method === 'POST') {
    $action = $_GET['action'] ?? null;

    // POST ?action=link — ผูก entity เข้า stage
    if ($action === 'link') {
        $body = getRequestBody();
        $required = ['instance_id', 'stage', 'entity_type', 'entity_id'];
        foreach ($required as $f) {
            if (empty($body[$f])) jsonError("กรุณาระบุ $f", 400);
        }

        $check = $db->prepare('SELECT id FROM workflow_instances WHERE id = ? AND tenant_id = ?');
        $check->execute([$body['instance_id'], $tenantId]);
        if (!$check->fetch()) jsonError('ไม่พบ Journey', 404);

        // ลบ link เดิมของ stage นี้ถ้ามี (replace)
        $db->prepare('DELETE FROM workflow_journey_links WHERE instance_id = ? AND stage = ?')
           ->execute([$body['instance_id'], $body['stage']]);

        // ดึง SLA สำหรับ stage นี้จาก definition
        $defStmt = $db->prepare('SELECT wd.definition FROM workflow_instances wi JOIN workflow_definitions wd ON wi.workflow_definition_id = wd.id WHERE wi.id = ?');
        $defStmt->execute([$body['instance_id']]);
        $defRow = $defStmt->fetch(PDO::FETCH_ASSOC);
        $defData = json_decode($defRow['definition'] ?? '{}', true);
        $slaDays = $defData['sla'][$body['stage']] ?? null;

        $db->prepare('INSERT INTO workflow_journey_links (id, instance_id, stage, entity_type, entity_id, sla_days) VALUES (UUID(),?,?,?,?,?)')
           ->execute([$body['instance_id'], $body['stage'], $body['entity_type'], $body['entity_id'], $slaDays]);

        // อัปเดต current_stage ถ้า stage นี้ใหม่กว่า current
        $stageOrder = ['marketing','sales','project','support','renewal'];
        $instStmt = $db->prepare('SELECT current_stage FROM workflow_instances WHERE id = ?');
        $instStmt->execute([$body['instance_id']]);
        $inst = $instStmt->fetch(PDO::FETCH_ASSOC);
        $currentIdx = array_search($inst['current_stage'] ?? 'marketing', $stageOrder);
        $newIdx     = array_search($body['stage'], $stageOrder);
        if ($newIdx >= $currentIdx) {
            $db->prepare('UPDATE workflow_instances SET current_stage = ?, updated_at = NOW() WHERE id = ?')
               ->execute([$body['stage'], $body['instance_id']]);
        }

        jsonResponse(['message' => 'ผูก entity สำเร็จ'], 201);
    }

    // POST — สร้าง journey ใหม่
    $body = getRequestBody();
    if (empty($body['company_id'])) jsonError('กรุณาระบุ company_id', 400);
    if (empty($body['journey_name'])) jsonError('กรุณาระบุ journey_name', 400);

    // หา definition สำหรับ company_journey
    $defStmt = $db->prepare("SELECT id FROM workflow_definitions WHERE tenant_id = ? AND entity_type = 'company_journey' ORDER BY is_template DESC LIMIT 1");
    $defStmt->execute([$tenantId]);
    $def = $defStmt->fetch(PDO::FETCH_ASSOC);
    if (!$def) jsonError('ยังไม่มี Journey Definition — กรุณาสร้างใน Editor', 404);

    $instanceId = generateUUID();
    $db->prepare('
        INSERT INTO workflow_instances
          (id, tenant_id, workflow_definition_id, entity_type, entity_id, journey_name, company_id, current_stage, status, started_at, created_at, updated_at)
        VALUES (?, ?, ?, \'company_journey\', ?, ?, ?, \'marketing\', \'active\', NOW(), NOW(), NOW())
    ')->execute([$instanceId, $tenantId, $def['id'], $instanceId, $body['journey_name'], $body['company_id']]);

    jsonResponse(['id' => $instanceId, 'message' => 'สร้าง Journey สำเร็จ'], 201);
}

// ─── PUT ───────────────────────────────────────────────────────
if ($method === 'PUT') {
    $id     = $_GET['id']     ?? null;
    $action = $_GET['action'] ?? null;
    $body   = getRequestBody();
    if (!$id) jsonError('กรุณาระบุ id', 400);

    $check = $db->prepare('SELECT id, current_stage FROM workflow_instances WHERE id = ? AND tenant_id = ?');
    $check->execute([$id, $tenantId]);
    $inst = $check->fetch(PDO::FETCH_ASSOC);
    if (!$inst) jsonError('ไม่พบ Journey', 404);

    // PUT ?action=complete_stage — mark stage completed + advance current_stage
    if ($action === 'complete_stage') {
        $stage = $body['stage'] ?? null;
        if (!$stage) jsonError('กรุณาระบุ stage', 400);

        $stageOrder = ['marketing','sales','project','support','renewal'];
        if (!in_array($stage, $stageOrder)) jsonError('stage ไม่ถูกต้อง', 400);

        // อัปเดต stage_status เป็น completed ใน workflow_journey_links
        $db->prepare('UPDATE workflow_journey_links SET stage_status = \'completed\', completed_at = NOW() WHERE instance_id = ? AND stage = ?')
           ->execute([$id, $stage]);

        // เลื่อน current_stage ไปขั้นถัดไปถ้า stage ที่ complete คือ current
        $currentIdx = array_search($inst['current_stage'], $stageOrder);
        $doneIdx    = array_search($stage, $stageOrder);
        if ($doneIdx === $currentIdx && $currentIdx < count($stageOrder) - 1) {
            $nextStage = $stageOrder[$currentIdx + 1];
            // recalculate sla_violated: ดูว่า stage ใหม่ที่กำลังจะเข้ามีการ link หรือยัง
            $newLinkStmt = $db->prepare('SELECT jl.sla_days, DATEDIFF(NOW(), jl.linked_at) AS days FROM workflow_journey_links jl WHERE jl.instance_id = ? AND jl.stage = ?');
            $newLinkStmt->execute([$id, $nextStage]);
            $newLink = $newLinkStmt->fetch(PDO::FETCH_ASSOC);
            $newSlaViolated = $newLink && $newLink['sla_days'] && $newLink['days'] > $newLink['sla_days'] ? 1 : 0;
            $db->prepare('UPDATE workflow_instances SET current_stage = ?, sla_violated = ?, updated_at = NOW() WHERE id = ?')
               ->execute([$nextStage, $newSlaViolated, $id]);
        } elseif ($doneIdx === count($stageOrder) - 1) {
            // renewal เสร็จ → journey completed, reset sla_violated
            $db->prepare('UPDATE workflow_instances SET status = \'completed\', sla_violated = 0, updated_at = NOW() WHERE id = ?')
               ->execute([$id]);
        }

        jsonResponse(['message' => 'ทำเครื่องหมาย stage เสร็จแล้ว']);
    }

    $fields = []; $values = [];
    foreach (['journey_name','current_stage','sla_violated','status'] as $f) {
        if (array_key_exists($f, $body)) {
            $fields[] = "$f = ?";
            $values[] = $body[$f];
        }
    }
    if (empty($fields)) jsonError('ไม่มีข้อมูลที่ต้องการอัปเดต', 400);
    $values[] = $id;
    $db->prepare('UPDATE workflow_instances SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE id = ?')
       ->execute($values);

    jsonResponse(['message' => 'อัปเดต Journey สำเร็จ']);
}

// ─── DELETE ───────────────────────────────────────────────────────
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('กรุณาระบุ id', 400);
    $stmt = $db->prepare("DELETE FROM workflow_instances WHERE id = ? AND tenant_id = ? AND entity_type = 'company_journey'");
    $stmt->execute([$id, $tenantId]);
    if ($stmt->rowCount() === 0) jsonError('ไม่พบ Journey', 404);
    jsonResponse(['message' => 'ลบ Journey สำเร็จ']);
}
