-- Add per-type notification toggles to notification_settings
ALTER TABLE notification_settings
  ADD COLUMN `notify_tasks_due`    tinyint(1) NOT NULL DEFAULT 1 AFTER notify_email,
  ADD COLUMN `notify_tasks_overdue` tinyint(1) NOT NULL DEFAULT 1 AFTER notify_tasks_due,
  ADD COLUMN `notify_calendar`     tinyint(1) NOT NULL DEFAULT 1 AFTER notify_tasks_overdue,
  ADD COLUMN `notify_tomorrow`     tinyint(1) NOT NULL DEFAULT 1 AFTER notify_calendar,
  ADD COLUMN `notify_assigned`     tinyint(1) NOT NULL DEFAULT 1 AFTER notify_tomorrow,
  ADD COLUMN `notify_sla`          tinyint(1) NOT NULL DEFAULT 1 AFTER notify_assigned;
