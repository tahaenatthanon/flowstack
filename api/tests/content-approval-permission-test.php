<?php
/**
 * ทดสอบ change restrict-content-approval-tab — สิทธิ์ content_approval คุมการตัดสินอนุมัติ
 * (อนุมัติ/ตีกลับ/ปฏิเสธ) ทั้งที่ api/content-items.php (PUT) และ api/approvals.php (decide)
 * ยิง HTTP จริงผ่าน Apache local (ไม่แตะ production) — สร้าง user/role/content ชั่วคราวแล้วลบทิ้งท้ายสคริปต์
 *
 * รัน: php api/tests/content-approval-permission-test.php
 */

if (PHP_SAPI !== 'cli') { http_response_code(403); exit("CLI only\n"); }

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

$BASE   = 'http://localhost/flowstack';
$TENANT = 'tenant-default';
$db     = getDB();

$PASS = 0; $FAIL = 0;
function check(string $name, bool $ok, string $detail = ''): void {
    global $PASS, $FAIL;
    if ($ok) { $PASS++; echo "  PASS  $name\n"; }
    else     { $FAIL++; echo "  FAIL  $name" . ($detail !== '' ? " — $detail" : '') . "\n"; }
}
// login.php ไม่ต้องใช้ Bearer token (สร้าง token เอง) — แยกจาก httpCall ที่ต้องมี token เสมอ
function httpCallNoAuth(string $method, string $url, ?array $payload): array {
    $ch = curl_init($url);
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT        => 15,
    ];
    if ($payload !== null) $opts[CURLOPT_POSTFIELDS] = json_encode($payload, JSON_UNESCAPED_UNICODE);
    curl_setopt_array($ch, $opts);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$code, json_decode((string)$res, true)];
}

function httpCall(string $method, string $url, ?array $payload, string $token): array {
    $ch = curl_init($url);
    $headers = ['Content-Type: application/json', "Authorization: Bearer $token"];
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 15,
    ];
    if ($payload !== null) $opts[CURLOPT_POSTFIELDS] = json_encode($payload, JSON_UNESCAPED_UNICODE);
    curl_setopt_array($ch, $opts);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$code, json_decode((string)$res, true)];
}

// ── เตรียมข้อมูลทดสอบ: role ไม่มีสิทธิ์ (member) / role มีสิทธิ์ (manager) / is_admin ──────
$memberRoleId  = (int)$db->query("SELECT id FROM roles WHERE tenant_id='$TENANT' AND name='member'")->fetchColumn();
$managerRoleId = (int)$db->query("SELECT id FROM roles WHERE tenant_id='$TENANT' AND name='manager'")->fetchColumn();
if (!$memberRoleId || !$managerRoleId) { exit("ไม่พบ role member/manager ของ $TENANT — หยุดทดสอบ\n"); }

$noPermUserId    = generateUUID();
$hasPermUserId   = generateUUID();
$adminUserId     = generateUUID();
$adminRoleUserId = generateUUID();
$now = date('Y-m-d H:i:s');

$db->prepare("INSERT INTO users (id, email, password_hash, display_name, is_active, created_at, updated_at) VALUES (?,?,?,?,1,?,?)")
   ->execute([$noPermUserId, "test-noperm-$noPermUserId@example.test", password_hash('x', PASSWORD_DEFAULT), 'ทดสอบ ไม่มีสิทธิ์', $now, $now]);
$db->prepare("INSERT INTO users (id, email, password_hash, display_name, is_active, created_at, updated_at) VALUES (?,?,?,?,1,?,?)")
   ->execute([$hasPermUserId, "test-hasperm-$hasPermUserId@example.test", password_hash('x', PASSWORD_DEFAULT), 'ทดสอบ มีสิทธิ์', $now, $now]);
$db->prepare("INSERT INTO users (id, email, password_hash, display_name, is_active, created_at, updated_at) VALUES (?,?,?,?,1,?,?)")
   ->execute([$adminUserId, "test-admin-$adminUserId@example.test", password_hash('x', PASSWORD_DEFAULT), 'ทดสอบ is_admin', $now, $now]);
$db->prepare("INSERT INTO users (id, email, password_hash, display_name, is_active, created_at, updated_at) VALUES (?,?,?,?,1,?,?)")
   ->execute([$adminRoleUserId, "test-adminrole-$adminRoleUserId@example.test", password_hash('x', PASSWORD_DEFAULT), 'ทดสอบ is_admin+role', $now, $now]);

