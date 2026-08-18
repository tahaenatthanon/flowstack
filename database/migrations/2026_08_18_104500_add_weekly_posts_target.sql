-- Phase 5: Result metrics
-- เพิ่มเป้าหมายความถี่การโพสต์รายสัปดาห์ใน content_global_settings
-- ค่า 0 = ยังไม่ได้ตั้งเป้าหมาย (ไม่กระทบ flow เดิม)
ALTER TABLE `content_global_settings`
  ADD COLUMN IF NOT EXISTS `weekly_posts_target` TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER `seo_gate_min_score`;
