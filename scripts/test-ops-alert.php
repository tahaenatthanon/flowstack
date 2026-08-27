<?php
/**
 * ทดสอบ api/lib/ops-alert.php กับฐานข้อมูลจริงในเครื่อง
 *
 * รัน: /c/xampp/php/php.exe scripts/test-ops-alert.php [--email=<ที่อยู่>] [--cleanup]
 *      (php บน PATH ของเครื่องนี้ไม่มี pdo_mysql — ต้องใช้ php ของ XAMPP)
 *
 * ครอบคลุม
 *   T1  ops_alert() ระดับงาน (tenant = null) → in-app ถึงแอดมินของ tenant ที่มีช่องทางเปิดใช้
 *   T2  เรียกคีย์เดิมซ้ำทันที → ถูกกลืนด้วยเพดาน 60 นาที (ไม่มีแถวใหม่ ไม่ขยับ send_count)
 *   T3  ops_alert_resolve() → ตั้ง resolved_at และส่ง "กลับมาปกติ" หนึ่งรอบ
 *   T4  แจ้งคีย์เดิมอีกครั้งหลังปิดเรื่อง → ส่งทันทีโดยไม่ติดเพดานของรอบก่อน (spec 2.4)
 *   T5  ops_alert_resolve() คีย์ที่ไม่เคยแจ้ง → ไม่สร้างแถว ไม่ส่งอะไร
 *   T6  เส้นทางอีเมล — ต้องระบุ --email=<ที่อยู่> เท่านั้น (ดูเหตุผลด้านล่าง)
 *   T7  ข้อบังคับข้อ 3 ของไฟล์: ไม่พิมพ์อะไรออก stdout เลย และไม่มีข้อความรูปแบบ
 *       "<เลข> error" / "<เลข> entries" ที่จะทำให้ preg_match ใน cron-runner.php อ่านผิด
 *
 * ⚠️ ทำไม T6 ต้องมีธง: SMTP ของเครื่องนี้ตั้งค่าไว้จริง (smtp2go + รหัสผ่าน) การเรียก
 *    ops_alert() แบบ urgent = true จะส่งอีเมลถึงแอดมินจริงทั้ง 5 คนทันที ซึ่งถอนคืนไม่ได้
 *    T6 จึงเรียก ops_alert_deliver() ตรง ๆ ด้วยผู้รับที่ประกอบเองหนึ่งคน โดยใช้ที่อยู่
 *    จากธง --email เท่านั้น ไม่มีธง = ข้ามและรายงานว่าข้ามเพราะอะไร
 *
 * ⚠️ สคริปต์นี้ไม่ลบข้อมูลทดสอบให้เอง เพราะขั้นตอนตรวจงาน (task 6.2) ต้องเห็นแถวจริงใน
 *    ai_notifications / notification_log / ops_alerts ก่อน จบการรันจะพิมพ์ SQL ล้างข้อมูลไว้ให้
 *    หรือรันซ้ำด้วย --cleanup เพื่อให้สคริปต์ลบเอง ทุกแถวที่สร้างมีเครื่องหมาย
 *    [TEST-OPS-ALERT] นำหน้าและคีย์ขึ้นต้นด้วย ops_test: จึงลบได้แบบไม่โดนข้อมูลจริง
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("CLI only\n");
}

require_once __DIR__ . '/../api/config.php';
require_once __DIR__ . '/../api/lib/ops-alert.php';

define('OPSTEST_MARK',   '[TEST-OPS-ALERT]');
define('OPSTEST_KEY_A',  'ops_test:alert-a');
define('OPSTEST_KEY_B',  'ops_test:never-alerted-b');

// ── อาร์กิวเมนต์ ───────────────────────────────────────────────────────────────
$emailTo = '';
$doClean = false;
foreach (array_slice($argv, 1) as $arg) {
    if ($arg === '--cleanup')                     { $doClean = true; continue; }
    if (strpos($arg, '--email=') === 0)           { $emailTo = trim(substr($arg, 8)); continue; }
    if ($arg === '--help' || $arg === '-h') {
        echo "รัน: php scripts/test-ops-alert.php [--email=<ที่อยู่>] [--cleanup]\n";
        exit(0);
    }
    fwrite(STDERR, "ไม่รู้จักอาร์กิวเมนต์: {$arg}\n");
    exit(2);
}

$db = getDB();

$pass = 0; $fail = 0;
function check(string $name, bool $ok, string $detail = ''): void {
    global $pass, $fail;
    if ($ok) { $pass++; echo "  PASS  $name\n"; }
    else     { $fail++; echo "  FAIL  $name" . ($detail !== '' ? " — $detail" : '') . "\n"; }
}

/** จำนวนแถวที่สคริปต์นี้สร้าง แยกตามปลายทาง — ใช้เทียบก่อน/หลังทุกขั้น */
function opstest_counts(PDO $db): array {
    $mark = OPSTEST_MARK . '%';
    $one = function (string $sql) use ($db, $mark): int {
        $s = $db->prepare($sql);
        $s->execute([$mark]);
        return (int) $s->fetchColumn();
    };
    return [
        'inapp'     => $one("SELECT COUNT(*) FROM ai_notifications WHERE title LIKE ?"),
        'log_inapp' => $one("SELECT COUNT(*) FROM notification_log WHERE message LIKE ? AND channel = 'in_app'"),
        'log_email' => $one("SELECT COUNT(*) FROM notification_log WHERE message LIKE ? AND channel = 'email'"),
        'log_line'  => $one("SELECT COUNT(*) FROM notification_log WHERE message LIKE ? AND channel = 'line'"),
        'log_fail'  => $one("SELECT COUNT(*) FROM notification_log WHERE message LIKE ? AND status  = 'failed'"),
    ];
}

