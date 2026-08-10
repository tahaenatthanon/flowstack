<?php
/**
 * Data Quality Stats API
 *
 * GET  (no action)                       : overall stats + score
 * GET  ?action=projects_without_budget    : projects missing budget/rate/hours + overdue tasks
 * GET  ?action=items_missing_fields       : tasks & subtasks with missing required fields
 * GET  ?action=companies_list             : all companies (id, name)
 * GET  ?action=customers_by_company       : customers for a given company_id
 * POST ?action=sync_project_stats         : recompute actual_hours + actual_progress for ALL projects
 * POST ?action=update_project_fields      : update multiple fields on one project
 * POST ?action=update_project_fields_bulk : bulk update budget/rate/status/payment on projects
 * POST ?action=update_task_fields         : update fields on one task
 * POST ?action=update_task_fields_bulk    : bulk update status/priority/assignee on tasks
 * POST ?action=fill_actual_hours          : copy estimated_hours → actual_hours where empty
 */

header('Content-Type: application/json; charset=utf-8');
require_once 'config.php';
require_once 'auth.php';

$auth     = requireAuth();
$tenantId = $auth['tenant_id'];
$pdo      = getDB();
$method   = $_SERVER['REQUEST_METHOD'];
$action   = $_GET['action'] ?? '';
$yearFrom = trim($_GET['year_from'] ?? '');
$yearTo   = trim($_GET['year_to']   ?? '');

// ─── helpers ───────────────────────────────────────────────────────────────────

function emptyToNull(string $v): ?string {
    $trimmed = trim($v);
    return $trimmed === '' ? null : $trimmed;
}

function floatOrNull(?string $v): ?float {
    if ($v === null || trim($v) === '') return null;
    return (float)$v;
}

function yearFilter(string $alias, string $yearFrom, string $yearTo): array {
    if ($yearFrom === '' || $yearTo === '') return ['sql' => '', 'params' => []];
    return [
        'sql' => " AND ({$alias}.start_date IS NULL OR {$alias}.end_date IS NULL OR ({$alias}.start_date <= ? AND {$alias}.end_date >= ?))",
        'params' => [$yearTo, $yearFrom],
    ];
}

