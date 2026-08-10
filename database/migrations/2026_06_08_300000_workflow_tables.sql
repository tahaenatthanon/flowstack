-- Workflow BPM tables
CREATE TABLE workflow_definitions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  entity_type ENUM('project','opportunity','support_ticket') NOT NULL,
  definition JSON NOT NULL,
  is_template TINYINT(1) NOT NULL DEFAULT 0,
  created_by CHAR(36) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE workflow_instances (
  id CHAR(36) NOT NULL PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  workflow_definition_id CHAR(36) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id CHAR(36) NOT NULL,
  current_step_id VARCHAR(100) DEFAULT NULL,
  status ENUM('active','completed','cancelled') NOT NULL DEFAULT 'active',
  started_at DATETIME DEFAULT NULL,
  completed_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_definition_id) REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  UNIQUE KEY uq_entity (tenant_id, entity_type, entity_id)
);

CREATE TABLE workflow_step_logs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  instance_id CHAR(36) NOT NULL,
  step_id VARCHAR(100) NOT NULL,
  step_name VARCHAR(255) DEFAULT NULL,
  assignee_id CHAR(36) DEFAULT NULL,
  started_at DATETIME DEFAULT NULL,
  completed_at DATETIME DEFAULT NULL,
  duration_minutes INT DEFAULT NULL,
  status ENUM('in_progress','completed','skipped') NOT NULL DEFAULT 'in_progress',
  notes TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (instance_id) REFERENCES workflow_instances(id) ON DELETE CASCADE,
  FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Approval requests table (multi-step approval chain)
CREATE TABLE approval_requests (
  id CHAR(36) NOT NULL PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  entity_type ENUM('quotation','content_item','project','task') NOT NULL,
  entity_id CHAR(36) NOT NULL,
  step_order INT NOT NULL DEFAULT 1,
  approver_id CHAR(36) NOT NULL,
  status ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  requested_by CHAR(36) NOT NULL,
  decided_at DATETIME DEFAULT NULL,
  comment TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE
);
