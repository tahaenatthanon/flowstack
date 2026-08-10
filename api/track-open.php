<?php
// Track email open - returns 1x1 transparent pixel
// GET /api/track-open.php?tracking_id=xxx

require_once __DIR__ . '/config.php';

$trackingId = $_GET['tracking_id'] ?? '';
$ipAddress = $_SERVER['REMOTE_ADDR'] ?? '';
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';

if (empty($trackingId)) {
    // Return empty pixel for invalid requests
    header('Content-Type: image/gif');
    echo base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
    exit;
}

$db = getDB();

// Update tracking record
$stmt = $db->prepare("
    UPDATE email_tracking 
    SET opened_at = NOW(), 
        ip_address = ?,
        user_agent = ?,
        status = 'delivered'
    WHERE id = ?
    AND opened_at IS NULL
");
$stmt->execute([$ipAddress, $userAgent, $trackingId]);

// Log activity
if ($stmt->rowCount() > 0) {
    // Get customer ID for this tracking
    $stmt = $db->prepare("SELECT customer_id, campaign_id FROM email_tracking WHERE id = ?");
    $stmt->execute([$trackingId]);
    $tracking = $stmt->fetch();
    
    if ($tracking) {
        $id = generateUUID();
        $stmt = $db->prepare("
            INSERT INTO customer_activities (id, customer_id, activity_type, reference_id, created_at)
            VALUES (?, ?, 'email_opened', ?, NOW())
        ");
        $stmt->execute([$id, $tracking['customer_id'], $trackingId]);
        
        // Update campaign open count
        $stmt = $db->prepare("
            UPDATE email_campaigns 
            SET total_opens = total_opens + 1 
            WHERE id = ?
        ");
        $stmt->execute([$tracking['campaign_id']]);
    }
}

// Return 1x1 transparent GIF
header('Content-Type: image/gif');
header('Cache-Control: no-cache, no-store, must-revalidate');
echo base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
exit;
