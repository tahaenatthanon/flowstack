<?php
// GET /api/views/resource-workload.php
// Query params: ?assignee= (optional filter) &year= (optional) &start_date= &end_date=
require_once __DIR__ . '/../auth.php';

$tokenData = requireAuth();
$db        = getDB();
$tenantId  = $tokenData['tenant_id'];

if (getMethod() !== 'GET') {
    jsonError('Method not allowed', 405);
}

$assigneeFilter = $_GET['assignee'] ?? null;
$year      = $_GET['year']       ?? date('Y');
$startDate = $_GET['start_date'] ?? null;
$endDate   = $_GET['end_date']   ?? null;

// ── Build canonical name resolution map (scoped to tenant) ───────────────────
$resolveMap  = [];
$userInfoMap = [];

$usersStmt = $db->prepare('
    SELECT u.id, u.email, u.display_name, u.position, r.label AS role_label
    FROM users u
    JOIN tenant_users tu ON tu.user_id = u.id AND tu.tenant_id = ?
    LEFT JOIN roles r ON r.id = tu.role_id
');
$usersStmt->execute([$tenantId]);
foreach ($usersStmt->fetchAll() as $u) {
    $canonical = $u['display_name'] ?: $u['email'];
    $resolveMap[strtolower($u['email'])] = $canonical;
    $resolveMap[strtolower($canonical)]  = $canonical;
    $userInfoMap[$canonical] = [
        'position'   => $u['position'] ?? '',
        'role_label' => $u['role_label'] ?? '',
    ];
}

$aliasStmt = $db->prepare('
    SELECT a.alias_email, u.display_name, u.email
    FROM user_email_aliases a
    JOIN users u ON u.id = a.user_id
    JOIN tenant_users tu ON tu.user_id = u.id AND tu.tenant_id = ?
');
$aliasStmt->execute([$tenantId]);
foreach ($aliasStmt->fetchAll() as $a) {
    $canonical = $a['display_name'] ?: $a['email'];
    $resolveMap[strtolower($a['alias_email'])] = $canonical;
}

// If a specific assignee filter was requested, also try to resolve it so
// the SQL WHERE still matches the raw value(s) stored in the DB.
$rawAssigneeValues = null;
if ($assigneeFilter) {
    // Collect all raw DB values that resolve to this canonical name
    $canonical = $resolveMap[strtolower($assigneeFilter)] ?? $assigneeFilter;
    $rawAssigneeValues = array_keys(array_filter($resolveMap, fn($v) => $v === $canonical));
    // Always include the filter value itself in case it's a stored raw value
    $rawAssigneeValues[] = strtolower($assigneeFilter);
    $rawAssigneeValues = array_unique($rawAssigneeValues);
}

// ── Fetch raw workload rows (scoped to tenant) ───────────────────────────────
$sql = 'SELECT
    assignee,
    work_date,
    CAST(project_count AS UNSIGNED)        AS project_count,
    CAST(task_count AS UNSIGNED)            AS task_count,
    CAST(active_task_count AS UNSIGNED)     AS active_task_count,
    CAST(total_estimated_days AS UNSIGNED)  AS total_estimated_days,
    project_names
FROM resource_workload
WHERE tenant_id = ?';
$conditions = [];
$params     = [$tenantId];

if ($year) {
    $conditions[] = 'YEAR(work_date) = ?';
    $params[]     = $year;
}
if ($startDate) {
    $conditions[] = 'work_date >= ?';
    $params[]     = $startDate;
}
if ($endDate) {
    $conditions[] = 'work_date <= ?';
    $params[]     = $endDate;
}
if ($rawAssigneeValues) {
    $placeholders = implode(',', array_fill(0, count($rawAssigneeValues), '?'));
    $conditions[] = "assignee IN ($placeholders)";
    $params       = array_merge($params, $rawAssigneeValues);
}

if (!empty($conditions)) {
    $sql .= ' WHERE ' . implode(' AND ', $conditions);
}
$sql .= ' ORDER BY work_date ASC';

$stmt = $db->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

// ── Resolve + merge rows by (canonical_name, work_date) ──────────────────────
$merged = [];
foreach ($rows as $row) {
    $key           = strtolower((string)$row['assignee']);
    $resolvedName  = $resolveMap[$key] ?? $row['assignee'];
    $mergeKey      = $resolvedName . '||' . $row['work_date'];

    if (!isset($merged[$mergeKey])) {
        $merged[$mergeKey] = [
            'assignee'            => $resolvedName,
            'work_date'           => $row['work_date'],
            'project_count'       => (int)$row['project_count'],
            'task_count'          => (int)$row['task_count'],
            'active_task_count'   => (int)$row['active_task_count'],
            'total_estimated_days'=> (int)$row['total_estimated_days'],
            '_project_set'        => array_filter(explode(', ', $row['project_names'] ?? '')),
        ];
    } else {
        $merged[$mergeKey]['project_count']        += (int)$row['project_count'];
        $merged[$mergeKey]['task_count']           += (int)$row['task_count'];
        $merged[$mergeKey]['active_task_count']    += (int)$row['active_task_count'];
        $merged[$mergeKey]['total_estimated_days'] += (int)$row['total_estimated_days'];
        $extra = array_filter(explode(', ', $row['project_names'] ?? ''));
        $merged[$mergeKey]['_project_set'] = array_unique(
            array_merge($merged[$mergeKey]['_project_set'], $extra)
        );
    }
}

// Finalise and attach user info
$result = [];
foreach ($merged as $item) {
    $projectNames = $item['_project_set'];
    sort($projectNames);
    $info = $userInfoMap[$item['assignee']] ?? ['position' => '', 'role_label' => ''];
    $result[] = [
        'assignee'            => $item['assignee'],
        'work_date'           => $item['work_date'],
        'project_count'       => $item['project_count'],
        'task_count'          => $item['task_count'],
        'active_task_count'   => $item['active_task_count'],
        'total_estimated_days'=> $item['total_estimated_days'],
        'project_names'       => implode(', ', $projectNames),
        'position'            => $info['position'],
        'role_label'          => $info['role_label'],
    ];
}

jsonResponse($result);
