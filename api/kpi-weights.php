<?php
// /api/kpi-weights.php — KPI Weight Configuration CRUD
//
// GET    /api/kpi-weights.php              — list all weight configs
// GET    /api/kpi-weights.php?id=xxx       — get single config
// POST   /api/kpi-weights.php              — create new config (admin)
// PUT    /api/kpi-weights.php?id=xxx       — update config (admin)
// DELETE /api/kpi-weights.php?id=xxx       — delete config (admin)
// POST   /api/kpi-weights.php?action=seed  — seed default configs (admin)

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

$db        = getDB();
$tokenData = requireAuth();
$tenantId  = $tokenData['tenant_id'];
$userId    = $tokenData['user_id'];

// Check admin status from DB — same pattern as calendar.php / tasks.php
$isAdmin = isTenantAdmin($db, $userId, $tenantId);

$method = getMethod();
$id     = $_GET['id'] ?? '';
$action = $_GET['action'] ?? '';

// ── GET: List or single ─────────────────────────────────────────────────────────
if ($method === 'GET') {
    if ($id) {
        $stmt = $db->prepare("SELECT * FROM kpi_weight_configs WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $tenantId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) jsonError('ไม่พบการตั้งค่า', 404);
        jsonResponse($row);
    } else {
        $stmt = $db->prepare(
            "SELECT * FROM kpi_weight_configs WHERE tenant_id = ? ORDER BY department"
        );
        $stmt->execute([$tenantId]);
        jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
    }
}

// ── Admin-only operations below ─────────────────────────────────────────────────
if (!$isAdmin) jsonError('Forbidden — admin only', 403);

// ── POST: Create ────────────────────────────────────────────────────────────────
if ($method === 'POST') {
    if ($action === 'seed') {
        // Seed default weights from design doc
        // [dept, p, q, a, s, b]
        $defaults = [
            ['Development',      40, 30, 10, 20,  0],
            ['Sales',            20, 40, 20, 20,  0],
            ['Support',          30, 30, 10, 30,  0],
            ['Management/Admin', 20, 20, 30, 10, 20],
        ];
        $seeded = 0;
        foreach ($defaults as [$dept, $p, $q, $a, $s, $b]) {
            $stmt = $db->prepare(
                "INSERT IGNORE INTO kpi_weight_configs (id, tenant_id, department, p_weight, q_weight, a_weight, s_weight, b_weight)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt->execute([generateUUID(), $tenantId, $dept, $p, $q, $a, $s, $b]);
            if ($stmt->rowCount() > 0) $seeded++;
        }
        jsonResponse(['seeded' => $seeded, 'message' => "เพิ่มการตั้งค่าเริ่มต้น {$seeded} รายการ"]);
    }

    $body = getRequestBody();
    $dept  = trim($body['department'] ?? '');
    if (!$dept) jsonError('กรุณาระบุชื่อแผนก', 400);

    $p = (float)($body['p_weight'] ?? 25);
    $q = (float)($body['q_weight'] ?? 25);
    $a = (float)($body['a_weight'] ?? 25);
    $s = (float)($body['s_weight'] ?? 25);
    $b = (float)($body['b_weight'] ?? 0);

    // Validate weights sum to ~100
    $sum = $p + $q + $a + $s + $b;
    if ($sum < 99 || $sum > 101) {
        jsonError("ผลรวมน้ำหนักต้องเท่ากับ 100 (ปัจจุบัน: {$sum})", 400);
    }

    $newId = generateUUID();
    try {
        $db->prepare(
            "INSERT INTO kpi_weight_configs (id, tenant_id, department, p_weight, q_weight, a_weight, s_weight, b_weight)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )->execute([$newId, $tenantId, $dept, $p, $q, $a, $s, $b]);
        jsonResponse(['id' => $newId, 'department' => $dept, 'p_weight' => $p, 'q_weight' => $q, 'a_weight' => $a, 's_weight' => $s, 'b_weight' => $b], 201);
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) {
            jsonError("แผนก '{$dept}' มีการตั้งค่าอยู่แล้ว — กรุณาแก้ไขแทน", 409);
        }
        throw $e;
    }
}

// ── PUT: Update ─────────────────────────────────────────────────────────────────
if ($method === 'PUT') {
    if (!$id) jsonError('id required', 400);

    $stmt = $db->prepare("SELECT * FROM kpi_weight_configs WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$id, $tenantId]);
    if (!$stmt->fetch()) jsonError('ไม่พบการตั้งค่า', 404);

    $body = getRequestBody();
    $sets = []; $params = [];

    if (isset($body['department'])) { $sets[] = 'department=?'; $params[] = trim($body['department']); }
    if (isset($body['p_weight']))   { $sets[] = 'p_weight=?';   $params[] = (float)$body['p_weight']; }
    if (isset($body['q_weight']))   { $sets[] = 'q_weight=?';   $params[] = (float)$body['q_weight']; }
    if (isset($body['a_weight']))   { $sets[] = 'a_weight=?';   $params[] = (float)$body['a_weight']; }
    if (isset($body['s_weight']))   { $sets[] = 's_weight=?';   $params[] = (float)$body['s_weight']; }
    if (isset($body['b_weight']))   { $sets[] = 'b_weight=?';   $params[] = (float)$body['b_weight']; }
    if (isset($body['is_active']))  { $sets[] = 'is_active=?';  $params[] = (int)$body['is_active']; }

    if (empty($sets)) jsonError('ไม่มีข้อมูลที่ต้องการอัปเดต', 400);

    $params[] = $id;
    $db->prepare("UPDATE kpi_weight_configs SET " . implode(', ', $sets) . " WHERE id = ?")->execute($params);

    // Re-fetch and validate sum
    $stmt = $db->prepare("SELECT * FROM kpi_weight_configs WHERE id = ?");
    $stmt->execute([$id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $sum = (float)$row['p_weight'] + (float)$row['q_weight'] + (float)$row['a_weight'] + (float)$row['s_weight'] + (float)$row['b_weight'];
    if ($sum < 99 || $sum > 101) {
        jsonResponse(['ok' => true, 'warning' => "ผลรวมน้ำหนัก = {$sum} (ควรเท่ากับ 100)"]);
    }

    jsonResponse(['ok' => true, 'message' => 'อัปเดตสำเร็จ']);
}

// ── DELETE ──────────────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    if (!$id) jsonError('id required', 400);
    $db->prepare("DELETE FROM kpi_weight_configs WHERE id = ? AND tenant_id = ?")
       ->execute([$id, $tenantId]);
    jsonResponse(['ok' => true, 'message' => 'ลบสำเร็จ']);
}

jsonError('Method not allowed', 405);
