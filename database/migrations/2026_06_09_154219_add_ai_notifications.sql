CREATE TABLE IF NOT EXISTS ai_notifications (
  id          CHAR(36)     NOT NULL,
  tenant_id   VARCHAR(100) NOT NULL,
  user_id     CHAR(36)     NOT NULL,
  type        ENUM('overdue','deadline','daily_digest','revenue','custom') NOT NULL DEFAULT 'custom',
  title       VARCHAR(255) NOT NULL,
  body        TEXT         NOT NULL,
  action_label VARCHAR(100) NULL,
  action_data  TEXT         NULL COMMENT 'JSON: {prompt: "..."} to send to AI chat',
  read_at     DATETIME     NULL,
  deleted_at  DATETIME     NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_user_unread (tenant_id, user_id, read_at),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
