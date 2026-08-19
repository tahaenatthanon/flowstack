<?php
/**
 * ทดสอบ change harden-publish-dispatch ด้วย local mock — ไม่มี traffic ไป production
 *
 * รัน: php scripts/test-publish-dispatch-hardening.php
 *
 * ครอบคลุม
 *   U1-U4  ชั้น dispatch: HTTP 500/404 = ล้มเหลว, 200 = สำเร็จ, cURL error = ล้มเหลว
 *   E1     approval gate: approved_at IS NULL → 422 ไม่มีแถวคิว ไม่มี request ออก
 *   E2     end-to-end 500: แถว failed + error_msg มีเลข status + response_snippet + content ไม่ published
 *   E3     end-to-end 200: แถว sent + platform_post_id + response_snippet
 *   E4     idempotency: ยิงซ้ำคู่เดิมในกรอบ 10 นาที → skipped ไม่มีแถวใหม่ ไม่มี request ออก
 *   E5     แถว failed ไม่ถูกบล็อก → ลองส่งใหม่ได้
 *
 * ข้อมูลทดสอบทั้งหมด (channel/content/queue) ถูกลบทิ้งท้ายสคริปต์
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("CLI only\n");
}

require_once __DIR__ . '/../api/config.php';
require_once __DIR__ . '/../api/auth.php';
require_once __DIR__ . '/../api/lib/publish-dispatch.php';

$BASE     = 'http://localhost/flowstack';
$MOCK     = $BASE . '/scripts/dev-mocks/publish-mock.php';
$HITLOG   = sys_get_temp_dir() . '/flowstack-publish-mock-hits.log';
$TENANT   = 'tenant-default';

$db = getDB();

$pass = 0;
$fail = 0;
function check(string $name, bool $ok, string $detail = ''): void {
    global $pass, $fail;
    if ($ok) { $pass++; echo "  PASS  $name\n"; }
    else     { $fail++; echo "  FAIL  $name" . ($detail !== '' ? " — $detail" : '') . "\n"; }
}
function hits(string $tag): int {
    global $HITLOG;
    if (!is_file($HITLOG)) return 0;
    $n = 0;
    foreach (file($HITLOG, FILE_IGNORE_NEW_LINES) as $line) {
        if (strpos($line, "\t$tag\t") !== false) $n++;
    }
    return $n;
}
function httpPost(string $url, array $payload, string $token): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json', "Authorization: Bearer $token"],
        CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_TIMEOUT        => 30,
    ]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    return ['code' => (int) $code, 'body' => json_decode((string) $res, true), 'raw' => (string) $res, 'curl_error' => $err];
}
/** jsonResponse() ห่อ payload ไว้ใต้ key `data` (api/config.php:163) — frontend ก็ unwrap ที่ src/lib/api.ts:179 */
function channelResult(array $res, int $i = 0): array {
    return $res['body']['data']['results'][$i] ?? [];
}

// ── ชั้น dispatch (unit) ────────────────────────────────────────────────────────
echo "\n[U] ชั้น dispatch: dispatch_lotusdomino()\n";

$mkChannel = fn(string $url) => ['id' => 'unit', 'platform' => 'lotusdomino', 'endpoint_url' => $url, 'credentials_encrypted' => null, 'name' => 'unit-mock'];

$r500 = dispatch_lotusdomino($mkChannel("$MOCK?code=500&tag=u1"), [], 'หัวข้อทดสอบ', 'เนื้อหาทดสอบ', 'สรุป', '');
check('U1 HTTP 500 → success=false', ($r500['success'] ?? null) === false, json_encode($r500, JSON_UNESCAPED_UNICODE));
check('U1 error มีเลข 500', str_contains((string) ($r500['error'] ?? ''), '500'), (string) ($r500['error'] ?? ''));
check('U1 ไม่มี platform_post_id', !isset($r500['platform_post_id']));
check('U1 response_snippet ไม่ว่าง', extract_response_snippet($r500) !== '', extract_response_snippet($r500));

$r404 = dispatch_lotusdomino($mkChannel("$MOCK?code=404&tag=u2"), [], 'หัวข้อ', 'เนื้อหา', 'สรุป', '');
check('U2 HTTP 404 → success=false', ($r404['success'] ?? null) === false);
check('U2 ไม่มี platform_post_id', !isset($r404['platform_post_id']));

$r200 = dispatch_lotusdomino($mkChannel("$MOCK?code=200&tag=u3"), [], 'หัวข้อ', 'เนื้อหา', 'สรุป', '');
check('U3 HTTP 200 → success=true', ($r200['success'] ?? null) === true, json_encode($r200, JSON_UNESCAPED_UNICODE));
check('U3 มี platform_post_id', !empty($r200['platform_post_id']), (string) ($r200['platform_post_id'] ?? ''));
check('U3 response_snippet ไม่ว่าง', extract_response_snippet($r200) !== '');

