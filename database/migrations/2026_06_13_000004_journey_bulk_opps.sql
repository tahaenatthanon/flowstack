-- 2026_06_13_000004_journey_bulk_opps.sql
-- Auto-create journey instances for all 2026 sales_opportunities not yet linked.
-- Mapping: lead→marketing, qualified/proposal/negotiation/won→sales(+project for won), lost→cancelled

SET NAMES utf8mb4;
SET @def_id = 'a4c8ba8d-66ea-11f1-a3b9-b4a9fcd19bae';
SET @tenant = 'tenant-default';

-- ── Step 1: Temp table with stable pre-generated journey IDs ──────────────────
CREATE TEMPORARY TABLE tmp_jmap AS
SELECT
    UUID() AS journey_id,
    o.id   AS opp_id,
    o.name AS opp_name,
    o.company_id,
    o.stage,
    o.created_at AS opp_created_at,
    o.tenant_id,
    -- BPM stage mapping
    CASE
        WHEN o.stage = 'lead'                             THEN 'marketing'
        WHEN o.stage IN ('qualified','proposal','negotiation') THEN 'sales'
        WHEN o.stage = 'won'                              THEN 'project'
        ELSE 'sales'
    END AS bpm_current_stage,
    -- status mapping
    CASE WHEN o.stage = 'lost' THEN 'cancelled' ELSE 'active' END AS bpm_status
FROM sales_opportunities o
WHERE o.tenant_id = @tenant
  AND YEAR(o.created_at) = 2026
  AND o.id NOT IN (
      SELECT jl.entity_id
      FROM workflow_journey_links jl
      WHERE jl.entity_type = 'opportunity'
  );

-- ── Step 2: Insert workflow_instances ────────────────────────────────────────
INSERT INTO workflow_instances
    (id, tenant_id, workflow_definition_id, entity_type, entity_id,
     journey_name, company_id, current_stage, sla_violated, status,
     started_at, created_at, updated_at)
SELECT
    journey_id,
    tenant_id,
    @def_id,
    'company_journey',
    journey_id,          -- entity_id = self for company_journey
    opp_name,
    company_id,
    bpm_current_stage,
    0,                   -- sla_violated — recalculate if needed
    bpm_status,
    opp_created_at,
    NOW(),
    NOW()
FROM tmp_jmap;

-- ── Step 3: Link opportunity to its BPM stage ─────────────────────────────────
-- For won: sales link = completed; all others: stage link = active
INSERT INTO workflow_journey_links
    (id, instance_id, stage, entity_type, entity_id, stage_status, sla_days, linked_at)
SELECT
    UUID(),
    journey_id,
    CASE
        WHEN stage IN ('qualified','proposal','negotiation','won') THEN 'sales'
        WHEN stage = 'lead'                                        THEN 'marketing'
        ELSE 'sales'
    END,
    'opportunity',
    opp_id,
    CASE WHEN stage = 'won' THEN 'completed' ELSE 'active' END,
    30,           -- default sales SLA 30 days
    opp_created_at
FROM tmp_jmap;

-- ── Step 4: For won opportunities that have a linked project, add project link ─
INSERT INTO workflow_journey_links
    (id, instance_id, stage, entity_type, entity_id, stage_status, sla_days, linked_at)
SELECT
    UUID(),
    t.journey_id,
    'project',
    'project',
    o.project_id,
    'active',
    60,
    NOW()
FROM tmp_jmap t
JOIN sales_opportunities o ON t.opp_id = o.id
WHERE t.stage = 'won'
  AND o.project_id IS NOT NULL;

DROP TEMPORARY TABLE IF EXISTS tmp_jmap;

-- Verify
SELECT
    CASE
        WHEN o.stage = 'lead'                                 THEN 'marketing'
        WHEN o.stage IN ('qualified','proposal','negotiation') THEN 'sales'
        WHEN o.stage = 'won'                                  THEN 'project'
        ELSE 'sales'
    END AS bpm_stage,
    o.stage AS opp_stage,
    COUNT(*) AS cnt
FROM workflow_instances wi
JOIN workflow_journey_links jl ON jl.instance_id = wi.id AND jl.entity_type = 'opportunity'
JOIN sales_opportunities o ON jl.entity_id = o.id
WHERE wi.tenant_id = @tenant
  AND wi.entity_type = 'company_journey'
  AND YEAR(o.created_at) = 2026
GROUP BY bpm_stage, o.stage
ORDER BY bpm_stage, o.stage;
