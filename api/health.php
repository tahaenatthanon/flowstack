<?php
// GET /api/health.php — System health check
// Returns: DB status, cron last-run, PHP version, required env vars presence.
// Does NOT return secret values — only whether they are set.
// Safe to poll publicly (no auth required); responses contain no sensitive data.

header('Content-Type: application/json; charset=utf-8');

$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos($line, '#') === 0 || strpos($line, '=') === false) continue;
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key); $value = trim($value);
        if (preg_match('/^["\'](.*)["\']\s*$/', $value, $m)) $value = $m[1];
        $_ENV[$key] = $value;
        putenv("$key=$value");
    }
}

// ── เขตเวลา ───────────────────────────────────────────────────────────────────
// ตรรกะนี้ซ้ำกับ api/config.php:34-54 โดยเจตนา — ไฟล์นี้ตั้งใจไม่ require config.php
// เพื่อให้ยังตอบได้เมื่อ config.php พังเอง (เช่น JWT_SECRET หาย ซึ่งทำให้ config.php
// exit 500 ทันที) ตัวตรวจสุขภาพที่ตายพร้อมระบบที่มันต้องตรวจนั้นไร้ประโยชน์
// จึงยอมแลกความซ้ำ 6 บรรทัดกับความเป็นอิสระของไฟล์นี้
// ผลที่ต้องการ: date('c') ท้ายไฟล์รายงาน offset ตรงกับที่ระบบใช้จริง (+07:00)
$_hcTz = getenv('APP_TIMEZONE') ?: ($_ENV['APP_TIMEZONE'] ?? 'Asia/Bangkok');
try {
    new DateTimeZone($_hcTz);
    date_default_timezone_set($_hcTz);
} catch (Exception $e) {
    date_default_timezone_set('Asia/Bangkok');
}
unset($_hcTz);

// ── ค่าคงที่เรื่องเวลาของ cron ────────────────────────────────────────────────
// ไฟล์นี้ไม่มี require และไม่มี side effect (ดูหัวไฟล์ของมัน) จึงไม่ทำลาย
// ความเป็นอิสระของ health.php — ต่างจาก api/lib/cron-runner.php ที่ require config.php
// เพดาน "เลยกำหนด" ต้องเป็นค่าเดียวกับที่ tick.php/cron-manager.php ใช้ ไม่ใช่เลขที่คัดลอกมา
require_once __DIR__ . '/lib/cron-constants.php';

$checks = [];
$overallOk = true;

// ── Required env vars (presence only, never values) ──────────────────────────
$requiredEnv = ['JWT_SECRET', 'CRON_SECRET'];
$envStatus = [];
foreach ($requiredEnv as $var) {
    $isSet = !empty(getenv($var) ?: ($_ENV[$var] ?? ''));
    $envStatus[$var] = $isSet ? 'set' : 'MISSING';
    if (!$isSet) $overallOk = false;
}
$checks['env'] = $envStatus;

// ── Database connectivity ─────────────────────────────────────────────────────
try {
    $dbHost    = getenv('DB_HOST') ?: ($_ENV['DB_HOST'] ?? 'localhost');
    $dbName    = getenv('DB_NAME') ?: ($_ENV['DB_NAME'] ?? 'flowstack');
    $dbUser    = getenv('DB_USER') ?: ($_ENV['DB_USER'] ?? 'root');
    $dbPass    = getenv('DB_PASS') ?: ($_ENV['DB_PASS'] ?? '');
    $pdo = new PDO(
        "mysql:host=$dbHost;dbname=$dbName;charset=utf8mb4",
        $dbUser, $dbPass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 3]
    );
    $pdo->query('SELECT 1');
    $checks['database'] = 'ok';
} catch (Throwable $e) {
    $checks['database'] = 'ERROR: ' . $e->getMessage();
    $overallOk = false;
}

