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

$db = getDB();

// เพดานต่อรอบ — กัน cron ค้างเมื่อคิวโตขึ้น (รายงานไว้ใน log ถ้าชนเพดาน ไม่ตัดเงียบ ๆ)
const METRICS_SYNC_LIMIT = 200;

/** ตั้งชื่อไม่ซ้ำ isCancelled() ของ publish-scheduler.php กันชนกันถ้าถูก include ในโปรเซสเดียว */
function metricsSyncCancelled(PDO $db): bool {
    if (empty($GLOBALS['cron_run_id'])) return false;
    $stmt = $db->prepare('SELECT cancel_requested FROM cron_runs WHERE id = ?');
    $stmt->execute([$GLOBALS['cron_run_id']]);
    return (bool)$stmt->fetchColumn();
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
    echo date('[Y-m-d H:i:s]') . " Processed 0 entries, 0 errors"
       . " — ข้าม {$skippedNoId} แถว (ไม่มี id โพสต์), ไม่มีโพสต์ที่พร้อมซิงก์\n";
    return;
}

$ok = 0; $errors = 0; $skippedUnsupported = 0; $cancelled = false;
$log = [];
$seen = [];              // (content_id|channel_id) ที่ซิงก์แล้วในรอบนี้
$touchedContent = [];    // content_id ที่ต้องคำนวณผลรวมใหม่

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
    if (empty($res['success'])) {
        $errors++;
        $log[] = "  [{$row['queue_id']}] {$row['platform']} ล้มเหลว: "
               . mb_substr((string) ($res['error'] ?? 'unknown'), 0, 200);
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