// ─── POST actions ──────────────────────────────────────────────────────────────

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];

    // Sync project actual_hours + actual_progress from tasks
    if ($action === 'sync_project_stats') {
        $pdo->prepare("
            UPDATE projects p
            SET p.actual_hours = (
                SELECT COALESCE(SUM(t.actual_hours), 0)
                FROM tasks t
                WHERE t.project_id = p.id
                  AND t.deleted_at IS NULL
                  AND t.tenant_id  = p.tenant_id
            ),
            p.actual_progress = (
                SELECT CASE
                    WHEN COUNT(t.id) = 0 THEN 0
                    ELSE ROUND(
                        COUNT(CASE WHEN t.status = 'completed' THEN 1 END) * 100.0 / COUNT(t.id)
                    )
                END
                FROM tasks t
                WHERE t.project_id = p.id
                  AND t.deleted_at IS NULL
                  AND t.tenant_id  = p.tenant_id
                  AND (t.task_type IS NULL OR t.task_type NOT IN ('holiday','leave'))
            ),
            p.updated_at = NOW()
            WHERE p.deleted_at IS NULL AND p.tenant_id = ?
        ")->execute([$tenantId]);

        echo json_encode(['success' => true, 'message' => 'อัปเดตข้อมูลโปรเจกต์เรียบร้อย']);
        exit;
    }

    // ── update_project_fields ──────────────────────────────────────────────
    if ($action === 'update_project_fields') {
        $projectId = $input['project_id'] ?? null;
        if (!$projectId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Project ID is required']);
            exit;
        }

        $fields = [];
        $params = [];

        $map = [
            'status'         => 'status',
            'start_date'     => 'start_date',
            'end_date'       => 'end_date',
            'budget_hours'   => 'budget_hours',
            'hourly_rate'    => 'hourly_rate',
            'project_value'  => 'project_value',
            'company_id'     => 'company_id',
            'customer_id'    => 'customer_id',
            'payment_status' => 'payment_status',
        ];

        foreach ($map as $inputKey => $col) {
            if (array_key_exists($inputKey, $input)) {
                $fields[] = "`$col` = ?";
                $params[] = emptyToNull($input[$inputKey]);
            }
        }

        if (empty($fields)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No fields to update']);
            exit;
        }

        $fields[] = "updated_at = NOW()";
        $params[] = $projectId;
        $params[] = $tenantId;

        $pdo->prepare("UPDATE projects SET " . implode(', ', $fields) . " WHERE id = ? AND tenant_id = ?")
            ->execute($params);

        echo json_encode(['success' => true, 'message' => 'Project updated']);
        exit;
    }

    // ── update_project_fields_bulk ─────────────────────────────────────────
    if ($action === 'update_project_fields_bulk') {
        $projectIds = $input['project_ids'] ?? [];
        if (empty($projectIds)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'project_ids required']);
            exit;
        }

        $setClauses = [];
        $params = [];

        $map = [
            'budget_hours'   => 'budget_hours',
            'hourly_rate'    => 'hourly_rate',
            'status'         => 'status',
            'payment_status' => 'payment_status',
        ];

        foreach ($map as $inputKey => $col) {
            if (array_key_exists($inputKey, $input) && trim((string)$input[$inputKey]) !== '') {
                $setClauses[] = "`$col` = ?";
                $params[] = $input[$inputKey];
            }
        }

        if (empty($setClauses)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No fields to update']);
            exit;
        }

        $setClauses[] = "updated_at = NOW()";

        $placeholders = implode(',', array_fill(0, count($projectIds), '?'));
        $params = array_merge($params, $projectIds);
        $params[] = $tenantId;

        $stmt = $pdo->prepare(
            "UPDATE projects SET " . implode(', ', $setClauses) .
            " WHERE id IN ($placeholders) AND tenant_id = ?"
        );
        $stmt->execute($params);

        echo json_encode(['success' => true, 'updated' => $stmt->rowCount()]);
        exit;
    }

    // ── update_task_fields ─────────────────────────────────────────────────
    if ($action === 'update_task_fields') {
        $taskId = $input['task_id'] ?? null;
        if (!$taskId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'task_id required']);
            exit;
        }

        $fields = [];
        $params = [];

        $map = [
            'actual_hours'    => 'actual_hours',
            'estimated_hours' => 'estimated_hours',
            'status'          => 'status',
            'priority'        => 'priority',
            'start_date'      => 'start_date',
            'end_date'        => 'end_date',
            'assignee'        => 'assignee',
        ];

        foreach ($map as $inputKey => $col) {
            if (array_key_exists($inputKey, $input)) {
                $v = $input[$inputKey];
                // For numeric fields, treat empty string as null
                if (in_array($col, ['actual_hours', 'estimated_hours'], true)) {
                    $fields[] = "`$col` = ?";
                    $params[] = floatOrNull($v);
                } else {
                    $fields[] = "`$col` = ?";
                    $params[] = ($v === '' || $v === null) ? null : $v;
                }
            }
        }

        if (empty($fields)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No fields to update']);
            exit;
        }

        $fields[] = "updated_at = NOW()";
        $params[] = $taskId;
        $params[] = $tenantId;

        $pdo->prepare("UPDATE tasks SET " . implode(', ', $fields) . " WHERE id = ? AND tenant_id = ?")
            ->execute($params);

        echo json_encode(['success' => true, 'message' => 'Task updated']);
        exit;
    }

    // ── update_task_fields_bulk ────────────────────────────────────────────
    if ($action === 'update_task_fields_bulk') {
        $taskIds = $input['task_ids'] ?? [];
        if (empty($taskIds)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'task_ids required']);
            exit;
        }

        $setClauses = [];
        $params = [];

        $map = ['status' => 'status', 'priority' => 'priority', 'assignee' => 'assignee'];

        foreach ($map as $inputKey => $col) {
            if (array_key_exists($inputKey, $input) && trim((string)$input[$inputKey]) !== '') {
                $setClauses[] = "`$col` = ?";
                $params[] = $input[$inputKey];
            }
        }

        if (empty($setClauses)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No fields to update']);
            exit;
        }

        $setClauses[] = "updated_at = NOW()";

        $placeholders = implode(',', array_fill(0, count($taskIds), '?'));
        $params = array_merge($params, $taskIds);
        $params[] = $tenantId;

        $stmt = $pdo->prepare(
            "UPDATE tasks SET " . implode(', ', $setClauses) .
            " WHERE id IN ($placeholders) AND tenant_id = ?"
        );
        $stmt->execute($params);

        echo json_encode(['success' => true, 'updated' => $stmt->rowCount()]);
        exit;
    }

    // ── fill_actual_hours ──────────────────────────────────────────────────
    if ($action === 'fill_actual_hours') {
        $taskIds = $input['task_ids'] ?? [];
        if (empty($taskIds)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'task_ids required']);
            exit;
        }

        $placeholders = implode(',', array_fill(0, count($taskIds), '?'));
        $params = array_merge($taskIds, [$tenantId]);

        $stmt = $pdo->prepare(
            "UPDATE tasks SET actual_hours = estimated_hours, base_actual_hours = estimated_hours, updated_at = NOW()
             WHERE id IN ($placeholders) AND tenant_id = ?
               AND estimated_hours > 0
               AND (actual_hours IS NULL OR actual_hours = 0)
               AND deleted_at IS NULL"
        );
        $stmt->execute($params);

        echo json_encode(['success' => true, 'updated' => $stmt->rowCount()]);
        exit;
    }

    // ── update_company_fields ────────────────────────────────────────────────
    if ($action === 'update_company_fields') {
        $companyId = $input['company_id'] ?? null;
        if (!$companyId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Company ID is required']);
            exit;
        }

        $fields = [];
        $params = [];
        $allowed = ['name', 'description', 'address', 'phone', 'email', 'website', 'tax_id', 'business_type', 'company_size', 'founded_year'];
        foreach ($allowed as $col) {
            if (array_key_exists($col, $input)) {
                $fields[] = "$col = ?";
                $params[] = $input[$col];
            }
        }
        if (empty($fields)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No fields to update']);
            exit;
        }

        $params[] = $companyId;
        $params[] = $tenantId;
        $stmt = $pdo->prepare("UPDATE companies SET " . implode(', ', $fields) . ", updated_at = NOW() WHERE id = ? AND tenant_id = ?");
        $stmt->execute($params);

        echo json_encode(['success' => true, 'updated' => $stmt->rowCount()]);
        exit;
    }

    // ── normalize_company_names ─────────────────────────────────────────────
    if ($action === 'normalize_company_names') {
        $companyIds = $input['company_ids'] ?? [];
        if (!empty($companyIds)) {
            $placeholders = implode(',', array_fill(0, count($companyIds), '?'));
            $stmt = $pdo->prepare("
                UPDATE companies
                SET name = UPPER(TRIM(name)), updated_at = NOW()
                WHERE tenant_id = ? AND is_active = 1
                  AND id IN ($placeholders)
                  AND (name COLLATE utf8mb4_bin != UPPER(TRIM(name)) OR name COLLATE utf8mb4_bin != TRIM(name))
            ");
            $stmt->execute(array_merge([$tenantId], $companyIds));
        } else {
            $stmt = $pdo->prepare("
                UPDATE companies
                SET name = UPPER(TRIM(name)), updated_at = NOW()
                WHERE tenant_id = ? AND is_active = 1
                  AND (name COLLATE utf8mb4_bin != UPPER(TRIM(name)) OR name COLLATE utf8mb4_bin != TRIM(name))
            ");
            $stmt->execute([$tenantId]);
        }
        $updated = $stmt->rowCount();

        echo json_encode([
            'success' => true,
            'updated' => $updated,
            'message' => $updated > 0 ? "อัปเดตชื่อบริษัท $updated รายการ" : 'ชื่อบริษัททั้งหมดเป็นรูปแบบที่ถูกต้องแล้ว',
        ]);
        exit;
    }

    // Unknown POST action
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => "Unknown POST action: $action"]);
    exit;
}

