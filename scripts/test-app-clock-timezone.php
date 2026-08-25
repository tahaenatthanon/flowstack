<?php
/**
 * ทดสอบ change fix-app-clock-timezone — นาฬิกาของ PHP ต้องตรงกับนาฬิกาของ MariaDB
 *
 * รัน: php scripts/test-app-clock-timezone.php
 *
 * ทำไมต้องมีสคริปต์นี้: ความคลาดเขตเวลาไม่ทำให้อะไรพัง "เสียงดัง" — มันทำให้ตัวเลข
 * ผิดเงียบ ๆ (ตัวตรวจสุขภาพบอก ok ทั้งที่ cron ตาย, กุญแจหมดอายุยังใช้ได้ต่ออีก 5 ชม.)
 * จึงต้องมีคำสั่งเดียวที่ตอบได้ว่านาฬิกาสองตัวยังตรงกันอยู่ไหม
 *
 * ครอบคลุม
 *   C1  bootstrap ตั้งเขตเวลาไว้จริง และเป็นชื่อ IANA ที่รู้จัก
 *   C2  offset ของ PHP เท่ากับ offset ของฐานข้อมูล (ตัวจับ regression ตัวจริง)
 *   C3  date('Y-m-d H:i:s') ต่างจาก SELECT NOW() ไม่เกิน 2 วินาที (ฝั่งเขียน)
 *   C4  dbNow() ให้ค่าเดียวกับ SELECT NOW() ทั้งแบบส่ง $db และไม่ส่ง
 *   C5  strtotime(ค่าจากคอลัมน์ DATETIME) เทียบ time() ได้ผลต่างเป็นบวกและสมเหตุสมผล (ฝั่งอ่าน)
 *   C6  การตัดสินหมดอายุแบบ strtotime($expires_at) < time() ให้ผลถูกทั้งสองทาง
 *   C7  api/health.php คืน minutes_ago ไม่ติดลบ และ timestamp มี offset ตรงกับฐานข้อมูล
 *
 * ไม่แก้ข้อมูลใด ๆ — อ่านอย่างเดียว ไม่ต้อง cleanup
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("CLI only\n");
}

require_once __DIR__ . '/../api/config.php';

$BASE = 'http://localhost/flowstack';

$db = getDB();

$pass = 0;
$fail = 0;
function check(string $name, bool $ok, string $detail = ''): void {
    global $pass, $fail;
    if ($ok) { $pass++; echo "  PASS  $name\n"; }
    else     { $fail++; echo "  FAIL  $name" . ($detail !== '' ? " — $detail" : '') . "\n"; }
}
function httpGet(string $url): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => (int) $code, 'body' => json_decode((string) $res, true), 'raw' => (string) $res];
}
/** offset ของฐานข้อมูลเป็นวินาที — TIMEDIFF คืน '07:00:00' หรือ '-05:00:00' */
function dbOffsetSeconds(PDO $db): int {
    $diff = (string) $db->query('SELECT TIMEDIFF(NOW(), UTC_TIMESTAMP())')->fetchColumn();
    $neg  = strpos($diff, '-') === 0;
    $b    = explode(':', ltrim($diff, '+-'));
    $sec  = ((int) ($b[0] ?? 0)) * 3600 + ((int) ($b[1] ?? 0)) * 60;
    return $neg ? -$sec : $sec;
}
/** แปลง offset วินาที → รูปแบบ '+07:00' เทียบกับท้ายค่าของ date('c') ได้ตรง */
function offsetLabel(int $sec): string {
    $s = $sec < 0 ? '-' : '+';
    $a = abs($sec);
    return sprintf('%s%02d:%02d', $s, intdiv($a, 3600), intdiv($a % 3600, 60));
}

// ── C1 bootstrap ───────────────────────────────────────────────────────────────
echo "\n[C1] bootstrap ตั้งเขตเวลาไว้จริง\n";
$tzName   = date_default_timezone_get();
$envTz    = getenv('APP_TIMEZONE') ?: ($_ENV['APP_TIMEZONE'] ?? '');
$knownTz  = in_array($tzName, DateTimeZone::listIdentifiers(), true);
check('C1 เขตเวลาปัจจุบันเป็นชื่อ IANA ที่รู้จัก', $knownTz, $tzName);
if ($envTz !== '' && in_array($envTz, DateTimeZone::listIdentifiers(), true)) {
    check('C1 ใช้ค่าจาก APP_TIMEZONE ใน .env', $tzName === $envTz, "APP_TIMEZONE=$envTz แต่ได้ $tzName");
} else {
    // ไม่ตั้งค่าไว้ หรือตั้งค่าที่ใช้ไม่ได้ → ต้องได้ค่าถอย ไม่ใช่ค่าของ php.ini
    check('C1 ถอยไป Asia/Bangkok เมื่อไม่มี/ใช้ APP_TIMEZONE ไม่ได้', $tzName === 'Asia/Bangkok', "APP_TIMEZONE='$envTz' → $tzName");
}

// ── C2 offset ตรงกัน ───────────────────────────────────────────────────────────
echo "\n[C2] offset ของ PHP เทียบฐานข้อมูล\n";
$dbOff  = dbOffsetSeconds($db);
$phpOff = (new DateTimeZone($tzName))->getOffset(new DateTime('now'));
check(
    'C2 offset เท่ากันพอดี',
    $dbOff === $phpOff,
    'db=' . offsetLabel($dbOff) . ' php=' . offsetLabel($phpOff) . " (tz=$tzName)"
);

