-- Add external_id (Domino @unid) to support tables for idempotent migration upserts.
-- Allows re-running the support.nsf migration without creating duplicates.

ALTER TABLE `support_contracts`
  ADD COLUMN `external_id` VARCHAR(64) NULL DEFAULT NULL COMMENT 'Domino @unid (migration source key)' AFTER `id`,
  ADD UNIQUE KEY `uq_sc_external_id` (`external_id`);

ALTER TABLE `support_tickets`
  ADD COLUMN `external_id` VARCHAR(64) NULL DEFAULT NULL COMMENT 'Domino @unid (migration source key)' AFTER `id`,
  ADD UNIQUE KEY `uq_st_external_id` (`external_id`);

ALTER TABLE `support_attachments`
  ADD COLUMN `external_id` VARCHAR(128) NULL DEFAULT NULL COMMENT 'Domino @unid + filename (migration source key)' AFTER `id`,
  ADD UNIQUE KEY `uq_sa_external_id` (`external_id`);
