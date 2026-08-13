-- Repair content_items whose status became empty string ('').
--
-- Root cause: the frontend was writing `pending_approval` before the status
-- ENUM on this database had been migrated to include that value. In MariaDB
-- non-strict mode, an unrecognized enum value is coerced to index 0 (empty
-- string) instead of raising an error.
--
-- These rows were "ขออนุมัติ" (request-approval) attempts, so restoring them to
-- `pending_approval` matches the user's original intent. The ENUM has already
-- been migrated to include `pending_approval` (see
-- 2026_08_11_171224_refactor_content_status_enum.sql).
--
-- See openspec/changes/fix-approval-buttons-not-showing/
UPDATE content_items
SET status = 'pending_approval'
WHERE status = '';
