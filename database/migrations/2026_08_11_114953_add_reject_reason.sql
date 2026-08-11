-- Store the approver's reason when a content item is rejected or sent back for revision.
-- Nullable because a reason is optional — the status change alone is still valid.
-- See openspec/changes/improve-content-approval-list/
ALTER TABLE content_items
  ADD COLUMN reject_reason TEXT NULL AFTER status;
