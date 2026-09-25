-- ลงทะเบียน cron ดึง page insights ของ Facebook วันละครั้ง (change: facebook-page-insights-dashboard)
--
-- type='include' รูปแบบเดียวกับ content-metrics-sync / video-clips-sync
-- 02:00 ทุกวัน: ข้อมูลเพจเป็นรายวัน ถี่กว่านี้ได้ตัวเลขเดิม (แอดมินปรับได้ที่หน้า Cron Manager)
-- ⚠️ รันด้วย --default-character-set=utf8mb4 ไม่งั้นข้อความไทยกลายเป็น ???

INSERT IGNORE INTO cron_jobs (id, `key`, name, description, interval_label, type, endpoint, file_path, http_method, query_string, enabled, cron_expression)
VALUES
  (UUID(), 'facebook-page-insights-sync', 'Facebook Page Insights Sync',
   'ดึง page insights รายวัน (ผู้ติดตาม, เข้าชมเพจ, reaction, วิดีโอ) ของเพจ Facebook ลง facebook_page_insights_daily — ดึงย้อนหลัง 3 วันทุกรอบ รอบแรก 90 วัน',
   'ทุกวัน 02:00', 'include', NULL, 'api/cron/facebook-page-insights-sync.php', 'GET', NULL, 1, '0 2 * * *');
