-- Fix 1: Insert in_progress step logs for all active workflow instances that are missing one.
-- These were missing from seed data causing queue_depth = 0 in analytics.
INSERT INTO workflow_step_logs (id, instance_id, step_id, step_name, status, started_at, created_at)
SELECT
  UUID(),
  wi.id,
  wi.current_step_id,
  NULL,
  'in_progress',
  COALESCE(wi.started_at, wi.created_at),
  NOW()
FROM workflow_instances wi
WHERE wi.status = 'active'
  AND wi.current_step_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM workflow_step_logs wsl
    WHERE wsl.instance_id = wi.id
      AND wsl.step_id = wi.current_step_id
      AND wsl.status = 'in_progress'
  );

-- Fix 2: Backfill started_at for completed logs where it is NULL (use created_at as proxy).
UPDATE workflow_step_logs
SET started_at = created_at
WHERE started_at IS NULL AND status = 'completed';

-- Fix 3: Backfill completed_at for completed logs where it is NULL.
-- Estimate completed_at = created_at + duration_minutes
UPDATE workflow_step_logs
SET completed_at = DATE_ADD(created_at, INTERVAL COALESCE(duration_minutes, 0) MINUTE)
WHERE completed_at IS NULL AND status = 'completed';