/** ผลต่างของสองสแนปช็อต */
function opstest_delta(array $before, array $after): array {
    $d = [];
    foreach ($after as $k => $v) $d[$k] = $v - ($before[$k] ?? 0);
    return $d;
}

function opstest_fmt(array $d): string {
    $bits = [];
    foreach ($d as $k => $v) $bits[] = "$k=$v";
    return implode(' ', $bits);
}

/** แถว ops_alerts ของคีย์หนึ่ง (คืน null ถ้าไม่มี) */
function opstest_row(PDO $db, string $key, string $tenantId): ?array {
    $s = $db->prepare("SELECT id, first_seen_at, last_sent_at, send_count, resolved_at FROM ops_alerts WHERE alert_key = ? AND tenant_id = ? LIMIT 1");
    $s->execute([$key, $tenantId]);
    $r = $s->fetch();
    return $r ?: null;
}

/**
 * เรียกฟังก์ชันแจ้งเตือนแล้วดักทุกอย่างที่มันพิมพ์ออก stdout
 * ข้อบังคับข้อ 3 ของ ops-alert.php คือห้ามพิมพ์อะไรออก stdout เลย เพราะ cron-runner.php
 * อ่าน records_processed/errors จาก output ของงานด้วย preg_match แบบ match แรกชนะ
 */
function opstest_capture(callable $fn): string {
    ob_start();
    try { $fn(); } finally { $out = ob_get_clean(); }
    return (string) $out;
}

// ── โหมดล้างข้อมูล ─────────────────────────────────────────────────────────────
if ($doClean) {
    echo "=== ล้างข้อมูลทดสอบ ===\n";
    $mark = OPSTEST_MARK . '%';
    $d1 = $db->prepare("DELETE FROM ai_notifications WHERE title LIKE ?");   $d1->execute([$mark]);
    echo "  ai_notifications ลบ: " . $d1->rowCount() . "\n";
    $d2 = $db->prepare("DELETE FROM notification_log WHERE message LIKE ?"); $d2->execute([$mark]);
    echo "  notification_log ลบ: " . $d2->rowCount() . "\n";
    $d3 = $db->prepare("DELETE FROM ops_alerts WHERE alert_key LIKE 'ops_test:%'"); $d3->execute();
    echo "  ops_alerts ลบ: " . $d3->rowCount() . "\n";
    exit(0);
}

