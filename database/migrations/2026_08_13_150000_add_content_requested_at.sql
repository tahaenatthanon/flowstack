-- Record when a content item is sent for approval (transition into `pending_approval`).
-- Nullable: items that have never been requested still have NULL; the approval list
-- sort falls back to `updated_at` via COALESCE for legacy rows.
ALTER TABLE content_items
  ADD COLUMN requested_at DATETIME NULL AFTER reject_reason;
