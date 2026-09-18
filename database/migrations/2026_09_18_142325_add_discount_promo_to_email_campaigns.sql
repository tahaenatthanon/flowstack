ALTER TABLE email_campaigns
  ADD COLUMN discount_percent VARCHAR(50) NULL AFTER cta_url,
  ADD COLUMN countdown_text VARCHAR(50) NULL AFTER discount_percent;
