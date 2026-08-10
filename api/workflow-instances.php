<?php
require_once __DIR__ . '/auth.php';

$user   = requireAuth();
$db     = getDB();
$method = getMethod();
$action = $_GET['action'] ?? null;
$id     = $_GET['id']     ?? null;

// ── GET unlinked records ──────────────────────────────────────────────────
if ($method === 'GET' && isset($_GET['unlinked'])) {
    $entity_type = $_GET['entity_type'] ?? null;
    if (!$entity_type) jsonError('entity_type required', 400);

    switch ($entity_type) {
        case 'project':
            $stmt = $db->prepare('
                SELECT p.id, p.name, p.status, COALESCE(c.name, \'\') as company_name,
                       DATE_FORMAT(p.created_at, \'%Y\') AS year_label
                FROM projects p
                LEFT JOIN companies c ON p.company_id = c.id
                LEFT JOIN workflow_instances wi
                  ON wi.entity_id = p.id AND wi.entity_type = \'project\' AND wi.status = \'active\'
                WHERE p.tenant_id = ? AND p.deleted_at IS NULL AND wi.id IS NULL
                ORDER BY p.created_at DESC, p.name
            ');
            $stmt->execute([$user['tenant_id']]);
            break;
        case 'opportunity':
            $stmt = $db->prepare('
                SELECT so.id, so.name, so.stage AS status, COALESCE(c.name, \'\') as company_name,
                       DATE_FORMAT(COALESCE(so.expected_close_date, so.created_at), \'%Y\') AS year_label
                FROM sales_opportunities so
                LEFT JOIN companies c ON so.company_id = c.id
                LEFT JOIN workflow_instances wi
                  ON wi.entity_id = so.id AND wi.entity_type = \'opportunity\' AND wi.status = \'active\'
                WHERE so.tenant_id = ? AND wi.id IS NULL
                ORDER BY COALESCE(so.expected_close_date, so.created_at) DESC, so.name
            ');
            $stmt->execute([$user['tenant_id']]);
            break;
        case 'support_ticket':
            $stmt = $db->prepare('
                SELECT st.id, st.title AS name, st.status, COALESCE(c.name, \'\') as company_name,
                       DATE_FORMAT(st.created_at, \'%Y\') AS year_label
                FROM support_tickets st
                LEFT JOIN companies c ON st.company_id = c.id
                LEFT JOIN workflow_instances wi
                  ON wi.entity_id = st.id AND wi.entity_type = \'support_ticket\' AND wi.status = \'active\'
                WHERE st.tenant_id = ? AND wi.id IS NULL
                ORDER BY st.created_at DESC, st.title
            ');
            $stmt->execute([$user['tenant_id']]);
            break;
        default:
            jsonError('Invalid entity_type', 400);
    }
    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

// ── DELETE — cancel instance ──────────────────────────────────────────────
if ($method === 'DELETE' && $id) {
    $db->prepare("UPDATE workflow_instances SET status='cancelled', completed_at=NOW(), updated_at=NOW() WHERE id=? AND tenant_id=?")
       ->execute([$id, $user['tenant_id']]);
    jsonResponse(['ok' => true]);
}

if ($method === 'GET') {
    $entity_type = $_GET['entity_type'] ?? null;
    $entity_id   = $_GET['entity_id']   ?? null;
    if (!$entity_type || !$entity_id) jsonError('entity_type and entity_id required', 400);

    $stmt = $db->prepare(
        'SELECT wi.*, wd.name as definition_name, wd.definition
         FROM workflow_instances wi
         JOIN workflow_definitions wd ON wi.workflow_definition_id = wd.id
         WHERE wi.entity_type = ? AND wi.entity_id = ?'
    );
    $stmt->execute([$entity_type, $entity_id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) jsonResponse(null);
    $row['definition'] = json_decode($row['definition'], true);

    $logStmt = $db->prepare('SELECT * FROM workflow_step_logs WHERE instance_id = ? ORDER BY started_at ASC');
    $logStmt->execute([$row['id']]);
    $row['step_logs'] = $logStmt->fetchAll(PDO::FETCH_ASSOC);
    jsonResponse($row);
}

if ($method === 'POST' && !$action) {
    $body  = json_decode(file_get_contents('php://input'), true);
    $newId = generateUUID();
    $defId = $body['workflow_definition_id'] ?? $body['definition_id'] ?? null;
    if (!$defId) jsonError('workflow_definition_id required', 400);
    $db->prepare("INSERT INTO workflow_instances (id, tenant_id, workflow_definition_id, entity_type, entity_id, status, started_at) VALUES (?,?,?,?,?,'active',NOW())")
       ->execute([$newId, $user['tenant_id'], $defId, $body['entity_type'], $body['entity_id']]);

    $defStmt = $db->prepare('SELECT definition FROM workflow_definitions WHERE id = ? AND tenant_id = ?');
    $defStmt->execute([$defId, $user['tenant_id']]);
    $def = json_decode($defStmt->fetchColumn(), true);
    $firstNode = null;
    foreach ($def['nodes'] as $n) {
        if (($n['type'] ?? '') === 'stage') { $firstNode = $n; break; }
    }
    if ($firstNode) {
        $logId = generateUUID();
        $db->prepare("INSERT INTO workflow_step_logs (id, instance_id, step_id, step_name, status, started_at) VALUES (?,?,?,?,'in_progress',NOW())")
           ->execute([$logId, $newId, $firstNode['id'], $firstNode['data']['label']]);
        $db->prepare('UPDATE workflow_instances SET current_step_id = ? WHERE id = ?')->execute([$firstNode['id'], $newId]);
    }

    $stmt = $db->prepare('SELECT * FROM workflow_instances WHERE id = ?');
    $stmt->execute([$newId]);
    jsonResponse($stmt->fetch(PDO::FETCH_ASSOC), 201);
}

if ($method === 'POST' && $action === 'advance') {
    $body       = json_decode(file_get_contents('php://input'), true);
    $instanceId = $body['instance_id'];
    $stepId     = $body['step_id'];
    $nextStepId = $body['next_step_id'] ?? null;
    $notes      = $body['notes'] ?? null;

    // Verify instance belongs to this tenant
    $instCheck = $db->prepare('SELECT id FROM workflow_instances WHERE id = ? AND tenant_id = ?');
    $instCheck->execute([$instanceId, $user['tenant_id']]);
    if (!$instCheck->fetch()) jsonError('Workflow instance not found', 404);

    $db->prepare("UPDATE workflow_step_logs SET status='completed', completed_at=NOW(), duration_minutes=TIMESTAMPDIFF(MINUTE, COALESCE(started_at, created_at), NOW()), notes=? WHERE instance_id=? AND step_id=? AND status='in_progress'")
       ->execute([$notes, $instanceId, $stepId]);

    if ($nextStepId) {
        // Look up the step name from the workflow definition
        $defStmt = $db->prepare('SELECT wd.definition FROM workflow_instances wi JOIN workflow_definitions wd ON wi.workflow_definition_id = wd.id WHERE wi.id = ? AND wi.tenant_id = ?');
        $defStmt->execute([$instanceId, $user['tenant_id']]);
        $defData   = json_decode($defStmt->fetchColumn(), true);
        $nextLabel = null;
        if ($defData) {
            foreach ($defData['nodes'] as $n) {
                if ($n['id'] === $nextStepId) { $nextLabel = $n['data']['label']; break; }
            }
        }
        $logId = generateUUID();
        $db->prepare("INSERT INTO workflow_step_logs (id, instance_id, step_id, step_name, status, started_at) VALUES (?,?,?,?,'in_progress',NOW())")
           ->execute([$logId, $instanceId, $nextStepId, $nextLabel]);
        $db->prepare('UPDATE workflow_instances SET current_step_id=?, updated_at=NOW() WHERE id=?')->execute([$nextStepId, $instanceId]);
    } else {
        $db->prepare("UPDATE workflow_instances SET status='completed', completed_at=NOW(), current_step_id=NULL, updated_at=NOW() WHERE id=?")->execute([$instanceId]);
    }
    jsonResponse(['ok' => true]);
}

jsonError('Method not allowed', 405);
