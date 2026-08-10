CREATE TABLE IF NOT EXISTS media_jobs (
  id                CHAR(36)      NOT NULL PRIMARY KEY,
  tenant_id         CHAR(36)      NOT NULL,
  created_by        CHAR(36)      NOT NULL,
  job_type          VARCHAR(20)   NOT NULL DEFAULT 'image',
  provider          VARCHAR(50)   NOT NULL DEFAULT 'kieai',
  model             VARCHAR(100)  NOT NULL,
  kie_task_id       VARCHAR(255)  NULL,
  status            VARCHAR(20)   NOT NULL DEFAULT 'pending',
  prompt            TEXT          NULL,
  input_params      JSON          NULL,
  result_urls       JSON          NULL,
  error_message     TEXT          NULL,
  source_content_id CHAR(36)      NULL,
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_status  (tenant_id, status),
  INDEX idx_tenant_created (tenant_id, created_at)
);

INSERT IGNORE INTO ai_providers (id, name, display_name, description, api_base_url, icon, is_active, created_at, updated_at)
VALUES (
  'provider-kieai',
  'kieai',
  'Kie.ai',
  'Affordable AI image, video, audio and music generation via Kie.ai API',
  'https://api.kie.ai/api/v1',
  '🎨',
  1,
  NOW(),
  NOW()
);
