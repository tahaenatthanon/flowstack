<?php
// GET /api/export.php?types=companies,customers,projects,tasks,subtasks,opportunities
// Returns JSON with rows per type, formatted to match import column structure
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$db = getDB();

if (getMethod() !== 'GET') {
    jsonError('Method not allowed', 405);
}

$typesParam = trim($_GET['types'] ?? '');
$validTypes = ['companies', 'customers', 'projects', 'tasks', 'subtasks', 'opportunities'];
$requested  = $typesParam
    ? array_values(array_filter(array_map('trim', explode(',', $typesParam)), fn($t) => in_array($t, $validTypes)))
    : $validTypes;

// Build email→display_name and user→email maps for resolving assignees
$usersRows = $db->query('SELECT id, email, display_name FROM users')->fetchAll();
$userIdToEmail = [];
$displayNameToEmail = [];
foreach ($usersRows as $u) {
    $userIdToEmail[$u['id']] = $u['email'];
    $displayNameToEmail[strtolower($u['display_name'] ?: $u['email'])] = $u['email'];
    $displayNameToEmail[strtolower($u['email'])] = $u['email'];
}

// Also resolve aliases
$aliasRows = $db->query('SELECT a.alias_email, u.email AS primary_email FROM user_email_aliases a JOIN users u ON u.id=a.user_id')->fetchAll();
foreach ($aliasRows as $a) {
    $displayNameToEmail[strtolower($a['alias_email'])] = $a['primary_email'];
}

function resolveToEmail(array &$map, string $value): string {
    if ($value === '') return '';
    $key = strtolower(trim($value));
    return $map[$key] ?? $value; // fallback: return the stored value
}

$tenantId = $tokenData['tenant_id'];
$result = [];

