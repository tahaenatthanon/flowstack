<?php
// ซิงก์ engagement (views/likes) ของโพสต์ที่เผยแพร่สำเร็จแล้วกลับเข้าระบบ — เฟส 2
//
// Run via: php api/cron/content-metrics-sync.php
// เรียกผ่าน cron-manager ด้วย type='include' (ลงทะเบียนใน cron_jobs)
//
// แหล่ง id โพสต์: content_publish_queue.platform_post_id (id ต่อช่องทาง)
// ไม่ใช้ content_items.external_post_id เพราะเก็บได้ช่องทางเดียวและถูกเขียนทับทุกรอบ
// โดย publish-scheduler.php
//
// ลำดับการ echo: สรุปผลก่อน แล้วค่อยรายละเอียด — เพราะ cron-manager.php:113-114
// ใช้ preg_match (นับ match แรก) ดึง "N entries" / "N error" และ notes เก็บแค่ 500 ตัวอักษรแรก

if (!defined('CRON_MODE')) define('CRON_MODE', true);
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/insights-fetch.php';
// ไฟล์นี้รันเดี่ยวได้ด้วย (ดูหัวไฟล์) จึง require เองไม่พึ่งว่า cron-runner.php โหลดไว้แล้ว
require_once __DIR__ . '/../lib/ops-alert.php';

$db = getDB();

// เพดานต่อรอบ — กัน cron ค้างเมื่อคิวโตขึ้น (รายงานไว้ใน log ถ้าชนเพดาน ไม่ตัดเงียบ ๆ)
const METRICS_SYNC_LIMIT = 200;

// เกณฑ์เตือนล่วงหน้าก่อน credentials หมดอายุ (วัน) — จุดเดียวที่กำหนดค่านี้
const METRICS_SYNC_TOKEN_WARN_DAYS = 7;

/** ตั้งชื่อไม่ซ้ำ isCancelled() ของ publish-scheduler.php กันชนกันถ้าถูก include ในโปรเซสเดียว */
function metricsSyncCancelled(PDO $db): bool {
    if (empty($GLOBALS['cron_run_id'])) return false;
    $stmt = $db->prepare('SELECT cancel_requested FROM cron_runs WHERE id = ?');
    $stmt->execute([$GLOBALS['cron_run_id']]);
    return (bool)$stmt->fetchColumn();
}

/**
 * ตรวจอายุ credentials ของช่องทางที่เปิดใช้ เขียนผลลง publish_channels และแจ้งเตือนเมื่อใกล้หมดอายุ
 *
 * คืน "บรรทัดรายงาน" กลับไปให้ผู้เรียกพิมพ์ **หลัง** บรรทัดสรุปของงาน — ห้ามพิมพ์เองในนี้
 * เพราะ api/lib/cron-runner.php อ่าน records_processed/errors จาก output ด้วย preg_match
 * ที่นับ match แรก และ cron_runs.notes เก็บแค่ 500 ตัวอักษรแรก
 *
 * จำนวนช่องทางในรายงานนี้ไม่ถูกนับรวมใน $errors ของรอบซิงก์ — ตัวเลขของ cron_runs
 * ต้องหมายถึงผลการซิงก์เมตริกเท่านั้น ฟังก์ชันนี้จึงไม่แตะตัวนับของรอบรันเลย
 *
 * ตรวจเฉพาะช่องทางที่ `is_active = 1`: ช่องทางที่ถูกปิดไม่ได้เผยแพร่อะไรอยู่แล้ว
 * การแจ้งว่า creds ของมันใช้ไม่ได้เป็นเสียงรบกวน (instagram/tiktok/linkedin ถูกปิด
 * ใน change เดียวกันนี้เพราะพิสูจน์แล้วว่าส่งไม่ได้) — ช่องทางที่ปิดจึงคง token_status
 * เป็น NULL = "ยังไม่เคยตรวจ" ตามความจริง
 *
 * @return string[] บรรทัดรายงาน (อาจว่างถ้าไม่มีช่องทางที่เปิดใช้)
 */
