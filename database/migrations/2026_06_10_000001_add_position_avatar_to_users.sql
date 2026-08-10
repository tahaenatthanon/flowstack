-- Migration: add missing columns to users table for production sync
-- Run on production if login fails with "Unknown column 'position'"

ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `position`   varchar(255) NOT NULL DEFAULT '' AFTER `display_name`,
  ADD COLUMN IF NOT EXISTS `avatar_url` varchar(500) NOT NULL DEFAULT '' AFTER `position`;
