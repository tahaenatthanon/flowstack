-- 1. plan_limits
CREATE TABLE IF NOT EXISTS `plan_limits` (
  `plan`       ENUM('trial','starter','pro','enterprise') NOT NULL,
  `max_users`  INT NOT NULL DEFAULT 1 COMMENT '0 = unlimited',
  `price_thb`  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `trial_days` INT NOT NULL DEFAULT 0,
  `is_active`  TINYINT(1) NOT NULL DEFAULT 1,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`plan`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `plan_limits` (`plan`,`max_users`,`price_thb`,`trial_days`,`is_active`) VALUES
  ('trial',      1,     0.00, 30, 1),
  ('starter',    5,   990.00,  0, 1),
  ('pro',       20,  2990.00,  0, 1),
  ('enterprise', 0,     0.00,  0, 1)
ON DUPLICATE KEY UPDATE `max_users`=VALUES(`max_users`);

-- 2. is_superadmin on users
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `is_superadmin` TINYINT(1) NOT NULL DEFAULT 0;

-- 3. subscriptions
CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id`         CHAR(36) NOT NULL,
  `tenant_id`  CHAR(36) NOT NULL,
  `plan`       ENUM('trial','starter','pro','enterprise') NOT NULL DEFAULT 'trial',
  `started_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME NULL COMMENT 'NULL = no expiry',
  `status`     ENUM('active','expired','cancelled','suspended') NOT NULL DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sub_tenant` (`tenant_id`),
  CONSTRAINT `fk_sub_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed existing tenants with active subscriptions
INSERT IGNORE INTO `subscriptions` (`id`,`tenant_id`,`plan`,`started_at`,`expires_at`,`status`)
SELECT UUID(), t.id, t.plan,
       t.created_at,
       CASE t.plan WHEN 'trial' THEN DATE_ADD(t.created_at, INTERVAL 30 DAY) ELSE NULL END,
       'active'
FROM tenants t;

-- 4. invoices
CREATE TABLE IF NOT EXISTS `invoices` (
  `id`         CHAR(36) NOT NULL,
  `tenant_id`  CHAR(36) NOT NULL,
  `plan`       ENUM('trial','starter','pro','enterprise') NOT NULL,
  `amount`     DECIMAL(10,2) NOT NULL,
  `due_date`   DATE NOT NULL,
  `status`     ENUM('pending','paid','overdue','cancelled') NOT NULL DEFAULT 'pending',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_inv_tenant` (`tenant_id`),
  CONSTRAINT `fk_inv_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. payments
CREATE TABLE IF NOT EXISTS `payments` (
  `id`           CHAR(36) NOT NULL,
  `invoice_id`   CHAR(36) NOT NULL,
  `method`       ENUM('qr','bank_transfer') NOT NULL,
  `amount`       DECIMAL(10,2) NOT NULL,
  `slip_url`     VARCHAR(500) NULL,
  `note`         TEXT NULL,
  `status`       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `submitted_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `verified_at`  DATETIME NULL,
  `verified_by`  CHAR(36) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pay_invoice` (`invoice_id`),
  CONSTRAINT `fk_pay_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. payment_methods_config
CREATE TABLE IF NOT EXISTS `payment_methods_config` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `method`         ENUM('qr','bank_transfer') NOT NULL,
  `label`          VARCHAR(100) NOT NULL,
  `account_name`   VARCHAR(255) NULL,
  `account_number` VARCHAR(50) NULL,
  `qr_image_url`   VARCHAR(500) NULL,
  `is_active`      TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order`     INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `payment_methods_config` (`method`,`label`,`account_name`,`account_number`,`is_active`,`sort_order`) VALUES
  ('qr',           'PromptPay',    NULL,                 NULL,              1, 1),
  ('bank_transfer','กสิกรไทย',     'บริษัท KTN Business', '000-0-00000-0',   1, 2);
