<?php
// ดึง page insights รายวันของเพจ Facebook ลง facebook_page_insights_daily
// (change: facebook-page-insights-dashboard)
//
// Run via: php api/cron/facebook-page-insights-sync.php
// เรียกผ่าน cron-manager ด้วย type='include' (ลงทะเบียนใน cron_jobs key 'facebook-page-insights-sync')
//
// ช่วงวันที่ต่อรอบ:
//   - tenant ที่มีข้อมูลแล้ว → ย้อนหลัง 3 วัน แล้ว upsert ทับ เพราะ Meta ลง/ปรับค่าของวันล่าสุดย้อนหลัง
//     (ทดสอบจริง: page_video_view_time ทั้งก้อนไปโผล่ที่วันล่าสุดวันเดียว)
//   - tenant ที่ยังไม่มีข้อมูลเลย → ย้อนหลัง 90 วัน (ไม่เกินเพดาน since/until ~93 วันต่อคำขอ)
//
// เพจเดียวต่อ tenant (ตัดสินใจแล้ว ไม่รองรับหลายเพจ): ถ้ามีช่องทาง Facebook ที่เปิดใช้มากกว่า 1
// ใช้ช่องทางที่สร้างก่อนสุด และรายงานช่องทางที่ข้ามใน log
//
// ไม่ตรวจอายุ token ซ้ำ — content-metrics-sync ทำและแจ้งเตือนอยู่แล้วทุกรอบ
//
// ลำดับการ echo: สรุปผลก่อน แล้วค่อยรายละเอียด — cron-runner อ่าน "N entries" / "N error"
// จาก match แรก และ cron_runs.notes เก็บแค่ 500 ตัวอักษรแรก
if (!defined('CRON_MODE')) define('CRON_MODE', true);
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/insights-fetch.php';

$db = getDB();

const PAGE_INSIGHTS_REFRESH_DAYS  = 3;
const PAGE_INSIGHTS_BACKFILL_DAYS = 90;

/** ตั้งชื่อไม่ซ้ำฟังก์ชันของ cron อื่น กันชนกันถ้าถูก include ในโปรเซสเดียว */
function pageInsightsCancelled(PDO $db): bool {
    if (empty($GLOBALS['cron_run_id'])) return false;
    $stmt = $db->prepare('SELECT cancel_requested FROM cron_runs WHERE id = ?');
    $stmt->execute([$GLOBALS['cron_run_id']]);
    return (bool) $stmt->fetchColumn();
}

// ช่องทาง Facebook ที่เปิดใช้ เรียงให้ช่องทางที่สร้างก่อนสุดของแต่ละ tenant มาก่อน
$channels = $db->query(
    "SELECT id, tenant_id, name, credentials_encrypted
       FROM publish_channels
      WHERE platform = 'facebook' AND is_active = 1
      ORDER BY tenant_id, created_at, id"
)->fetchAll(PDO::FETCH_ASSOC);

$byTenant = [];
$skippedChannels = [];
foreach ($channels as $ch) {
    $tid = (string) $ch['tenant_id'];
    if (isset($byTenant[$tid])) {
        $skippedChannels[] = $ch['name'];
        continue;
    }
    $byTenant[$tid] = $ch;
}

if (!$byTenant) {
    echo date('[Y-m-d H:i:s]') . " Processed 0 entries, 0 errors — ไม่มีช่องทาง Facebook ที่เปิดใช้\n";
    return;
}

$hasData = $db->prepare('SELECT 1 FROM facebook_page_insights_daily WHERE tenant_id = ? LIMIT 1');
$upsert  = $db->prepare(
    "INSERT INTO facebook_page_insights_daily (id, tenant_id, metric_date, metric, value, value_json, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE value = VALUES(value), value_json = VALUES(value_json), fetched_at = VALUES(fetched_at)"
);

$points = 0; $errors = 0; $cancelled = false;
$log = [];

foreach ($byTenant as $tid => $ch) {
    if (pageInsightsCancelled($db)) {
        $cancelled = true;
        $log[] = '  ยกเลิกโดยแอดมิน — หยุดกลางรอบ';
        break;
    }

    $hasData->execute([$tid]);
    $days  = $hasData->fetchColumn() ? PAGE_INSIGHTS_REFRESH_DAYS : PAGE_INSIGHTS_BACKFILL_DAYS;
    // until = พรุ่งนี้ เพื่อให้ได้ค่าของวันนี้ที่ Meta มีแล้ว (until เป็นขอบบนแบบไม่รวม)
    $since = date('Y-m-d', strtotime("-{$days} days"));
    $until = date('Y-m-d', strtotime('+1 day'));

    try {
        $res = fetch_facebook_page_insights(insights_channel_creds($ch), $since, $until);
    } catch (Throwable $e) {
        $res = ['success' => false, 'points' => [], 'warning' => null, 'error' => $e->getMessage()];
    }

    if (empty($res['success'])) {
        $errors++;
        $log[] = "  [{$ch['name']}] ล้มเหลว: " . mb_substr((string) $res['error'], 0, 200);
        continue;   // tenant หนึ่งล้มเหลวต้องไม่หยุด tenant อื่น
    }

    $n = 0;
    foreach ($res['points'] as $p) {
        $upsert->execute([
            generateUUID(), $tid, $p['date'], $p['metric'], $p['value'],
            $p['value_json'] !== null ? json_encode($p['value_json'], JSON_UNESCAPED_UNICODE) : null,
        ]);
        $n++;
    }
    $points += $n;
    $log[] = "  [{$ch['name']}] {$since} → {$until} ({$days} วัน) บันทึก {$n} จุด"
           . (!empty($res['warning']) ? ' ⚠ ' . mb_substr((string) $res['warning'], 0, 150) : '');
}

echo date('[Y-m-d H:i:s]') . " Processed {$points} entries, {$errors} errors"
   . ' — ' . count($byTenant) . ' เพจ'
   . ($skippedChannels ? ', ข้ามช่องทาง Facebook ที่ซ้ำใน tenant เดียวกัน: ' . implode(', ', $skippedChannels) : '')
   . ($cancelled ? ' (ยกเลิกกลางรอบ)' : '') . "\n";
foreach ($log as $line) echo $line . "\n";
