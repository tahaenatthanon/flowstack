-- Track renewal/upsell chain: opportunity that was created from a previous won deal
ALTER TABLE sales_opportunities
  ADD COLUMN IF NOT EXISTS renewal_of CHAR(36) NULL AFTER company_id,
  ADD CONSTRAINT fk_opportunity_renewal
    FOREIGN KEY (renewal_of) REFERENCES sales_opportunities(id) ON DELETE SET NULL;

-- Index for reverse lookup (find all renewals of a given deal)
ALTER TABLE sales_opportunities
  ADD INDEX IF NOT EXISTS idx_renewal_of (renewal_of);