function metricsSyncCheckTokens(PDO $db): array {
    $channels = $db->query(
        "SELECT id, tenant_id, name, platform, credentials_encrypted
           FROM publish_channels WHERE is_active = 1"
    )->fetchAll(PDO::FETCH_ASSOC);

    if (!$channels) return [];

    $warn   = METRICS_SYNC_TOKEN_WARN_DAYS;   // int ของโค้ดเอง ไม่ใช่ค่าจากผู้ใช้
    $counts = ['valid' => 0, 'expiring' => 0, 'expired' => 0, 'invalid' => 0, 'unsupported' => 0];
    $detail = [];

    $writeFacts = $db->prepare(
        // FROM_UNIXTIME(NULL) คืน NULL อยู่แล้ว จึงไม่ต้องมี CASE แยกกรณี "ไม่มีวันหมดอายุ"
        "UPDATE publish_channels
            SET token_expires_at       = FROM_UNIXTIME(?),
                data_access_expires_at = FROM_UNIXTIME(?),
                token_checked_at       = NOW(),
                token_error            = ?
          WHERE id = ?"
    );

    // สถานะคำนวณด้วย SQL ทั้งหมดจากค่าที่เพิ่งเขียน — เทียบเวลาด้วยนาฬิกาของฐานข้อมูล
    // (TIMESTAMPDIFF เทียบ NOW()) ตามข้อกำหนดเรื่องนาฬิกาของเส้นทาง cron
    $writeStatus = $db->prepare(
        "UPDATE publish_channels
            SET token_status = CASE
                  WHEN ? = 1 THEN 'unsupported'
                  WHEN ? = 1 THEN 'invalid'
                  WHEN (token_expires_at       IS NOT NULL AND token_expires_at       <= NOW())
                    OR (data_access_expires_at IS NOT NULL AND data_access_expires_at <= NOW())
                       THEN 'expired'
                  WHEN (token_expires_at       IS NOT NULL AND TIMESTAMPDIFF(DAY, NOW(), token_expires_at)       < {$warn})
                    OR (data_access_expires_at IS NOT NULL AND TIMESTAMPDIFF(DAY, NOW(), data_access_expires_at) < {$warn})
                       THEN 'expiring'
                  ELSE 'valid' END
          WHERE id = ?"
    );

    $readBack = $db->prepare(
        "SELECT token_status,
                DATE_FORMAT(token_expires_at,       '%d/%m/%Y %H:%i') AS exp_th,
                DATE_FORMAT(data_access_expires_at, '%d/%m/%Y %H:%i') AS data_exp_th,
                TIMESTAMPDIFF(DAY, NOW(), token_expires_at)       AS exp_days,
                TIMESTAMPDIFF(DAY, NOW(), data_access_expires_at) AS data_exp_days
           FROM publish_channels WHERE id = ?"
    );

    foreach ($channels as $ch) {
        $platform = (string) $ch['platform'];
        $label    = ($platform !== '' ? $platform : '(ไม่ระบุ platform)') . ' / ' . $ch['name'];

        try {
            // ช่องทางเดียวที่ตรวจพลาดต้องไม่ทำให้ช่องทางที่เหลือไม่ถูกตรวจ
            $h = fetch_channel_token_health($platform, $ch);
        } catch (Throwable $e) {
            $h = [
                'unsupported' => false, 'is_valid' => false,
                'expires_at' => null, 'data_access_expires_at' => null,
                'error' => 'ตรวจไม่ได้: ' . $e->getMessage(),
            ];
        }

        // 0 = "ไม่มีวันหมดอายุ" ตามความหมายของ Graph API ไม่ใช่ Unix epoch ปี 1970
        // Page token ที่ระบบใช้อยู่คืน 0 — เก็บตรง ๆ จะทำให้ดูเหมือนหมดอายุมาแล้ว 56 ปี
        $exp  = !empty($h['expires_at'])             ? (int) $h['expires_at']             : null;
        $dexp = !empty($h['data_access_expires_at']) ? (int) $h['data_access_expires_at'] : null;
        $err  = $h['error'] !== null && $h['error'] !== '' ? mb_substr((string) $h['error'], 0, 500) : null;

        $writeFacts->execute([$exp, $dexp, $err, $ch['id']]);
        $writeStatus->execute([
            !empty($h['unsupported']) ? 1 : 0,
            ($err !== null || $h['is_valid'] === false) ? 1 : 0,
            $ch['id'],
        ]);

        $readBack->execute([$ch['id']]);
        $st     = $readBack->fetch(PDO::FETCH_ASSOC) ?: ['token_status' => 'invalid'];
        $status = (string) $st['token_status'];
        if (isset($counts[$status])) $counts[$status]++;

        $when = [];
        if ($st['exp_th']      ?? null) $when[] = "token หมดอายุ {$st['exp_th']} (อีก {$st['exp_days']} วัน)";
        if ($st['data_exp_th'] ?? null) $when[] = "data access หมด {$st['data_exp_th']} (อีก {$st['data_exp_days']} วัน)";
        if ($status === 'valid' && !$when) $when[] = 'ไม่มีวันหมดอายุ';

        $detail[] = '  ' . metricsSyncTokenStatusLabel($status) . ' — ' . $label
                  . ($when ? ' · ' . implode(' · ', $when) : '')
                  . ($err !== null ? ' · ' . mb_substr($err, 0, 200) : '');

        // ── แจ้งเตือน: คีย์แยกตามช่องทางเพื่อไม่ให้ช่องทางหนึ่งกลืนเรื่องของอีกช่องทาง
        // ด่วนจริง (มีอีเมล): พ้นเดดไลน์แล้วเผยแพร่และซิงก์เมตริกหยุดทั้งช่องทาง
        if ($status === 'expiring' || $status === 'expired' || $status === 'invalid') {
            ops_alert(
                $db,
                (string) $ch['tenant_id'],
                'token_expiring:' . $ch['id'],
                '🔑 credentials ของช่องทางต้องต่ออายุ: ' . $ch['name'],
                "ช่องทาง: {$label}\n"
                . 'สถานะ: ' . metricsSyncTokenStatusLabel($status) . "\n"
                . ($when ? implode("\n", $when) . "\n" : '')
                . ($err !== null ? "ข้อความจากปลายทาง: {$err}\n" : '')
                . "\nต้องต่ออายุ token หรือขอสิทธิ์ใหม่ก่อนถึงกำหนด ไม่งั้นการเผยแพร่และการซิงก์เมตริกของช่องทางนี้จะหยุด",
                true
            );
        } elseif ($status === 'valid') {
            ops_alert_resolve(
                $db,
                (string) $ch['tenant_id'],
                'token_expiring:' . $ch['id'],
                '✅ credentials ของช่องทางกลับมาปกติ: ' . $ch['name'],
                "ช่องทาง: {$label}\n" . ($when ? implode("\n", $when) : '')
            );
        }
        // 'unsupported' ไม่แจ้งและไม่ปิดเรื่อง — ไม่เคยมีเรื่องให้แจ้งตั้งแต่ต้น
    }

    return array_merge(
        ['  ตรวจอายุ credentials ' . count($channels) . ' ช่องทาง — '
         . "ปกติ {$counts['valid']}, ใกล้หมดอายุ {$counts['expiring']}, "
         . "หมดอายุแล้ว {$counts['expired']}, ใช้ไม่ได้ {$counts['invalid']}, "
         . "ตรวจอายุไม่ได้ {$counts['unsupported']}"],
        $detail
    );
}

