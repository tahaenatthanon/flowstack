<?php
// ส่งแคมเปญอีเมลที่ตั้งเวลาไว้ (email_campaigns.status='scheduled') เมื่อถึง scheduled_at
//
// Run via: php api/cron/send-scheduled-campaigns.php
// เรียกผ่าน cron-manager/tick ด้วย type='include' (ลงทะเบียนใน cron_jobs, key='send-scheduled-campaigns')
//
// ลำดับการ echo: สรุปผลก่อน แล้วค่อยรายละเอียด — เพราะ api/lib/cron-runner.php:286-287
// ใช้ preg_match (นับ match แรก) ดึง "N entries" / "N error" จาก output และ notes เก็บแค่ 500 ตัวอักษรแรก
// (ดูหมายเหตุเดียวกันใน api/cron/content-metrics-sync.php) — จึงคำนวณผลลัพธ์ทั้งหมดให้เสร็จก่อน
// แล้วค่อย echo สรุปเป็นบรรทัดแรก ไม่ echo อะไรระหว่างลูป

if (!defined('CRON_MODE')) define('CRON_MODE', true);
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/email-campaign-sender.php';
// ไฟล์นี้รันเดี่ยวได้ด้วย (ดูหัวไฟล์) จึง require เองไม่พึ่งว่า cron-runner.php โหลดไว้แล้ว
require_once __DIR__ . '/../lib/ops-alert.php';

$db = getDB();

$stmt = $db->prepare("
    SELECT id, tenant_id, created_by
    FROM email_campaigns
    WHERE status = 'scheduled' AND scheduled_at <= NOW()
    ORDER BY scheduled_at ASC
");
$stmt->execute();
$dueCampaigns = $stmt->fetchAll(PDO::FETCH_ASSOC);

$sentCount = 0;
$errorCount = 0;
$details = [];

foreach ($dueCampaigns as $row) {
    $id = $row['id'];
    try {
        $result = sendCampaignCore($db, $id, (string)$row['created_by'], (string)$row['tenant_id']);
        if ($result['ok']) {
            $sentCount++;
            $details[] = "  [{$id}] sent — {$result['data']['recipients']} ok, {$result['data']['failed']} failed";
        } else {
            $errorCount++;
            $details[] = "  [{$id}] error: {$result['error']}";
        }
    } catch (Throwable $e) {
        // A single campaign blowing up (e.g. malformed template) must not stop
        // the rest of the due campaigns from being sent this tick.
        $errorCount++;
        $details[] = "  [{$id}] exception: {$e->getMessage()}";
    }
}

echo date('[Y-m-d H:i:s]') . ' Processed ' . count($dueCampaigns) . ' entries, ' . $errorCount . ' errors' . PHP_EOL;
foreach ($details as $line) {
    echo $line . PHP_EOL;
}

if ($errorCount > 0) {
    ops_alert(
        $db,
        null,
        'send_scheduled_campaigns_fail',
        "⚠️ ส่งแคมเปญตามเวลาล้มเหลวบางส่วน ({$errorCount} แคมเปญ)",
        "รอบนี้ประมวลผล " . count($dueCampaigns) . " แคมเปญ สำเร็จ {$sentCount} ล้มเหลว {$errorCount}\n\n" . implode("\n", $details)
    );
}
