-- Migration: Add missing AI and billing cron jobs to cron_jobs table
-- ai-digest.php: generates daily AI notifications for overdue/deadline tasks
-- billing-reminders.php: checks expiring subscriptions and sends email reminders

INSERT IGNORE INTO `cron_jobs` (`id`, `key`, `name`, `description`, `interval_label`, `type`, `endpoint`, `file_path`, `http_method`, `query_string`, `enabled`, `created_at`, `updated_at`) VALUES
(UUID(), 'ai-digest', 'AI Daily Digest', 'สร้าง ai_notifications สำหรับงานเกินกำหนดและ deadline วันนี้ ทุก user', 'ทุกวัน 07:30', 'include', NULL, 'api/cron/ai-digest.php', 'GET', NULL, 1, NOW(), NOW()),
(UUID(), 'billing-reminders', 'Billing Reminders', 'ตรวจสอบ subscription ที่ใกล้หมดอายุและส่ง email แจ้งเตือน admin', 'ทุกวัน 09:00', 'include', NULL, 'api/cron/billing-reminders.php', 'GET', NULL, 1, NOW(), NOW());