/** ป้ายสถานะภาษาไทย — ใช้ทั้งในรายงานของ cron และในข้อความแจ้งเตือน */
function metricsSyncTokenStatusLabel(string $status): string {
    return match ($status) {
        'valid'       => 'ปกติ',
        'expiring'    => 'ใกล้หมดอายุ',
        'expired'     => 'หมดอายุแล้ว',
        'invalid'     => 'ใช้ไม่ได้',
        'unsupported' => 'ตรวจสอบอายุไม่ได้',
        default       => $status,
    };
}

// ตรวจอายุ credentials ก่อนหยิบคิว — ต้องทำงานในรอบที่คิวว่างด้วย เพราะไฟล์นี้ return
// ออกทันทีเมื่อไม่มีแถวให้ซิงก์ และ "คิวว่าง" คือสถานะที่เกิดบ่อยที่สุดเมื่อ token หมดอายุ
// (ไม่มีอะไรเผยแพร่สำเร็จให้ซิงก์) ถ้าวางไว้หลังจุดนั้นรอบที่ต้องรู้ที่สุดจะไม่ตรวจอะไรเลย
//
// try/catch ชั้นนอก: การตรวจที่ล้มทั้งก้อน (เช่น SELECT พัง) ต้องไม่หยุดการซิงก์เมตริก
try {
    $tokenReport = metricsSyncCheckTokens($db);
} catch (Throwable $e) {
    $tokenReport = ['  ตรวจอายุ credentials ล้มเหลวทั้งรอบ: ' . mb_substr($e->getMessage(), 0, 200)];
}

