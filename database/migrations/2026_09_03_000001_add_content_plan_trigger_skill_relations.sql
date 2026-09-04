-- Support multiple Triggers and Skills per generated content plan.
-- Legacy content_plans.trigger_command and skill_id remain for backward compatibility.

CREATE TABLE IF NOT EXISTS content_plan_triggers (
  plan_id CHAR(36) NOT NULL,
  trigger_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (plan_id, trigger_id),
  KEY idx_content_plan_triggers_trigger (trigger_id),
  CONSTRAINT fk_content_plan_triggers_plan
    FOREIGN KEY (plan_id) REFERENCES content_plans(id) ON DELETE CASCADE,
  CONSTRAINT fk_content_plan_triggers_trigger
    FOREIGN KEY (trigger_id) REFERENCES content_triggers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS content_plan_skills (
  plan_id CHAR(36) NOT NULL,
  skill_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (plan_id, skill_id),
  KEY idx_content_plan_skills_skill (skill_id),
  CONSTRAINT fk_content_plan_skills_plan
    FOREIGN KEY (plan_id) REFERENCES content_plans(id) ON DELETE CASCADE,
  CONSTRAINT fk_content_plan_skills_skill
    FOREIGN KEY (skill_id) REFERENCES content_skills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill legacy plan selections when the migration is first applied.
INSERT IGNORE INTO content_plan_triggers (plan_id, trigger_id)
SELECT cp.id, ct.id
FROM content_plans cp
JOIN content_triggers ct
  ON ct.tenant_id = cp.tenant_id
 AND ct.command = cp.trigger_command
WHERE cp.trigger_command IS NOT NULL AND cp.trigger_command <> '';

INSERT IGNORE INTO content_plan_skills (plan_id, skill_id)
SELECT cp.id, cp.skill_id
FROM content_plans cp
WHERE cp.skill_id IS NOT NULL AND cp.skill_id <> '';
