-- Article Writing Style — persist the user's selected writing style on the canonical content item.
-- NULL is retained for legacy content created before this migration.
-- New Article generation stores one of: friendly, formal, educational, storytelling.

ALTER TABLE `content_items`
  ADD COLUMN `tone` VARCHAR(32) NULL AFTER `type`;

CREATE INDEX `idx_content_items_tenant_tone`
  ON `content_items` (`tenant_id`, `tone`);