$db->prepare("INSERT INTO tenant_users (user_id, tenant_id, role_id, is_admin) VALUES (?,?,?,0)")->execute([$noPermUserId, $TENANT, $memberRoleId]);
$db->prepare("INSERT INTO tenant_users (user_id, tenant_id, role_id, is_admin) VALUES (?,?,?,0)")->execute([$hasPermUserId, $TENANT, $managerRoleId]);
$db->prepare("INSERT INTO tenant_users (user_id, tenant_id, role_id, is_admin) VALUES (?,?,NULL,1)")->execute([$adminUserId, $TENANT]);
// is_admin=1 ที่มี role_id ชี้ role ซึ่งมี content_approval — ต้องผ่านเพราะมี role assignment จริง ไม่ใช่เพราะ is_admin (D1.5)
$db->prepare("INSERT INTO tenant_users (user_id, tenant_id, role_id, is_admin) VALUES (?,?,?,1)")->execute([$adminRoleUserId, $TENANT, $managerRoleId]);

$tokenNoPerm    = generateToken($noPermUserId, "test-noperm-$noPermUserId@example.test", $TENANT);
$tokenHasPerm   = generateToken($hasPermUserId, "test-hasperm-$hasPermUserId@example.test", $TENANT);
$tokenAdmin     = generateToken($adminUserId, "test-admin-$adminUserId@example.test", $TENANT);
$tokenAdminRole = generateToken($adminRoleUserId, "test-adminrole-$adminRoleUserId@example.test", $TENANT);

register_shutdown_function(function () use ($db, $noPermUserId, $hasPermUserId, $adminUserId, $adminRoleUserId) {
    $ids = [$noPermUserId, $hasPermUserId, $adminUserId, $adminRoleUserId];
    $in = implode(',', array_fill(0, count($ids), '?'));
    $db->prepare("DELETE FROM content_approval_rounds WHERE content_item_id IN (SELECT id FROM content_items WHERE created_by IN ($in))")->execute($ids);
    $db->prepare("DELETE FROM approval_requests WHERE requested_by IN ($in) OR approver_id IN ($in)")->execute([...$ids, ...$ids]);
    $db->prepare("DELETE FROM content_items WHERE created_by IN ($in)")->execute($ids);
    $db->prepare("DELETE FROM tenant_users WHERE user_id IN ($in)")->execute($ids);
    $db->prepare("DELETE FROM users WHERE id IN ($in)")->execute($ids);
});