// แถวคิวที่เผยแพร่สำเร็จและมี id โพสต์ให้ใช้ดึง insights
// tenant มาจาก content_items เพราะ content_post_metrics.content_item_id ชี้ไปที่นั่น
// is_active ของ channel ไม่ถูกกรอง: ปิดช่องทางแล้วโพสต์เก่ายังมี engagement ให้เก็บ
$stmt = $db->prepare(
    "SELECT q.id AS queue_id, q.content_id, q.channel_id, q.platform_post_id, q.sent_at,
            ci.tenant_id, pc.platform, pc.credentials_encrypted, pc.name AS channel_name
     FROM content_publish_queue q
     JOIN publish_channels pc ON pc.id = q.channel_id
     JOIN content_items ci    ON ci.id = q.content_id
     WHERE q.status = 'sent'
       AND q.platform_post_id IS NOT NULL AND q.platform_post_id <> ''
     ORDER BY q.sent_at DESC
     LIMIT " . METRICS_SYNC_LIMIT
);
$stmt->execute();
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

// นับแถวที่ sent แต่ไม่มี id โพสต์ — ข้ามได้ (ไม่ใช่ error) แต่ต้องรายงานไม่ใช่หายเงียบ ๆ
$noIdStmt = $db->query(
    "SELECT COUNT(*) FROM content_publish_queue
     WHERE status = 'sent' AND (platform_post_id IS NULL OR platform_post_id = '')"
);
$skippedNoId = (int) $noIdStmt->fetchColumn();

if (empty($rows)) {
    // ไม่ปิดเรื่องแจ้งเตือนในทางออกนี้ — รอบที่ไม่มีอะไรให้ซิงก์ไม่ได้พิสูจน์ว่าปัญหาหายแล้ว
    echo date('[Y-m-d H:i:s]') . " Processed 0 entries, 0 errors"
       . " — ข้าม {$skippedNoId} แถว (ไม่มี id โพสต์), ไม่มีโพสต์ที่พร้อมซิงก์\n";
    foreach ($tokenReport as $line) echo $line . "\n";   // หลังบรรทัดสรุปเสมอ
    return;
}

$ok = 0; $errors = 0; $skippedUnsupported = 0; $cancelled = false;
$log = [];
$seen = [];              // (content_id|channel_id) ที่ซิงก์แล้วในรอบนี้
$touchedContent = [];    // content_id ที่ต้องคำนวณผลรวมใหม่

// สำหรับแจ้งเตือนท้ายรอบ — แยกตาม tenant เพราะข้อความ error มีชื่อช่องทางของ tenant นั้นอยู่
$errorsByTenant   = [];  // tenant_id => ['count' => int, 'samples' => string[]]
$tenantsAttempted = [];  // tenant_id ที่มีโพสต์ถูกลองซิงก์จริงในรอบนี้

