<?php
// /api/support-contracts.php — CRUD for support contracts + renewal alerts
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db     = getDB();
$method = getMethod();

// Auto-update expiring/expired status on every GET
$db->exec("
  UPDATE support_contracts SET status = 'expired'   WHERE end_date < CURDATE() AND status NOT IN ('expired','cancelled');
  UPDATE support_contracts SET status = 'expiring'
    WHERE end_date >= CURDATE() AND end_date <= DATE_ADD(CURDATE(), INTERVAL renewal_alert_days DAY)
      AND status = 'active';
");

function contractWithMeta(PDO $db, string $id, string $tenantId): array|false {
    $stmt = $db->prepare("
        SELECT sc.*,
               c.name  AS company_name,
               cu.first_name AS cust_first, cu.last_name AS cust_last,
               u.display_name AS created_by_name,
               DATEDIFF(sc.end_date, CURDATE()) AS days_until_expiry
        FROM support_contracts sc
        LEFT JOIN companies c  ON sc.company_id  = c.id
        LEFT JOIN customers cu ON sc.customer_id = cu.id
        LEFT JOIN users u      ON sc.created_by  = u.id
        WHERE sc.id = ? AND sc.tenant_id = ?
    ");
    $stmt->execute([$id, $tenantId]);
    $row = $stmt->fetch();
    if (!$row) return false;
    // attachments
    $att = $db->prepare("SELECT * FROM support_attachments WHERE contract_id = ? ORDER BY created_at");
    $att->execute([$id]);
    $row['attachments'] = $att->fetchAll();
    return $row;
}

// ── GET ──────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $id = $_GET['id'] ?? null;
    if ($id) {
        $c = contractWithMeta($db, $id, $tenantId);
        if (!$c) jsonError('ไม่พบสัญญา', 404);
        jsonResponse($c);
    }

    // Filters
    $where  = ['sc.tenant_id = ?'];
    $params = [$tenantId];

    if (!empty($_GET['status'])) {
        $where[]  = 'sc.status = ?';
        $params[] = $_GET['status'];
    }
    if (!empty($_GET['type'])) {
        $where[]  = 'sc.type = ?';
        $params[] = $_GET['type'];
    }
    if (!empty($_GET['company_id'])) {
        $where[]  = 'sc.company_id = ?';
        $params[] = $_GET['company_id'];
    }
    if (!empty($_GET['expiring_days'])) {
        $days     = (int)$_GET['expiring_days'];
        $where[]  = 'sc.end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)';
        $params[] = $days;
    }
    if (!empty($_GET['search'])) {
        $q        = '%' . $_GET['search'] . '%';
        $where[]  = '(sc.title LIKE ? OR sc.contract_number LIKE ? OR sc.vendor LIKE ? OR c.name LIKE ?)';
        $params   = array_merge($params, [$q, $q, $q, $q]);
    }

    $stmt = $db->prepare("
        SELECT sc.*,
               c.name AS company_name,
               cu.first_name AS cust_first, cu.last_name AS cust_last,
               DATEDIFF(sc.end_date, CURDATE()) AS days_until_expiry,
               (SELECT COUNT(*) FROM support_tickets st WHERE st.contract_id = sc.id AND st.status NOT IN ('closed')) AS open_tickets,
               (SELECT COUNT(*) FROM support_attachments sa WHERE sa.contract_id = sc.id) AS attachment_count
        FROM support_contracts sc
        LEFT JOIN companies c  ON sc.company_id  = c.id
        LEFT JOIN customers cu ON sc.customer_id = cu.id
        WHERE " . implode(' AND ', $where) . "
        ORDER BY sc.end_date ASC
    ");
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

// ── POST (create) ─────────────────────────────────────────────────────────────
if ($method === 'POST') {
    $b  = getRequestBody();
    $id = generateUUID();

    // Auto contract number if not given
    if (empty($b['contract_number'])) {
        $count = $db->query('SELECT COUNT(*)+1 FROM support_contracts')->fetchColumn();
        $b['contract_number'] = 'CON-' . date('Ym') . '-' . str_pad($count, 4, '0', STR_PAD_LEFT);
    }

    $stmt = $db->prepare("
        INSERT INTO support_contracts
          (id, tenant_id, company_id, customer_id, contract_number, title, description, type, status,
           start_date, end_date, value, renewal_alert_days, vendor,
           contact_name, contact_phone, contact_email, notes, created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ");
    $stmt->execute([
        $id,
        $tenantId,
        $b['company_id']       ?? null,
        $b['customer_id']      ?? null,
        $b['contract_number'],
        $b['title']            ?? '',
        $b['description']      ?? '',
        $b['type']             ?? 'support',
        $b['status']           ?? 'active',
        $b['start_date']       ?? date('Y-m-d'),
        $b['end_date']         ?? date('Y-m-d', strtotime('+1 year')),
        $b['value']            ?? 0,
        $b['renewal_alert_days'] ?? 30,
        $b['vendor']           ?? '',
        $b['contact_name']     ?? '',
        $b['contact_phone']    ?? '',
        $b['contact_email']    ?? '',
        $b['notes']            ?? '',
        $userId,
    ]);

    jsonResponse(contractWithMeta($db, $id, $tenantId), 201);
}

// ── PUT (update) ──────────────────────────────────────────────────────────────
if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id');

    $b      = getRequestBody();
    $fields = [];
    $vals   = [];
    $allowed = ['company_id','customer_id','contract_number','title','description',
                'type','status','start_date','end_date','value','renewal_alert_days',
                'vendor','contact_name','contact_phone','contact_email','notes'];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $b)) { $fields[] = "$f = ?"; $vals[] = $b[$f]; }
    }
    if (empty($fields)) jsonError('No fields to update');
    $vals[] = $id;
    $vals[] = $tenantId;
    $db->prepare('UPDATE support_contracts SET ' . implode(', ', $fields) . ' WHERE id = ? AND tenant_id = ?')->execute($vals);
    jsonResponse(contractWithMeta($db, $id, $tenantId));
}

// ── DELETE ────────────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id');
    $db->prepare('DELETE FROM support_contracts WHERE id = ? AND tenant_id = ?')->execute([$id, $tenantId]);
    jsonResponse(['success' => true]);
}
