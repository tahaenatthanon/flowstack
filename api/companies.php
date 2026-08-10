<?php
// CRUD /api/companies.php
// GET    - list companies (?id= single, ?active_only=1)
// POST   - create company
// PUT    - update company (?id=)
// DELETE - delete company (?id=)
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$tenantId = $tokenData['tenant_id'];
$db = getDB();
$method = getMethod();

// --- GET ---
if ($method === 'GET') {
    $id = $_GET['id'] ?? null;

    if ($id) {
        $stmt = $db->prepare('SELECT * FROM companies WHERE id = ? AND tenant_id = ?');
        $stmt->execute([$id, $tenantId]);
        $company = $stmt->fetch();
        if (!$company) jsonError('ไม่พบบริษัท', 404);
        jsonResponse($company);
    }

    $activeOnly = ($_GET['active_only'] ?? '0') === '1';
    $search  = trim($_GET['search'] ?? '');
    $page    = isset($_GET['page']) ? max(1, (int)$_GET['page']) : null;
    $perPageRaw = isset($_GET['per_page']) ? (int)$_GET['per_page'] : 20;
    $allMode    = $perPageRaw >= 99999;
    $perPage    = $allMode ? 500 : max(1, min(500, $perPageRaw)); // hard cap: 500 rows

    $where  = ['c.tenant_id = ?'];
    $params = [$tenantId];

    if ($activeOnly) $where[] = 'c.is_active = 1';
    $companyType = trim($_GET['company_type'] ?? '');
    if (in_array($companyType, ['customer', 'partner', 'manufacturer'], true)) {
        $where[] = 'c.company_type = ?';
        $params[] = $companyType;
    }
    if ($search !== '') {
        $where[] = '(c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.business_type LIKE ?)';
        $like = "%$search%";
        array_push($params, $like, $like, $like, $like);
    }

    $whereClause = $where ? ('WHERE ' . implode(' AND ', $where)) : '';
    $selectCols  = 'c.*, (SELECT COUNT(*) FROM customers cu WHERE cu.company_id = c.id) AS customer_count';

    if ($page !== null) {
        $countStmt = $db->prepare("SELECT COUNT(*) FROM companies c $whereClause");
        $countStmt->execute($params);
        $total  = (int)$countStmt->fetchColumn();
        $pages  = $allMode ? 1 : max(1, (int)ceil($total / $perPage));
        $offset = ($page - 1) * $perPage;
        if ($allMode) {
            $stmt = $db->prepare("SELECT $selectCols FROM companies c $whereClause ORDER BY c.name ASC");
            $stmt->execute($params);
        } else {
            $stmt = $db->prepare("SELECT $selectCols FROM companies c $whereClause ORDER BY c.name ASC LIMIT ? OFFSET ?");
            $stmt->execute(array_merge($params, [$perPage, $offset]));
        }
        jsonResponse(['data' => $stmt->fetchAll(), 'total' => $total, 'page' => $page, 'pages' => $pages, 'per_page' => $allMode ? $total : $perPage]);
    } else {
        $stmt = $db->prepare("SELECT $selectCols FROM companies c $whereClause ORDER BY c.name ASC");
        $stmt->execute($params);
        jsonResponse($stmt->fetchAll());
    }
}

// --- POST ---
if ($method === 'POST') {
    $body = getRequestBody();
    $name = trim($body['name'] ?? '');

    if (!validateStringLength($name, 255, 1)) jsonError('กรุณาระบุชื่อบริษัท (ไม่เกิน 255 ตัวอักษร)', 400);
    if (!empty($body['email']) && !validateEmail($body['email'])) jsonError('รูปแบบอีเมลไม่ถูกต้อง', 400);
    if (!empty($body['website']) && !validateUrl($body['website'])) jsonError('รูปแบบ URL เว็บไซต์ไม่ถูกต้อง', 400);

    // Check duplicate company name
    $dupStmt = $db->prepare('SELECT id FROM companies WHERE name = ? AND tenant_id = ?');
    $dupStmt->execute([$name, $tenantId]);
    if ($dupStmt->fetch()) {
        jsonError('มีบริษัทชื่อ "' . $name . '" อยู่แล้วในระบบ', 409);
    }

    $id = generateUUID();

    $stmt = $db->prepare('
        INSERT INTO companies (id, tenant_id, name, description, address, phone, email, website, tax_id, logo_url, is_active, business_type, company_type, company_size, founded_year)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $companyType = in_array($body['company_type'] ?? '', ['customer', 'partner', 'manufacturer'], true) ? $body['company_type'] : 'customer';
    $stmt->execute([
        $id,
        $tenantId,
        $name,
        $body['description'] ?? '',
        $body['address'] ?? '',
        $body['phone'] ?? '',
        $body['email'] ?? '',
        $body['website'] ?? '',
        $body['tax_id'] ?? '',
        $body['logo_url'] ?? '',
        $body['is_active'] ?? 1,
        $body['business_type'] ?? '',
        $companyType,
        $body['company_size'] ?? '',
        !empty($body['founded_year']) ? (int)$body['founded_year'] : null,
    ]);

    $stmt = $db->prepare('SELECT * FROM companies WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch(), 201);
}

// --- PUT ---
if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id parameter');

    $body = getRequestBody();

    if (array_key_exists('name', $body) && !validateStringLength($body['name'] ?? '', 255, 1)) jsonError('กรุณาระบุชื่อบริษัท (ไม่เกิน 255 ตัวอักษร)', 400);
    if (!empty($body['email']) && !validateEmail($body['email'])) jsonError('รูปแบบอีเมลไม่ถูกต้อง', 400);
    if (!empty($body['website']) && !validateUrl($body['website'])) jsonError('รูปแบบ URL เว็บไซต์ไม่ถูกต้อง', 400);

    $fields = [];
    $values = [];

    $allowed = ['name', 'description', 'address', 'phone', 'email', 'website', 'tax_id', 'logo_url', 'is_active', 'business_type', 'company_type', 'company_size', 'founded_year'];
    foreach ($allowed as $field) {
        if (array_key_exists($field, $body)) {
            // company_type ต้องเป็นค่าใน enum เท่านั้น
            if ($field === 'company_type' && !in_array($body[$field], ['customer', 'partner', 'manufacturer'], true)) {
                continue;
            }
            $fields[] = "`$field` = ?";
            $values[] = $body[$field];
        }
    }

    if (empty($fields)) jsonError('No fields to update');

    // Check duplicate name when renaming
    if (array_key_exists('name', $body)) {
        $dupStmt = $db->prepare('SELECT id FROM companies WHERE name = ? AND tenant_id = ? AND id != ?');
        $dupStmt->execute([$body['name'], $tenantId, $id]);
        if ($dupStmt->fetch()) {
            jsonError('มีบริษัทชื่อ "' . $body['name'] . '" อยู่แล้วในระบบ', 409);
        }
    }

    $values[] = $id;
    $values[] = $tenantId;
    $sql = 'UPDATE companies SET ' . implode(', ', $fields) . ' WHERE id = ? AND tenant_id = ?';
    $db->prepare($sql)->execute($values);

    $stmt = $db->prepare('SELECT * FROM companies WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$id, $tenantId]);
    jsonResponse($stmt->fetch());
}

// --- DELETE ---
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id parameter');

    $db->prepare('DELETE FROM companies WHERE id = ? AND tenant_id = ?')->execute([$id, $tenantId]);
    jsonResponse(['deleted' => true]);
}

jsonError('Method not allowed', 405);
