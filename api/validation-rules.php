<?php
// api/validation-rules.php
// GET    - list rules for tenant (seeds defaults if none exist)
// POST   - create rule
// PUT    - update rule (?id= required)
// DELETE - delete rule (?id= required, non-system only)
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId    = $tokenData['user_id'];
$tenantId  = $tokenData['tenant_id'];
$db        = getDB();
$method    = getMethod();

$isAdmin = isTenantAdmin($db, $userId, $tenantId);

// ── Seed default rules for tenant if none exist ──────────────────────────────
function seedDefaultRules(PDO $db, string $tenantId): void {
    $defaults = [
        ['warn',  'title_duplicate',    'duplicate', null,  'พบ task ที่อาจซ้ำกัน กรุณาตรวจสอบ'],
        ['block', 'actual_hours',       'gt',        '16',  'ไม่สามารถบันทึกชั่วโมงเกิน 16 ชั่วโมงต่อ task'],
        ['block', 'daily_hours_sum',    'gt',        '24',  'ชั่วโมงรวมของวันนี้เกิน 24 ชั่วโมง'],
        ['warn',  'assignee_user_id',   'null',      null,  'task ยังไม่มีผู้รับผิดชอบ'],
        ['warn',  'estimated_hours',    'null',      null,  'task ยังไม่มีชั่วโมงประมาณ'],
        ['warn',  'estimated_hours',    'gt',        'max_task_hours',  'ชั่วโมงประมาณเกินกำหนด แนะนำให้แตกเป็นงานย่อย'],
        ['block', 'end_before_start',   'invalid',   null,  'วันสิ้นสุดต้องไม่น้อยกว่าวันเริ่มต้น'],
    ];
    $stmt = $db->prepare("INSERT INTO task_validation_rules
        (id, tenant_id, rule_type, condition_field, condition_operator, condition_value, message_th, is_active, is_system)
        VALUES (UUID(), ?, ?, ?, ?, ?, ?, 1, 1)");
    foreach ($defaults as [$type, $field, $op, $val, $msg]) {
        $stmt->execute([$tenantId, $type, $field, $op, $val, $msg]);
    }
}

// ── GET ──────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $count = $db->prepare('SELECT COUNT(*) FROM task_validation_rules WHERE tenant_id = ?');
    $count->execute([$tenantId]);
    if ((int)$count->fetchColumn() === 0) {
        seedDefaultRules($db, $tenantId);
    }
    $stmt = $db->prepare('SELECT * FROM task_validation_rules WHERE tenant_id = ? ORDER BY is_system DESC, created_at ASC');
    $stmt->execute([$tenantId]);
    echo json_encode(['data' => $stmt->fetchAll(PDO::FETCH_ASSOC)], JSON_NUMERIC_CHECK);
    exit;
}

// Admin-only below ─────────────────────────────────────────────────────────
if (!$isAdmin) { jsonError('Forbidden', 403); }

// ── POST ─────────────────────────────────────────────────────────────────────
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $required = ['rule_type','condition_field','condition_operator','message_th'];
    foreach ($required as $f) {
        if (empty($input[$f])) { jsonError("Field required: $f", 400); }
    }
    if (!in_array($input['rule_type'], ['warn','block'])) { jsonError('rule_type must be warn or block', 400); }
    $stmt = $db->prepare("INSERT INTO task_validation_rules
        (id, tenant_id, rule_type, condition_field, condition_operator, condition_value, message_th, is_active, is_system, created_by)
        VALUES (UUID(), ?, ?, ?, ?, ?, ?, 1, 0, ?)");
    $stmt->execute([
        $tenantId,
        $input['rule_type'],
        $input['condition_field'],
        $input['condition_operator'],
        $input['condition_value'] ?? null,
        $input['message_th'],
        $userId,
    ]);
    echo json_encode(['success' => true]);
    exit;
}

// ── PUT ──────────────────────────────────────────────────────────────────────
if ($method === 'PUT') {
    $id = $_GET['id'] ?? '';
    if (!$id) { jsonError('id required', 400); }
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $fields = [];
    $params = [];
    $allowed = ['rule_type','condition_field','condition_operator','condition_value','message_th','is_active'];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $input)) {
            $fields[] = "$f = ?";
            $params[] = $input[$f];
        }
    }
    if (empty($fields)) { jsonError('Nothing to update', 400); }
    $params[] = $id;
    $params[] = $tenantId;
    $stmt = $db->prepare("UPDATE task_validation_rules SET " . implode(', ', $fields) . " WHERE id = ? AND tenant_id = ?");
    $stmt->execute($params);
    echo json_encode(['success' => true]);
    exit;
}

// ── DELETE ───────────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? '';
    if (!$id) { jsonError('id required', 400); }
    $stmt = $db->prepare("DELETE FROM task_validation_rules WHERE id = ? AND tenant_id = ? AND is_system = 0");
    $stmt->execute([$id, $tenantId]);
    echo json_encode(['success' => true]);
    exit;
}

jsonError('Method not allowed', 405);