function makeContentItem(PDO $db, string $tenant, string $userId, string $status): string {
    $id = generateUUID();
    $db->prepare("INSERT INTO content_items (id, tenant_id, title, type, status, platform, platforms, created_by, approved_at, created_at, updated_at)
                  VALUES (?,?,?,?,?,?,?,?,?,NOW(),NOW())")
       ->execute([$id, $tenant, 'ทดสอบสิทธิ์อนุมัติ', 'article', $status, 'wordpress', json_encode(['wordpress']), $userId, $status === 'pending_approval' ? null : ($status === 'approved' ? date('Y-m-d H:i:s') : null)]);
    return $id;
}

// ═══════════════════ Section A — PUT content-items.php ══════════════════════
{
    $itemId = makeContentItem($db, $TENANT, $noPermUserId, 'pending_approval');
    [$code, $body] = httpCall('PUT', "$BASE/api/content-items.php?id=$itemId", ['status' => 'approved'], $tokenNoPerm);
    $row = $db->query("SELECT status, approved_at FROM content_items WHERE id='$itemId'")->fetch(PDO::FETCH_ASSOC);
    check('A1 member ส่ง approved → 403', $code === 403, "code=$code body=" . json_encode($body, JSON_UNESCAPED_UNICODE));
    check('A1 status ไม่เปลี่ยน', $row['status'] === 'pending_approval' && $row['approved_at'] === null, json_encode($row));
}
{
    $itemId = makeContentItem($db, $TENANT, $noPermUserId, 'pending_approval');
    [$code] = httpCall('PUT', "$BASE/api/content-items.php?id=$itemId", ['status' => 'revision', 'reject_reason' => 'แก้หน่อย'], $tokenNoPerm);
    $rounds = (int)$db->query("SELECT COUNT(*) FROM content_approval_rounds WHERE content_item_id='$itemId'")->fetchColumn();
    check('A2 member ตีกลับ (revision) คอนเทนต์ pending_approval → 403', $code === 403, "code=$code");
    check('A2 ไม่มีแถวใหม่ใน content_approval_rounds', $rounds === 0, "rounds=$rounds");
}
{
    $itemId = makeContentItem($db, $TENANT, $noPermUserId, 'draft');
    [$code] = httpCall('PUT', "$BASE/api/content-items.php?id=$itemId", ['status' => 'pending_approval'], $tokenNoPerm);
    check('A3 member ส่งขออนุมัติ (pending_approval) ไม่ถูกบล็อกด้วยสิทธิ์นี้', $code !== 403, "code=$code");
}
{
    $itemId = makeContentItem($db, $TENANT, $noPermUserId, 'approved');
    [$code] = httpCall('PUT', "$BASE/api/content-items.php?id=$itemId", ['title' => 'แก้ชื่อโดย member'], $tokenNoPerm);
    $row = $db->query("SELECT status, title FROM content_items WHERE id='$itemId'")->fetch(PDO::FETCH_ASSOC);
    check('A4 member แก้เนื้อหาคอนเทนต์ที่อนุมัติแล้ว → ไม่ถูกบล็อกด้วยสิทธิ์นี้', $code !== 403, "code=$code");
    check('A4 ระบบตั้ง revision อัตโนมัติตามเดิม', $row['status'] === 'revision' && $row['title'] === 'แก้ชื่อโดย member', json_encode($row));
}
{
    $itemId = makeContentItem($db, $TENANT, $hasPermUserId, 'pending_approval');
    [$code] = httpCall('PUT', "$BASE/api/content-items.php?id=$itemId", ['status' => 'approved'], $tokenHasPerm);
    check('A5 manager (มีสิทธิ์) ส่ง approved → ไม่ถูกบล็อกที่ด่านสิทธิ์', $code !== 403, "code=$code");
}
{
    // D1.5: content_approval ต้องมี role assignment เสมอ — is_admin=1 ที่ไม่มี role_id ไม่ bypass ที่นี่
    // (ต่างจากเมนูอื่นทุกเมนูที่ is_admin ยัง bypass ตามปกติ)
    $itemId = makeContentItem($db, $TENANT, $adminUserId, 'pending_approval');
    [$code] = httpCall('PUT', "$BASE/api/content-items.php?id=$itemId", ['status' => 'rejected', 'reject_reason' => 'ไม่ผ่าน'], $tokenAdmin);
    $row = $db->query("SELECT status FROM content_items WHERE id='$itemId'")->fetch(PDO::FETCH_ASSOC);
    check('A6 is_admin=1 ไม่มี role → ส่ง rejected ถูกบล็อก 403', $code === 403, "code=$code");
    check('A6 status ไม่เปลี่ยน', $row['status'] === 'pending_approval', json_encode($row));
}
{
    // is_admin=1 ที่มี role_id ชี้ role ซึ่งมี content_approval → ผ่านเพราะ role ไม่ใช่เพราะ is_admin
    $itemId = makeContentItem($db, $TENANT, $adminRoleUserId, 'pending_approval');
    [$code] = httpCall('PUT', "$BASE/api/content-items.php?id=$itemId", ['status' => 'approved'], $tokenAdminRole);
    check('A7 is_admin=1 ที่มี role ซึ่งมีสิทธิ์ → ไม่ถูกบล็อกที่ด่านสิทธิ์', $code !== 403, "code=$code");
}

// ═══════════════════ Section B — approvals.php action=decide ════════════════
{
    $itemId = makeContentItem($db, $TENANT, $noPermUserId, 'pending_approval');
    $reqId  = generateUUID();
    $db->prepare("INSERT INTO approval_requests (id, tenant_id, entity_type, entity_id, step_order, approver_id, status, requested_by, created_at, updated_at)
                  VALUES (?,?,?,?,1,?,?,?,NOW(),NOW())")
       ->execute([$reqId, $TENANT, 'content_item', $itemId, $noPermUserId, 'pending', $noPermUserId]);
    [$code] = httpCall('POST', "$BASE/api/approvals.php?action=decide&id=$reqId", ['status' => 'approved'], $tokenNoPerm);
    $status = $db->query("SELECT status FROM approval_requests WHERE id='$reqId'")->fetchColumn();
    check('B1 approver ที่ไม่มีสิทธิ์ content_approval เรียก decide → 403', $code === 403, "code=$code");
    check('B1 คำขอยังเป็น pending', $status === 'pending', "status=$status");
}
{
    $itemId = makeContentItem($db, $TENANT, $hasPermUserId, 'pending_approval');
    $reqId  = generateUUID();
    $db->prepare("INSERT INTO approval_requests (id, tenant_id, entity_type, entity_id, step_order, approver_id, status, requested_by, created_at, updated_at)
                  VALUES (?,?,?,?,1,?,?,?,NOW(),NOW())")
       ->execute([$reqId, $TENANT, 'content_item', $itemId, $hasPermUserId, 'pending', $hasPermUserId]);
    [$code] = httpCall('POST', "$BASE/api/approvals.php?action=decide&id=$reqId", ['status' => 'approved'], $tokenHasPerm);
    check('B2 approver ที่มีสิทธิ์ content_approval เรียก decide → ไม่ถูกบล็อกที่ด่านสิทธิ์', $code !== 403, "code=$code");
}

// ═══════════════════ Section C — userHasRolePermission() ไม่ bypass ด้วย is_admin/superadmin ═
{
    $noPerm     = userHasRolePermission($db, $noPermUserId, $TENANT, 'content_approval');
    $hasPerm    = userHasRolePermission($db, $hasPermUserId, $TENANT, 'content_approval');
    $adminNoRole = userHasRolePermission($db, $adminUserId, $TENANT, 'content_approval');
    $adminRole  = userHasRolePermission($db, $adminRoleUserId, $TENANT, 'content_approval');
    check('C1 member ไม่มีสิทธิ์', $noPerm === false, var_export($noPerm, true));
    check('C2 manager มีสิทธิ์', $hasPerm === true, var_export($hasPerm, true));
    check('C3 is_admin=1 ไม่มี role → ไม่มีสิทธิ์ (ไม่ bypass)', $adminNoRole === false, var_export($adminNoRole, true));
    check('C4 is_admin=1 ที่มี role ซึ่งมีสิทธิ์ → มีสิทธิ์ (เพราะ role ไม่ใช่ is_admin)', $adminRole === true, var_export($adminRole, true));

    // userHasPermission() เดิม (bypass) ยังต้องทำงานตามปกติสำหรับเมนูอื่น — ต่างจาก
    // userHasRolePermission() เฉพาะตอน is_admin/superadmin ไม่มี role หรือ role ไม่มีสิทธิ์นี้
    $adminNoRoleBypass = userHasPermission($db, $adminUserId, $TENANT, 'content_approval');
    check('C5 userHasPermission (เดิม) ยัง bypass ให้ is_admin — พิสูจน์ว่าเป็นคนละฟังก์ชันกับ C3', $adminNoRoleBypass === true, var_export($adminNoRoleBypass, true));

    $perms = getUserPermissions($db, $hasPermUserId, $TENANT);
    check('C6 userHasRolePermission ตรงกับ role_menu_permissions ของ manager', in_array('content_approval', $perms, true) === $hasPerm);
}

// ═══════════════════ Section D — /auth/login.php และ /auth/me.php คืน role_permissions ตรงกัน ═
// regression: login.php เคยไม่คำนวณ role_permissions เลย (มีแค่ permissions ที่ bypass) ทำให้
// หลังล็อกอินสด แท็บ "รายการอนุมัติ" หายไปจนกว่าจะรีเฟรชหน้าให้ AuthProvider เรียก me.php ใหม่
{
    [$loginCode, $loginRes] = httpCallNoAuth('POST', "$BASE/api/auth/login.php", [
        'email' => "test-hasperm-$hasPermUserId@example.test", 'password' => 'x',
    ]);
    $loginBody = $loginRes['data'] ?? null; // jsonResponse() ห่อผลด้วย {"data": ...} เสมอ
    $loginRolePerms = $loginBody['user']['role_permissions'] ?? null;
    check('D1 login.php คืน role_permissions', $loginCode === 200 && is_array($loginRolePerms), "code=$loginCode body=" . json_encode($loginRes, JSON_UNESCAPED_UNICODE));
    check('D2 login.php: role_permissions มี content_approval สำหรับ manager', in_array('content_approval', $loginRolePerms ?? [], true), json_encode($loginRolePerms));

    [, $meRes] = httpCall('GET', "$BASE/api/auth/me.php", null, $loginBody['token'] ?? $tokenHasPerm);
    $meBody = $meRes['data'] ?? null;
    check('D3 login.php และ me.php คืน role_permissions ตรงกัน', ($meBody['role_permissions'] ?? null) === $loginRolePerms, json_encode([$meBody['role_permissions'] ?? null, $loginRolePerms]));
}
{
    // is_admin=1 ไม่มี role: login.php ต้องคืน role_permissions ว่าง ไม่ล้มหรือขาดฟิลด์
    [$loginCode, $loginRes] = httpCallNoAuth('POST', "$BASE/api/auth/login.php", [
        'email' => "test-admin-$adminUserId@example.test", 'password' => 'x',
    ]);
    $loginBody = $loginRes['data'] ?? null;
    check('D4 login.php: is_admin ไม่มี role → role_permissions เป็น array ว่าง', $loginCode === 200 && ($loginBody['user']['role_permissions'] ?? null) === [], json_encode($loginBody['user']['role_permissions'] ?? null));
}

// ═══════════════════ Output ═══════════════════════════════════════════════
echo "\nผ่าน: $PASS\nไม่ผ่าน: $FAIL\n";
if ($FAIL > 0) { echo "\nRESULT: FAIL\n"; exit(1); }
echo "\nRESULT: PASS\n";