$rErr = dispatch_lotusdomino($mkChannel('http://127.0.0.1:9/closed-port'), [], 'หัวข้อ', 'เนื้อหา', 'สรุป', '');
check('U4 cURL error → success=false', ($rErr['success'] ?? null) === false);
check('U4 error แยกได้ว่าเป็น cURL error', str_starts_with((string) ($rErr['error'] ?? ''), 'cURL error'), (string) ($rErr['error'] ?? ''));

// ── เตรียมข้อมูลทดสอบ ───────────────────────────────────────────────────────────
$u = $db->query("SELECT id, email FROM users WHERE is_active=1 ORDER BY created_at LIMIT 1")->fetch(PDO::FETCH_ASSOC);
if (!$u) { exit("ไม่มีผู้ใช้ที่ active — หยุดทดสอบ\n"); }
$token = generateToken($u['id'], $u['email'], $TENANT);

$chFail = generateUUID();
$chOk   = generateUUID();
$db->prepare("INSERT INTO publish_channels (id,tenant_id,name,platform,endpoint_url,is_active,created_by) VALUES (?,?,?,?,?,1,?)")
   ->execute([$chFail, $TENANT, '[TEST] mock 500', 'lotusdomino', "$MOCK?code=500&tag=e2", $u['id']]);
$db->prepare("INSERT INTO publish_channels (id,tenant_id,name,platform,endpoint_url,is_active,created_by) VALUES (?,?,?,?,?,1,?)")
   ->execute([$chOk, $TENANT, '[TEST] mock 200', 'lotusdomino', "$MOCK?code=200&tag=e3", $u['id']]);

$mkContent = function (PDO $db, string $tenant, string $userId, bool $approved) {
    $id = generateUUID();
    $db->prepare(
        "INSERT INTO content_items (id,tenant_id,title,type,status,approved_at,caption,article_content,created_by)
         VALUES (?,?,?,'article',?,?,?,?,?)"
    )->execute([
        $id, $tenant, '[TEST] harden-publish-dispatch', $approved ? 'approved' : 'draft',
        $approved ? date('Y-m-d H:i:s') : null,
        'แคปชันทดสอบ', json_encode(['html' => '<p>เนื้อหาทดสอบ</p>', 'title' => 'ทดสอบ', 'excerpt' => 'สรุป'], JSON_UNESCAPED_UNICODE),
        $userId,
    ]);
    return $id;
};
$cUnapproved = $mkContent($db, $TENANT, $u['id'], false);
$cFail       = $mkContent($db, $TENANT, $u['id'], true);
$cOk         = $mkContent($db, $TENANT, $u['id'], true);

$queueCount = function (PDO $db, string $contentId, string $channelId) {
    $s = $db->prepare("SELECT COUNT(*) FROM content_publish_queue WHERE content_id=? AND channel_id=?");
    $s->execute([$contentId, $channelId]);
    return (int) $s->fetchColumn();
};
$queueRow = function (PDO $db, string $contentId, string $channelId) {
    $s = $db->prepare("SELECT * FROM content_publish_queue WHERE content_id=? AND channel_id=? ORDER BY created_at DESC, id DESC LIMIT 1");
    $s->execute([$contentId, $channelId]);
    return $s->fetch(PDO::FETCH_ASSOC) ?: [];
};

$url = "$BASE/api/content-publish.php";

// ── E1 approval gate ───────────────────────────────────────────────────────────
echo "\n[E1] approval gate: approved_at IS NULL\n";
$hitsBefore = hits('e2');
$res = httpPost($url, ['action' => 'send_now', 'content_id' => $cUnapproved, 'channel_ids' => [$chFail]], $token);
check('E1 ตอบ 422', $res['code'] === 422, "code={$res['code']} body={$res['raw']}");
check('E1 ข้อความพูดเรื่องอนุมัติ', str_contains((string) ($res['body']['error'] ?? ''), 'อนุมัติ'), (string) ($res['body']['error'] ?? ''));
check('E1 ไม่มีแถวคิวถูกสร้าง', $queueCount($db, $cUnapproved, $chFail) === 0);
check('E1 ไม่มี request ออกไปยังปลายทาง', hits('e2') === $hitsBefore, 'hits ' . $hitsBefore . ' → ' . hits('e2'));

// ── E2 end-to-end HTTP 500 ─────────────────────────────────────────────────────
echo "\n[E2] end-to-end: ปลายทางตอบ 500\n";
$res = httpPost($url, ['action' => 'send_now', 'content_id' => $cFail, 'channel_ids' => [$chFail]], $token);
$row0 = channelResult($res);
check('E2 ตอบ 200', $res['code'] === 200, "code={$res['code']} body={$res['raw']}");
check('E2 results[0].status = failed', ($row0['status'] ?? '') === 'failed', json_encode($row0, JSON_UNESCAPED_UNICODE));
$q = $queueRow($db, $cFail, $chFail);
check('E2 แถวคิวเป็น failed', ($q['status'] ?? '') === 'failed', (string) ($q['status'] ?? ''));
check('E2 error_msg มีเลข 500', str_contains((string) ($q['error_msg'] ?? ''), '500'), (string) ($q['error_msg'] ?? ''));
check('E2 response_snippet ไม่เป็น NULL', ($q['response_snippet'] ?? null) !== null && $q['response_snippet'] !== '', (string) ($q['response_snippet'] ?? 'NULL'));
$st = $db->prepare("SELECT status FROM content_items WHERE id=?"); $st->execute([$cFail]);
check('E2 content ไม่กลายเป็น published', $st->fetchColumn() !== 'published');

