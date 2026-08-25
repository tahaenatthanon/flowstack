<?php
// api/lib/cron-runner.php
//
// ตัวรันงาน cron ที่ใช้ร่วมกันระหว่าง:
//   - api/cron-manager.php  → ปุ่ม "รันเดี๋ยวนี้" ของแอดมิน (POST ?action=run&job=<key>)
//   - api/cron/tick.php     → ตัวตั้งเวลาระดับ OS เรียกทุกนาที
// ถ้าแยกกันสองชุด พฤติกรรมสองทางจะแตกต่างกันเงียบ ๆ (บันทึก cron_runs ไม่เหมือนกัน,
// อ่านจำนวนที่ประมวลผลต่างกัน) จึงรวมไว้ที่ไฟล์นี้ที่เดียว
//
// ⚠️ ข้อตกลงสำหรับไฟล์งานแบบ type='include':
//   ทุกงานถูก include เข้ามาในโปรเซสเดียวกัน (รอบเดียวของ tick อาจ include หลายไฟล์)
//   ฟังก์ชันที่ประกาศที่ global scope จึงอยู่ร่วม namespace เดียวกันทั้งหมด —
//   ชื่อซ้ำ = PHP fatal "Cannot redeclare" ซึ่ง try/catch จับไม่ได้ และทำให้ tick ทั้งรอบตาย
//   ไฟล์งานใหม่ต้องตั้งชื่อฟังก์ชันโดยมี prefix ของงานตัวเอง
//   ปัจจุบัน: isCancelled (publish-scheduler), metricsSyncCancelled (content-metrics-sync),
//             sendReminderEmail (billing-reminders), ai-digest ไม่ประกาศฟังก์ชัน

require_once __DIR__ . '/../config.php';

// เพดานเวลาที่ถือว่างาน "ค้าง" — ใช้ค่าเดียวกันทั้งใน jobState() ของ cron-manager
// และในตัวเลือกงานของ tick.php ถ้าใช้ค่าต่างกัน หน้าแอดมินจะบอกว่า "running"
// ขณะที่ tick ยิงงานซ้อนไปแล้ว
if (!defined('CRON_STUCK_SECONDS')) define('CRON_STUCK_SECONDS', 600);

// เพดานการค้นหา next_run_at เป็นนาที (~366 วัน) กัน expression ที่ match ไม่ได้เลย
// เช่น '0 0 30 2 *' (30 กุมภาพันธ์) ทำให้ลูปไม่จบ
if (!defined('CRON_NEXT_RUN_MAX_MINUTES')) define('CRON_NEXT_RUN_MAX_MINUTES', 527040);

// ความล่าช้าที่ยอมรับได้ก่อนถือว่างาน "เลยกำหนด" — tick ถูกเรียกทุก 1 นาที
// จึงเผื่อไว้ 2 นาที ถ้า next_run_at เลยมานานกว่านี้แปลว่าไม่มีใครเรียก tick จริง
// (ตัวตั้งเวลาระดับ OS ไม่ได้ลงทะเบียน / ถูกปิด / เครื่องหลับ) — หน้าแอดมินต้องบอกให้เห็น
if (!defined('CRON_OVERDUE_SECONDS')) define('CRON_OVERDUE_SECONDS', 120);

/**
 * secret ที่ใช้ยืนยันการเรียก cron ผ่าน HTTP — จุดเดียวสำหรับทุกไฟล์
 *
 * ⚠️ ค่า literal ชั้นสุดท้ายเป็นจุดอ่อนด้านความปลอดภัยที่มีอยู่ก่อนไฟล์นี้:
 *   api/notification-dispatch.php ใช้ค่านี้เป็น fallback อยู่แล้ว ถ้าตัดออกทันที
 *   งานแจ้งเตือนจะพังในเครื่องที่ยังไม่ได้อัปเดต .env
 *   วิธีแก้จริงคือบังคับให้ต้องมี CRON_SECRET แล้วเอา literal ออก — ควรทำเป็นงานแยก
 *   พร้อมประกาศให้ผู้ดูแลระบบตั้งค่าก่อน
 */
function cron_secret(): string {
    $v = getenv('CRON_SECRET');
    if ($v !== false && $v !== '') return (string)$v;
    if (!empty($_ENV['CRON_SECRET'])) return (string)$_ENV['CRON_SECRET'];
    return 'flowstack-cron-2026';
}

