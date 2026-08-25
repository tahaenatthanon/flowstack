<?php
// api/cron/tick.php
//
// ตัวเรียกงาน cron ตามเวลา — entry point เดียวที่ตัวตั้งเวลาระดับ OS ต้องเรียก
//
// Windows Task Scheduler (ทุก 1 นาที):
//   php C:\xampp\htdocs\flowstack\api\cron\tick.php
//   (ลงทะเบียนด้วย scripts\register-cron-task.bat — ต้องรันด้วยสิทธิ์ Administrator ครั้งเดียว)
// Linux cron:
//   * * * * * php /var/www/html/flowstack/api/cron/tick.php
// ตรวจด้วยมือผ่าน HTTP:
//   GET /api/cron/tick.php?token=<CRON_SECRET>
//
// หน้าที่: อ่าน cron_jobs ที่ enabled=1 → ตัดสินว่างานใดถึงกำหนดจาก next_run_at
// → สั่งรันผ่าน runJob() ตัวเดียวกับที่ปุ่ม "รันเดี๋ยวนี้" ของแอดมินใช้
// → อัปเดต last_run_at / next_run_at
//
// ⚠️ งานแบบ type='include' ถูก include เข้าโปรเซสนี้ทั้งหมด — PHP fatal ในไฟล์งานหนึ่ง
//    (เช่นชื่อฟังก์ชันซ้ำ) จะทำให้ tick ทั้งรอบตาย งานที่ตายจะเหลือแถว cron_runs
//    ที่ finished_at IS NULL ให้เห็นในหน้าแอดมิน และรอบถัดไป (1 นาที) จะเริ่มใหม่
//    ทางแก้ที่แข็งกว่าคือ spawn โปรเซสแยกต่องาน — อยู่นอกขอบเขต change นี้

if (!defined('CRON_MODE')) define('CRON_MODE', true);
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/cron-runner.php';

$isCli = php_sapi_name() === 'cli';
if (!$isCli) {
    header('Content-Type: text/plain; charset=utf-8');
    $token = $_GET['token'] ?? $_GET['secret'] ?? '';
    if (!hash_equals(cron_secret(), $token)) {
        http_response_code(403);
        echo "Forbidden\n";
        exit;
    }
}

$db  = getDB();
$tz  = cron_timezone($db);   // เขตเวลาของ MariaDB — ห้ามใช้ time()/date() ของ PHP ในไฟล์นี้
$now = cron_now($db);

// is_due คำนวณด้วย NOW() ของ MySQL เพื่อให้ใช้นาฬิกาเดียวกับที่เขียน next_run_at
$jobs = $db->query(
    "SELECT *, (next_run_at IS NOT NULL AND next_run_at <= NOW()) AS is_due
     FROM cron_jobs WHERE enabled = 1 ORDER BY created_at ASC"
)->fetchAll(PDO::FETCH_ASSOC);

$initialized = 0;   // next_run_at ยังเป็น NULL → ตั้งรอบให้ แต่ไม่รัน
$due         = 0;
$ran         = 0;
$failed      = 0;
$skipped     = 0;   // ยังมีแถว cron_runs ค้างเปิดอยู่และไม่เกินเพดาน
$invalid     = 0;   // cron_expression ใช้ไม่ได้

echo '[' . cron_format($now, $tz) . '] tick: ' . count($jobs) . " enabled jobs\n";

foreach ($jobs as $job) {
    $key  = $job['key'];
    $expr = trim((string)($job['cron_expression'] ?? ''));

    if ($expr === '' || !cron_expr_validate($expr)) {
        $invalid++;
        echo "  [{$key}] 1 error: cron_expression ใช้ไม่ได้ (" . ($expr === '' ? 'ว่าง' : $expr) . ")\n";
        continue;
    }

    // next_run_at IS NULL = ยังไม่เคยตั้งรอบ → initialize เท่านั้น ไม่รันในรอบนี้
    // เจตนา: งานที่เงียบไปนานจะไม่ยิงพร้อมกันทันทีที่เปิดตัวตั้งเวลา
    // และไม่มีการย้อนรัน (backfill) รอบที่พลาดไปในอดีต
    if (empty($job['next_run_at'])) {
        $next = cron_next_run($expr, $now, $tz);
        if ($next === null) {
            $invalid++;
            echo "  [{$key}] 1 error: หา next_run_at ไม่ได้จาก '{$expr}'\n";
            continue;
        }
        $db->prepare("UPDATE cron_jobs SET next_run_at = ? WHERE `key` = ?")->execute([$next, $key]);
        $initialized++;
        echo "  [{$key}] initialized → {$next}\n";
        continue;
    }

    if (!$job['is_due']) {
        continue;   // ยังไม่ถึงกำหนด
    }

    $due++;

    // กันงานทับซ้อน — ข้ามงานที่ยังมีแถว cron_runs เปิดค้างและยังไม่เกินเพดานเวลา
    // เทียบอายุด้วย TIMESTAMPDIFF ฝั่ง SQL เพราะ started_at เขียนด้วย NOW() ของ MySQL
    // runJob() จะปิดแถวค้างที่เกินเพดานเองด้วย 'Force-restarted after timeout'
    $openStmt = $db->prepare(
        "SELECT started_at FROM cron_runs
         WHERE job_name = ? AND finished_at IS NULL
           AND TIMESTAMPDIFF(SECOND, started_at, NOW()) < ?
         ORDER BY id DESC LIMIT 1"
    );
    $openStmt->execute([$key, CRON_STUCK_SECONDS]);
    $openStartedAt = $openStmt->fetchColumn();
    if ($openStartedAt !== false) {
        $skipped++;
        echo "  [{$key}] skipped — กำลังทำงานอยู่ (เริ่ม {$openStartedAt})\n";
        continue;
    }

    $result = runJob($db, $job);
    // runJob() อาจถูกไฟล์งานที่ include ทับตัวแปร global — ขอ PDO ใหม่ก่อนใช้ต่อ
    $db = getDB();

    if ($result['success']) { $ran++;    echo "  [{$key}] ran ok (processed={$result['processed']})\n"; }
    else                    { $failed++; echo "  [{$key}] 1 error: " . mb_substr(str_replace("\n", ' ', $result['output']), 0, 200) . "\n"; }

    // ตั้งรอบถัดไปจาก "เวลานี้" ไม่ใช่จาก next_run_at เดิม — งานที่เลยกำหนดจึงรัน
    // ครั้งเดียวแล้วเข้าจังหวะใหม่ ไม่ไล่รันทุกนาทีที่พลาดไป
    $next = cron_next_run($expr, cron_now($db), $tz);
    if ($next === null) {
        $invalid++;
        echo "  [{$key}] 1 error: หา next_run_at รอบถัดไปไม่ได้จาก '{$expr}'\n";
        $db->prepare("UPDATE cron_jobs SET last_run_at = NOW() WHERE `key` = ?")->execute([$key]);
        continue;
    }
    $db->prepare("UPDATE cron_jobs SET last_run_at = NOW(), next_run_at = ? WHERE `key` = ?")
       ->execute([$next, $key]);
}

echo '[' . cron_format(cron_now($db), $tz) . "] tick done: due={$due} ran={$ran} failed={$failed}"
   . " skipped={$skipped} initialized={$initialized} invalid={$invalid}\n";
