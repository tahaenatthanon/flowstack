-- Phase 4: SEO checklist publish gate
-- เพิ่มการตั้งค่าเกต SEO ใน content_global_settings (default ปิด — ไม่กระทบ flow เดิม)
ALTER TABLE `content_global_settings`
  ADD COLUMN IF NOT EXISTS `seo_gate_enabled`   TINYINT(1)       NOT NULL DEFAULT 0 AFTER `product_refs`,
  ADD COLUMN IF NOT EXISTS `seo_gate_min_score` TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER `seo_gate_enabled`;
