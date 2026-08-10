-- Fix invoices.plan: change from ENUM to VARCHAR(50) to match plan_limits, tenants, subscriptions
-- Missed in the original plan_varchar migration (2026_06_10_200000)
ALTER TABLE `invoices` MODIFY `plan` VARCHAR(50) NOT NULL;
