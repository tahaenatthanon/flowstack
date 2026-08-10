-- Change plan columns from ENUM to VARCHAR(50) to support dynamic plans
ALTER TABLE plan_limits MODIFY plan VARCHAR(50) NOT NULL;
ALTER TABLE tenants MODIFY plan VARCHAR(50) NOT NULL DEFAULT 'trial';
ALTER TABLE subscriptions MODIFY plan VARCHAR(50) NOT NULL DEFAULT 'trial';
