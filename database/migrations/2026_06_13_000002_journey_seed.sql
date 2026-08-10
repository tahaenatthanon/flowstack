-- database/migrations/2026_06_13_000002_journey_seed.sql
SET @company_id = '1c22cd13-dc29-44c2-8c97-d49c6a86665d';
SET @def_id = 'a4c8ba8d-66ea-11f1-a3b9-b4a9fcd19bae';
SET @inst1 = UUID();
SET @inst2 = UUID();

INSERT INTO workflow_instances
  (id, tenant_id, workflow_definition_id, entity_type, entity_id, journey_name, company_id, current_stage, sla_violated, status, started_at, created_at, updated_at)
VALUES
  (@inst1, 'tenant-default', @def_id, 'company_journey', @inst1,
   'Journey ทดสอบ — Project Phase', @company_id, 'project', 0, 'active',
   DATE_SUB(NOW(), INTERVAL 42 DAY), NOW(), DATE_SUB(NOW(), INTERVAL 5 DAY)),
  (@inst2, 'tenant-default', @def_id, 'company_journey', @inst2,
   'Journey ทดสอบ — SLA เกิน', @company_id, 'sales', 1, 'active',
   DATE_SUB(NOW(), INTERVAL 60 DAY), NOW(), DATE_SUB(NOW(), INTERVAL 35 DAY));