// ── Cron last run (requires cron_runs table) ──────────────────────────────────
if (isset($pdo)) {
    try {
        // อายุคำนวณด้วย TIMESTAMPDIFF ในฐานข้อมูล ไม่ใช่ time() - strtotime() ของ PHP
        // เพราะ finished_at เขียนด้วย NOW() ของ MySQL — ถ้าเอาสตริงนั้นมาให้ PHP ตีความ
        // ผลจะคลาดไปเท่ากับส่วนต่างเขตเวลาของสอง runtime และเคยติดลบคงที่ ~-300 นาที
        // ทำให้เพดาน STALE 120 นาทีไม่เคยถึงเลย (cron ตาย 15 ชม. คืน 24 ส.ค. 2026 ไม่มีเตือน)
        // ตัวตรวจสุขภาพต้องไม่พึ่งการตั้งค่าเขตเวลาของ PHP จึงเทียบสองค่าในนาฬิกาเดียวกัน
        //
        // ⚠️ เพดาน 120 ที่นี่เป็น "นาที" และไม่ใช่ตัวเดียวกับ CRON_OVERDUE_SECONDS (วินาที)
        // ที่ใช้ในบล็อก cron_jobs ด้านล่าง — สองค่านี้วัดคนละเรื่อง: ที่นี่ถามว่า "มีงานใด
        // รันจบเมื่อไม่นานนี้ไหม" (ตัว tick ยังมีชีวิตหรือเปล่า) ส่วนด้านล่างถามว่า
        // "งานแต่ละงานถูกเรียกตามตารางของตัวเองหรือไม่"
        $row = $pdo->query(
            "SELECT job_name, finished_at, errors,
                    TIMESTAMPDIFF(MINUTE, finished_at, NOW()) AS minutes_ago
             FROM cron_runs
             ORDER BY finished_at DESC LIMIT 1"
        )->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            $minutesAgo = $row['minutes_ago'] === null ? null : (int)$row['minutes_ago'];
            $checks['cron_last_run'] = [
                'job'         => $row['job_name'],
                'finished_at' => $row['finished_at'],
                'minutes_ago' => $minutesAgo,
                'errors'      => (int)$row['errors'],
                'status'      => ($minutesAgo !== null && $minutesAgo > 120) ? 'STALE' : 'ok',
            ];
            if ($minutesAgo !== null && $minutesAgo > 120) $overallOk = false;
        } else {
            $checks['cron_last_run'] = 'no runs recorded yet';
        }
    } catch (Throwable $e) {
        $checks['cron_last_run'] = 'cron_runs table not found';
    }
}

/** วินาที → ระยะเวลาภาษาไทยแบบสั้น เช่น '2 วัน 5 ชั่วโมง' (หน่วยใหญ่สุด 2 หน่วย) */
function _hcDuration(int $seconds): string {
    if ($seconds < 60) return $seconds . ' วินาที';
    $units = [['วัน', 86400], ['ชั่วโมง', 3600], ['นาที', 60]];
    $parts = [];
    foreach ($units as [$label, $size]) {
        $n = intdiv($seconds, $size);
        if ($n > 0) {
            $parts[]  = $n . ' ' . $label;
            $seconds -= $n * $size;
        }
        if (count($parts) === 2) break;
    }
    return implode(' ', $parts);
}

