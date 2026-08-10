-- Link projects back to the opportunity that created them
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS opportunity_id CHAR(36) NULL AFTER company_id,
  ADD CONSTRAINT fk_projects_opportunity
    FOREIGN KEY (opportunity_id) REFERENCES sales_opportunities(id) ON DELETE SET NULL;

-- Link support tickets back to the project they relate to
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS project_id CHAR(36) NULL AFTER company_id,
  ADD CONSTRAINT fk_tickets_project
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
