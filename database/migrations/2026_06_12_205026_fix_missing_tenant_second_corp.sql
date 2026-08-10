-- Fix: company_settings id=3 (Second Corp, tenant_id=175f81a8-...) has no matching tenants row
-- This causes data integrity errors and JOIN failures in any tenant-scoped query
-- Root cause: tenant was created partially during development (company_settings+roles inserted, tenants row missing)
-- This tenant has 0 users, 0 projects, 0 subscriptions — it is stale test data
-- Resolution: insert the missing tenant record to restore FK integrity

INSERT IGNORE INTO `tenants` (`id`, `name`, `slug`, `plan`, `status`, `created_at`, `updated_at`)
VALUES ('175f81a8-36a4-4aa2-a053-c5e4762e3855', 'Second Corp', 'second-corp', 'trial', 'active', '2026-06-10 13:42:48', NOW());
