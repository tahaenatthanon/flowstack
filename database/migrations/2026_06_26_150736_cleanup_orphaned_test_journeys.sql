-- Cleanup orphaned company_journey instances whose links all point to
-- deleted entities (e.g. Test Opp / X / Test under "TEST CO LTD" — their
-- linked opportunities were deleted but the journeys lingered).
-- Backs up affected rows before deletion.

-- 1. Identify orphaned journey ids (have links, none resolve to a live entity)
CREATE TEMPORARY TABLE _orphan_journeys AS
SELECT wi.id
FROM workflow_instances wi
WHERE wi.entity_type = 'company_journey'
  AND wi.status <> 'cancelled'
  AND EXISTS (SELECT 1 FROM workflow_journey_links jl WHERE jl.instance_id = wi.id)
  AND NOT EXISTS (
      SELECT 1 FROM workflow_journey_links jl
      WHERE jl.instance_id = wi.id AND (
            (jl.entity_type = 'opportunity'     AND EXISTS (SELECT 1 FROM sales_opportunities WHERE id = jl.entity_id))
         OR (jl.entity_type = 'project'         AND EXISTS (SELECT 1 FROM projects            WHERE id = jl.entity_id))
         OR (jl.entity_type = 'support_ticket'  AND EXISTS (SELECT 1 FROM support_tickets     WHERE id = jl.entity_id))
      )
  );

-- 2. Backup (idempotent table names with date)
CREATE TABLE IF NOT EXISTS _bak_20260626_orphan_instances AS
SELECT wi.* FROM workflow_instances wi JOIN _orphan_journeys o ON o.id = wi.id;
CREATE TABLE IF NOT EXISTS _bak_20260626_orphan_links AS
SELECT jl.* FROM workflow_journey_links jl JOIN _orphan_journeys o ON o.id = jl.instance_id;
CREATE TABLE IF NOT EXISTS _bak_20260626_orphan_steplogs AS
SELECT sl.* FROM workflow_step_logs sl JOIN _orphan_journeys o ON o.id = sl.instance_id;

-- 3. Delete children then instances
DELETE sl FROM workflow_step_logs sl JOIN _orphan_journeys o ON o.id = sl.instance_id;
DELETE jl FROM workflow_journey_links jl JOIN _orphan_journeys o ON o.id = jl.instance_id;
DELETE wi FROM workflow_instances wi JOIN _orphan_journeys o ON o.id = wi.id;

DROP TEMPORARY TABLE _orphan_journeys;