// ── สภาพแวดล้อมที่ทดสอบอยู่บน ──────────────────────────────────────────────────
echo "=== สภาพแวดล้อม ===\n";
$targets = ops_alert_tenants_with_active_channels($db);
echo "  tenant ที่มีช่องทางเปิดใช้: " . (implode(', ', $targets) ?: '(ไม่มี)') . "\n";

$adminCount = [];
foreach ($targets as $tid) {
    $adminCount[$tid] = count(ops_alert_recipients($db, $tid));
    echo "  แอดมินของ {$tid}: {$adminCount[$tid]} คน\n";
}
$expectPerAlert = array_sum($adminCount);

// แอดมินของ tenant ที่ "ไม่ใช่" เป้าหมาย — ต้องไม่ได้รับแถวใด ๆ เลย
$foreign = [];
$all = $db->query(
    "SELECT tu.tenant_id, tu.user_id
       FROM tenant_users tu JOIN users u ON u.id = tu.user_id
      WHERE tu.is_admin = 1 AND u.is_active = 1"
)->fetchAll();
foreach ($all as $r) {
    if (!in_array((string) $r['tenant_id'], $targets, true)) $foreign[] = (string) $r['user_id'];
}
echo "  แอดมินของ tenant อื่น (ต้องไม่ได้รับ): " . count($foreign) . " คน\n";
echo "  เพดานแจ้งซ้ำ: " . OPS_ALERT_RATE_LIMIT_MINUTES . " นาที\n";
echo "  ปลายทาง LINE (" . OPS_ALERT_LINE_TARGETS_KEY . "): " . count(ops_alert_line_targets($db)) . " ปลายทาง\n";

if ($expectPerAlert < 1) {
    fwrite(STDERR, "ไม่มีแอดมินให้ส่งถึงเลย — ทดสอบต่อไม่ได้\n");
    exit(2);
}

// เริ่มจากสถานะสะอาด เพื่อให้ผลต่างของแต่ละขั้นอ่านได้ตรง ๆ
$db->prepare("DELETE FROM ops_alerts WHERE alert_key LIKE 'ops_test:%'")->execute();

$stdoutAll = '';

// ── T1 แจ้งเตือนระดับงาน (tenant = null) ───────────────────────────────────────
echo "\n=== T1 ops_alert() ครั้งแรก (urgent = false) ===\n";
$b = opstest_counts($db);
$stdoutAll .= opstest_capture(function () use ($db) {
    ops_alert(
        $db, null, OPSTEST_KEY_A,
        OPSTEST_MARK . ' ทดสอบระบบแจ้งเตือน — ไม่ใช่ความล้มเหลวจริง',
        "สคริปต์ scripts/test-ops-alert.php สร้างข้อความนี้เพื่อพิสูจน์เส้นทางส่ง\nลบทิ้งได้ทันที",
        false
    );
});
$a = opstest_counts($db);
$d = opstest_delta($b, $a);
echo "  ผลต่าง: " . opstest_fmt($d) . "\n";
check('T1 in-app หนึ่งแถวต่อแอดมินหนึ่งคน', $d['inapp'] === $expectPerAlert, "คาด {$expectPerAlert} ได้ {$d['inapp']}");
check('T1 notification_log in_app ตรงกับจำนวนที่ส่ง', $d['log_inapp'] === $expectPerAlert, "คาด {$expectPerAlert} ได้ {$d['log_inapp']}");
check('T1 ไม่มีอีเมลออกเพราะ urgent = false', $d['log_email'] === 0, "ได้ {$d['log_email']}");
check('T1 ไม่มีการส่งที่ล้มเหลว', $d['log_fail'] === 0, "ได้ {$d['log_fail']}");
check('T1 ไม่ยิง LINE เพราะปลายทางว่าง', $d['log_line'] === 0, "ได้ {$d['log_line']}");

$row1 = opstest_row($db, OPSTEST_KEY_A, $targets[0]);
check('T1 สร้างแถว ops_alerts', $row1 !== null);
check('T1 send_count = 1', $row1 && (int) $row1['send_count'] === 1, $row1 ? "ได้ {$row1['send_count']}" : 'ไม่มีแถว');
check('T1 last_sent_at ถูกลงเวลา', $row1 && $row1['last_sent_at'] !== null);
check('T1 resolved_at ยังว่าง', $row1 && $row1['resolved_at'] === null);

