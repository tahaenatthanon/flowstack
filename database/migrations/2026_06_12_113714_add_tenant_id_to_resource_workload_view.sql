-- Add tenant_id to resource_workload view so it can be filtered per-tenant

CREATE OR REPLACE VIEW resource_workload AS
SELECT
    t.tenant_id,
    t.assignee,
    CAST(t.start_date AS DATE)             AS work_date,
    COUNT(DISTINCT t.project_id)           AS project_count,
    COUNT(t.id)                            AS task_count,
    SUM(CASE WHEN t.status IN ('in-progress','pending','overdue') THEN 1 ELSE 0 END) AS active_task_count,
    SUM(t.estimated_days)                  AS total_estimated_days,
    GROUP_CONCAT(DISTINCT p.name ORDER BY p.name SEPARATOR ', ') AS project_names
FROM tasks t
LEFT JOIN projects p ON t.project_id = p.id
WHERE t.assignee IS NOT NULL
  AND t.assignee <> ''
  AND t.status <> 'completed'
GROUP BY t.tenant_id, t.assignee, CAST(t.start_date AS DATE);
