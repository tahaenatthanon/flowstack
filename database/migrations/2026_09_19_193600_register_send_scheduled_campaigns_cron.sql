INSERT IGNORE INTO cron_jobs (id, `key`, name, description, interval_label, type, endpoint, file_path, http_method, query_string, enabled, cron_expression)
VALUES
  (UUID(), 'send-scheduled-campaigns', 'Scheduled Campaign Sender', 'ส่งแคมเปญอีเมลที่ตั้งเวลาไว้เมื่อถึงกำหนด (email_campaigns.status=scheduled)', 'ทุก 1 นาที', 'include', NULL, 'api/cron/send-scheduled-campaigns.php', 'GET', NULL, 1, '* * * * *');