// แอดมินของ tenant อื่นต้องไม่มีแถวเลย
$foreignRows = 0;
if ($foreign) {
    $in = implode(',', array_fill(0, count($foreign), '?'));
    $s = $db->prepare("SELECT COUNT(*) FROM ai_notifications WHERE title LIKE ? AND user_id IN ($in)");
    $s->execute(array_merge([OPSTEST_MARK . '%'], $foreign));
    $foreignRows = (int) $s->fetchColumn();
}
check('T1 แอดมินของ tenant อื่นไม่ได้รับแถว', $foreignRows === 0, "ได้ {$foreignRows}");

$inTargets = implode(',', array_fill(0, count($targets), '?'));
$s = $db->prepare("SELECT COUNT(*) FROM ai_notifications WHERE title LIKE ? AND tenant_id NOT IN ($inTargets)");
$s->execute(array_merge([OPSTEST_MARK . '%'], $targets));
$otherTenantRows = (int) $s->fetchColumn();
check('T1 ไม่มีแถวที่ tenant_id อยู่นอกเป้าหมาย', $otherTenantRows === 0, "ได้ {$otherTenantRows}");

// ── T2 คีย์เดิมซ้ำทันที → ต้องติดเพดาน ─────────────────────────────────────────
echo "\n=== T2 ops_alert() คีย์เดิมซ้ำทันที ===\n";
$b = opstest_counts($db);
$sentBefore = $row1['last_sent_at'] ?? null;
$stdoutAll .= opstest_capture(function () use ($db) {
    ops_alert(
        $db, null, OPSTEST_KEY_A,
        OPSTEST_MARK . ' ทดสอบระบบแจ้งเตือน — ครั้งที่สองต้องถูกกลืน',
        'ถ้าเห็นข้อความนี้ในแอป แปลว่าเพดานแจ้งซ้ำไม่ทำงาน',
        false
    );
});
$a = opstest_counts($db);
$d = opstest_delta($b, $a);
$row2 = opstest_row($db, OPSTEST_KEY_A, $targets[0]);
echo "  ผลต่าง: " . opstest_fmt($d) . "\n";
check('T2 ไม่มีแถว in-app ใหม่', $d['inapp'] === 0, "ได้ {$d['inapp']}");
check('T2 ไม่มีแถว notification_log ใหม่', $d['log_inapp'] === 0 && $d['log_email'] === 0, opstest_fmt($d));
check('T2 send_count ยังเป็น 1', $row2 && (int) $row2['send_count'] === 1, $row2 ? "ได้ {$row2['send_count']}" : 'ไม่มีแถว');
check('T2 last_sent_at ไม่ขยับ', $row2 && $row2['last_sent_at'] === $sentBefore, $row2 ? "{$sentBefore} → {$row2['last_sent_at']}" : 'ไม่มีแถว');

// ── T3 ปิดเรื่อง ───────────────────────────────────────────────────────────────
echo "\n=== T3 ops_alert_resolve() ===\n";
$b = opstest_counts($db);
$stdoutAll .= opstest_capture(function () use ($db) {
    ops_alert_resolve(
        $db, null, OPSTEST_KEY_A,
        OPSTEST_MARK . ' ทดสอบระบบแจ้งเตือน — กลับมาปกติ',
        'ปิดเรื่องทดสอบ'
    );
});
$a = opstest_counts($db);
$d = opstest_delta($b, $a);
$row3 = opstest_row($db, OPSTEST_KEY_A, $targets[0]);
echo "  ผลต่าง: " . opstest_fmt($d) . "\n";
check('T3 ส่ง "กลับมาปกติ" หนึ่งรอบถึงแอดมินทุกคน', $d['inapp'] === $expectPerAlert, "คาด {$expectPerAlert} ได้ {$d['inapp']}");
check('T3 ตั้ง resolved_at', $row3 && $row3['resolved_at'] !== null);
check('T3 ไม่เพิ่ม send_count', $row3 && (int) $row3['send_count'] === 1, $row3 ? "ได้ {$row3['send_count']}" : 'ไม่มีแถว');