// ── E3 end-to-end HTTP 200 ─────────────────────────────────────────────────────
echo "\n[E3] end-to-end: ปลายทางตอบ 200\n";
$res = httpPost($url, ['action' => 'send_now', 'content_id' => $cOk, 'channel_ids' => [$chOk]], $token);
$row0 = channelResult($res);
check('E3 results[0].status = success', ($row0['status'] ?? '') === 'success', json_encode($row0, JSON_UNESCAPED_UNICODE));
$q = $queueRow($db, $cOk, $chOk);
check('E3 แถวคิวเป็น sent', ($q['status'] ?? '') === 'sent', (string) ($q['status'] ?? ''));
check('E3 มี platform_post_id', str_starts_with((string) ($q['platform_post_id'] ?? ''), 'lotusdomino_'), (string) ($q['platform_post_id'] ?? ''));
check('E3 response_snippet ไม่เป็น NULL', ($q['response_snippet'] ?? null) !== null && $q['response_snippet'] !== '', (string) ($q['response_snippet'] ?? 'NULL'));

// ── E4 idempotency ─────────────────────────────────────────────────────────────
echo "\n[E4] idempotency: ยิงซ้ำคู่เดิมทันที\n";
$rowsBefore = $queueCount($db, $cOk, $chOk);
$hitsBefore = hits('e3');
$res = httpPost($url, ['action' => 'send_now', 'content_id' => $cOk, 'channel_ids' => [$chOk]], $token);
$row0 = channelResult($res);
check('E4 results[0].status = skipped', ($row0['status'] ?? '') === 'skipped', json_encode($row0, JSON_UNESCAPED_UNICODE));
check('E4 มีเหตุผลภาษาไทย', ($row0['reason'] ?? '') !== '', (string) ($row0['reason'] ?? ''));
check('E4 ไม่มีแถวใหม่', $queueCount($db, $cOk, $chOk) === $rowsBefore, "before=$rowsBefore after=" . $queueCount($db, $cOk, $chOk));
check('E4 ไม่มี request ออกไปยังปลายทาง', hits('e3') === $hitsBefore, 'hits ' . $hitsBefore . ' → ' . hits('e3'));

// ── E5 แถว failed ไม่ถูกบล็อก ───────────────────────────────────────────────────
echo "\n[E5] แถว failed ยังลองส่งใหม่ได้\n";
$rowsBefore = $queueCount($db, $cFail, $chFail);
$hitsBefore = hits('e2');
$res = httpPost($url, ['action' => 'send_now', 'content_id' => $cFail, 'channel_ids' => [$chFail]], $token);
$row0 = channelResult($res);
check('E5 ไม่ถูกข้าม (status = failed จากปลายทาง)', ($row0['status'] ?? '') === 'failed', json_encode($row0, JSON_UNESCAPED_UNICODE));
check('E5 มีแถวใหม่ถูกสร้าง', $queueCount($db, $cFail, $chFail) === $rowsBefore + 1, "before=$rowsBefore after=" . $queueCount($db, $cFail, $chFail));
check('E5 มี request ออกไปจริง', hits('e2') > $hitsBefore, 'hits ' . $hitsBefore . ' → ' . hits('e2'));

// ── cleanup ────────────────────────────────────────────────────────────────────
echo "\n[cleanup] ลบข้อมูลทดสอบที่สคริปต์นี้สร้าง\n";
$contentIds = [$cUnapproved, $cFail, $cOk];
$in = implode(',', array_fill(0, count($contentIds), '?'));
$delQ = $db->prepare("DELETE FROM content_publish_queue WHERE content_id IN ($in)");
$delQ->execute($contentIds);
echo "  queue rows ลบ: " . $delQ->rowCount() . "\n";
$delC = $db->prepare("DELETE FROM content_items WHERE id IN ($in)");
$delC->execute($contentIds);
echo "  content_items ลบ: " . $delC->rowCount() . "\n";
$delCh = $db->prepare("DELETE FROM publish_channels WHERE id IN (?,?)");
$delCh->execute([$chFail, $chOk]);
echo "  publish_channels ลบ: " . $delCh->rowCount() . "\n";
@unlink($HITLOG);

echo "\n=== สรุป: PASS $pass / FAIL $fail ===\n";
exit($fail === 0 ? 0 : 1);
