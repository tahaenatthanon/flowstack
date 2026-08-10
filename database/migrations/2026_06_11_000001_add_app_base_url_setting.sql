-- Add app_base_url to settings for email tracking pixel URLs
-- Value should be the public XAMPP hostname WITHOUT port (e.g. http://platform.ktnbs.com)
INSERT INTO settings (`key`, `value`)
VALUES ('app_base_url', 'http://platform.ktnbs.com')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);
