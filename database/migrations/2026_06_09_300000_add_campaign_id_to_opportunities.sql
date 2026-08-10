ALTER TABLE sales_opportunities
  ADD COLUMN IF NOT EXISTS campaign_id CHAR(36) NULL AFTER renewal_of,
  ADD CONSTRAINT fk_opportunity_campaign
    FOREIGN KEY (campaign_id) REFERENCES email_campaigns(id) ON DELETE SET NULL;

ALTER TABLE sales_opportunities
  ADD INDEX IF NOT EXISTS idx_campaign_id (campaign_id);
