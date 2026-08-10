<?php
// CRUD /api/contacts.php (alias for customers, but with name field)
// GET    - list contacts (?id= single, ?company_id= filter, ?active_only=1, ?primary_only=1)
// POST   - create contact (body: { company_id, name, email?, phone?, position?, notes? })
// PUT    - update contact (?id=) (body: same)
// DELETE - delete contact (?id=)
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$tenantId = $tokenData['tenant_id'];
$db = getDB();
$method = getMethod();

// Helper: split name into first_name, last_name
function splitName($name) {
    $parts = explode(' ', trim($name), 2);
    return [
        'first_name' => $parts[0] ?? '',
        'last_name' => $parts[1] ?? ''
    ];
}

// Helper: join first_name + last_name into name
function joinName($first, $last) {
    return trim($first . ' ' . $last);
}

// --- GET ---
if ($method === 'GET') {
    $id = $_GET['id'] ?? null;

    if ($id) {
        // Single contact with company info
        $stmt = $db->prepare('
            SELECT c.*, co.name AS company_name, co.email AS company_email, co.phone AS company_phone
            FROM customers c
            LEFT JOIN companies co ON c.company_id = co.id
            WHERE c.id = ? AND c.tenant_id = ?
        ');
        $stmt->execute([$id, $tenantId]);
        $customer = $stmt->fetch();
        if (!$customer) jsonError('ไม่พบผู้ติดต่อ', 404);
        // Add name field
        $customer['name'] = joinName($customer['first_name'], $customer['last_name']);
        jsonResponse($customer);
    }

    // List with filters
    $companyId   = $_GET['company_id']  ?? null;
    $activeOnly  = ($_GET['active_only']  ?? '0') === '1';
    $primaryOnly = ($_GET['primary_only'] ?? '0') === '1';
    $search      = trim($_GET['search']   ?? '');
    $page        = isset($_GET['page'])     ? max(1, (int)$_GET['page'])                    : null;
    $perPage     = isset($_GET['per_page']) ? max(1, min(100, (int)$_GET['per_page'])) : 20;

    $where  = ['c.tenant_id = ?'];
    $params = [$tenantId];

    if ($companyId) {
        $where[] = 'c.company_id = ?';
        $params[] = $companyId;
    }
    if ($activeOnly)  { $where[] = 'c.is_active = 1'; }
    if ($primaryOnly) { $where[] = 'c.is_primary_contact = 1'; }
    if ($search !== '') {
        $where[] = '(c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR co.name LIKE ?)';
        $like = "%$search%";
        array_push($params, $like, $like, $like, $like, $like);
    }

    $whereClause = 'WHERE ' . implode(' AND ', $where);
    $baseSql     = "SELECT c.*, co.name AS company_name, co.business_type AS company_business_type FROM customers c LEFT JOIN companies co ON c.company_id = co.id $whereClause";

    if ($page !== null) {
        $countStmt = $db->prepare("SELECT COUNT(*) FROM customers c LEFT JOIN companies co ON c.company_id = co.id $whereClause");
        $countStmt->execute($params);
        $total  = (int)$countStmt->fetchColumn();
        $pages  = max(1, (int)ceil($total / $perPage));
        $offset = ($page - 1) * $perPage;
        $stmt = $db->prepare("$baseSql ORDER BY c.first_name ASC LIMIT ? OFFSET ?");
        $stmt->execute(array_merge($params, [$perPage, $offset]));
        $data = $stmt->fetchAll();
        // Add name field to each
        foreach ($data as &$row) {
            $row['name'] = joinName($row['first_name'], $row['last_name']);
        }
        jsonResponse(['data' => $data, 'total' => $total, 'page' => $page, 'pages' => $pages, 'per_page' => $perPage]);
    } else {
        $stmt = $db->prepare("$baseSql ORDER BY c.first_name ASC");
        $stmt->execute($params);
        $data = $stmt->fetchAll();
        // Add name field
        foreach ($data as &$row) {
            $row['name'] = joinName($row['first_name'], $row['last_name']);
        }
        jsonResponse($data);
    }
}

// --- POST ---
if ($method === 'POST') {
    $body = getRequestBody();
    $email = trim($body['email'] ?? '');

    if (!validateStringLength($body['name'] ?? '', 255, 1)) jsonError('กรุณาระบุชื่อผู้ติดต่อ (ไม่เกิน 255 ตัวอักษร)', 400);
    if ($email && !validateEmail($email)) jsonError('รูปแบบอีเมลไม่ถูกต้อง', 400);

    // Check duplicate email within same company
    if ($email) {
        $dupStmt = $db->prepare('SELECT id FROM customers WHERE email = ? AND company_id = ? AND tenant_id = ?');
        $dupStmt->execute([$email, $body['company_id'] ?? '', $tenantId]);
        if ($dupStmt->fetch()) {
            jsonError('มีลูกค้าที่ใช้อีเมลนี้ในบริษัทนี้อยู่แล้ว', 409);
        }
    }

    $id = generateUUID();

    $nameParts = splitName($body['name'] ?? '');

    $stmt = $db->prepare('
        INSERT INTO customers (id, tenant_id, company_id, first_name, last_name, email, phone, position, is_primary_contact, is_active, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([
        $id,
        $tenantId,
        $body['company_id'] ?? '',
        $nameParts['first_name'],
        $nameParts['last_name'],
        $body['email'] ?? '',
        $body['phone'] ?? '',
        $body['position'] ?? '',
        $body['is_primary_contact'] ?? 0,
        $body['is_active'] ?? 1,
        $body['notes'] ?? '',
    ]);

    $stmt = $db->prepare('SELECT * FROM customers WHERE id = ?');
    $stmt->execute([$id]);
    $customer = $stmt->fetch();
    $customer['name'] = joinName($customer['first_name'], $customer['last_name']);
    jsonResponse($customer, 201);
}

// --- PUT ---
if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id parameter');

    $body = getRequestBody();

    if (array_key_exists('name', $body) && !validateStringLength($body['name'] ?? '', 255, 1)) jsonError('กรุณาระบุชื่อผู้ติดต่อ (ไม่เกิน 255 ตัวอักษร)', 400);
    if (!empty($body['email']) && !validateEmail($body['email'])) jsonError('รูปแบบอีเมลไม่ถูกต้อง', 400);

    $fields = [];
    $values = [];

    $allowed = ['company_id', 'name', 'email', 'phone', 'position', 'is_primary_contact', 'is_active', 'notes'];
    foreach ($allowed as $field) {
        if (array_key_exists($field, $body)) {
            if ($field === 'name') {
                $nameParts = splitName($body[$field]);
                $fields[] = "`first_name` = ?";
                $values[] = $nameParts['first_name'];
                $fields[] = "`last_name` = ?";
                $values[] = $nameParts['last_name'];
            } else {
                $fields[] = "`$field` = ?";
                $values[] = $body[$field];
            }
        }
    }

    if (empty($fields)) jsonError('No fields to update');

    // Check duplicate email when changing email
    if (array_key_exists('email', $body) && $body['email']) {
        $dupStmt = $db->prepare('SELECT id FROM customers WHERE email = ? AND company_id = ? AND tenant_id = ? AND id != ?');
        $dupStmt->execute([$body['email'], $body['company_id'] ?? '', $tenantId, $id]);
        if ($dupStmt->fetch()) {
            jsonError('มีลูกค้าที่ใช้อีเมลนี้ในบริษัทนี้อยู่แล้ว', 409);
        }
    }

    $values[] = $id;
    $values[] = $tenantId;
    $sql = 'UPDATE customers SET ' . implode(', ', $fields) . ' WHERE id = ? AND tenant_id = ?';
    $db->prepare($sql)->execute($values);

    $stmt = $db->prepare('SELECT * FROM customers WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$id, $tenantId]);
    $customer = $stmt->fetch();
    $customer['name'] = joinName($customer['first_name'], $customer['last_name']);
    jsonResponse($customer);
}

// --- DELETE ---
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id parameter');

    $db->prepare('DELETE FROM customers WHERE id = ? AND tenant_id = ?')->execute([$id, $tenantId]);
    jsonResponse(['deleted' => true]);
}

jsonError('Method not allowed', 405);