foreach ($rows as $row) {
    if (metricsSyncCancelled($db)) {
        $cancelled = true;
        $log[] = '  ยกเลิกโดยแอดมิน — หยุดกลางรอบ';
        break;
    }

    // คอนเทนต์เดียวอาจถูกส่งซ้ำไปช่องทางเดิม (หลายแถวคิว) — เอาแถวล่าสุดต่อช่องทางเท่านั้น
    // ไม่งั้นผลรวมต่อช่องทางจะนับซ้ำ
    $key = $row['content_id'] . '|' . $row['channel_id'];
    if (isset($seen[$key])) continue;
    $seen[$key] = true;

    $channel = [
        'id'                    => $row['channel_id'],
        'platform'              => $row['platform'],
        'credentials_encrypted' => $row['credentials_encrypted'],
        'name'                  => $row['channel_name'],
    ];

    try {
        $res = fetch_post_insights($row['platform'], $channel, (string) $row['platform_post_id']);
    } catch (Exception $e) {
        $res = ['success' => false, 'unsupported' => false, 'error' => $e->getMessage()];
    }

    if (!empty($res['unsupported'])) {
        $skippedUnsupported++;
        continue;
    }

    // ถึงบรรทัดนี้ = tenant นี้ได้คำตอบชี้ขาดแล้วในรอบนี้ (สำเร็จหรือล้มเหลว)
    // ใช้เป็นเงื่อนไขของการปิดเรื่องท้ายรอบ — tenant ที่ไม่มีโพสต์ถูกลองจริงพิสูจน์อะไรไม่ได้
    $tenantsAttempted[(string) $row['tenant_id']] = true;

    if (empty($res['success'])) {
        $errors++;
        $errMsg = mb_substr((string) ($res['error'] ?? 'unknown'), 0, 200);
        $log[] = "  [{$row['queue_id']}] {$row['platform']} ล้มเหลว: " . $errMsg;

        $etid = (string) $row['tenant_id'];
        if (!isset($errorsByTenant[$etid])) $errorsByTenant[$etid] = ['count' => 0, 'samples' => []];
        $errorsByTenant[$etid]['count']++;
        // เก็บตัวอย่างไม่เกิน 3 อัน — โพสต์เก่าหลายสิบโพสต์ล้มด้วยเหตุเดียวกันได้ในรอบเดียว
        if (count($errorsByTenant[$etid]['samples']) < 3) {
            $errorsByTenant[$etid]['samples'][] = "{$row['platform']} / {$row['channel_name']}: {$errMsg}";
        }
        continue;
    }

    // time-series: INSERT แถวใหม่ทุกรอบ ไม่ทับแถวเดิม
    $db->prepare(
        "INSERT INTO content_post_metrics
           (id, tenant_id, content_item_id, channel_id, platform, platform_post_id, views, likes, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())"
    )->execute([
        generateUUID(), $row['tenant_id'], $row['content_id'], $row['channel_id'],
        $row['platform'], $row['platform_post_id'],
        (int) $res['views'], (int) $res['likes'],
    ]);

    $touchedContent[$row['content_id']] = $row['tenant_id'];
    $ok++;
    $log[] = "  [{$row['queue_id']}] {$row['platform']} views={$res['views']} likes={$res['likes']}"
           // warning = ดึงได้แต่ไม่ครบ (เช่น Meta ยกเลิกชื่อ metric บางตัว) — ต้องเห็นใน log
           // ไม่นับเป็น error เพราะยังได้ตัวเลขบางส่วนและไม่ควรทำให้รอบ cron ดูล้มเหลว
           . (!empty($res['warning']) ? ' ⚠ ' . mb_substr((string) $res['warning'], 0, 150) : '');
}

// เขียนผลรวมทุกช่องทางกลับ content_items.views/likes ให้การ์ดและ ranking เดิมอ่านได้
// ใช้ "แถวล่าสุดต่อช่องทาง" จากตาราง time-series ไม่ใช่แค่ค่าที่ดึงได้ในรอบนี้
// เพื่อไม่ให้ช่องทางที่ fetch พลาดรอบนี้หายไปจากผลรวม
//
// series_key = channel_id ถ้ามี ถ้าไม่มีใช้ platform_post_id แทน: channel ที่ถูกลบ
// ทำให้ channel_id เป็น NULL (FK SET NULL) การจับกลุ่มด้วย NULL จะรวมโพสต์
// ต่างช่องทางเป็นก้อนเดียวและทำให้ผลรวมขาด
//
// GROUP BY series_key ชั้นใน: fetched_at เป็น DATETIME ความละเอียดระดับวินาที
// ถ้าสองรอบรันตกในวินาทีเดียวกัน MAX(fetched_at) จะ match สองแถวของช่องทางเดียว
// การยุบเป็นค่าเดียวต่อช่องทางก่อนบวกจึงกันการนับซ้ำ
$sumStmt = $db->prepare(
    "SELECT COALESCE(SUM(s.views), 0) AS v, COALESCE(SUM(s.likes), 0) AS l
     FROM (SELECT MAX(m.views) AS views, MAX(m.likes) AS likes
             FROM content_post_metrics m
             JOIN (SELECT COALESCE(channel_id, CONCAT('#', platform_post_id)) AS series_key,
                          MAX(fetched_at) AS mx
                     FROM content_post_metrics
                    WHERE content_item_id = ?
                    GROUP BY series_key) t
               ON t.series_key = COALESCE(m.channel_id, CONCAT('#', m.platform_post_id))
              AND t.mx = m.fetched_at
            WHERE m.content_item_id = ?
            GROUP BY COALESCE(m.channel_id, CONCAT('#', m.platform_post_id))) s"
);
$updStmt = $db->prepare("UPDATE content_items SET views = ?, likes = ? WHERE id = ? AND tenant_id = ?");
foreach ($touchedContent as $contentId => $tenantId) {
    $sumStmt->execute([$contentId, $contentId]);
    $sum = $sumStmt->fetch(PDO::FETCH_ASSOC) ?: ['v' => 0, 'l' => 0];
    $updStmt->execute([(int) $sum['v'], (int) $sum['l'], $contentId, $tenantId]);
}

