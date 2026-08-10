<?php
// GET /api/views/project-company-customer.php
require_once __DIR__ . '/../auth.php';

$tokenData = requireAuth();
$db        = getDB();
$userId    = $tokenData['user_id'];
$tenantId  = $tokenData['tenant_id'];

if (getMethod() !== 'GET') {
    jsonError('Method not allowed', 405);
}

$isAdmin = isTenantAdmin($db, $userId, $tenantId);

$baseSelect = '
    SELECT
        p.id,
        p.id as project_id,
        p.name,
        p.name as project_name,
        p.description as project_description,
        p.description,
        p.status,
        p.status as project_status,
        p.start_date,
        p.end_date,
        p.original_end_date,
        p.project_value,
        p.payment_status,
        p.payment_terms,
        co.id as company_id,
        co.name as company_name,
        co.email as company_email,
        co.phone as company_phone,
        co.website as company_website,
        cu.id as customer_id,
        CONCAT(cu.first_name, " ", cu.last_name) as customer_name,
        cu.email as customer_email,
        cu.phone as customer_phone,
        cu.position as customer_position,
        cu.is_primary_contact,
        p.user_id,
        p.created_at,
        p.updated_at,
        COALESCE(pay.amount_paid, 0) as amount_paid
    FROM projects p
    LEFT JOIN companies co ON p.company_id = co.id
    LEFT JOIN customers cu ON p.customer_id = cu.id
    LEFT JOIN (
        SELECT project_id, SUM(amount) as amount_paid
        FROM project_payments
        GROUP BY project_id
    ) pay ON pay.project_id = p.id
';

if ($isAdmin) {
    $stmt = $db->prepare($baseSelect . '
        WHERE p.tenant_id = ? AND p.deleted_at IS NULL
        ORDER BY p.created_at DESC
    ');
    $stmt->execute([$tenantId]);
} else {
    $stmt = $db->prepare($baseSelect . '
        LEFT JOIN project_members pm ON p.id = pm.project_id
        WHERE p.tenant_id = ? AND p.deleted_at IS NULL
          AND (p.user_id = ? OR pm.user_id = ?)
        ORDER BY p.created_at DESC
    ');
    $stmt->execute([$tenantId, $userId, $userId]);
}

$floatFields = ['project_value', 'amount_paid'];
jsonResponse(castNumericFieldsAll($stmt->fetchAll(), $floatFields));
