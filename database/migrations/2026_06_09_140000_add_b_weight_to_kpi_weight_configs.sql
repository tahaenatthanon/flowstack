-- Add B (Business Development) axis to KPI weights
-- b_weight defaults to 0 so existing rows are unaffected
ALTER TABLE `kpi_weight_configs`
  ADD COLUMN `b_weight` decimal(5,2) NOT NULL DEFAULT 0.00
    COMMENT 'Business Development weight — lead finding / BD attribution (0-100)'
  AFTER `s_weight`;

-- Give Manager role a BD weight of 20 (reduce S from 30→10, keep P=20,Q=20,A=30)
UPDATE `kpi_weight_configs`
  SET `b_weight` = 20.00, `s_weight` = 10.00
  WHERE `department` = 'Manager';
