-- Persist Video Script Style and requested duration on the canonical content item.
-- NULL is retained for legacy/non-video content.

ALTER TABLE `content_items`
  ADD COLUMN `script_style` VARCHAR(32) NULL AFTER `tone`,
  ADD COLUMN `duration_sec` INT NULL AFTER `script_style`;

CREATE INDEX `idx_content_items_tenant_video_config`
  ON `content_items` (`tenant_id`, `script_style`, `duration_sec`);
