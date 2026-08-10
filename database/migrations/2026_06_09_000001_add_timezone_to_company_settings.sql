-- Add timezone column to company_settings
-- Default Asia/Bangkok for Thai SaaS deployments

ALTER TABLE `company_settings`
  ADD COLUMN `timezone` varchar(64) NOT NULL DEFAULT 'Asia/Bangkok'
    COMMENT 'IANA timezone name used for date-boundary calculations (e.g. holidays, schedules)'
  AFTER `currency_symbol`;
