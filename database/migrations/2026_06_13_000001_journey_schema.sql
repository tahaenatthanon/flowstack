-- database/migrations/2026_06_13_000001_journey_schema.sql

-- 1. เพิ่ม company_journey ใน entity_type enum
ALTER TABLE workflow_definitions
  MODIFY COLUMN entity_type
    ENUM('project','opportunity','support_ticket','company_journey') NOT NULL;

-- 2. เพิ่ม columns ใน workflow_instances สำหรับ journey
ALTER TABLE workflow_instances
  ADD COLUMN IF NOT EXISTS journey_name   VARCHAR(255) DEFAULT NULL      AFTER entity_id,
  ADD COLUMN IF NOT EXISTS company_id     CHAR(36)     DEFAULT NULL      AFTER journey_name,
  ADD COLUMN IF NOT EXISTS sla_violated   TINYINT(1)   NOT NULL DEFAULT 0 AFTER company_id,
  ADD COLUMN IF NOT EXISTS current_stage  VARCHAR(50)  DEFAULT 'marketing'
    COMMENT 'marketing|sales|project|support|renewal'      AFTER sla_violated,
  ADD INDEX IF NOT EXISTS idx_company_id (company_id),
  ADD INDEX IF NOT EXISTS idx_current_stage (current_stage);

-- 3. ตาราง workflow_journey_links เชื่อม journey instance กับ entity จริง
CREATE TABLE IF NOT EXISTS workflow_journey_links (
  id           CHAR(36)    NOT NULL,
  instance_id  CHAR(36)    NOT NULL,
  stage        VARCHAR(50) NOT NULL COMMENT 'marketing|sales|project|support|renewal',
  entity_type  VARCHAR(50) NOT NULL COMMENT 'opportunity|project|support_ticket',
  entity_id    CHAR(36)    NOT NULL,
  stage_status ENUM('active','completed','skipped') NOT NULL DEFAULT 'active',
  sla_days     INT         DEFAULT NULL,
  linked_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME    DEFAULT NULL,
  notes        TEXT        DEFAULT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_journey_link_instance FOREIGN KEY (instance_id) REFERENCES workflow_instances(id) ON DELETE CASCADE,
  INDEX idx_instance_stage (instance_id, stage),
  INDEX idx_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Default journey definition สำหรับ tenant-default
INSERT INTO workflow_definitions
  (id, tenant_id, name, entity_type, definition, is_template, created_by, created_at, updated_at)
SELECT
  UUID(),
  'tenant-default',
  'เส้นทางลูกค้า (Standard)',
  'company_journey',
  '{"nodes":[],"edges":[],"stages":["marketing","sales","project","support","renewal"],"sla":{"marketing":10,"sales":30,"project":60,"support":90,"renewal":30}}',
  1,
  NULL,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM workflow_definitions
  WHERE entity_type = 'company_journey' AND tenant_id = 'tenant-default'
);
