CREATE TABLE IF NOT EXISTS `work_schedules` (
  `id`            CHAR(36)       NOT NULL PRIMARY KEY,
  `tenant_id`     CHAR(36)       NOT NULL,
  `name`          VARCHAR(255)   NOT NULL,
  `description`   TEXT,
  `is_default`    TINYINT(1)     NOT NULL DEFAULT 0,
  `hours_per_day` DECIMAL(4,2)   NOT NULL DEFAULT 8.00,
  `created_at`    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `work_schedule_days` (
  `id`          CHAR(36)     NOT NULL PRIMARY KEY,
  `schedule_id` CHAR(36)     NOT NULL,
  `day_of_week` TINYINT      NOT NULL COMMENT '1=Mon 2=Tue ... 7=Sun',
  `is_working`  TINYINT(1)   NOT NULL DEFAULT 1,
  `work_hours`  DECIMAL(4,2) NOT NULL DEFAULT 8.00,
  UNIQUE KEY `uq_schedule_day` (`schedule_id`, `day_of_week`),
  FOREIGN KEY (`schedule_id`) REFERENCES `work_schedules`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_work_schedules` (
  `user_id`     CHAR(36) NOT NULL PRIMARY KEY,
  `schedule_id` CHAR(36) NOT NULL,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`schedule_id`) REFERENCES `work_schedules`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default Mon–Fri 8h schedule for all existing tenants
INSERT INTO `work_schedules` (`id`, `tenant_id`, `name`, `description`, `is_default`, `hours_per_day`)
SELECT UUID(), `tenant_id`, 'ตารางงานมาตรฐาน (จ–ศ)', 'จันทร์–ศุกร์ 8 ชั่วโมง/วัน', 1, 8.00
FROM (SELECT DISTINCT `tenant_id` FROM `company_settings`) t;

-- Seed days for each new schedule
INSERT INTO `work_schedule_days` (`id`, `schedule_id`, `day_of_week`, `is_working`, `work_hours`)
SELECT UUID(), ws.`id`, d.`dow`,
       CASE WHEN d.`dow` BETWEEN 1 AND 5 THEN 1 ELSE 0 END,
       CASE WHEN d.`dow` BETWEEN 1 AND 5 THEN 8.00 ELSE 0.00 END
FROM `work_schedules` ws
JOIN (SELECT 1 dow UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
      UNION SELECT 5 UNION SELECT 6 UNION SELECT 7) d ON 1=1
WHERE ws.`is_default` = 1;