// ── C3 ฝั่งเขียน ───────────────────────────────────────────────────────────────
echo "\n[C3] ฝั่งเขียน: date() เทียบ SELECT NOW()\n";
$phpNow = date('Y-m-d H:i:s');
$sqlNow = (string) $db->query('SELECT NOW()')->fetchColumn();
$gap    = abs(strtotime($phpNow) - strtotime($sqlNow));
check('C3 ต่างกันไม่เกิน 2 วินาที', $gap <= 2, "php=$phpNow db=$sqlNow gap={$gap}s");

// ── C4 dbNow() ─────────────────────────────────────────────────────────────────
echo "\n[C4] dbNow() อ่านนาฬิกาฐานข้อมูล\n";
$sqlNow2 = (string) $db->query('SELECT NOW()')->fetchColumn();
$h1      = dbNow();
$h2      = dbNow($db);
check('C4 dbNow() ต่างจาก SELECT NOW() ไม่เกิน 2 วินาที', abs(strtotime($h1) - strtotime($sqlNow2)) <= 2, "dbNow()=$h1 db=$sqlNow2");
check('C4 dbNow($db) ให้ผลแบบเดียวกัน', abs(strtotime($h2) - strtotime($sqlNow2)) <= 2, "dbNow(\$db)=$h2 db=$sqlNow2");
check('C4 คืนรูปแบบ DATETIME ที่เขียนลงคอลัมน์ได้', (bool) preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $h1), $h1);

// ── C5 ฝั่งอ่าน ────────────────────────────────────────────────────────────────
echo "\n[C5] ฝั่งอ่าน: strtotime(ค่าจาก DATETIME) เทียบ time()\n";
// จำลองแถวที่เขียนด้วย NOW() เมื่อ 1 นาทีก่อน — รูปแบบเดียวกับที่อ่านจากคอลัมน์จริง
$oneMinAgo = (string) $db->query('SELECT NOW() - INTERVAL 1 MINUTE')->fetchColumn();
$ageSec    = time() - strtotime($oneMinAgo);
check('C5 อายุเป็นบวก (ไม่ใช่ค่าติดลบแบบก่อนแก้)', $ageSec > 0, "age={$ageSec}s ($oneMinAgo)");
check('C5 อายุอยู่ในช่วง 55-65 วินาที', $ageSec >= 55 && $ageSec <= 65, "age={$ageSec}s ($oneMinAgo)");

// ── C6 การตัดสินหมดอายุ ────────────────────────────────────────────────────────
echo "\n[C6] การตัดสินหมดอายุแบบ strtotime(\$expires_at) < time()\n";
// รูปแบบเดียวกับ api/agent-auth.php:94 (กุญแจ) และ api/billing/status.php:26 (แพ็กเกจ)
$future = (string) $db->query('SELECT NOW() + INTERVAL 1 HOUR')->fetchColumn();
$past   = (string) $db->query('SELECT NOW() - INTERVAL 1 HOUR')->fetchColumn();
check('C6 หมดอายุอีก 1 ชม. = ยังใช้ได้', strtotime($future) > time(), "expires_at=$future");
check('C6 หมดอายุไปแล้ว 1 ชม. = หมดอายุ',  strtotime($past)   < time(), "expires_at=$past");

// ── C7 health.php ──────────────────────────────────────────────────────────────
echo "\n[C7] api/health.php\n";
$hc = httpGet("$BASE/api/health.php");
check('C7 ตอบ 200 หรือ 503 (ไม่ใช่ 500)', in_array($hc['code'], [200, 503], true), "code={$hc['code']} body=" . substr($hc['raw'], 0, 200));
$cron = $hc['body']['checks']['cron_last_run'] ?? null;
if (is_array($cron)) {
    $ma = $cron['minutes_ago'] ?? null;
    check('C7 minutes_ago ไม่ติดลบ', $ma === null || (int) $ma >= 0, 'minutes_ago=' . var_export($ma, true));
    // ถ้า cron ตายจริง เพดาน 120 นาทีต้องรายงาน STALE ได้ — ตรวจว่าตรรกะสองฝั่งสอดคล้อง
    $expected = ($ma !== null && (int) $ma > 120) ? 'STALE' : 'ok';
    check('C7 status สอดคล้องกับ minutes_ago', ($cron['status'] ?? '') === $expected, "minutes_ago=$ma status=" . ($cron['status'] ?? ''));
} else {
    echo "  SKIP  C7 cron_last_run: " . var_export($cron, true) . " (ยังไม่มีแถวใน cron_runs)\n";
}
$ts = (string) ($hc['body']['checks']['timestamp'] ?? '');
check('C7 timestamp มี offset ตรงกับฐานข้อมูล', $ts !== '' && str_ends_with($ts, offsetLabel($dbOff)), "timestamp=$ts คาดว่าลงท้าย " . offsetLabel($dbOff));

echo "\n=== สรุป: PASS $pass / FAIL $fail ===\n";
exit($fail === 0 ? 0 : 1);