foreach ($requested as $type) {

    if ($type === 'companies') {
        $stmt = $db->prepare('SELECT name, description, address, phone, email, website, tax_id, logo_url, is_active FROM companies WHERE tenant_id = ? ORDER BY name ASC');
        $stmt->execute([$tenantId]);
        $rows = $stmt->fetchAll();
        $result['companies'] = array_map(fn($r) => [
            'name'        => $r['name'],
            'description' => $r['description'],
            'address'     => $r['address'],
            'phone'       => $r['phone'],
            'email'       => $r['email'],
            'website'     => $r['website'],
            'tax_id'      => $r['tax_id'],
            'logo_url'    => $r['logo_url'],
            'is_active'   => $r['is_active'] ? 'true' : 'false',
        ], $rows);
        continue;
    }

    if ($type === 'customers') {
        $stmt = $db->prepare('
            SELECT cu.first_name, cu.last_name, cu.email, cu.phone, cu.position,
                   cu.is_primary_contact, cu.is_active, cu.notes,
                   co.name AS company_name
            FROM customers cu
            LEFT JOIN companies co ON co.id = cu.company_id
            WHERE cu.tenant_id = ?
            ORDER BY co.name ASC, cu.last_name ASC, cu.first_name ASC
        ');
        $stmt->execute([$tenantId]);
        $rows = $stmt->fetchAll();
        $result['customers'] = array_map(fn($r) => [
            'company_name'       => $r['company_name'] ?? '',
            'first_name'         => $r['first_name'],
            'last_name'          => $r['last_name'],
            'email'              => $r['email'],
            'phone'              => $r['phone'],
            'position'           => $r['position'],
            'is_primary_contact' => $r['is_primary_contact'] ? 'true' : 'false',
            'is_active'          => $r['is_active'] ? 'true' : 'false',
            'notes'              => $r['notes'],
        ], $rows);
        continue;
    }

    if ($type === 'projects') {
        $stmt = $db->prepare('
            SELECT p.name, p.description, p.status, p.start_date, p.end_date,
                   p.project_value, p.payment_status, p.payment_terms,
                   co.name AS company_name,
                   cu.email AS customer_email
            FROM projects p
            LEFT JOIN companies co ON co.id = p.company_id
            LEFT JOIN customers cu ON cu.id = p.customer_id
            WHERE p.tenant_id = ?
            ORDER BY co.name ASC, p.name ASC
        ');
        $stmt->execute([$tenantId]);
        $rows = $stmt->fetchAll();
        $result['projects'] = array_map(fn($r) => [
            'company_name'   => $r['company_name'] ?? '',
            'customer_email' => $r['customer_email'] ?? '',
            'name'           => $r['name'],
            'description'    => $r['description'],
            'status'         => $r['status'],
            'start_date'     => $r['start_date'],
            'end_date'       => $r['end_date'],
            'project_value'  => $r['project_value'] ?? '',
            'payment_status' => $r['payment_status'],
            'payment_terms'  => $r['payment_terms'],
        ], $rows);
        continue;
    }

    if ($type === 'tasks') {
        $stmt = $db->prepare('
            SELECT t.title, t.description, t.status, t.priority, t.assignee,
                   t.start_date, t.end_date, t.estimated_days, t.days_spent,
                   t.is_ad_hoc, t.task_type,
                   p.name AS project_name,
                   co.name AS company_name
            FROM tasks t
            LEFT JOIN projects p ON p.id = t.project_id
            LEFT JOIN companies co ON co.id = p.company_id
            WHERE (t.is_subtask = 0 OR t.is_subtask IS NULL)
              AND t.parent_task_id IS NULL
              AND t.tenant_id = ?
              AND t.deleted_at IS NULL
            ORDER BY co.name ASC, p.name ASC, t.start_date ASC
        ');
        $stmt->execute([$tenantId]);
        $rows = $stmt->fetchAll();
        $result['tasks'] = array_map(function($r) use (&$displayNameToEmail) {
            return [
                'company_name'   => $r['company_name'] ?? '',
                'project_name'   => $r['project_name'] ?? '',
                'title'          => $r['title'],
                'description'    => $r['description'],
                'status'         => $r['status'],
                'priority'       => $r['priority'],
                'assignee_email' => resolveToEmail($displayNameToEmail, $r['assignee']),
                'start_date'     => $r['start_date'],
                'end_date'       => $r['end_date'],
                'estimated_days' => $r['estimated_days'],
                'days_spent'     => $r['days_spent'],
                'is_ad_hoc'      => $r['is_ad_hoc'] ? 'true' : 'false',
                'task_type'      => $r['task_type'] ?? 'task',
            ];
        }, $rows);
        continue;
    }

    if ($type === 'subtasks') {
        $stmt = $db->prepare('
            SELECT t.title, t.description, t.status, t.priority, t.assignee,
                   t.start_date, t.end_date, t.estimated_days, t.days_spent, t.task_type,
                   pt.title AS parent_task_title,
                   p.name AS project_name,
                   co.name AS company_name
            FROM tasks t
            LEFT JOIN tasks pt ON pt.id = t.parent_task_id
            LEFT JOIN projects p ON p.id = t.project_id
            LEFT JOIN companies co ON co.id = p.company_id
            WHERE t.is_subtask = 0 AND t.parent_task_id IS NOT NULL
              AND t.tenant_id = ?
              AND t.deleted_at IS NULL
            ORDER BY co.name ASC, p.name ASC, pt.title ASC, t.start_date ASC
        ');
        $stmt->execute([$tenantId]);
        $rows = $stmt->fetchAll();
        $result['subtasks'] = array_map(function($r) use (&$displayNameToEmail) {
            return [
                'company_name'      => $r['company_name'] ?? '',
                'project_name'      => $r['project_name'] ?? '',
                'parent_task_title' => $r['parent_task_title'] ?? '',
                'title'             => $r['title'],
                'description'       => $r['description'],
                'status'            => $r['status'],
                'priority'          => $r['priority'],
                'assignee_email'    => resolveToEmail($displayNameToEmail, $r['assignee']),
                'start_date'        => $r['start_date'],
                'end_date'          => $r['end_date'],
                'estimated_days'    => $r['estimated_days'],
                'days_spent'        => $r['days_spent'],
                'task_type'         => $r['task_type'] ?? 'task',
            ];
        }, $rows);
        continue;
    }

    if ($type === 'opportunities') {
        $stmt = $db->prepare('
            SELECT o.name, o.description, o.notes, o.stage, o.value, o.probability,
                   o.expected_close_date, o.lead_source,
                   co.name AS company_name,
                   p.name AS project_name,
                   u.email AS assigned_user_email
            FROM sales_opportunities o
            LEFT JOIN companies co ON co.id = o.company_id
            LEFT JOIN projects p ON p.id = o.project_id
            LEFT JOIN users u ON u.id = o.assigned_to
            WHERE o.tenant_id = ?
            ORDER BY co.name ASC, o.name ASC
        ');
        $stmt->execute([$tenantId]);
        $rows = $stmt->fetchAll();
        $result['opportunities'] = array_map(fn($r) => [
            'company_name'         => $r['company_name'] ?? '',
            'project_name'         => $r['project_name'] ?? '',
            'name'                 => $r['name'],
            'description'          => $r['description'] ?? '',
            'stage'                => $r['stage'],
            'value'                => $r['value'],
            'probability'          => $r['probability'],
            'expected_close_date'  => $r['expected_close_date'] ?? '',
            'assigned_user_email'  => $r['assigned_user_email'] ?? '',
            'lead_source'          => $r['lead_source'] ?? '',
            'notes'                => $r['notes'] ?? '',
        ], $rows);
        continue;
    }
}

jsonResponse($result);
