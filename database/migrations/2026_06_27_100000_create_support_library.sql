-- Support manual / handbook library (migrated from Domino AttachFile docs).
-- Backs the "คู่มือ" tab on the Support page.

CREATE TABLE IF NOT EXISTS `support_library` (
  `id`          CHAR(36)      NOT NULL,
  `external_id` VARCHAR(160)  NULL COMMENT 'Domino @unid + filename (migration key)',
  `tenant_id`   CHAR(36)      NOT NULL,
  `subject`     VARCHAR(500)  NOT NULL DEFAULT '',
  `company`     VARCHAR(255)  NOT NULL DEFAULT '',
  `company_id`  CHAR(36)      NULL,
  `cn`          VARCHAR(100)  NOT NULL DEFAULT '',
  `contact`     VARCHAR(255)  NOT NULL DEFAULT '',
  `file_name`   VARCHAR(255)  NOT NULL,
  `file_path`   VARCHAR(500)  NOT NULL,
  `file_size`   INT           NOT NULL DEFAULT 0,
  `mime_type`   VARCHAR(100)  NOT NULL DEFAULT '',
  `doc_date`    DATE          NULL,
  `created_by`  CHAR(36)      NULL,
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_lib_external` (`external_id`),
  KEY `idx_lib_tenant`  (`tenant_id`),
  KEY `idx_lib_company` (`company_id`),
  KEY `idx_lib_subject` (`subject`(100)),
  CONSTRAINT `fk_lib_company` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
