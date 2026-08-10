<?php
// CRUD /api/customers.php
// GET    - list customers (?id= single, ?company_id= filter, ?active_only=1, ?primary_only=1)
// POST   - create customer
// PUT    - update customer (?id=)
// DELETE - delete customer (?id=)
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$tenantId = $tokenData['tenant_id'];
$db = getDB();
$method = getMethod();

function normalizePhone(string $phone): string {
    return preg_replace('/[^0-9+]/', '', $phone) ?: '';
}

function hasDuplicatePhone(PDO $db, string $tenantId, string $companyId, string $phone, ?string $excludeId = null): bool {
    $target = normalizePhone($phone);
    if ($target === '' || $companyId === '') {
        return false;
    }

    if ($excludeId) {
        $stmt = $db->prepare('SELECT phone FROM customers WHERE tenant_id = ? AND company_id = ? AND id != ?');
        $stmt->execute([$tenantId, $companyId, $excludeId]);
    } else {
        $stmt = $db->prepare('SELECT phone FROM customers WHERE tenant_id = ? AND company_id = ?');
        $stmt->execute([$tenantId, $companyId]);
    }

    $rows = $stmt->fetchAll();
    foreach ($rows as $r) {
        $existing = normalizePhone((string)($r['phone'] ?? ''));
        if ($existing !== '' && $existing === $target) {
            return true;
        }
    }

    return false;
}

// --- GET ---
if ($method === 'GET') {
    $id = $_GET['id'] ?? null;

    if ($id) {
        // Single customer with company info
        $stmt = $db->prepare('
            SELECT c.*, co.name AS company_name, co.email AS company_email, co.phone AS company_phone
            FROM customers c
            LEFT JOIN companies co ON c.company_id = co.id
            WHERE c.id = ? AND c.tenant_id = ?
        ');
        $stmt->execute([$id, $tenantId]);
        $customer = $stmt->fetch();
        if (!$customer) jsonError('ไม่พบลูกค้า', 404);
        jsonResponse($customer);
    }

    // List with filters
    $companyId   = $_GET['company_id']  ?? null;
    $activeOnly  = ($_GET['active_only']  ?? '0') === '1';
    $primaryOnly = ($_GET['primary_only'] ?? '0') === '1';
    $search      = trim($_GET['search']   ?? '');
    $page        = isset($_GET['page'])     ? max(1, (int)$_GET['page'])                    : null;
    $perPageRaw = isset($_GET['per_page']) ? (int)$_GET['per_page'] : 20;
    $allMode    = $perPageRaw >= 99999;
    $perPage    = $allMode ? 500 : max(1, min(500, $perPageRaw)); // hard cap: 500 rows

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
        $pages  = $allMode ? 1 : max(1, (int)ceil($total / $perPage));
        $offset = ($page - 1) * $perPage;
        if ($allMode) {
            $stmt = $db->prepare("$baseSql ORDER BY c.first_name ASC");
            $stmt->execute($params);
        } else {
            $stmt = $db->prepare("$baseSql ORDER BY c.first_name ASC LIMIT ? OFFSET ?");
            $stmt->execute(array_merge($params, [$perPage, $offset]));
        }
        jsonResponse(['data' => $stmt->fetchAll(), 'total' => $total, 'page' => $page, 'pages' => $pages, 'per_page' => $allMode ? $total : $perPage]);
    } else {
        $stmt = $db->prepare("$baseSql ORDER BY c.first_name ASC");
        $stmt->execute($params);
        jsonResponse($stmt->fetchAll());
    }
}

// --- POST ---
if ($method === 'POST') {
    $body = getRequestBody();
    $email = $body['email'] ?? '';
    $companyId = $body['company_id'] ?? '';
    $phone = $body['phone'] ?? '';

    // Check duplicate email within same company
    if ($email) {
        $dupStmt = $db->prepare('SELECT id FROM customers WHERE email = ? AND company_id = ? AND tenant_id = ?');
        $dupStmt->execute([$email, $companyId, $tenantId]);
        if ($dupStmt->fetch()) {
            jsonError('มีลูกค้าที่ใช้อีเมลนี้ในบริษัทนี้อยู่แล้ว', 409);
        }
    }

    // Check duplicate phone within same company (normalized compare)
    if (hasDuplicatePhone($db, $tenantId, $companyId, (string)$phone)) {
        jsonError('มีลูกค้าที่ใช้เบอร์โทรนี้ในบริษัทนี้อยู่แล้ว', 409);
    }

    $id = generateUUID();

    $stmt = $db->prepare('
        INSERT INTO customers (id, tenant_id, company_id, first_name, last_name, email, phone, position, is_primary_contact, is_active, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([
        $id,
        $tenantId,
        $companyId,
        $body['first_name'] ?? '',
        $body['last_name'] ?? '',
        $body['email'] ?? '',
        $phone,
        $body['position'] ?? '',
        $body['is_primary_contact'] ?? 0,
        $body['is_active'] ?? 1,
        $body['notes'] ?? '',
    ]);

    $stmt = $db->prepare('SELECT * FROM customers WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse($stmt->fetch(), 201);
}

// --- PUT ---
if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id parameter');

    $currentStmt = $db->prepare('SELECT company_id, email, phone FROM customers WHERE id = ? AND tenant_id = ?');
    $currentStmt->execute([$id, $tenantId]);
    $current = $currentStmt->fetch();
    if (!$current) jsonError('ไม่พบลูกค้า', 404);

    $body = getRequestBody();
    $fields = [];
    $values = [];

    $allowed = ['company_id', 'first_name', 'last_name', 'email', 'phone', 'position', 'is_primary_contact', 'is_active', 'notes'];
    foreach ($allowed as $field) {
        if (array_key_exists($field, $body)) {
            $fields[] = "`$field` = ?";
            $values[] = $body[$field];
        }
    }

    if (empty($fields)) jsonError('No fields to update');

    $targetCompanyId = $body['company_id'] ?? $current['company_id'];

    // Check duplicate email when changing email
    if (array_key_exists('email', $body) && $body['email']) {
        $dupStmt = $db->prepare('SELECT id FROM customers WHERE email = ? AND company_id = ? AND tenant_id = ? AND id != ?');
        $dupStmt->execute([$body['email'], $targetCompanyId, $tenantId, $id]);
        if ($dupStmt->fetch()) {
            jsonError('มีลูกค้าที่ใช้อีเมลนี้ในบริษัทนี้อยู่แล้ว', 409);
        }
    }

    $targetPhone = array_key_exists('phone', $body) ? (string)$body['phone'] : (string)($current['phone'] ?? '');
    if (hasDuplicatePhone($db, $tenantId, (string)$targetCompanyId, $targetPhone, $id)) {
        jsonError('มีลูกค้าที่ใช้เบอร์โทรนี้ในบริษัทนี้อยู่แล้ว', 409);
    }

    $values[] = $id;
    $values[] = $tenantId;
    $sql = 'UPDATE customers SET ' . implode(', ', $fields) . ' WHERE id = ? AND tenant_id = ?';
    $db->prepare($sql)->execute($values);

    $stmt = $db->prepare('SELECT * FROM customers WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$id, $tenantId]);
    jsonResponse($stmt->fetch());
}

// --- DELETE ---
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id parameter');

    $db->prepare('DELETE FROM customers WHERE id = ? AND tenant_id = ?')->execute([$id, $tenantId]);
    jsonResponse(['deleted' => true]);
}

jsonError('Method not allowed', 405);
