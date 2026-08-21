<?php
/**
 * ทดสอบ change phase-2-post-metrics-sync ด้วย local mock — ไม่มี traffic ไป graph.facebook.com
 *
 * รัน: php scripts/test-phase2-metrics-sync.php
 *
 * ครอบคลุม
 *   M1  cron ซิงก์ FB+IG: views/likes ลง content_items เป็นผลรวมทุกช่องทาง
 *   M2  time-series: content_post_metrics เพิ่มแถวทุกรอบรัน (ไม่ทับ) และผลรวมไม่นับซ้ำ
 *   M3  ปลายทางตอบ 500 → นับเป็น error ไม่เขียน metrics และไม่ทำให้รอบรันล้ม
 *   M4  แถว sent ที่ไม่มี platform_post_id → ข้าม ไม่ error ไม่มี request ออก
 *   M5  platform ที่ไม่รองรับ (lotusdomino) → ข้าม ไม่นับ error ไม่มี request ออก
 *   M6  Facebook ปฏิเสธชื่อ metric (code 100) → ถอยไปยิงแยกทีละตัว เก็บค่าที่ยังได้ + warning
 *   S1  social block ของ ?action=analytics บวกครบทุกช่องทาง แม้ช่องทางถูกลบ (channel_id NULL)
 *   A1  analytics-recalculate เกต <10 → ข้อความไทย + ระบุจำนวนที่ขาด
 *   A2  analytics-recalculate จัดกลุ่มด้วย published_at (สร้าง 09:00 เผยแพร่ 20:00 → ชั่วโมง 20)
 *
 * ข้อมูลทดสอบทั้งหมด (channel/content/queue/metrics/analytics) ถูกลบทิ้งท้ายสคริปต์
 * ก่อนรัน A2 จะสำรอง content_posting_analytics ของ tenant ไว้และคืนค่าให้ตอน cleanup
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("CLI only\n");
}

require_once __DIR__ . '/../api/config.php';
require_once __DIR__ . '/../api/auth.php';

$BASE   = 'http://localhost/flowstack';
$MOCK   = $BASE . '/scripts/dev-mocks/insights-mock.php';
// ต้องใช้ fb_post_metric_names() เพื่อ probe ด้วยชื่อ metric ชุดเดียวกับที่โค้ดจริงขอ
// define ฐาน URL ชี้ mock ก่อน require เพื่อกันไม่ให้โปรเซสนี้ยิงออก graph.facebook.com ได้เลย
define('GRAPH_API_BASE', $MOCK);
require_once __DIR__ . '/../api/lib/insights-fetch.php';
$RUNNER = __DIR__ . '/dev-mocks/run-metrics-sync-with-mock.php';
$HITLOG = sys_get_temp_dir() . '/flowstack-insights-mock-hits.log';
$TENANT = 'tenant-default';

$db = getDB();

$pass = 0; $fail = 0;
function check(string $name, bool $ok, string $detail = ''): void {
    global $pass, $fail;
    if ($ok) { $pass++; echo "  PASS  $name\n"; }
    else     { $fail++; echo "  FAIL  $name" . ($detail !== '' ? " — $detail" : '') . "\n"; }
}
function hits(string $needle): int {
    global $HITLOG;
    if (!is_file($HITLOG)) return 0;
    $n = 0;
    foreach (file($HITLOG, FILE_IGNORE_NEW_LINES) as $line) {
        if (str_contains($line, "\t$needle")) $n++;
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
        CURLOPT_TIMEOUT        => 60,
    ]);
    $res  = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $code, 'body' => json_decode((string) $res, true), 'raw' => (string) $res];
}
function httpGet(string $url, string $token): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ["Authorization: Bearer $token"],
        CURLOPT_TIMEOUT        => 60,
    ]);
    $res  = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $code, 'body' => json_decode((string) $res, true), 'raw' => (string) $res];
}
/** รัน cron เป็นโปรเซสใหม่ (ดูเหตุผลใน run-metrics-sync-with-mock.php) */
function runSync(): string {
    global $RUNNER, $MOCK;
    $cmd = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($RUNNER) . ' ' . escapeshellarg($MOCK) . ' 2>&1';
    return (string) shell_exec($cmd);
}
function firstInt(string $haystack, string $pattern): ?int {
    return preg_match($pattern, $haystack, $m) ? (int) $m[1] : null;
}

