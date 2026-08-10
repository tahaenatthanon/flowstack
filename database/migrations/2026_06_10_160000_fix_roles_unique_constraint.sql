-- Fix roles UNIQUE KEY to be scoped per tenant (not global)
ALTER TABLE `roles` DROP INDEX `name`;
ALTER TABLE `roles` ADD UNIQUE KEY `uq_role_tenant_name` (`tenant_id`, `name`);
