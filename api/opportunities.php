<?php
// CRUD /api/opportunities.php
// GET    - list opportunities (?id= single, ?company_id= filter, ?stage= filter, ?assigned_to= filter)
// POST   - create opportunity
// PUT    - update opportunity (?id=)
// DELETE - delete opportunity (?id=)
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db = getDB();
$method = getMethod();

$oppFloatFields = ['value', 'approved_quotation_value'];
$oppIntFields = ['probability', 'quotation_count'];

// --- GET ---
if ($method === 'GET') {
    $id = $_GET['id'] ?? null;

    // Get single opportunity with contact info
    if ($id) {
        $stmt = $db->prepare('
            SELECT
                s.*,
                o.competitor_info,
                o.contact_id,
                cu.first_name as contact_first_name,
                cu.last_name as contact_last_name,
                CONCAT(COALESCE(cu.first_name, ""), " ", COALESCE(cu.last_name, "")) as contact_name,
                cu.email as contact_email,
                cu.phone as contact_phone,
                cu.position as contact_position
            FROM sales_pipeline_summary s
            LEFT JOIN sales_opportunities o ON s.opportunity_id = o.id
            LEFT JOIN customers cu ON o.contact_id = cu.id
            WHERE s.opportunity_id = ? AND s.tenant_id = ?
        ');
        $stmt->execute([$id, $tenantId]);
        $opportunity = $stmt->fetch();
        if (!$opportunity) jsonError('ไม่พบโอกาสการขาย', 404);
        jsonResponse(castNumericFields($opportunity, $oppFloatFields, $oppIntFields));
    }

    // List opportunities with optional filters
    $sql = 'SELECT * FROM sales_pipeline_summary WHERE tenant_id = ?';
    $params = [$tenantId];

    // Filter by user - if not admin, show only assigned opportunities
    $isAdmin = isTenantAdmin($db, $userId, $tenantId);
    
    if (!$isAdmin) {
        // Get opportunity IDs where user is a member
        $memberStmt = $db->prepare('SELECT opportunity_id FROM opportunity_members WHERE user_id = ? AND tenant_id = ?');
        $memberStmt->execute([$userId, $tenantId]);
        $memberOpportunityIds = array_column($memberStmt->fetchAll(), 'opportunity_id');
        
        // Filter: user is assigned OR user is a member
        $sql .= ' AND (assigned_user_id = ?';
        $params[] = $userId;
        if (!empty($memberOpportunityIds)) {
            $placeholders = implode(',', array_fill(0, count($memberOpportunityIds), '?'));
            $sql .= " OR opportunity_id IN ($placeholders)";
            $params = array_merge($params, $memberOpportunityIds);
        }
        $sql .= ')';
    }

    if (isset($_GET['company_id'])) {
        $sql .= ' AND company_id = ?';
        $params[] = $_GET['company_id'];
    }

    if (isset($_GET['stage'])) {
        $sql .= ' AND stage = ?';
        $params[] = $_GET['stage'];
    }

    if (isset($_GET['assigned_to'])) {
        $sql .= ' AND assigned_user_id = ?';
        $params[] = $_GET['assigned_to'];
    }

    $sql .= ' ORDER BY created_at DESC';

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse(castNumericFieldsAll($stmt->fetchAll(), $oppFloatFields, $oppIntFields));
}

// --- POST ---
if ($method === 'POST') {
    $body = getRequestBody();
    $id = generateUUID();

    // Validate required fields
    if (empty($body['company_id'])) jsonError('กรุณาระบุบริษัท', 400);
    if (empty($body['name'])) jsonError('กรุณาระบุชื่อโอกาสการขาย', 400);
    if (empty($body['assigned_to'])) jsonError('กรุณาระบุผู้รับผิดชอบ', 400);

    // Check duplicate opportunity name within same company
    $dupStmt = $db->prepare('SELECT id FROM sales_opportunities WHERE name = ? AND company_id = ? AND tenant_id = ?');
    $dupStmt->execute([$body['name'], $body['company_id'], $tenantId]);
    if ($dupStmt->fetch()) {
        jsonError('มีโอกาสขายชื่อ "' . $body['name'] . '" ในบริษัทนี้อยู่แล้ว', 409);
    }

    $stmt = $db->prepare('
        INSERT INTO sales_opportunities (
            id, tenant_id, company_id, contact_id, project_id, renewal_of, campaign_id, name, description, stage, value, probability,
            expected_close_date, actual_close_date, assigned_to, created_by, lead_source, competitor_info, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([
        $id,
        $tenantId,
        $body['company_id'],
        $body['contact_id'] ?? null,
        $body['project_id'] ?? null,
        $body['renewal_of'] ?? null,
        $body['campaign_id'] ?? null,
        $body['name'],
        $body['description'] ?? '',
        $body['stage'] ?? 'lead',
        $body['value'] ?? 0.00,
        $body['probability'] ?? 0,
        $body['expected_close_date'] ?? null,
        $body['actual_close_date'] ?? null,
        $body['assigned_to'],
        $userId,
        $body['lead_source'] ?? '',
        $body['competitor_info'] ?? '',
        $body['notes'] ?? '',
    ]);

    // Auto-create workflow instance using first opportunity workflow definition
    try {
        $wfStmt = $db->prepare("SELECT id FROM workflow_definitions WHERE entity_type='opportunity' AND tenant_id=? ORDER BY is_template DESC, created_at ASC LIMIT 1");
        $wfStmt->execute([$tenantId]);
        $wfDef = $wfStmt->fetchColumn();
        if ($wfDef) {
            $wfInstanceId = generateUUID();
            $db->prepare("INSERT INTO workflow_instances (id, workflow_definition_id, entity_type, entity_id, status, started_at) VALUES (?,?,'opportunity',?,'active',NOW())")
               ->execute([$wfInstanceId, $wfDef, $id]);
            $wfDefData = json_decode($db->query("SELECT definition FROM workflow_definitions WHERE id='$wfDef'")->fetchColumn(), true);
            $firstStage = null;
            foreach (($wfDefData['nodes'] ?? []) as $n) { if ($n['type'] === 'stage') { $firstStage = $n; break; } }
            if ($firstStage) {
                $db->prepare("INSERT INTO workflow_step_logs (id, instance_id, step_id, step_name, status, started_at) VALUES (UUID(),?,?,?,'in_progress',NOW())")
                   ->execute([$wfInstanceId, $firstStage['id'], $firstStage['data']['label']]);
                $db->prepare("UPDATE workflow_instances SET current_step_id=? WHERE id=?")->execute([$firstStage['id'], $wfInstanceId]);
            }
        }
    } catch (Exception $e) { /* ignore — workflow is optional */ }

    $stmt = $db->prepare('SELECT * FROM sales_pipeline_summary WHERE opportunity_id = ?');
    $stmt->execute([$id]);
    jsonResponse(castNumericFields($stmt->fetch(), $oppFloatFields, $oppIntFields), 201);
}

// --- PUT ---
if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('กรุณาระบุ ID', 400);

    $body = getRequestBody();
    $fields = [];
    $values = [];

    $allowed = [
        'company_id', 'contact_id', 'project_id', 'renewal_of', 'campaign_id', 'name', 'description', 'stage', 'value',
        'probability', 'expected_close_date', 'actual_close_date', 'assigned_to',
        'lead_source', 'competitor_info', 'notes'
    ];

    // Admin-only: allow changing who found the lead
    $isAdmin = isTenantAdmin($db, $userId, $tenantId);
    if ($isAdmin) {
        $allowed[] = 'created_by';
    }

    foreach ($allowed as $field) {
        if (array_key_exists($field, $body)) {
            $fields[] = "`$field` = ?";
            $values[] = $body[$field];
        }
    }

    if (empty($fields)) jsonError('No fields to update');

    // Check duplicate name within same company when renaming
    if (array_key_exists('name', $body)) {
        $dupStmt = $db->prepare('SELECT id FROM sales_opportunities WHERE name = ? AND company_id = ? AND tenant_id = ? AND id != ?');
        $dupStmt->execute([$body['name'], $body['company_id'] ?? '', $tenantId, $id]);
        if ($dupStmt->fetch()) {
            jsonError('มีโอกาสขายชื่อ "' . $body['name'] . '" ในบริษัทนี้อยู่แล้ว', 409);
        }
    }

    $values[] = $id;
    $values[] = $tenantId;
    $sql = 'UPDATE sales_opportunities SET ' . implode(', ', $fields) . ' WHERE id = ? AND tenant_id = ?';
    $db->prepare($sql)->execute($values);

    // Auto-advance journey เมื่อ opportunity เป็น won
    if (isset($body['stage']) && $body['stage'] === 'won') {
        require_once __DIR__ . '/journey-utils.php';
        journeyAutoAdvance($db, $tenantId, 'sales', 'opportunity', $id);
    }

    $stmt = $db->prepare('SELECT * FROM sales_pipeline_summary WHERE opportunity_id = ?');
    $stmt->execute([$id]);
    $updated = $stmt->fetch();
    if (!$updated) jsonError('ไม่พบโอกาสการขาย', 404);
    jsonResponse(castNumericFields($updated, $oppFloatFields, $oppIntFields));
}

// --- DELETE ---
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('กรุณาระบุ ID', 400);

    $stmt = $db->prepare('DELETE FROM sales_opportunities WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$id, $tenantId]);

    if ($stmt->rowCount() === 0) jsonError('ไม่พบโอกาสการขาย', 404);

    require_once __DIR__ . '/journey-utils.php';
    journeyCleanupEntityLinks($db, 'opportunity', $id);

    jsonResponse(['message' => 'ลบโอกาสการขายสำเร็จ']);
}
