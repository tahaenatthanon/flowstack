<?php
// GET /api/customer-activities.php              - Get all customer activities
// GET /api/customer-activities.php?customer_id= - Get by customer
// Filters: type, date_from, date_to, limit, offset

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

$tokenData = requireAuth();
$tenantId = $tokenData['tenant_id'];

if ($method === 'GET') {
    getCustomerActivities($db, $tenantId);
} else {
    jsonError('Method not allowed', 405);
}

function getCustomerActivities($db, $tenantId) {
    $customerId = $_GET['customer_id'] ?? '';
    $type       = $_GET['type']        ?? '';
    $dateFrom   = $_GET['date_from']   ?? '';
    $dateTo     = $_GET['date_to']     ?? '';
    $limit      = isset($_GET['limit'])  ? (int)$_GET['limit']  : 100;
    $offset     = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

    // customer_activities has no tenant_id; scope via customers.tenant_id
    $where  = ['c.tenant_id = ?'];
    $params = [$tenantId];

    if ($customerId) {
        $where[]  = 'ca.customer_id = ?';
        $params[] = $customerId;
    }
    if ($type) {
        $where[]  = 'ca.activity_type = ?';
        $params[] = $type;
    }
    if ($dateFrom) {
        $where[]  = 'ca.created_at >= ?';
        $params[] = $dateFrom . ' 00:00:00';
    }
    if ($dateTo) {
        $where[]  = 'ca.created_at <= ?';
        $params[] = $dateTo . ' 23:59:59';
    }

    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $sql = "SELECT ca.*,
                   c.first_name, c.last_name, c.email,
                   co.name AS company_name
            FROM customer_activities ca
            LEFT JOIN customers c  ON ca.customer_id = c.id
            LEFT JOIN companies co ON c.company_id   = co.id
            $whereSql
            ORDER BY ca.created_at DESC
            LIMIT ? OFFSET ?";

    $stmtParams = array_merge($params, [$limit, $offset]);
    $stmt = $db->prepare($sql);
    $stmt->execute($stmtParams);
    $activities = $stmt->fetchAll();

    // Count total
    $countSql = "SELECT COUNT(*) AS total FROM customer_activities ca LEFT JOIN customers c ON ca.customer_id = c.id $whereSql";
    $stmt = $db->prepare($countSql);
    $stmt->execute($params);
    $total = $stmt->fetch()['total'] ?? 0;

    foreach ($activities as &$activity) {
        if ($activity['details']) {
            $activity['details'] = json_decode($activity['details'], true);
        }
    }

    jsonSuccess([
        'activities' => $activities,
        'total'      => (int)$total,
        'limit'      => $limit,
        'offset'     => $offset,
    ]);
}

/**
 * Get activity type labels
 */
function getActivityTypeLabel($type) {
    $labels = [
        'email_sent' => 'ส่งอีเมล',
        'email_opened' => 'เปิดอีเมล',
        'email_clicked' => 'คลิกลิงก์',
        'email_replied' => 'ตอบกลับ',
        'email_bounced' => 'อีเมลตีกลับ',
        'campaign_created' => 'สร้างแคมเปญ',
        'group_added' => 'เพิ่มเข้ากลุ่ม',
        'survey_sent' => 'ส่งแบบสำรวจ'
    ];
    
    return $labels[$type] ?? $type;
}
