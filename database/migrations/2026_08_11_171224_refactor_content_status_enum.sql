-- Refactor content_items.status workflow:
--   1. Rename `review` -> `pending_approval` (position 4 is unchanged, so existing
--      rows keep their value — MariaDB stores ENUM by ordinal, not by string).
--   2. Append `approved` as the new last value, between approval and publication.
-- Positions 1-3 and 5 are untouched, so no data is rewritten.
ALTER TABLE content_items
  MODIFY COLUMN status ENUM('published','draft','revision','pending_approval','rejected','approved')
  NOT NULL DEFAULT 'draft';
