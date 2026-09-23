<?php
// ตรวจสถานะ + ดาวน์โหลดคลิปวิดีโอรายฉากที่ยังสร้างอยู่ และเก็บงานค้าง (multi-clip-video)
//
// Run via: php api/cron/video-clips-sync.php
// เรียกผ่าน tick.php ด้วย type='include' (ลงทะเบียนใน cron_jobs, key='video-clips-sync', ทุก 1 นาที)
//
// งบเวลา 40 วินาทีต่อรอบ — tick include งานทุกงานต่อกันในโปรเซสเดียว ห้ามถ่วง publish-scheduler
// การดาวน์โหลดที่ไม่ครบในรอบนี้ต่อจากไฟล์ .part ในรอบถัดไป (CDN ของ kie รองรับ Range)
// ตรรกะอยู่ใน videoClipsSyncRun() (api/lib/video-clips.php) — ใช้ videoClipPollOne() ตัวเดียวกับ clip-status
//
// ลำดับการ echo: สรุปผลก่อน เพราะ cron-runner.php ดึง "N entries" / "N error" ด้วย preg_match (match แรก)

if (!defined('CRON_MODE')) define('CRON_MODE', true);
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/video-clips.php';

$videoClipsSyncDb = getDB();
$videoClipsSyncResult = videoClipsSyncRun($videoClipsSyncDb, 40, 30);

echo 'video-clips-sync: ' . $videoClipsSyncResult['polled'] . ' entries, ' . $videoClipsSyncResult['failed'] . ' error'
   . ' — done ' . $videoClipsSyncResult['done'] . ' · ยังสร้างอยู่ ' . $videoClipsSyncResult['generating']
   . ' · เลื่อนไปรอบหน้า ' . $videoClipsSyncResult['out_of_time']
   . ' · งานค้าง: ส่งไม่สำเร็จ ' . $videoClipsSyncResult['orphaned'] . ', หมดเวลา ' . $videoClipsSyncResult['timed_out']
   . ', รวมค้าง ' . $videoClipsSyncResult['stale_combines'] . "\n";