// ── นาฬิกา ────────────────────────────────────────────────────────────────────
// PHP กับ MariaDB บนเครื่องนี้ใช้เขตเวลาต่างกัน: php.ini ของ XAMPP ตั้ง
// date.timezone = Europe/Berlin ขณะที่ MariaDB ใช้เวลาระบบ (UTC+7) — ห่างกัน 5 ชั่วโมง
// ถ้าปล่อยให้ cron ใช้ time()/date() ของ PHP จะเกิดสามอาการพร้อมกัน:
//   1) next_run_at ถูกเขียนในกรอบ Berlin → '30 7 * * *' ยิงตอน 12:30 ตามเวลาจริง
//   2) last_run_at (NOW() ของ MySQL) กับ next_run_at (PHP) ขัดกันในแถวเดียวกัน
//   3) time() - strtotime(started_at) ติดลบ ~18000 เสมอ → เพดาน "ค้าง" ไม่เคยถึง
// ข้อตกลงของไฟล์นี้: ในเส้นทาง cron ห้ามใช้ time() — เวลา "เดี๋ยวนี้" ต้องมาจาก
// ฐานข้อมูล และการเทียบอายุเวลาต้องทำด้วย SQL (TIMESTAMPDIFF) ไม่ใช่ PHP

/** เขตเวลาที่ MariaDB ใช้ — อ่านจาก offset จริง ไม่ hardcode เพื่อไม่ให้เพี้ยนเงียบ ๆ เมื่อย้ายเครื่อง */
function cron_timezone(PDO $db): DateTimeZone {
    static $tz = null;
    if ($tz !== null) return $tz;

    // TIMEDIFF คืนรูปแบบ '07:00:00' หรือ '-05:00:00' (รองรับ offset ครึ่งชั่วโมงด้วย)
    $diff = (string)$db->query('SELECT TIMEDIFF(NOW(), UTC_TIMESTAMP())')->fetchColumn();
    $neg  = strpos($diff, '-') === 0;
    $bits = explode(':', ltrim($diff, '+-'));
    $off  = sprintf('%s%02d:%02d', $neg ? '-' : '+', (int)($bits[0] ?? 0), (int)($bits[1] ?? 0));

    // ใช้ offset คงที่ ไม่ใช้ชื่อเขตเวลา — จึงไม่มีชั่วโมงที่ซ้ำหรือหายช่วงเปลี่ยน DST
    // ให้การเดินหน้าทีละนาทีใน cron_next_run() แม่นทุกกรณี
    $tz = new DateTimeZone($off);
    return $tz;
}

/** unix timestamp ของ "เดี๋ยวนี้" ตามนาฬิกาของฐานข้อมูล */
function cron_now(PDO $db): int {
    return (int)$db->query('SELECT UNIX_TIMESTAMP()')->fetchColumn();
}

/** แปลง unix timestamp เป็นสตริง DATETIME ในกรอบเวลาของฐานข้อมูล */
function cron_format(int $ts, DateTimeZone $tz): string {
    return (new DateTimeImmutable('@' . $ts))->setTimezone($tz)->format('Y-m-d H:i:s');
}

// ── cron expression ───────────────────────────────────────────────────────────
// รองรับเฉพาะ 5 ฟิลด์ และไวยากรณ์ `*`, `N`, `*/N`, `A-B`, `A,B,C` (ผสมกันได้
// เช่น '0,30 9-17 * * 1-5') — ไม่รองรับ L, W, #, ?, ชื่อเดือน/วัน (MON, JAN)
// เขียนเองเพราะโปรเจกต์ deploy ด้วยการ copy ไฟล์บน XAMPP และ composer.json
// มีแค่ 2 แพ็กเกจ — เพิ่ม vendor tree เพื่อโค้ดไม่กี่สิบบรรทัดไม่คุ้ม

/** ขอบเขตค่าที่ยอมรับของแต่ละฟิลด์: [min, max] */
function cron_field_bounds(): array {
    return [
        [0, 59], // นาที
        [0, 23], // ชั่วโมง
        [1, 31], // วันที่
        [1, 12], // เดือน
        [0, 6],  // วันในสัปดาห์ (0 = อาทิตย์)
    ];
}

/**
 * แปลงหนึ่งฟิลด์เป็นชุดค่าที่ match — คืน null ถ้าไวยากรณ์ใช้ไม่ได้
 * @return int[]|null
 */
