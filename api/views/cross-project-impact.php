<?php
// GET /api/views/cross-project-impact.php
// Query params: ?active_only=1 (optional)
// Returns cross-project task dependencies (task_id and depends_on_task_id are in different projects)
require_once __DIR__ . '/../auth.php';

$tokenData = requireAuth();
$db        = getDB();
$tenantId  = $tokenData['tenant_id'];

if (getMethod() !== 'GET') {
    jsonError('Method not allowed', 405);
}

$activeOnly = ($_GET['active_only'] ?? '0') === '1';

$sql = '
    SELECT
        td.id                   AS dependency_id,
        td.dependency_type,
        td.notes,
        td.auto_shift_dates,
        td.created_at,
        td.resolved_at,
        CASE WHEN td.resolved_at IS NULL THEN 1 ELSE 0 END AS is_active,

        t_task.id               AS task_id,
        t_task.title            AS task_title,
        t_task.status           AS task_status,
        t_task.assignee         AS task_assignee,
        t_task.project_id       AS task_project_id,
        p_task.name             AS task_project_name,

        t_dep.id                AS depends_on_task_id,
        t_dep.title             AS depends_on_title,
        t_dep.status            AS depends_on_status,
        t_dep.assignee          AS assignee,
        t_dep.project_id        AS depends_on_project_id,
        p_dep.name              AS depends_on_project_name
    FROM task_dependencies td
    JOIN tasks    t_task ON td.task_id            = t_task.id
    JOIN projects p_task ON t_task.project_id     = p_task.id
    JOIN tasks    t_dep  ON td.depends_on_task_id = t_dep.id
    JOIN projects p_dep  ON t_dep.project_id      = p_dep.id
    WHERE td.deleted_at IS NULL
      AND t_task.tenant_id = ?
      AND t_task.project_id != t_dep.project_id
';
$params = [$tenantId];

if ($activeOnly) {
    $sql .= ' AND td.resolved_at IS NULL';
}
$sql .= ' ORDER BY td.created_at DESC';

$stmt = $db->prepare($sql);
$stmt->execute($params);
jsonResponse($stmt->fetchAll());
