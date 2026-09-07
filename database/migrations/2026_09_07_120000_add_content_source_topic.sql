-- Content Source Topic — preserve the original topic supplied by the user.
-- source_topic is immutable application-level source of truth for Research.
-- Existing rows are backfilled from the current title as the safest available value.

ALTER TABLE `content_items`
  ADD COLUMN `source_topic` VARCHAR(255) NULL AFTER `title`;

UPDATE `content_items`
SET `source_topic` = NULLIF(TRIM(`title`), '')
WHERE `source_topic` IS NULL;

CREATE INDEX `idx_content_items_tenant_source_topic`
  ON `content_items` (`tenant_id`, `source_topic`);