function cron_field_values(string $field, int $min, int $max): ?array {
    $field = trim($field);
    if ($field === '') return null;

    $out = [];
    foreach (explode(',', $field) as $part) {
        $part = trim($part);
        if ($part === '') return null;

        // step: <range>/<N>
        $step  = 1;
        if (strpos($part, '/') !== false) {
            $bits = explode('/', $part);
            if (count($bits) !== 2) return null;
            $part = trim($bits[0]);
            if (!ctype_digit($bits[1])) return null;
            $step = (int)$bits[1];
            if ($step < 1) return null;
        }

        if ($part === '*') {
            $from = $min; $to = $max;
        } elseif (strpos($part, '-') !== false) {
            $bits = explode('-', $part);
            if (count($bits) !== 2) return null;
            if (!ctype_digit(trim($bits[0])) || !ctype_digit(trim($bits[1]))) return null;
            $from = (int)trim($bits[0]); $to = (int)trim($bits[1]);
            if ($from > $to) return null;
        } else {
            if (!ctype_digit($part)) return null;   // ปฏิเสธ L, W, ?, MON, JAN ที่นี่
            $from = (int)$part; $to = $from;
        }

        if ($from < $min || $to > $max) return null;
        for ($v = $from; $v <= $to; $v += $step) $out[] = $v;
    }

    if (empty($out)) return null;
    return array_values(array_unique($out));
}

/** แยก expression เป็นชุดค่าทั้ง 5 ฟิลด์ — คืน null ถ้าใช้ไม่ได้ */
function cron_expr_parse(string $expr): ?array {
    $fields = preg_split('/\s+/', trim($expr));
    if (!is_array($fields) || count($fields) !== 5) return null;

    $parsed = [];
    foreach (cron_field_bounds() as $i => [$min, $max]) {
        $vals = cron_field_values($fields[$i], $min, $max);
        if ($vals === null) return null;
        $parsed[] = $vals;
    }
    return $parsed;
}

/** true ถ้า expression อ่านได้ทั้ง 5 ฟิลด์ */
function cron_expr_validate(string $expr): bool {
    return cron_expr_parse($expr) !== null;
}

/**
 * true ถ้านาทีของ timestamp นี้ตรงกับ expression
 * $tz = กรอบเวลาที่ใช้ตีความ timestamp — ต้องส่ง cron_timezone($db) มาในเส้นทาง cron
 * (ปล่อยว่างได้สำหรับการทดสอบ จะใช้เขตเวลาปัจจุบันของ PHP)
 */
function cron_expr_matches(string $expr, int $ts, ?DateTimeZone $tz = null): bool {
    $p = cron_expr_parse($expr);
    if ($p === null) return false;

    $d = new DateTimeImmutable('@' . $ts);
    if ($tz !== null) $d = $d->setTimezone($tz);
    else              $d = $d->setTimezone(new DateTimeZone(date_default_timezone_get()));

    // วันในสัปดาห์แบบ crontab: 0 = อาทิตย์ — format('w') คืน 0-6 อยู่แล้ว
    return in_array((int)$d->format('i'), $p[0], true)
        && in_array((int)$d->format('G'), $p[1], true)
        && in_array((int)$d->format('j'), $p[2], true)
        && in_array((int)$d->format('n'), $p[3], true)
        && in_array((int)$d->format('w'), $p[4], true);
}

/**
 * เวลารันรอบถัดไปหลังจาก $fromTs — เดินหน้าทีละนาทีจากนาทีถัดไป
 * คืนสตริง DATETIME ในกรอบ $tz (พร้อมเขียนลง DB ได้ตรง ๆ)
 * คืน null ถ้า expression ใช้ไม่ได้ หรือหา match ไม่เจอภายในเพดาน
 */
function cron_next_run(string $expr, int $fromTs, ?DateTimeZone $tz = null): ?string {
    if (cron_expr_parse($expr) === null) return null;
    $tz = $tz ?? new DateTimeZone(date_default_timezone_get());

    // ตัดวินาทีทิ้งก่อน แล้วเริ่มที่นาทีถัดไป — ไม่คืนนาทีเดิมที่เพิ่งรันไป
    $ts = (int)floor($fromTs / 60) * 60 + 60;
    for ($i = 0; $i < CRON_NEXT_RUN_MAX_MINUTES; $i++, $ts += 60) {
        if (cron_expr_matches($expr, $ts, $tz)) return cron_format($ts, $tz);
    }
    return null;
}

