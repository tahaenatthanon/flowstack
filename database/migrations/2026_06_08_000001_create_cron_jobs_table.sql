CREATE TABLE IF NOT EXISTS cron_jobs (
  id             CHAR(36)       NOT NULL PRIMARY KEY,
  `key`          VARCHAR(60)    NOT NULL UNIQUE,
  name           VARCHAR(100)   NOT NULL,
  description    TEXT           DEFAULT NULL,
  interval_label VARCHAR(100)   DEFAULT NULL,
  type           ENUM('http','include') NOT NULL DEFAULT 'http',
  endpoint       VARCHAR(255)   DEFAULT NULL,
  file_path      VARCHAR(500)   DEFAULT NULL,
  http_method    ENUM('GET','POST') NOT NULL DEFAULT 'GET',
  query_string   VARCHAR(255)   DEFAULT NULL,
  enabled        TINYINT(1)     NOT NULL DEFAULT 1,
  created_at     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO cron_jobs (id, `key`, name, description, interval_label, type, endpoint, file_path, http_method, query_string, enabled)
VALUES
  (UUID(), 'cron-publish',          'Content Publish Scheduler',  'ประมวลผล content_schedules ที่ถึงเวลาโพสต์ (brand-content flow)',        'ทุก 1 นาที',      'http',    'cron-publish.php',          NULL,                             'GET',  NULL,        1),
  (UUID(), 'publish-scheduler',     'Publish Queue Processor',    'ประมวลผล content_publish_queue (SchedulePublishDialog flow)',             'ทุก 1 นาที',      'include', NULL,                        'api/cron/publish-scheduler.php', 'GET',  NULL,        1),
  (UUID(), 'notification-dispatch', 'Notification Dispatch',      'ส่งการแจ้งเตือนผ่าน Line OA, Telegram, Email',                          'ทุก 15 นาที',     'http',    'notification-dispatch.php', NULL,                             'GET',  NULL,        1),
  (UUID(), 'recurring-tasks',       'Recurring Task Generator',   'สร้าง instance ของงานซ้ำที่ถึงกำหนด',                                   'ทุกวัน เที่ยงคืน','http',    'recurring-tasks.php',       NULL,                             'POST', 'trigger=1', 1);

ALTER TABLE cron_runs
  ADD INDEX IF NOT EXISTS idx_cron_runs_job_name (job_name);
