<?php
// /api/customer-tiers.php — Customer tier classification and listing
//
// GET    ?company_id=xxx       — get tier for a single company
// GET    ?action=list          — list all companies with tiers
// POST   ?action=classify&company_id=xxx  — classify single company
// POST   ?action=classify_all  — classify all active companies (admin only)

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/lib/customer-tiering.php';

$db        = getDB();
$tokenData = requireAuth();
$userId    = $tokenData['user_id'];
$tenantId  = $tokenData['tenant_id'];
// Check admin status from DB — same pattern as calendar.php
$isAdmin = isTenantAdmin($db, $userId, $tenantId);

$method = getMethod();
$action = $_GET['action'] ?? '';

// ── GET: Read tier info ─────────────────────────────────────────────────────────
if ($method === 'GET') {
    $companyId = $_GET['company_id'] ?? '';

    if ($action === 'list') {
        // List all companies with tiers
        $stmt = $db->prepare(
            "SELECT c.id, c.name, c.tier, c.tier_score, c.tier_updated_at,
                    c.industry, c.phone,
                    COALESCE(SUM(CASE WHEN so.status = 'won' THEN COALESCE(so.amount, 0) ELSE 0 END), 0) AS revenue_12m
             FROM companies c
             LEFT JOIN sales_opportunities so ON so.company_id = c.id
                 AND so.updated_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
             WHERE c.tenant_id = ?
             GROUP BY c.id
             ORDER BY
               CASE c.tier
                 WHEN 'partner'         THEN 1
                 WHEN 'high_value'      THEN 2
                 WHEN 'high_potential'  THEN 3
                 WHEN 'transactional'   THEN 4
                 WHEN 'low_volume'      THEN 5
                 ELSE 6
               END, c.name"
        );
        $stmt->execute([$tenantId]);
        jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));

    } elseif ($companyId) {
        // Single company tier detail
        $stmt = $db->prepare(
            "SELECT id, name, tier, tier_score, tier_updated_at
             FROM companies WHERE id = ? AND tenant_id = ?"
        );
        $stmt->execute([$companyId, $tenantId]);
        $company = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$company) jsonError('ไม่พบบริษัทนี้', 404);
        jsonResponse($company);

    } else {
        jsonError('ระบุ company_id หรือ action=list', 400);
    }
}

// ── POST: Trigger classification ────────────────────────────────────────────────
if ($method === 'POST') {
    if ($action === 'classify') {
        $companyId = $_GET['company_id'] ?? '';
        if (!$companyId) jsonError('ระบุ company_id', 400);

        // Verify company belongs to tenant
        $stmt = $db->prepare("SELECT id FROM companies WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$companyId, $tenantId]);
        if (!$stmt->fetch()) jsonError('ไม่พบบริษัทนี้', 404);

        $result = classifyCompany($db, $companyId, $tenantId);
        jsonResponse(array_merge(['company_id' => $companyId], $result));

    } elseif ($action === 'classify_all') {
        if (!$isAdmin) jsonError('Forbidden — admin only', 403);

        $result = classifyAllCompanies($db, $tenantId);
        jsonResponse($result);

    } else {
        jsonError('ระบุ action=classify หรือ action=classify_all', 400);
    }
}

jsonError('Method not allowed', 405);