// ── ตัวรันงาน ────────────────────────────────────────────────────────────────

/**
 * รันงานหนึ่งงานแล้วบันทึกผลลง cron_runs
 *
 * ย้ายมาจาก api/cron-manager.php แบบยกทั้งฟังก์ชัน — ไม่แก้พฤติกรรมภายใน
 * (รวมทั้งการอ่านจำนวนงานจาก output ด้วย preg_match ของ "N entries"/"N error"
 *  ซึ่งหยาบแต่เป็นพฤติกรรมที่มีอยู่ก่อน การปรับปรุงเป็นเรื่องแยก)
 */
function runJob(PDO $db, array $def): array {
    // ตัวแปรของฟังก์ชันนี้ตั้งชื่อกันชนด้วย prefix cr_ เพราะไฟล์งานแบบ include
    // ประกาศตัวแปรที่ global scope ซึ่งอยู่ scope เดียวกันกับตัวแปรในฟังก์ชันนี้
    // (เช่น publish-scheduler.php ตั้ง $db = getDB(); → ทับ $db ของเรา)
    $cr_key    = $def['key'];
    $cr_secret = cron_secret();

    // Close any stuck run first
    $db->prepare(
        "UPDATE cron_runs SET finished_at = NOW(), errors = 1,
          notes = 'Force-restarted after timeout'
         WHERE job_name = ? AND finished_at IS NULL"
    )->execute([$cr_key]);

    $db->prepare("INSERT INTO cron_runs (job_name, started_at) VALUES (?, NOW())")->execute([$cr_key]);
    $cr_runId = $db->lastInsertId();

    $output = ''; $success = false; $processed = 0; $errors = 0;

    try {
        if ($def['type'] === 'include') {
            ob_start();
            if (!defined('CRON_MODE')) define('CRON_MODE', true);
            $GLOBALS['cron_run_id'] = $cr_runId;  // allows job script to check cancel flag
            $file = (strpos($def['file_path'], '/') === 0 || strpos($def['file_path'], ':') === 1)
                ? $def['file_path']
                : __DIR__ . '/../../' . $def['file_path'];
            include $file;
            $output  = ob_get_clean() ?: '';
            $success = true;
            // ไฟล์งานอาจทับ $db ด้วย $db = getDB(); ที่ global scope — ขอใหม่ให้แน่ใจ
            // (ราคาเป็นศูนย์: getDB() เป็น static singleton ใน api/config.php)
            $db = getDB();
        } else {
            $q   = $def['query_string'] ?? '';
            $url = 'http://localhost/flowstack/api/' . $def['endpoint']
                 . ($def['http_method'] === 'GET'
                     ? '?token=' . urlencode($cr_secret) . ($q ? '&' . $q : '')
                     : ($q ? '?' . $q : ''));
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 120,
                CURLOPT_CUSTOMREQUEST  => $def['http_method'],
                CURLOPT_HTTPHEADER     => $def['http_method'] === 'POST'
                    ? ['Content-Type: application/json'] : [],
            ]);
            if ($def['http_method'] === 'POST') {
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['secret' => $cr_secret]));
            }
            $output   = (string)(curl_exec($ch) ?: '');
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlErr  = curl_error($ch);
            curl_close($ch);
            $success = !$curlErr && $httpCode < 400;
            if ($curlErr) $output = 'cURL error: ' . $curlErr;
        }
        if (preg_match('/(\d+)\s+entries/i', $output, $m)) $processed = (int)$m[1];
        if (preg_match('/(\d+)\s+error/i',   $output, $m)) $errors    = (int)$m[1];
    } catch (Throwable $e) {
        $output = 'Exception: ' . $e->getMessage();
        $success = false; $errors = 1;
    }

    $db->prepare(
        "UPDATE cron_runs SET finished_at=NOW(), records_processed=?, errors=?, notes=? WHERE id=?"
    )->execute([$processed, $errors, mb_substr($output, 0, 500), $cr_runId]);

    return [
        'success'   => $success,
        'output'    => mb_substr($output ?: ($success ? 'Completed.' : 'Failed.'), 0, 2000),
        'processed' => $processed,
        'errors'    => $errors,
    ];
}
