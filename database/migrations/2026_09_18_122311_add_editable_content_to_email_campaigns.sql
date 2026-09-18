ALTER TABLE email_campaigns
  ADD COLUMN editable_content TEXT NULL AFTER template_id,
  ADD COLUMN cta_text VARCHAR(255) NULL AFTER editable_content,
  ADD COLUMN cta_url VARCHAR(500) NULL AFTER cta_text;
