-- Re-weight the "Project Manager" KPI department to activate axis B (PM Goal Score):
-- win/loss of deals on managed projects + on-time/cancelled project delivery.
-- See docs/superpowers/specs/2026-06-26-pm-goal-score-design.md
UPDATE kpi_weight_configs
   SET p_weight = 15, q_weight = 25, a_weight = 15, s_weight = 20, b_weight = 25
 WHERE department = 'Project Manager';