// ── ตารางเวลาของ cron แต่ละงาน (ต้องมีตาราง cron_jobs) ────────────────────────
// แยกเรื่องจาก cron_last_run ด้านบนโดยเจตนา — งานหนึ่งรันจบเมื่อ 1 นาทีก่อนได้พร้อมกับ
// ที่อีกงานไม่ถูกเรียกมา 3 วัน ถ้ารายงานเป็นค่าเดียวกันสองอาการนี้จะกลบกัน
//
// วัดด้วย next_run_at ซึ่ง tick.php เขียนหลังรันเสร็จทุกครั้ง: ถ้าเวลานั้นเลยมานานกว่า
// CRON_OVERDUE_SECONDS แปลว่าไม่มีใครเรียก tick จริง (ตัวตั้งเวลาระดับ OS ไม่ได้ลงทะเบียน /
// ถูกปิด / เครื่องหลับ) — เป็นอาการเดียวกับที่หน้าแอดมินใช้ที่ cron-manager.php:78
// จึงใช้สูตรและเพดานตัวเดียวกันเพื่อให้สองที่ไม่ขัดกัน
if (isset($pdo)) {
    try {
        // เทียบเวลาฝั่ง SQL ด้วยนาฬิกาเดียวกับที่เขียน next_run_at
        // ค่าบวก = เลยกำหนดมาแล้วกี่วินาที, ค่าลบ = อีกกี่วินาทีจะถึงกำหนด
        $jobs = $pdo->query(
            "SELECT `key`, name, cron_expression, last_run_at, next_run_at,
                    TIMESTAMPDIFF(SECOND, next_run_at, NOW()) AS overdue_seconds
             FROM cron_jobs WHERE enabled = 1 ORDER BY created_at ASC"
        )->fetchAll(PDO::FETCH_ASSOC);

        $overdue = [];
        $noSchedule = [];
        foreach ($jobs as $j) {
            // next_run_at เป็น NULL = ยังไม่เคยตั้งรอบ ซึ่ง tick.php initialize ให้เองในรอบถัดไป
            // (tick.php:70-81) จึงเป็นสถานะชั่วคราวไม่ใช่ความผิดพลาด — รายงานแยกไว้ให้เห็น
            // แต่ไม่ทำให้ทั้ง endpoint เป็น degraded เพราะจะกลายเป็น 503 ที่กระพริบ
            // ทุกครั้งที่มีคนเปิดงานใหม่ ถ้า tick ตายจริง overdue/cron_last_run บอกอยู่แล้ว
            if (empty($j['next_run_at'])) {
                $noSchedule[] = $j['key'];
                continue;
            }
            $sec = $j['overdue_seconds'] === null ? null : (int)$j['overdue_seconds'];
            if ($sec !== null && $sec > CRON_OVERDUE_SECONDS) {
                $overdue[] = [
                    'job'             => $j['key'],
                    'name'            => $j['name'],
                    'cron_expression' => $j['cron_expression'],
                    'next_run_at'     => $j['next_run_at'],
                    'last_run_at'     => $j['last_run_at'],
                    'overdue_seconds' => $sec,
                    'overdue_human'   => _hcDuration($sec),
                ];
            }
        }

        $checks['cron_jobs'] = [
            'status'                    => empty($overdue) ? 'ok' : 'OVERDUE',
            'enabled_count'             => count($jobs),
            'overdue_count'             => count($overdue),
            'overdue_threshold_seconds' => CRON_OVERDUE_SECONDS,
            'overdue'                   => $overdue,
            'without_schedule'          => $noSchedule,
        ];
        if (!empty($overdue)) $overallOk = false;
    } catch (Throwable $e) {
        $checks['cron_jobs'] = 'cron_jobs table not found';
    }
}

// ── Recent frontend crash count (last 24 h) ───────────────────────────────────
if (isset($pdo)) {
    try {
        $errCount = (int)$pdo->query(
            "SELECT COUNT(*) FROM client_errors WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)"
        )->fetchColumn();
        $checks['client_errors_24h'] = $errCount;
        if ($errCount > 50) $overallOk = false; // >50 crashes/day is degraded
    } catch (Throwable $e) {
        $checks['client_errors_24h'] = 'table not found';
    }
}

// ── PHP / server info ─────────────────────────────────────────────────────────
$checks['php_version'] = PHP_VERSION;
$checks['timestamp']   = date('c');

// ── Response ──────────────────────────────────────────────────────────────────
http_response_code($overallOk ? 200 : 503);
echo json_encode([
    'status' => $overallOk ? 'ok' : 'degraded',
    'checks' => $checks,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
