-- ลงทะเบียน cron ซิงก์ engagement ของโพสต์ที่เผยแพร่แล้ว (เฟส 2: post metrics sync)
--
-- type='include' + file_path — รูปแบบเดียวกับ publish-scheduler / ai-digest / billing-reminders
-- คอลัมน์ `key` เป็น reserved word ของ MySQL จึงต้อง backtick
-- ทุก 6 ชั่วโมง: Graph API insights ไม่อัปเดตเป็นวินาที และมี rate limit ต่อ token
--   ถี่กว่านี้ได้ตัวเลขเดิมแต่เปลืองโควตา (แอดมินปรับ interval ได้จากหน้า Cron Manager)

INSERT IGNORE INTO `cron_jobs`
  (`id`, `key`, `name`, `description`, `interval_label`, `type`, `endpoint`, `file_path`, `http_method`, `query_string`, `enabled`, `created_at`, `updated_at`)
VALUES
  (UUID(), 'content-metrics-sync', 'Content Metrics Sync',
   'ดึง views/likes ของโพสต์ที่เผยแพร่สำเร็จ (Facebook/Instagram) เขียนลง content_post_metrics แบบ time-series และผลรวมทุกช่องทางลง content_items',
   'ทุก 6 ชั่วโมง', 'include', NULL, 'api/cron/content-metrics-sync.php', 'GET', NULL, 1, NOW(), NOW());
