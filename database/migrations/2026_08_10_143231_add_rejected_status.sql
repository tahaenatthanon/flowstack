-- Add 'rejected' (ปฏิเสธ) to content_items.status enum so the approval list page
-- can distinguish content rejected by an approver from 'draft' saved by the creator.
-- Order follows the existing enum with 'rejected' appended after 'review'.
-- See openspec/changes/improve-content-approval-list/
ALTER TABLE content_items
  MODIFY COLUMN status ENUM('published','draft','revision','review','rejected')
  NOT NULL DEFAULT 'draft';
