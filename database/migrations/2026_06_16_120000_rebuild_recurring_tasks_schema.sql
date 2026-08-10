-- Rebuild recurring_tasks to match API + frontend schema
-- Old schema had mismatched column names; table was empty so safe to recreate

DROP TABLE IF EXISTS recurring_tasks;

CREATE TABLE recurring_tasks (
  id                  CHAR(36)     NOT NULL PRIMARY KEY,
  tenant_id           CHAR(36)     NOT NULL,
  project_id          CHAR(36)     NULL,
  user_id             CHAR(36)     NOT NULL,
  title               VARCHAR(255) NOT NULL DEFAULT '',
  description         TEXT         NULL,
  frequency           ENUM('daily','weekly','biweekly','monthly','quarterly','yearly','custom') NOT NULL DEFAULT 'weekly',
  interval_value      INT          NOT NULL DEFAULT 1,
  day_of_week         INT          NULL,
  day_of_month        INT          NULL,
  start_date          DATE         NOT NULL,
  end_date            DATE         NULL,
  due_date_offset     INT          NOT NULL DEFAULT 0,
  assignee            VARCHAR(255) NULL,
  priority            ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  status              ENUM('pending','in-progress','completed','cancelled') NOT NULL DEFAULT 'pending',
  estimated_days      INT          NOT NULL DEFAULT 1,
  task_type           VARCHAR(50)  NOT NULL DEFAULT 'task',
  copy_checklist      TINYINT(1)   NOT NULL DEFAULT 1,
  copy_attachments    TINYINT(1)   NOT NULL DEFAULT 0,
  copy_custom_fields  TINYINT(1)   NOT NULL DEFAULT 1,
  next_occurrence     DATE         NULL,
  is_active           TINYINT(1)   NOT NULL DEFAULT 1,
  deleted_at          DATETIME     NULL,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_project (project_id),
  INDEX idx_next (next_occurrence)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