// ── ตรวจว่า mock เข้าถึงได้ก่อน (ถ้า Apache ไม่รัน จะได้รู้ทันที) ─────────────────
@unlink($HITLOG);
$probe = curl_init("$MOCK/probe_v1_l1/insights?metric=" . implode(',', fb_post_metric_names()));
curl_setopt_array($probe, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
$probeBody = curl_exec($probe);
$probeCode = (int) curl_getinfo($probe, CURLINFO_HTTP_CODE);
curl_close($probe);
if ($probeCode !== 200 || !str_contains((string) $probeBody, 'post_video_views')) {
    exit("mock เข้าถึงไม่ได้ (code=$probeCode) — ตรวจว่า Apache ของ XAMPP รันอยู่\n");
}
@unlink($HITLOG);

// ── เตรียมข้อมูลทดสอบ ───────────────────────────────────────────────────────────
$u = $db->query("SELECT id, email FROM users WHERE is_active=1 ORDER BY created_at LIMIT 1")->fetch(PDO::FETCH_ASSOC);
if (!$u) exit("ไม่มีผู้ใช้ที่ active — หยุดทดสอบ\n");
$token = generateToken($u['id'], $u['email'], $TENANT);

$mkChannel = function (PDO $db, string $tenant, string $userId, string $platform, ?array $creds) {
    $id = generateUUID();
    $db->prepare(
        "INSERT INTO publish_channels (id,tenant_id,name,platform,endpoint_url,credentials_encrypted,is_active,created_by)
         VALUES (?,?,?,?,?,?,1,?)"
    )->execute([
        $id, $tenant, "[TEST] phase2 $platform", $platform, null,
        $creds ? encryptApiKey(json_encode($creds)) : null, $userId,
    ]);
    return $id;
};
$chFb     = $mkChannel($db, $TENANT, $u['id'], 'facebook',  ['page_id' => '999', 'access_token' => 'mock-token']);
$chIg     = $mkChannel($db, $TENANT, $u['id'], 'instagram', ['ig_user_id' => '888', 'access_token' => 'mock-token']);
$chDomino = $mkChannel($db, $TENANT, $u['id'], 'lotusdomino', null);

/** คอนเทนต์ที่เผยแพร่แล้ว — createdAt/publishedAt ระบุได้เพื่อทดสอบการจัดกลุ่มของ A2 */
$mkContent = function (PDO $db, string $tenant, string $userId, string $title, string $createdAt, string $publishedAt, string $platform = 'facebook') {
    $id = generateUUID();
    $db->prepare(
        "INSERT INTO content_items (id,tenant_id,title,type,platform,status,created_at,published_at,views,likes,created_by)
         VALUES (?,?,?,'social',?, 'published',?,?,0,0,?)"
    )->execute([$id, $tenant, $title, $platform, $createdAt, $publishedAt, $userId]);
    return $id;
};
$mkQueue = function (PDO $db, string $tenant, string $contentId, string $channelId, ?string $postId) {
    $id = generateUUID();
    $db->prepare(
        "INSERT INTO content_publish_queue (id,tenant_id,content_id,channel_id,scheduled_at,status,sent_at,platform_post_id)
         VALUES (?,?,?,?,NOW(),'sent',NOW(),?)"
    )->execute([$id, $tenant, $contentId, $channelId, $postId]);
    return $id;
};

$now       = date('Y-m-d H:i:s');
$cMain     = $mkContent($db, $TENANT, $u['id'], '[TEST] phase2 หลัก',   $now, $now);
$cErr      = $mkContent($db, $TENANT, $u['id'], '[TEST] phase2 err500', $now, $now);
$cNoId     = $mkContent($db, $TENANT, $u['id'], '[TEST] phase2 ไม่มี id', $now, $now);
$cDomino   = $mkContent($db, $TENANT, $u['id'], '[TEST] phase2 domino', $now, $now, 'lotusdomino');
$testItems = [$cMain, $cErr, $cNoId, $cDomino];

$mkQueue($db, $TENANT, $cMain,   $chFb,     'mockfb_v120_l7');   // views 120 likes 7
$mkQueue($db, $TENANT, $cMain,   $chIg,     'mockig_v50_l9');    // views 50  likes 9
$mkQueue($db, $TENANT, $cErr,    $chFb,     'mockfb_err500');
$mkQueue($db, $TENANT, $cNoId,   $chFb,     null);
$mkQueue($db, $TENANT, $cDomino, $chDomino, 'domino_1');

$itemStmt    = $db->prepare("SELECT views, likes FROM content_items WHERE id=?");
$metricsStmt = $db->prepare("SELECT COUNT(*) FROM content_post_metrics WHERE content_item_id=?");
$item        = function (string $id) use ($itemStmt) { $itemStmt->execute([$id]); return $itemStmt->fetch(PDO::FETCH_ASSOC) ?: []; };
$metricRows  = function (string $id) use ($metricsStmt) { $metricsStmt->execute([$id]); return (int) $metricsStmt->fetchColumn(); };

// ── M1-M5: รอบแรก ───────────────────────────────────────────────────────────────
echo "\n[M] cron ซิงก์ metrics — รอบที่ 1\n";
$out1 = runSync();
echo '  stdout: ' . trim(explode("\n", trim($out1))[0]) . "\n";

check('M1 stdout รายงาน 2 entries', firstInt($out1, '/(\d+)\s+entries/i') === 2, $out1);
check('M3 stdout รายงาน 1 error',   firstInt($out1, '/(\d+)\s+error/i')   === 1, $out1);

$main1 = $item($cMain);
check('M1 content_items.views = 120+50 (ผลรวมทุกช่องทาง)', (int) ($main1['views'] ?? 0) === 170, 'views=' . ($main1['views'] ?? 'NULL'));
check('M1 content_items.likes = 7+9 (ผลรวมทุกช่องทาง)',    (int) ($main1['likes'] ?? 0) === 16,  'likes=' . ($main1['likes'] ?? 'NULL'));
check('M1 content_items.views > 0 อย่างน้อย 1 แถว',        (int) ($main1['views'] ?? 0) > 0);
check('M2 time-series 2 แถว (หนึ่งแถวต่อช่องทาง)', $metricRows($cMain) === 2, 'rows=' . $metricRows($cMain));

$chk = $db->prepare("SELECT channel_id, platform, platform_post_id, views, likes FROM content_post_metrics WHERE content_item_id=? ORDER BY platform");
$chk->execute([$cMain]);
$rows = $chk->fetchAll(PDO::FETCH_ASSOC);
check('M2 แถว metrics มี channel_id ครบ', count(array_filter($rows, fn($r) => !empty($r['channel_id']))) === 2, json_encode($rows, JSON_UNESCAPED_UNICODE));
check('M2 แยกค่าต่อ platform ถูกต้อง',
    ($rows[0]['platform'] ?? '') === 'facebook' && (int) ($rows[0]['views'] ?? 0) === 120 && (int) ($rows[0]['likes'] ?? 0) === 7
    && ($rows[1]['platform'] ?? '') === 'instagram' && (int) ($rows[1]['views'] ?? 0) === 50 && (int) ($rows[1]['likes'] ?? 0) === 9,
    json_encode($rows, JSON_UNESCAPED_UNICODE));

check('M3 ปลายทาง 500 → ไม่เขียน metrics', $metricRows($cErr) === 0, 'rows=' . $metricRows($cErr));
check('M3 ปลายทาง 500 → content_items.views ยัง 0', (int) ($item($cErr)['views'] ?? -1) === 0);
check('M3 มี request ออกไปยัง id ที่พัง (พิสูจน์ว่าเรียกจริง)', hits('mockfb_err500') === 1, 'hits=' . hits('mockfb_err500'));

check('M4 แถวไม่มี id โพสต์ → ไม่เขียน metrics', $metricRows($cNoId) === 0);
check('M4 stdout รายงานจำนวนที่ข้ามเพราะไม่มี id', (firstInt($out1, '/ข้าม (\d+) \(ไม่มี id/u') ?? 0) >= 1, $out1);

check('M5 platform ไม่รองรับ → ไม่เขียน metrics', $metricRows($cDomino) === 0);
check('M5 stdout รายงานจำนวนที่ข้ามเพราะ platform', (firstInt($out1, '/ข้าม (\d+) \(platform/u') ?? 0) >= 2, $out1);
check('M5 ไม่มี request ออกไปให้ domino', hits('domino_1') === 0, 'hits=' . hits('domino_1'));
check('M1 request ออกไปช่องทางที่รองรับครบ 2', hits('mockfb_v120_l7') === 1 && hits('mockig_v50_l9') === 1,
    'fb=' . hits('mockfb_v120_l7') . ' ig=' . hits('mockig_v50_l9'));

// ── M2: รอบที่สอง (time-series ต้องเพิ่มแถว แต่ผลรวมไม่นับซ้ำ) ───────────────────
echo "\n[M] cron ซิงก์ metrics — รอบที่ 2\n";
$out2 = runSync();
echo '  stdout: ' . trim(explode("\n", trim($out2))[0]) . "\n";
check('M2 time-series เพิ่มเป็น 4 แถว (ไม่ทับแถวเดิม)', $metricRows($cMain) === 4, 'rows=' . $metricRows($cMain));
$main2 = $item($cMain);
check('M2 ผลรวมไม่ถูกนับซ้ำ (ยัง 170/16)',
    (int) ($main2['views'] ?? 0) === 170 && (int) ($main2['likes'] ?? 0) === 16,
    'views=' . ($main2['views'] ?? 'NULL') . ' likes=' . ($main2['likes'] ?? 'NULL'));

// ── M6: Meta ยกเลิกชื่อ metric บางตัว → ต้องถอยไปยิงแยกทีละตัว ไม่ใช่ล้มทั้งโพสต์ ────
// post_impressions ถูกยกเลิกจริงเมื่อ 21 ส.ค. 2026 (ตอบ error code 100) — Graph API
// ปฏิเสธทั้งคำขอถ้ามีชื่อที่ไม่รู้จักแม้ตัวเดียว จึงต้องเก็บ metric ที่ยังได้ให้ครบ
// mock: id ที่มี deadvv จะแกล้งว่า post_video_views ถูกยกเลิก
echo "\n[M6] metric ถูกยกเลิก → ถอยไปยิงแยกทีละตัว\n";
$cDead       = $mkContent($db, $TENANT, $u['id'], '[TEST] phase2 metric ถูกยกเลิก', $now, $now);
$testItems[] = $cDead;
$mkQueue($db, $TENANT, $cDead, $chFb, 'mockfb_deadvv_v120_l7');
$out3 = runSync();
echo '  stdout: ' . trim(explode("\n", trim($out3))[0]) . "\n";

$deadStmt = $db->prepare("SELECT views, likes FROM content_post_metrics WHERE content_item_id=?");
$deadStmt->execute([$cDead]);
$deadRow = $deadStmt->fetch(PDO::FETCH_ASSOC) ?: [];
check('M6 ยังเขียน metrics ได้ (ไม่ล้มทั้งโพสต์)', $deadRow !== [], 'ไม่มีแถว metrics');
check('M6 likes ที่ยังดึงได้ = 7', (int) ($deadRow['likes'] ?? -1) === 7, 'likes=' . ($deadRow['likes'] ?? 'NULL'));
check('M6 views = 0 เพราะ metric ถูกปฏิเสธ', (int) ($deadRow['views'] ?? -1) === 0, 'views=' . ($deadRow['views'] ?? 'NULL'));
// error 1 รายการที่ยังนับอยู่คือแถว err500 ของ M3 ซึ่งพังทุกรอบ — M6 ต้องไม่เพิ่มจากนั้น
check('M6 นับเป็น entry สำเร็จ ไม่เพิ่ม error',
    firstInt($out3, '/(\d+)\s+entries/i') === 3 && firstInt($out3, '/(\d+)\s+error/i') === 1, $out3);
check('M6 log บอกชื่อ metric ที่ถูกปฏิเสธ',
    str_contains($out3, 'ปฏิเสธ metric') && str_contains($out3, 'post_video_views'), $out3);
check('M6 ยิง 3 ครั้ง (ชุดรวม 1 + แยกทีละตัว 2)', hits('mockfb_deadvv_v120_l7') === 3,
    'hits=' . hits('mockfb_deadvv_v120_l7'));

// ── S1: social block ของ ?action=analytics รวมทุกช่องทาง แม้ช่องทางถูกลบไปแล้ว ─────
// ช่องทางที่ถูกลบทำให้ content_post_metrics.channel_id เป็น NULL (FK SET NULL)
// ถ้าจับกลุ่มด้วย channel_id ตรง ๆ สองโพสต์ที่กำพร้าจะถูกยุบเป็นก้อนเดียวและผลรวมขาด
// (วัดเป็นส่วนต่างจากค่าตั้งต้น เพื่อไม่ให้ข้อมูลอื่นใน tenant ทำให้ผลเพี้ยน)
echo "\n[S1] social block: ช่องทางถูกลบแล้ว (channel_id NULL) ต้องยังบวกครบ\n";
$anaUrl = "$BASE/api/content-analytics.php?action=analytics&from=" . date('Y-m-d', strtotime('-30 day'))
        . '&to=' . date('Y-m-d');
$before = httpGet($anaUrl, $token);
check('S1 endpoint ตอบ 200', $before['code'] === 200, "code={$before['code']}");
$baseViews = (int) ($before['body']['data']['social']['views'] ?? -1);
$baseLikes = (int) ($before['body']['data']['social']['likes'] ?? -1);

$cOrphan     = $mkContent($db, $TENANT, $u['id'], '[TEST] phase2 ช่องทางถูกลบ', $now, $now);
$testItems[] = $cOrphan;
foreach ([['facebook', 'orphan_fb', 100, 5], ['instagram', 'orphan_ig', 40, 3]] as [$p, $pid, $v, $l]) {
    $db->prepare(
        "INSERT INTO content_post_metrics
           (id,tenant_id,content_item_id,channel_id,platform,platform_post_id,views,likes,fetched_at)
         VALUES (?,?,?,NULL,?,?,?,?,NOW())"
    )->execute([generateUUID(), $TENANT, $cOrphan, $p, $pid, $v, $l]);
}
$after = httpGet($anaUrl, $token);
$dViews = (int) ($after['body']['data']['social']['views'] ?? -1) - $baseViews;
$dLikes = (int) ($after['body']['data']['social']['likes'] ?? -1) - $baseLikes;
check('S1 views เพิ่ม 100+40 (ไม่ยุบเป็นแถวเดียว)', $dViews === 140, "delta=$dViews");
check('S1 likes เพิ่ม 5+3 (ไม่ยุบเป็นแถวเดียว)',    $dLikes === 8,   "delta=$dLikes");
check('S1 has_data = true', ($after['body']['data']['social']['has_data'] ?? null) === true);

// ── A1: เกต <10 published ───────────────────────────────────────────────────────
echo "\n[A1] analytics-recalculate: เกต <10 รายการ\n";
$recalcUrl = "$BASE/api/brand-content.php?action=analytics-recalculate";
$res = httpPost($recalcUrl, [], $token);
$err = (string) ($res['body']['error'] ?? '');
check('A1 ตอบ 400', $res['code'] === 400, "code={$res['code']} body={$res['raw']}");
check('A1 ข้อความเป็นภาษาไทย', preg_match('/[\x{0E00}-\x{0E7F}]/u', $err) === 1, $err);
check('A1 ระบุจำนวนที่ขาด', str_contains($err, 'ขาดอีก'), $err);
check('A1 ไม่มีข้อความอังกฤษเดิม', !str_contains($err, 'Need at least 10'), $err);

// ── A2: จัดกลุ่มด้วย published_at ───────────────────────────────────────────────
echo "\n[A2] analytics-recalculate: จัดกลุ่มด้วย published_at\n";
// สำรองข้อมูลจริงก่อน เพราะ endpoint นี้ DELETE ทั้ง tenant ก่อนคำนวณใหม่
$backup = $db->prepare("SELECT * FROM content_posting_analytics WHERE tenant_id=?");
$backup->execute([$TENANT]);
$backupRows = $backup->fetchAll(PDO::FETCH_ASSOC);
echo '  สำรอง content_posting_analytics: ' . count($backupRows) . " แถว\n";

// สร้างให้ครบ 10 รายการ: สร้าง 09:00 เผยแพร่ 20:00 วันเดียวกัน
$day = date('Y-m-d', strtotime('-3 day'));
for ($i = 0; $i < 10; $i++) {
    $testItems[] = $mkContent($db, $TENANT, $u['id'], "[TEST] phase2 grouping $i", "$day 09:00:00", "$day 20:00:00");
}
$res = httpPost($recalcUrl, [], $token);
check('A2 ตอบ 200', $res['code'] === 200, "code={$res['code']} body={$res['raw']}");

$grp = $db->prepare("SELECT hour_of_day, day_of_week, total_posts FROM content_posting_analytics WHERE tenant_id=? ORDER BY total_posts DESC");
$grp->execute([$TENANT]);
$grpRows  = $grp->fetchAll(PDO::FETCH_ASSOC);
$hours    = array_map(fn($r) => (int) $r['hour_of_day'], $grpRows);
$expectDw = (int) date('w', strtotime($day));   // 0=Sun..6=Sat ตรงกับ DAYOFWEEK()-1
check('A2 มีกลุ่มชั่วโมง 20 (เวลาเผยแพร่)', in_array(20, $hours, true), 'hours=' . json_encode($hours));
check('A2 ไม่มีกลุ่มชั่วโมง 9 (เวลาสร้าง)', !in_array(9, $hours, true), 'hours=' . json_encode($hours));
$row20 = array_values(array_filter($grpRows, fn($r) => (int) $r['hour_of_day'] === 20));
check('A2 กลุ่มชั่วโมง 20 นับได้ 10 โพสต์', (int) ($row20[0]['total_posts'] ?? 0) === 10, json_encode($row20));
check('A2 day_of_week ตรงกับวันที่เผยแพร่', (int) ($row20[0]['day_of_week'] ?? -1) === $expectDw,
    'got=' . ($row20[0]['day_of_week'] ?? 'NULL') . " expect=$expectDw");

// ── cleanup ────────────────────────────────────────────────────────────────────
echo "\n[cleanup] ลบข้อมูลทดสอบที่สคริปต์นี้สร้าง\n";
$in = implode(',', array_fill(0, count($testItems), '?'));
$delQ = $db->prepare("DELETE FROM content_publish_queue WHERE content_id IN ($in)");
$delQ->execute($testItems);
echo '  queue rows ลบ: ' . $delQ->rowCount() . "\n";
// content_post_metrics ถูกลบตาม FK ON DELETE CASCADE ของ content_items
$delC = $db->prepare("DELETE FROM content_items WHERE id IN ($in)");
$delC->execute($testItems);
echo '  content_items ลบ: ' . $delC->rowCount() . "\n";
$delCh = $db->prepare("DELETE FROM publish_channels WHERE id IN (?,?,?)");
$delCh->execute([$chFb, $chIg, $chDomino]);
echo '  publish_channels ลบ: ' . $delCh->rowCount() . "\n";

// คืนค่า content_posting_analytics ให้เหมือนก่อนทดสอบ
$db->prepare("DELETE FROM content_posting_analytics WHERE tenant_id=?")->execute([$TENANT]);
if ($backupRows) {
    $cols = array_keys($backupRows[0]);
    $ins  = $db->prepare(
        'INSERT INTO content_posting_analytics (' . implode(',', $cols) . ') VALUES ('
        . implode(',', array_fill(0, count($cols), '?')) . ')'
    );
    foreach ($backupRows as $r) $ins->execute(array_values($r));
}
echo '  คืน content_posting_analytics: ' . count($backupRows) . " แถว\n";

$leftMetrics = (int) $db->query("SELECT COUNT(*) FROM content_post_metrics")->fetchColumn();
echo "  content_post_metrics ที่เหลือในระบบ: $leftMetrics แถว\n";
@unlink($HITLOG);

echo "\n=== สรุป: PASS $pass / FAIL $fail ===\n";
exit($fail === 0 ? 0 : 1);