// สรุปก่อน (cron-manager อ่าน match แรก) แล้วค่อยรายละเอียด
echo date('[Y-m-d H:i:s]') . " Processed {$ok} entries, {$errors} errors"
   . " — ข้าม {$skippedUnsupported} (platform ไม่รองรับ), ข้าม {$skippedNoId} (ไม่มี id โพสต์)"
   . ', อัปเดต content_items ' . count($touchedContent) . ' รายการ'
   . ($cancelled ? ' [ยกเลิกกลางรอบ]' : '') . "\n";

if (count($rows) === METRICS_SYNC_LIMIT) {
    echo '  หมายเหตุ: ชนเพดาน ' . METRICS_SYNC_LIMIT . " แถวต่อรอบ — ส่วนที่เหลือจะถูกซิงก์รอบถัดไป\n";
}

foreach ($log as $line) echo $line . "\n";

// ผลตรวจอายุ credentials — พิมพ์หลังบรรทัดสรุปเสมอ (เหตุผลอยู่ใน docblock ของ
// metricsSyncCheckTokens()) จำนวนช่องทางในนี้ไม่ถูกนับในตัวนับ errors ของรอบซิงก์
foreach ($tokenReport as $line) echo $line . "\n";

// ── แจ้งเตือนท้ายรอบ ──────────────────────────────────────────────────────────
// หนึ่งเรื่องต่อรอบรันต่อ tenant ไม่ใช่หนึ่งเรื่องต่อโพสต์: โพสต์เก่าหลายรายการล้มด้วย
// เหตุเดียวกันได้ในรอบเดียว (ปัจจุบัน 8 โพสต์ของเพจเก่าล้มพร้อมกันทุกรอบ)
// แยกตาม tenant เพราะ ops_alerts มี UNIQUE (alert_key, tenant_id) และข้อความมีชื่อ
// ช่องทางของ tenant นั้น ห้ามส่งข้ามไปให้แอดมินของ tenant อื่น
//
// ไม่ใช่เรื่องด่วน (ไม่ส่งอีเมล): เมตริกที่ค้างทำให้แดชบอร์ดแสดงตัวเลขเก่า ซึ่งต่างจาก
// token ที่หมดอายุแล้วเผยแพร่ไม่ได้เลย — แจ้งในแอปพอสำหรับเรื่องนี้
foreach ($errorsByTenant as $etid => $einfo) {
    ops_alert(
        $db,
        $etid,
        'metrics_sync_fail',
        "⚠️ ซิงก์เมตริกโพสต์ล้มเหลว {$einfo['count']} รายการ",
        "งาน: content-metrics-sync\n"
        . "จำนวนที่ล้มเหลว: {$einfo['count']} รายการ\n\n"
        . "ตัวอย่างข้อความจากปลายทาง:\n" . implode("\n", $einfo['samples'])
    );
}

// ปิดเรื่องเฉพาะ tenant ที่รอบนี้ลองซิงก์จริงแล้วไม่มี error เลย
// รอบที่ถูกยกเลิกกลางทางไม่ปิดเรื่อง — การยกเลิกไม่ได้พิสูจน์ว่าปัญหาหายแล้ว
if (!$cancelled) {
    foreach (array_keys($tenantsAttempted) as $etid) {
        if (isset($errorsByTenant[$etid])) continue;
        ops_alert_resolve(
            $db,
            $etid,
            'metrics_sync_fail',
            '✅ ซิงก์เมตริกโพสต์กลับมาปกติ',
            "งาน: content-metrics-sync\nรอบล่าสุดซิงก์ได้โดยไม่มีข้อผิดพลาด"
        );
    }
}