// ── T4 แจ้งซ้ำหลังปิดเรื่อง → ต้องไม่ติดเพดานของรอบก่อน ────────────────────────
echo "\n=== T4 ops_alert() คีย์เดิมหลังปิดเรื่อง ===\n";
$b = opstest_counts($db);
$stdoutAll .= opstest_capture(function () use ($db) {
    ops_alert(
        $db, null, OPSTEST_KEY_A,
        OPSTEST_MARK . ' ทดสอบระบบแจ้งเตือน — ล้มอีกครั้งหลังปิดเรื่อง',
        'เรื่องที่ปิดแล้วกลับมาล้มอีกต้องแจ้งทันที ไม่รอเพดานของรอบก่อน',
        false
    );
});
$a = opstest_counts($db);
$d = opstest_delta($b, $a);
$row4 = opstest_row($db, OPSTEST_KEY_A, $targets[0]);
echo "  ผลต่าง: " . opstest_fmt($d) . "\n";
check('T4 ส่งทันทีแม้ last_sent_at ห่างไม่ถึงเพดาน', $d['inapp'] === $expectPerAlert, "คาด {$expectPerAlert} ได้ {$d['inapp']}");
check('T4 resolved_at ถูกล้างกลับเป็นว่าง', $row4 && $row4['resolved_at'] === null);
check('T4 send_count เพิ่มเป็น 2', $row4 && (int) $row4['send_count'] === 2, $row4 ? "ได้ {$row4['send_count']}" : 'ไม่มีแถว');

// ── T5 ปิดเรื่องที่ไม่เคยแจ้ง ──────────────────────────────────────────────────
echo "\n=== T5 ops_alert_resolve() คีย์ที่ไม่เคยแจ้ง ===\n";
$b = opstest_counts($db);
$stdoutAll .= opstest_capture(function () use ($db) {
    ops_alert_resolve(
        $db, null, OPSTEST_KEY_B,
        OPSTEST_MARK . ' ไม่ควรมีใครได้รับข้อความนี้',
        'ปิดเรื่องที่ไม่เคยเปิด'
    );
});
$a = opstest_counts($db);
$d = opstest_delta($b, $a);
echo "  ผลต่าง: " . opstest_fmt($d) . "\n";
check('T5 ไม่ส่งอะไรเลย', $d['inapp'] === 0 && $d['log_inapp'] === 0, opstest_fmt($d));
check('T5 ไม่สร้างแถว ops_alerts', opstest_row($db, OPSTEST_KEY_B, $targets[0]) === null);

