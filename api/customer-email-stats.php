<?php
// GET /api/customer-email-stats.php - Get email engagement stats for customers
// GET /api/customer-email-stats.php?customer_id=xxx - Get stats for specific customer

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// Get current user
$tokenData = requireAuth();
$tenantId = $tokenData['tenant_id'];

if ($method !== 'GET') {
    jsonError('Method not allowed', 405);
}

$customerId = $_GET['customer_id'] ?? null;
$campaignId = $_GET['campaign_id'] ?? null;

// If specific customer requested
if ($customerId) {
    getCustomerEmailStats($db, $customerId, $tenantId);
} else {
    // Get all customers with email engagement
    getAllCustomersEmailStats($db, $campaignId, $tenantId);
}

/**
 * Get email stats for a specific customer
 */
function getCustomerEmailStats($db, $customerId, $tenantId) {
    // Get basic customer info
    $stmt = $db->prepare("
        SELECT c.*, co.name as company_name
        FROM customers c
        LEFT JOIN companies co ON c.company_id = co.id
        WHERE c.id = ? AND c.tenant_id = ?
    ");
    $stmt->execute([$customerId, $tenantId]);
    $customer = $stmt->fetch();
    
    if (!$customer) {
        jsonError('Customer not found', 404);
    }
    
    // Get email tracking stats
    $stmt = $db->prepare("
        SELECT 
            COUNT(*) as total_emails,
            SUM(CASE WHEN status IN ('sent', 'delivered') THEN 1 ELSE 0 END) as delivered,
            SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
            SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
            SUM(CASE WHEN bounced_at IS NOT NULL THEN 1 ELSE 0 END) as bounced
        FROM email_tracking
        WHERE customer_id = ?
    ");
    $stmt->execute([$customerId]);
    $stats = $stmt->fetch();
    
    // Get recent email activity
    $stmt = $db->prepare("
        SELECT 
            et.id,
            ec.name as campaign_name,
            et.status,
            et.sent_at,
            et.opened_at,
            et.clicked_at
        FROM email_tracking et
        JOIN email_campaigns ec ON et.campaign_id = ec.id
        WHERE et.customer_id = ?
        ORDER BY et.sent_at DESC
        LIMIT 20
    ");
    $stmt->execute([$customerId]);
    $recentEmails = $stmt->fetchAll();
    
    // Also fetch full stats from email_tracking table
    $stmt = $db->prepare("
        SELECT 
            et.*,
            ec.name as campaign_name
        FROM email_tracking et
        JOIN email_campaigns ec ON et.campaign_id = ec.id
        WHERE et.customer_id = ?
        ORDER BY et.sent_at DESC
    ");
    $stmt->execute([$customerId]);
    $allEmails = $stmt->fetchAll();
    
    // Calculate rates
    $delivered = (int)($stats['delivered'] ?? 0);
    $opened = (int)($stats['opened'] ?? 0);
    $clicked = (int)($stats['clicked'] ?? 0);
    
    $openRate = $delivered > 0 ? round($opened / $delivered * 100, 1) : 0;
    $clickRate = $delivered > 0 ? round($clicked / $delivered * 100, 1) : 0;
    $clickToOpenRate = $opened > 0 ? round($clicked / $opened * 100, 1) : 0;
    
    jsonSuccess([
        'customer' => $customer,
        'stats' => [
            'total_emails' => (int)$stats['total_emails'],
            'delivered' => $delivered,
            'opened' => $opened,
            'clicked' => $clicked,
            'bounced' => (int)($stats['bounced'] ?? 0),
            'open_rate' => $openRate,
            'click_rate' => $clickRate,
            'click_to_open_rate' => $clickToOpenRate,
        ],
        'recent_emails' => $recentEmails
    ]);
}

/**
 * Get email stats for all customers
 */
function getAllCustomersEmailStats($db, $campaignId = null, $tenantId = '') {
    $search = $_GET['search'] ?? '';
    $sortBy = $_GET['sort'] ?? 'recent';
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
    $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
    
    $where = "c.tenant_id = ?";
    $params = [$tenantId];
    
    if ($campaignId) {
        $where .= " AND et.campaign_id = ?";
        $params[] = $campaignId;
    }
    
    if ($search) {
        $where .= " AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ? OR co.name LIKE ?)";
        $searchTerm = "%$search%";
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
    }
    
    // Get total count
    $countSql = "SELECT COUNT(DISTINCT c.id) as total 
                 FROM customers c
                 LEFT JOIN companies co ON c.company_id = co.id
                 LEFT JOIN email_tracking et ON c.id = et.customer_id
                 WHERE $where";
    $stmt = $db->prepare($countSql);
    $stmt->execute($params);
    $total = $stmt->fetch()['total'] ?? 0;
    
    // Build ORDER BY
    $orderBy = "ORDER BY MAX(et.sent_at) DESC"; // default: most recent
    switch ($sortBy) {
        case 'opens':
            $orderBy = "ORDER BY SUM(CASE WHEN et.opened_at IS NOT NULL THEN 1 ELSE 0 END) DESC";
            break;
        case 'clicks':
            $orderBy = "ORDER BY SUM(CASE WHEN et.clicked_at IS NOT NULL THEN 1 ELSE 0 END) DESC";
            break;
        case 'open_rate':
            $orderBy = "ORDER BY (SUM(CASE WHEN et.opened_at IS NOT NULL THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN et.status IN ('sent', 'delivered') THEN 1 ELSE 0 END), 0)) DESC";
            break;
        case 'click_rate':
            $orderBy = "ORDER BY (SUM(CASE WHEN et.clicked_at IS NOT NULL THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN et.status IN ('sent', 'delivered') THEN 1 ELSE 0 END), 0)) DESC";
            break;
    }
    
    // Get customer email stats
    $sql = "SELECT 
                c.id,
                c.first_name,
                c.last_name,
                c.email,
                co.name as company_name,
                COUNT(et.id) as total_emails,
                SUM(CASE WHEN et.status IN ('sent', 'delivered') THEN 1 ELSE 0 END) as delivered,
                SUM(CASE WHEN et.opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
                SUM(CASE WHEN et.clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
                SUM(CASE WHEN et.bounced_at IS NOT NULL THEN 1 ELSE 0 END) as bounced,
                MAX(et.sent_at) as last_sent,
                MAX(et.opened_at) as last_opened,
                MAX(et.clicked_at) as last_clicked
            FROM customers c
            LEFT JOIN companies co ON c.company_id = co.id
            LEFT JOIN email_tracking et ON c.id = et.customer_id
            WHERE $where
            GROUP BY c.id, c.first_name, c.last_name, c.email, co.name
            $orderBy
            LIMIT $limit OFFSET $offset";
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $customers = $stmt->fetchAll();
    
    // Calculate rates for each customer
    $result = [];
    foreach ($customers as $c) {
        $delivered = (int)($c['delivered'] ?? 0);
        $opened = (int)($c['opened'] ?? 0);
        $clicked = (int)($c['clicked'] ?? 0);
        
        $result[] = [
            'id' => $c['id'],
            'first_name' => $c['first_name'],
            'last_name' => $c['last_name'],
            'email' => $c['email'],
            'company_name' => $c['company_name'],
            'total_emails' => (int)$c['total_emails'],
            'delivered' => $delivered,
            'opened' => $opened,
            'clicked' => $clicked,
            'bounced' => (int)($c['bounced'] ?? 0),
            'open_rate' => $delivered > 0 ? round($opened / $delivered * 100, 1) : 0,
            'click_rate' => $delivered > 0 ? round($clicked / $delivered * 100, 1) : 0,
            'last_sent' => $c['last_sent'],
            'last_opened' => $c['last_opened'],
            'last_clicked' => $c['last_clicked'],
        ];
    }
    
    jsonSuccess([
        'customers' => $result,
        'total' => $total,
        'limit' => $limit,
        'offset' => $offset
    ]);
}