// ─── GET actions ───────────────────────────────────────────────────────────────

// ── projects_without_budget ────────────────────────────────────────────────
if ($action === 'projects_without_budget') {
    $pyf = yearFilter('p', $yearFrom, $yearTo);
    $tyf = yearFilter('t', $yearFrom, $yearTo);

    // Projects missing budget_hours
    $stmt = $pdo->prepare("
        SELECT
            p.id, p.name, p.status,
            p.start_date, p.end_date,
            p.budget_hours, p.hourly_rate, p.project_value,
            p.actual_hours, p.actual_progress,
            p.company_id,
            COALESCE(c.name, '') AS company_name,
            p.customer_id,
            COALESCE(CONCAT(cust.first_name, ' ', cust.last_name), '') AS customer_name,
            p.payment_status,
            COALESCE(SUM(t.estimated_hours), 0) AS total_task_hours,
            COUNT(DISTINCT t.id)                 AS task_count,
            COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) AS completed_tasks
        FROM projects p
        LEFT JOIN companies c  ON p.company_id  = c.id
        LEFT JOIN customers cust ON p.customer_id = cust.id
        LEFT JOIN tasks     t ON t.project_id = p.id AND t.deleted_at IS NULL
        WHERE p.deleted_at IS NULL AND p.tenant_id = ?
          AND (p.budget_hours IS NULL OR p.budget_hours = 0)
          {$pyf['sql']}
        GROUP BY p.id
        ORDER BY p.created_at DESC
        LIMIT 50
    ");
    $stmt->execute(array_merge([$tenantId], $pyf['params']));
    $projectsWithoutBudget = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Projects missing hourly_rate
    $stmt2 = $pdo->prepare("
        SELECT
            p.id, p.name, p.status,
            p.start_date, p.end_date,
            p.budget_hours, p.hourly_rate, p.project_value,
            p.actual_hours, p.actual_progress,
            p.company_id,
            COALESCE(c.name, '') AS company_name,
            p.customer_id,
            COALESCE(CONCAT(cust.first_name, ' ', cust.last_name), '') AS customer_name,
            p.payment_status
        FROM projects p
        LEFT JOIN companies c  ON p.company_id  = c.id
        LEFT JOIN customers cust ON p.customer_id = cust.id
        WHERE p.deleted_at IS NULL AND p.tenant_id = ?
          AND (p.hourly_rate IS NULL OR p.hourly_rate = 0)
          {$pyf['sql']}
        ORDER BY p.created_at DESC
        LIMIT 50
    ");
    $stmt2->execute(array_merge([$tenantId], $pyf['params']));
    $projectsWithoutRate = $stmt2->fetchAll(PDO::FETCH_ASSOC);

    // Projects with actual_hours = 0 / NULL (no hours logged at all)
    $stmt3 = $pdo->prepare("
        SELECT
            p.id, p.name, p.status,
            p.actual_hours, p.actual_progress,
            p.start_date, p.end_date,
            p.budget_hours, p.hourly_rate, p.project_value,
            p.company_id,
            COALESCE(c.name, '') AS company_name,
            p.customer_id,
            COALESCE(CONCAT(cust.first_name, ' ', cust.last_name), '') AS customer_name,
            p.payment_status,
            COUNT(DISTINCT t.id) AS task_count,
            COUNT(DISTINCT CASE WHEN t.actual_hours > 0 THEN t.id END) AS tasks_with_hours,
            COALESCE(SUM(t.estimated_hours), 0) AS total_estimated
        FROM projects p
        LEFT JOIN companies c  ON p.company_id  = c.id
        LEFT JOIN customers cust ON p.customer_id = cust.id
        LEFT JOIN tasks     t ON t.project_id = p.id AND t.deleted_at IS NULL
        WHERE p.deleted_at IS NULL AND p.tenant_id = ?
          AND (p.actual_hours IS NULL OR p.actual_hours = 0)
          AND p.status NOT IN ('completed','cancelled')
          {$pyf['sql']}
        GROUP BY p.id
        HAVING task_count > 0
        ORDER BY total_estimated DESC
        LIMIT 30
    ");
    $stmt3->execute(array_merge([$tenantId], $pyf['params']));
    $projectsWithoutHours = $stmt3->fetchAll(PDO::FETCH_ASSOC);

    // Overdue tasks (not completed, past end_date)
    $stmt4 = $pdo->prepare("
        SELECT t.id, t.title AS name, t.status, t.estimated_hours, t.actual_hours,
               t.start_date, t.end_date, p.name AS project_name,
               DATEDIFF(CURDATE(), t.end_date) AS days_overdue
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE t.deleted_at IS NULL AND t.tenant_id = ?
          AND t.status NOT IN ('completed','cancelled')
          AND t.end_date < CURDATE()
          AND (t.task_type IS NULL OR t.task_type NOT IN ('holiday','leave'))
          {$tyf['sql']}
        ORDER BY t.end_date ASC
        LIMIT 30
    ");
    $stmt4->execute(array_merge([$tenantId], $tyf['params']));
    $overdueTasks = $stmt4->fetchAll(PDO::FETCH_ASSOC);

    // Tasks without estimated_hours count
    $stmt5 = $pdo->prepare("
        SELECT COUNT(*) AS cnt FROM tasks t
        WHERE deleted_at IS NULL AND tenant_id = ?
          AND (estimated_hours IS NULL OR estimated_hours = 0)
          AND status NOT IN ('completed','cancelled')
          AND (task_type IS NULL OR task_type NOT IN ('holiday','leave'))
          {$tyf['sql']}
    ");
    $stmt5->execute(array_merge([$tenantId], $tyf['params']));
    $noHoursCount = (int)$stmt5->fetchColumn();

    echo json_encode([
        'success'                  => true,
        'projects_without_budget'  => $projectsWithoutBudget,
        'projects_without_rate'    => $projectsWithoutRate,
        'projects_without_hours'   => $projectsWithoutHours,
        'overdue_tasks'            => $overdueTasks,
        'tasks_without_hours_count' => $noHoursCount,
    ], JSON_NUMERIC_CHECK);
    exit;
}

// ── items_missing_fields ───────────────────────────────────────────────────
if ($action === 'items_missing_fields') {
    $tyf = yearFilter('t', $yearFrom, $yearTo);

    // Main tasks missing any required field (not subtasks, not holiday/leave)
    $stmt = $pdo->prepare("
        SELECT
            t.id, t.title, t.status, t.priority,
            t.estimated_hours, t.actual_hours,
            t.start_date, t.end_date,
            COALESCE(t.assignee, '') AS assignee,
            0 AS is_subtask,
            COALESCE(p.name, '') AS project_name
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id AND p.deleted_at IS NULL
        WHERE t.deleted_at IS NULL AND t.tenant_id = ?
          AND (t.is_subtask IS NULL OR t.is_subtask = 0)
          AND (t.parent_task_id IS NULL OR t.parent_task_id = '')
          AND (t.task_type IS NULL OR t.task_type NOT IN ('holiday','leave'))
          AND (
              t.estimated_hours IS NULL OR t.estimated_hours = 0
              OR t.actual_hours IS NULL OR t.actual_hours = 0
              OR t.start_date IS NULL
              OR t.end_date IS NULL
              OR t.assignee IS NULL OR t.assignee = ''
              OR t.status IS NULL OR t.status = ''
              OR t.priority IS NULL OR t.priority = ''
          )
          {$tyf['sql']}
        ORDER BY t.created_at DESC
        LIMIT 200
    ");
    $stmt->execute(array_merge([$tenantId], $tyf['params']));
    $tasksMissing = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Subtasks missing actual_hours
    $stmt2 = $pdo->prepare("
        SELECT
            t.id, t.title, t.status, t.priority,
            t.estimated_hours, t.actual_hours,
            t.start_date, t.end_date,
            COALESCE(t.assignee, '') AS assignee,
            0 AS is_subtask,
            COALESCE(p.name, '') AS project_name
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id AND p.deleted_at IS NULL
        WHERE t.deleted_at IS NULL AND t.tenant_id = ?
          AND t.parent_task_id IS NOT NULL
          AND (t.actual_hours IS NULL OR t.actual_hours = 0)
          {$tyf['sql']}
        ORDER BY t.created_at DESC
        LIMIT 200
    ");
    $stmt2->execute(array_merge([$tenantId], $tyf['params']));
    $subtasksMissing = $stmt2->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success'  => true,
        'tasks'    => $tasksMissing,
        'subtasks' => $subtasksMissing,
    ], JSON_NUMERIC_CHECK);
    exit;
}

// ── companies_list ─────────────────────────────────────────────────────────
if ($action === 'companies_list') {
    $stmt = $pdo->prepare("
        SELECT id, name, description, address, phone, email, website, tax_id,
               business_type, company_size, founded_year, is_active
        FROM companies
        WHERE tenant_id = ? AND is_active = 1
        ORDER BY name ASC
    ");
    $stmt->execute([$tenantId]);
    echo json_encode(['success' => true, 'companies' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    exit;
}

// ── customers_by_company ───────────────────────────────────────────────────
if ($action === 'customers_by_company') {
    $companyId = $_GET['company_id'] ?? '';
    if (!$companyId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'company_id required']);
        exit;
    }

    $stmt = $pdo->prepare("
        SELECT id, company_id, first_name, last_name, position, email, phone
        FROM customers
        WHERE company_id = ? AND tenant_id = ? AND is_active = 1
        ORDER BY first_name ASC, last_name ASC
    ");
    $stmt->execute([$companyId, $tenantId]);
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Map to the shape the frontend expects: full_name = first_name + last_name
    $result = array_map(function($c) {
        return [
            'id'         => $c['id'],
            'company_id' => $c['company_id'],
            'full_name'  => trim($c['first_name'] . ' ' . $c['last_name']),
            'position'   => $c['position'],
            'email'      => $c['email'],
            'phone'      => $c['phone'],
        ];
    }, $customers);

    echo json_encode(['success' => true, 'customers' => $result]);
    exit;
}

// ─── Default GET: overall stats ────────────────────────────────────────────────

$pyf = yearFilter('p', $yearFrom, $yearTo);
$tyf = yearFilter('t', $yearFrom, $yearTo);

$projectStmt = $pdo->prepare("
    SELECT COUNT(*)  AS total,
        SUM(CASE WHEN p.actual_hours > 0  THEN 1 ELSE 0 END) AS with_hours,
        SUM(CASE WHEN p.budget_hours > 0  THEN 1 ELSE 0 END) AS with_budget,
        SUM(CASE WHEN p.hourly_rate  > 0  THEN 1 ELSE 0 END) AS with_rate,
        SUM(CASE WHEN p.actual_progress > 0 THEN 1 ELSE 0 END) AS with_progress,
        COALESCE(SUM(p.actual_hours), 0) AS total_hours
    FROM projects p WHERE p.deleted_at IS NULL AND p.tenant_id = ? {$pyf['sql']}
");
$projectStmt->execute(array_merge([$tenantId], $pyf['params']));
$ps = $projectStmt->fetch(PDO::FETCH_ASSOC);

$taskStmt = $pdo->prepare("
    SELECT COUNT(*) AS total,
        SUM(CASE WHEN t.estimated_hours > 0 THEN 1 ELSE 0 END) AS with_hours,
        SUM(CASE WHEN t.actual_hours    > 0 THEN 1 ELSE 0 END) AS with_actual,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN t.status NOT IN ('completed','cancelled')
                  AND t.end_date < CURDATE()
                  AND (t.task_type IS NULL OR t.task_type NOT IN ('holiday','leave'))
             THEN 1 ELSE 0 END) AS overdue
    FROM tasks t WHERE t.deleted_at IS NULL AND t.tenant_id = ? {$tyf['sql']}
");
$taskStmt->execute(array_merge([$tenantId], $tyf['params']));
$ts = $taskStmt->fetch(PDO::FETCH_ASSOC);

// Timesheet-like stats: tasks that have actual_hours logged
$timesheetStmt = $pdo->prepare("
    SELECT COUNT(*) AS total,
        SUM(CASE WHEN t.project_id IS NOT NULL THEN 1 ELSE 0 END) AS linked,
        SUM(CASE WHEN t.project_id IS NULL     THEN 1 ELSE 0 END) AS unlinked,
        COALESCE(SUM(t.actual_hours), 0) AS total_hours
    FROM tasks t WHERE t.deleted_at IS NULL AND t.tenant_id = ? AND t.actual_hours > 0 {$tyf['sql']}
");
$timesheetStmt->execute(array_merge([$tenantId], $tyf['params']));
$tss = $timesheetStmt->fetch(PDO::FETCH_ASSOC);

$total = max((int)$ps['total'], 1);
$score = round(
    ((int)$ps['with_hours']    / $total) * 25 +
    ((int)$ps['with_budget']   / $total) * 25 +
    ((int)$ps['with_rate']     / $total) * 12.5 +
    ((int)$ps['with_progress'] / $total) * 12.5 +
    ((int)$ts['with_hours']    / max((int)$ts['total'], 1)) * 12.5 +
    (max(0, (int)$tss['total'] - (int)$tss['unlinked']) / max((int)$tss['total'], 1)) * 12.5
);

echo json_encode([
    'success' => true,
    'score'   => $score,
    'projects' => [
        'total'        => (int)$ps['total'],
        'withHours'    => (int)$ps['with_hours'],
        'withBudget'   => (int)$ps['with_budget'],
        'withRate'     => (int)$ps['with_rate'],
        'withProgress' => (int)$ps['with_progress'],
        'totalHours'   => (float)$ps['total_hours'],
    ],
    'tasks' => [
        'total'      => (int)$ts['total'],
        'withHours'  => (int)$ts['with_hours'],
        'withActual' => (int)$ts['with_actual'],
        'completed'  => (int)$ts['completed'],
        'overdue'    => (int)$ts['overdue'],
    ],
    'task_hours_list' => [
        'total'      => (int)$tss['total'],
        'linked'     => (int)$tss['linked'],
        'unlinked'   => (int)$tss['unlinked'],
        'totalHours' => (float)$tss['total_hours'],
    ],
], JSON_NUMERIC_CHECK);
