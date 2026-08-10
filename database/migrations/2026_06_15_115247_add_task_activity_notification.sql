-- Admin/manager: receive task activity notifications per channel
ALTER TABLE notification_settings
  ADD COLUMN `notify_task_activity`         tinyint(1) NOT NULL DEFAULT 0 AFTER notify_sla,
  ADD COLUMN `task_activity_via_line`       tinyint(1) NOT NULL DEFAULT 1 AFTER notify_task_activity,
  ADD COLUMN `task_activity_via_telegram`   tinyint(1) NOT NULL DEFAULT 1 AFTER task_activity_via_line,
  ADD COLUMN `task_activity_via_email`      tinyint(1) NOT NULL DEFAULT 0 AFTER task_activity_via_telegram;