// ── T6 เส้นทางอีเมล ────────────────────────────────────────────────────────────
echo "\n=== T6 เส้นทางอีเมล (urgent = true) ===\n";
if ($emailTo === '') {
    echo "  SKIP  ไม่ได้ระบุ --email=<ที่อยู่>\n";
    echo "        SMTP ของเครื่องนี้ตั้งค่าไว้จริง (mail_host = "
       . (string) $db->query("SELECT `value` FROM settings WHERE `key`='mail_host'")->fetchColumn()
       . ") การทดสอบ urgent กับผู้รับจริงจะส่งอีเมลถึงแอดมิน {$expectPerAlert} คนซึ่งถอนคืนไม่ได้\n";
    echo "        รันซ้ำด้วย --email=<ที่อยู่ของคุณ> เพื่อทดสอบเส้นทางนี้กับผู้รับหนึ่งคน\n";
} else {
    $adminRow = ops_alert_recipients($db, $targets[0])[0];
    // ผู้รับประกอบเอง: user_id ของแอดมินจริง (ให้แถวใน ai_notifications/notification_log
    // อ้างผู้ใช้ที่มีอยู่) แต่ที่อยู่อีเมลมาจากธง ไม่ใช่ users.email ของคนนั้น
    $recipient = [
        'user_id'      => $adminRow['user_id'],
        'tenant_id'    => $targets[0],
        'email'        => $emailTo,
        'display_name' => 'ผู้ทดสอบ',
    ];
    echo "  ส่งถึง: {$emailTo} (บันทึกในชื่อ user_id = {$recipient['user_id']})\n";
    $b = opstest_counts($db);
    $t0 = microtime(true);
    $sent = 0;
    $stdoutAll .= opstest_capture(function () use ($db, $targets, $recipient, &$sent) {
        $sent = ops_alert_deliver(
            $db, $targets[0], [$recipient],
            OPSTEST_MARK . ' ทดสอบเส้นทางอีเมลของระบบแจ้งเตือน',
            "ข้อความนี้มาจาก scripts/test-ops-alert.php\nถ้าได้รับ แปลว่าเส้นทางอีเมลของ ops alert ใช้งานได้",
            true
        );
    });
    $secs = round(microtime(true) - $t0, 1);
    $a = opstest_counts($db);
    $d = opstest_delta($b, $a);
    echo "  ผลต่าง: " . opstest_fmt($d) . " (ใช้เวลา {$secs} วินาที)\n";
    check('T6 in-app ถึงผู้รับ', $d['inapp'] === 1, "ได้ {$d['inapp']}");
    check('T6 มีแถว notification_log ของช่องทาง email', $d['log_email'] === 1, "ได้ {$d['log_email']}");

    $s = $db->prepare("SELECT status, error FROM notification_log WHERE message LIKE ? AND channel = 'email' ORDER BY sent_at DESC LIMIT 1");
    $s->execute([OPSTEST_MARK . '%']);
    $mailRow = $s->fetch();
    $mailStatus = $mailRow ? (string) $mailRow['status'] : '(ไม่มีแถว)';
    echo "  สถานะการส่งอีเมล: {$mailStatus}"
       . ($mailRow && $mailRow['error'] ? " — {$mailRow['error']}" : '') . "\n";
    check('T6 ตัวส่งอีเมลรายงานว่าสำเร็จ', $mailStatus === 'sent', "ได้ {$mailStatus} (ดูรายละเอียดใน PHP error log)");
    check('T6 ค่าที่คืนนับทั้งสองช่องทาง', $sent === 2, "ได้ {$sent}");
}

// ── T7 ข้อบังคับเรื่อง stdout ──────────────────────────────────────────────────
echo "\n=== T7 ข้อบังคับ: ไม่พิมพ์อะไรออก stdout ===\n";
check('T7 ไม่มี output ออก stdout เลย', $stdoutAll === '', 'ได้ ' . strlen($stdoutAll) . ' ไบต์: ' . mb_substr($stdoutAll, 0, 200));
check('T7 ไม่มีรูปแบบ "<เลข> entries" ที่ cron-runner.php จะอ่านผิด', !preg_match('/(\d+)\s+entries/i', $stdoutAll));
check('T7 ไม่มีรูปแบบ "<เลข> error" ที่ cron-runner.php จะอ่านผิด',   !preg_match('/(\d+)\s+error/i',   $stdoutAll));

// ── ผลรวมและวิธีล้างข้อมูล ─────────────────────────────────────────────────────
$final = opstest_counts($db);
echo "\n=== แถวที่สคริปต์นี้สร้างไว้ให้ตรวจ ===\n";
echo "  " . opstest_fmt($final) . "\n";
$rows = $db->query("SELECT alert_key, tenant_id, send_count, last_sent_at, resolved_at FROM ops_alerts WHERE alert_key LIKE 'ops_test:%'")->fetchAll();
foreach ($rows as $r) {
    echo "  ops_alerts: {$r['alert_key']} / {$r['tenant_id']} send_count={$r['send_count']}"
       . " last_sent_at={$r['last_sent_at']} resolved_at=" . ($r['resolved_at'] ?? 'NULL') . "\n";
}
echo "\n  ล้างข้อมูลทดสอบ: php scripts/test-ops-alert.php --cleanup\n";
echo "  หรือด้วย SQL:\n";
echo "    DELETE FROM ai_notifications WHERE title LIKE '" . OPSTEST_MARK . "%';\n";
echo "    DELETE FROM notification_log WHERE message LIKE '" . OPSTEST_MARK . "%';\n";
echo "    DELETE FROM ops_alerts WHERE alert_key LIKE 'ops_test:%';\n";

echo "\n=== สรุป: PASS $pass / FAIL $fail ===\n";
exit($fail === 0 ? 0 : 1);
