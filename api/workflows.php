<?php
require_once __DIR__ . '/auth.php';

$user   = requireAuth();
$db     = getDB();
$method = getMethod();
$id     = $_GET['id'] ?? null;

function wfTemplates(): array {
    return [
      'project' => ['nodes'=>[
        ['id'=>'start','type'=>'start','position'=>['x'=>100,'y'=>200],'data'=>['label'=>'เริ่มต้น','nodeType'=>'start']],
        ['id'=>'kickoff','type'=>'stage','position'=>['x'=>260,'y'=>200],'data'=>['label'=>'Kickoff','nodeType'=>'stage','slaMinutes'=>1440]],
        ['id'=>'planning','type'=>'stage','position'=>['x'=>440,'y'=>200],'data'=>['label'=>'วางแผน','nodeType'=>'stage','slaMinutes'=>2880]],
        ['id'=>'development','type'=>'stage','position'=>['x'=>620,'y'=>200],'data'=>['label'=>'พัฒนา','nodeType'=>'stage','slaMinutes'=>14400]],
        ['id'=>'testing','type'=>'stage','position'=>['x'=>800,'y'=>200],'data'=>['label'=>'ทดสอบ','nodeType'=>'stage','slaMinutes'=>2880]],
        ['id'=>'delivery','type'=>'stage','position'=>['x'=>980,'y'=>200],'data'=>['label'=>'ส่งมอบ','nodeType'=>'stage','slaMinutes'=>1440]],
        ['id'=>'end','type'=>'end','position'=>['x'=>1160,'y'=>200],'data'=>['label'=>'เสร็จสิ้น','nodeType'=>'end']],
      ],'edges'=>[
        ['id'=>'e1','source'=>'start','target'=>'kickoff'],['id'=>'e2','source'=>'kickoff','target'=>'planning'],
        ['id'=>'e3','source'=>'planning','target'=>'development'],['id'=>'e4','source'=>'development','target'=>'testing'],
        ['id'=>'e5','source'=>'testing','target'=>'delivery'],['id'=>'e6','source'=>'delivery','target'=>'end'],
      ]],
      'opportunity' => ['nodes'=>[
        ['id'=>'start','type'=>'start','position'=>['x'=>100,'y'=>200],'data'=>['label'=>'เริ่มต้น','nodeType'=>'start']],
        ['id'=>'lead','type'=>'stage','position'=>['x'=>260,'y'=>200],'data'=>['label'=>'Lead','nodeType'=>'stage','slaMinutes'=>1440]],
        ['id'=>'qualified','type'=>'stage','position'=>['x'=>440,'y'=>200],'data'=>['label'=>'Qualified','nodeType'=>'stage','slaMinutes'=>2880]],
        ['id'=>'proposal','type'=>'stage','position'=>['x'=>620,'y'=>200],'data'=>['label'=>'Proposal','nodeType'=>'stage','slaMinutes'=>7200]],
        ['id'=>'negotiation','type'=>'stage','position'=>['x'=>800,'y'=>200],'data'=>['label'=>'Negotiation','nodeType'=>'stage','slaMinutes'=>4320]],
        ['id'=>'end','type'=>'end','position'=>['x'=>980,'y'=>200],'data'=>['label'=>'Won/Lost','nodeType'=>'end']],
      ],'edges'=>[
        ['id'=>'e1','source'=>'start','target'=>'lead'],['id'=>'e2','source'=>'lead','target'=>'qualified'],
        ['id'=>'e3','source'=>'qualified','target'=>'proposal'],['id'=>'e4','source'=>'proposal','target'=>'negotiation'],
        ['id'=>'e5','source'=>'negotiation','target'=>'end'],
      ]],
      'support_ticket' => ['nodes'=>[
        ['id'=>'start','type'=>'start','position'=>['x'=>100,'y'=>200],'data'=>['label'=>'เริ่มต้น','nodeType'=>'start']],
        ['id'=>'received','type'=>'stage','position'=>['x'=>260,'y'=>200],'data'=>['label'=>'รับเรื่อง','nodeType'=>'stage','slaMinutes'=>60]],
        ['id'=>'assigned','type'=>'stage','position'=>['x'=>440,'y'=>200],'data'=>['label'=>'มอบหมาย','nodeType'=>'stage','slaMinutes'=>120]],
        ['id'=>'inprogress','type'=>'stage','position'=>['x'=>620,'y'=>200],'data'=>['label'=>'กำลังดำเนินการ','nodeType'=>'stage','slaMinutes'=>480]],
        ['id'=>'resolved','type'=>'stage','position'=>['x'=>800,'y'=>200],'data'=>['label'=>'แก้ไขแล้ว','nodeType'=>'stage','slaMinutes'=>60]],
        ['id'=>'end','type'=>'end','position'=>['x'=>980,'y'=>200],'data'=>['label'=>'ปิดเรื่อง','nodeType'=>'end']],
      ],'edges'=>[
        ['id'=>'e1','source'=>'start','target'=>'received'],['id'=>'e2','source'=>'received','target'=>'assigned'],
        ['id'=>'e3','source'=>'assigned','target'=>'inprogress'],['id'=>'e4','source'=>'inprogress','target'=>'resolved'],
        ['id'=>'e5','source'=>'resolved','target'=>'end'],
      ]],
    ];
}

if ($method === 'GET') {
    if (isset($_GET['templates'])) { jsonResponse(wfTemplates()); }
    $entity_type = $_GET['entity_type'] ?? null;
    $sql    = 'SELECT * FROM workflow_definitions WHERE tenant_id = ?';
    $params = [$user['tenant_id']];
    if ($entity_type) { $sql .= ' AND entity_type = ?'; $params[] = $entity_type; }
    $sql .= ' ORDER BY is_template DESC, created_at DESC';
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as &$row) { $row['definition'] = json_decode($row['definition'], true); }
    jsonResponse($rows);
}

if ($method === 'POST') {
    $body  = json_decode(file_get_contents('php://input'), true);
    $newId = generateUUID();
    $db->prepare('INSERT INTO workflow_definitions (id, tenant_id, name, entity_type, definition, is_template, created_by) VALUES (?,?,?,?,?,?,?)')
       ->execute([$newId, $user['tenant_id'], $body['name'], $body['entity_type'], json_encode($body['definition']), $body['is_template'] ?? 0, $user['user_id']]);
    $stmt = $db->prepare('SELECT * FROM workflow_definitions WHERE id = ?');
    $stmt->execute([$newId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $row['definition'] = json_decode($row['definition'], true);
    jsonResponse($row, 201);
}

if ($method === 'PUT' && $id) {
    $body = json_decode(file_get_contents('php://input'), true);
    $db->prepare('UPDATE workflow_definitions SET name=?, entity_type=?, definition=?, is_template=?, updated_at=NOW() WHERE id=? AND tenant_id=?')
       ->execute([$body['name'], $body['entity_type'], json_encode($body['definition']), $body['is_template'] ?? 0, $id, $user['tenant_id']]);
    $stmt = $db->prepare('SELECT * FROM workflow_definitions WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$id, $user['tenant_id']]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) jsonError('Workflow not found', 404);
    $row['definition'] = json_decode($row['definition'], true);
    jsonResponse($row);
}

if ($method === 'DELETE' && $id) {
    $db->prepare('DELETE FROM workflow_definitions WHERE id = ? AND tenant_id = ?')->execute([$id, $user['tenant_id']]);
    jsonResponse(['ok' => true]);
}

jsonError('Method not allowed', 405);
