-- Add platforms column to content_items to store the list of selected publish
-- platforms as a JSON array. This decouples content generation from a single
-- platform value so one generated item can target multiple publish channels.
--
-- content_items.platform (varchar, single value) is kept as the FIRST selected
-- platform for backward compatibility with existing queries and features.

ALTER TABLE content_items
  ADD COLUMN platforms TEXT DEFAULT NULL COMMENT 'JSON array of selected publish platforms' AFTER platform;
