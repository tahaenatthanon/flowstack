-- multi-clip-video: cron poll + ดาวน์โหลดคลิปวิดีโอที่ค้าง (ผู้ใช้ปิดแท็บ) และเก็บงานค้าง
-- type='include' รูปแบบเดียวกับ content-metrics-sync / send-scheduled-campaigns
-- ⚠️ รันด้วย --default-character-set=utf8mb4 ไม่งั้นข้อความไทยกลายเป็น ???

INSERT IGNORE INTO cron_jobs (id, `key`, name, description, interval_label, type, endpoint, file_path, http_method, query_string, enabled, cron_expression)
VALUES
  (UUID(), 'video-clips-sync', 'Video Clips Sync', 'ตรวจสถานะและดาวน์โหลดคลิปวิดีโอรายฉากที่ยังสร้างอยู่ (content_video_clips.status=generating) และเก็บงานค้าง', 'ทุก 1 นาที', 'include', NULL, 'api/cron/video-clips-sync.php', 'GET', NULL, 1, '* * * * *');
