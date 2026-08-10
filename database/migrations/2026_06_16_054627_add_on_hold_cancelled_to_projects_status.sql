-- Add 'on-hold' and 'cancelled' to projects.status enum
ALTER TABLE `projects`
  MODIFY COLUMN `status` ENUM('on-track','at-risk','delayed','completed','on-hold','cancelled')
  NOT NULL DEFAULT 'on-track'
  COMMENT 'Project status';
