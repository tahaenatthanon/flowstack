-- Add 'revision' (รอแก้ไข) to content_items.status enum so the Content list page
-- can filter by the รอแก้ไข status sub-tab.
-- Order follows the existing enum with 'revision' inserted after 'draft'.
-- See openspec/changes/add-content-status-subtabs/
ALTER TABLE content_items
  MODIFY COLUMN status ENUM('published','draft','revision','review')
  NOT NULL DEFAULT 'draft';
