-- Phase 0: publish result tracking
-- เพิ่มคอลัมน์บันทึกผลการเผยแพร่คอนเทนต์ใน 3 ตาราง
--   content_items         : published_at, published_url, external_post_id, approved_at
--   content_publish_queue : platform_post_id, published_url
--   content_schedules     : platform_post_id, published_url
-- คอลัมน์ทั้งหมดเป็น NULL (ไม่กระทบข้อมูลเดิม); ใช้ IF NOT EXISTS เพื่อให้รันซ้ำได้

ALTER TABLE `content_items`
  ADD COLUMN IF NOT EXISTS `published_at`     DATETIME      NULL AFTER `requested_at`,
  ADD COLUMN IF NOT EXISTS `published_url`    VARCHAR(1000) NULL AFTER `published_at`,
  ADD COLUMN IF NOT EXISTS `external_post_id` VARCHAR(255)  NULL AFTER `published_url`,
  ADD COLUMN IF NOT EXISTS `approved_at`      DATETIME      NULL AFTER `external_post_id`;

ALTER TABLE `content_publish_queue`
  ADD COLUMN IF NOT EXISTS `platform_post_id` VARCHAR(255)  NULL AFTER `sent_at`,
  ADD COLUMN IF NOT EXISTS `published_url`    VARCHAR(1000) NULL AFTER `platform_post_id`;

ALTER TABLE `content_schedules`
  ADD COLUMN IF NOT EXISTS `platform_post_id` VARCHAR(255)  NULL AFTER `publish_result`,
  ADD COLUMN IF NOT EXISTS `published_url`    VARCHAR(1000) NULL AFTER `platform_post_id`;
