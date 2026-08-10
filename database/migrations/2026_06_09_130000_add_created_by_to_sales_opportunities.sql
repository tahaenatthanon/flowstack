ALTER TABLE `sales_opportunities`
  ADD COLUMN `created_by` CHAR(36) NULL COMMENT 'FK to users (ผู้สร้าง lead)'
  AFTER `assigned_to`;
