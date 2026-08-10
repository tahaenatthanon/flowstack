-- database/migrations/2026_06_13_000003_journey_reseed.sql
-- ลบ journey เดิม (ชื่อเสีย encoding) แล้วสร้างใหม่ผูกกับ sales opportunities จริง

-- ลบ journey เดิม
DELETE FROM workflow_instances WHERE entity_type = 'company_journey';

-- ตัวแปร
SET @def_id = (SELECT id FROM workflow_definitions WHERE entity_type='company_journey' AND tenant_id='tenant-default' LIMIT 1);

-- Journey 1: INOAC TOKAI THAILAND — AI Portal (DuckKITs)
SET @inst1 = UUID();
INSERT INTO workflow_instances
  (id, tenant_id, workflow_definition_id, entity_type, entity_id, journey_name, company_id, current_stage, sla_violated, status, started_at, created_at, updated_at)
VALUES
  (@inst1, 'tenant-default', @def_id, 'company_journey', @inst1,
   'AI Portal (DuckKITs)', '88288071-446f-4676-b91c-654402ea18be', 'sales', 0, 'active',
   DATE_SUB(NOW(), INTERVAL 25 DAY), NOW(), DATE_SUB(NOW(), INTERVAL 3 DAY));

-- ผูก sales stage กับ opportunity จริง
INSERT INTO workflow_journey_links (id, instance_id, stage, entity_type, entity_id, stage_status, sla_days, linked_at)
VALUES (UUID(), @inst1, 'sales', 'opportunity', '522538c9-d70a-4ff9-b17d-b02d0c022f14', 'active', 30, DATE_SUB(NOW(), INTERVAL 25 DAY));

-- Journey 2: THAI SPECIAL WIRE CO. — Document Control (SLA เกิน)
SET @inst2 = UUID();
INSERT INTO workflow_instances
  (id, tenant_id, workflow_definition_id, entity_type, entity_id, journey_name, company_id, current_stage, sla_violated, status, started_at, created_at, updated_at)
VALUES
  (@inst2, 'tenant-default', @def_id, 'company_journey', @inst2,
   'Document Control', 'f0feaee1-4052-497a-8a63-3082bbc82975', 'sales', 1, 'active',
   DATE_SUB(NOW(), INTERVAL 55 DAY), NOW(), DATE_SUB(NOW(), INTERVAL 38 DAY));

-- ผูก sales stage (เกิน SLA)
INSERT INTO workflow_journey_links (id, instance_id, stage, entity_type, entity_id, stage_status, sla_days, linked_at)
VALUES (UUID(), @inst2, 'sales', 'opportunity', 'dd4726d1-ae8e-4d00-aa43-0e100ca1f47c', 'active', 30, DATE_SUB(NOW(), INTERVAL 55 DAY));

-- Journey 3: THAI SPECIAL WIRE CO. — HRMs (ผ่าน sales ไปแล้ว)
SET @inst3 = UUID();
INSERT INTO workflow_instances
  (id, tenant_id, workflow_definition_id, entity_type, entity_id, journey_name, company_id, current_stage, sla_violated, status, started_at, created_at, updated_at)
VALUES
  (@inst3, 'tenant-default', @def_id, 'company_journey', @inst3,
   'HRMs', 'f0feaee1-4052-497a-8a63-3082bbc82975', 'project', 0, 'active',
   DATE_SUB(NOW(), INTERVAL 60 DAY), NOW(), DATE_SUB(NOW(), INTERVAL 10 DAY));

-- ผูก sales stage (completed แล้ว)
INSERT INTO workflow_journey_links (id, instance_id, stage, entity_type, entity_id, stage_status, sla_days, linked_at, completed_at)
VALUES (UUID(), @inst3, 'sales', 'opportunity', 'f8c3bcaf-5f40-4ac9-ba77-9e3a5aa9f45b', 'completed', 30,
        DATE_SUB(NOW(), INTERVAL 60 DAY), DATE_SUB(NOW(), INTERVAL 40 DAY));
