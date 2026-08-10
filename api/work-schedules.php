<?php
// GET    /api/work-schedules.php                         — list schedules + days
// GET    /api/work-schedules.php?id=<id>                — single schedule + days
// POST   /api/work-schedules.php                         — create schedule
// PUT    /api/work-schedules.php?id=<id>                — update schedule fields + days
// DELETE /api/work-schedules.php?id=<id>                — delete (not if has users)
// POST   /api/work-schedules.php?action=assign          — assign user to schedule
// GET    /api/work-schedules.php?action=user_assignments — list user→schedule
require_once __DIR__ . '/auth.php';

$user     = requireAuth();
$db       = getDB();
$method   = getMethod();
$tenantId = $user['tenant_id'];
$userId   = $user['user_id'];
$id       = $_GET['id']     ?? null;
$action   = $_GET['action'] ?? '';

function fetchScheduleWithDays(PDO $db, string $id, string $tenantId): ?array {
    $stmt = $db->prepare('SELECT * FROM work_schedules WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$id, $tenantId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) return null;
    $days = $db->prepare('SELECT * FROM work_schedule_days WHERE schedule_id = ? ORDER BY day_of_week');
    $days->execute([$id]);
    $row['days'] = $days->fetchAll(PDO::FETCH_ASSOC);
    return $row;
}

if ($method === 'GET') {
    if ($action === 'user_assignments') {
        $stmt = $db->prepare(
            'SELECT uws.user_id, uws.schedule_id, u.display_name, u.email, ws.name as schedule_name
             FROM user_work_schedules uws
             JOIN users u  ON u.id  = uws.user_id
             JOIN tenant_users tu ON tu.user_id = u.id AND tu.tenant_id = ?
             JOIN work_schedules ws ON ws.id = uws.schedule_id
             WHERE ws.tenant_id = ?
             ORDER BY u.display_name'
        );
        $stmt->execute([$tenantId, $tenantId]);
        jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    if ($id) {
        $row = fetchScheduleWithDays($db, $id, $tenantId);
        if (!$row || $row['tenant_id'] !== $tenantId) jsonError('Not found', 404);
        jsonResponse($row);
    }
    $stmt = $db->prepare('SELECT * FROM work_schedules WHERE tenant_id = ? ORDER BY is_default DESC, name ASC');
    $stmt->execute([$tenantId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as &$r) {
        $days = $db->prepare('SELECT * FROM work_schedule_days WHERE schedule_id = ? ORDER BY day_of_week');
        $days->execute([$r['id']]);
        $r['days'] = $days->fetchAll(PDO::FETCH_ASSOC);
    }
    jsonResponse($rows);
}

if ($method === 'POST') {
    requireAdmin($db, $userId, $tenantId);
    if ($action === 'assign') {
        $body       = json_decode(file_get_contents('php://input'), true) ?? [];
        $targetUser = $body['user_id']     ?? '';
        $schedId    = $body['schedule_id'] ?? '';
        if (!$targetUser || !$schedId) jsonError('user_id and schedule_id required', 422);
        $chk = $db->prepare('SELECT id FROM work_schedules WHERE id = ? AND tenant_id = ?');
        $chk->execute([$schedId, $tenantId]);
        if (!$chk->fetch()) jsonError('Schedule not found', 404);
        // Verify user belongs to same tenant
        $userChk = $db->prepare('SELECT u.id FROM users u JOIN tenant_users tu ON tu.user_id = u.id WHERE u.id = ? AND tu.tenant_id = ?');
        $userChk->execute([$targetUser, $tenantId]);
        if (!$userChk->fetch()) jsonError('User not found', 404);
        $db->prepare(
            'INSERT INTO user_work_schedules (user_id, schedule_id) VALUES (?,?)
             ON DUPLICATE KEY UPDATE schedule_id=VALUES(schedule_id), updated_at=NOW()'
        )->execute([$targetUser, $schedId]);
        jsonResponse(['success' => true]);
    }

    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    if (empty($body['name'])) jsonError('name required', 422);
    $days = $body['days'] ?? [];

    if (!empty($body['is_default'])) {
        $db->prepare('UPDATE work_schedules SET is_default=0 WHERE tenant_id=?')->execute([$tenantId]);
    }

    $newId = generateUUID();
    $db->prepare(
        'INSERT INTO work_schedules (id, tenant_id, name, description, is_default, hours_per_day)
         VALUES (?,?,?,?,?,?)'
    )->execute([$newId, $tenantId, $body['name'], $body['description'] ?? null, !empty($body['is_default']) ? 1 : 0, $body['hours_per_day'] ?? 8.00]);

    foreach ($days as $day) {
        $dow = (int)$day['day_of_week'];
        $wh  = (float)$day['work_hours'];
        if ($dow < 1 || $dow > 7) jsonError('day_of_week must be 1–7', 422);
        if ($wh < 0 || $wh > 24)  jsonError('work_hours must be 0–24', 422);
        $db->prepare(
            'INSERT INTO work_schedule_days (id, schedule_id, day_of_week, is_working, work_hours)
             VALUES (?,?,?,?,?)'
        )->execute([generateUUID(), $newId, $dow, (int)$day['is_working'], $wh]);
    }

    jsonResponse(fetchScheduleWithDays($db, $newId, $tenantId), 201);
}

if ($method === 'PUT') {
    requireAdmin($db, $userId, $tenantId);
    if (!$id) jsonError('id required', 400);
    $row = fetchScheduleWithDays($db, $id, $tenantId);
    if (!$row || $row['tenant_id'] !== $tenantId) jsonError('Not found', 404);

    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    if (!empty($body['is_default'])) {
        $db->prepare('UPDATE work_schedules SET is_default=0 WHERE tenant_id=?')->execute([$tenantId]);
    }

    $fields = []; $values = [];
    foreach (['name','description','is_default','hours_per_day'] as $f) {
        if (array_key_exists($f, $body)) { $fields[] = "$f=?"; $values[] = $body[$f]; }
    }
    if ($fields) {
        $values[] = $id;
        $db->prepare('UPDATE work_schedules SET '.implode(',', $fields).' WHERE id=?')->execute($values);
    }

    if (!empty($body['days'])) {
        $db->prepare('DELETE FROM work_schedule_days WHERE schedule_id=?')->execute([$id]);
        foreach ($body['days'] as $day) {
            $dow = (int)$day['day_of_week'];
            $wh  = (float)$day['work_hours'];
            if ($dow < 1 || $dow > 7) jsonError('day_of_week must be 1–7', 422);
            if ($wh < 0 || $wh > 24)  jsonError('work_hours must be 0–24', 422);
            $db->prepare(
                'INSERT INTO work_schedule_days (id, schedule_id, day_of_week, is_working, work_hours)
                 VALUES (?,?,?,?,?)'
            )->execute([generateUUID(), $id, $dow, (int)$day['is_working'], $wh]);
        }
    }

    jsonResponse(fetchScheduleWithDays($db, $id, $tenantId));
}

if ($method === 'DELETE') {
    requireAdmin($db, $userId, $tenantId);
    if ($action === 'assign') {
        $targetUser = $_GET['user_id'] ?? '';
        if (!$targetUser) jsonError('user_id required', 400);
        // Verify the user belongs to this tenant
        $userChk = $db->prepare('SELECT u.id FROM users u JOIN tenant_users tu ON tu.user_id = u.id WHERE u.id = ? AND tu.tenant_id = ?');
        $userChk->execute([$targetUser, $tenantId]);
        if (!$userChk->fetch()) jsonError('User not found', 404);
        $db->prepare('DELETE FROM user_work_schedules WHERE user_id = ?')->execute([$targetUser]);
        jsonResponse(['success' => true]);
    }
    if (!$id) jsonError('id required', 400);
    $row = fetchScheduleWithDays($db, $id, $tenantId);
    if (!$row || $row['tenant_id'] !== $tenantId) jsonError('Not found', 404);

    if (!empty($row['is_default'])) jsonError('ไม่สามารถลบ schedule เริ่มต้น กรุณาตั้ง schedule อื่นเป็นค่าเริ่มต้นก่อน', 409);

    $used = $db->prepare('SELECT COUNT(*) FROM user_work_schedules WHERE schedule_id=?');
    $used->execute([$id]);
    if ((int)$used->fetchColumn() > 0) jsonError('ไม่สามารถลบ schedule ที่มีพนักงานใช้งานอยู่', 409);

    $db->prepare('DELETE FROM work_schedules WHERE id=?')->execute([$id]);
    jsonResponse(['success' => true]);
}

jsonError('Method not allowed', 405);
