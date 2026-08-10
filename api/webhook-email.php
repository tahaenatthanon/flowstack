<?php
// Webhook handler for email events (bounce, delivery, etc)
// POST /api/webhook-email.php

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    http_response_code(405);
    echo 'Method not allowed';
    exit;
}

$db = getDB();
$body = file_get_contents('php://input');
$eventData = json_decode($body, true);

// Common webhook providers: SendGrid, Mailgun, Amazon SES, etc.
// This handler supports SendGrid format by default

$eventType = $eventData['event'] ?? '';
$messageId = $eventData['message_id'] ?? $eventData['sg_message_id'] ?? '';
$email = $eventData['email'] ?? $eventData['to'] ?? '';

if (empty($messageId) && empty($email)) {
    http_response_code(400);
    echo 'Missing message ID or email';
    exit;
}

// Find tracking record
if ($messageId) {
    $stmt = $db->prepare("SELECT * FROM email_tracking WHERE message_id = ?");
    $stmt->execute([$messageId]);
} else {
    $stmt = $db->prepare("SELECT * FROM email_tracking WHERE to_email = ? ORDER BY sent_at DESC LIMIT 1");
    $stmt->execute([$email]);
}

$tracking = $stmt->fetch();

if (!$tracking) {
    // No tracking record found - acknowledge but don't process
    http_response_code(200);
    echo 'OK';
    exit;
}

$trackingId = $tracking['id'];
$customerId = $tracking['customer_id'];
$campaignId = $tracking['campaign_id'];

// Process event
switch ($eventType) {
    case 'delivered':
    case 'open': // Some providers send open event via webhook
        $stmt = $db->prepare("
            UPDATE email_tracking 
            SET delivered_at = NOW(), status = 'delivered'
            WHERE id = ?
        ");
        $stmt->execute([$trackingId]);
        break;
        
    case 'bounce':
    case 'hard_bounce':
    case 'blocked':
        $reason = $eventData['reason'] ?? $eventData['description'] ?? '';
        $stmt = $db->prepare("
            UPDATE email_tracking 
            SET bounced_at = NOW(), 
                status = 'bounced',
                bounce_reason = ?
            WHERE id = ?
        ");
        $stmt->execute([$reason, $trackingId]);
        
        // Log activity
        $activityId = generateUUID();
        $stmt = $db->prepare("
            INSERT INTO customer_activities (id, customer_id, activity_type, reference_id, details, created_at)
            VALUES (?, ?, 'email_bounced', ?, ?, NOW())
        ");
        $stmt->execute([$activityId, $customerId, $trackingId, json_encode(['reason' => $reason])]);
        break;
        
    case 'click':
        // Click is usually tracked via our own click tracking
        break;
        
    case 'unsubscribe':
        // Handle unsubscribe
        $stmt = $db->prepare("UPDATE customers SET is_active = 0 WHERE id = ?");
        $stmt->execute([$customerId]);
        break;
        
    case 'spam_report':
        // Mark customer as spam
        $stmt = $db->prepare("UPDATE customers SET notes = CONCAT(notes, '\n[SPAM REPORT]') WHERE id = ?");
        $stmt->execute([$customerId]);
        break;
        
    default:
        // Unknown event - log for debugging
        error_log("Unknown email event: $eventType - " . json_encode($eventData));
        break;
}

// Update campaign stats
updateCampaignStats($db, $campaignId);

http_response_code(200);
echo 'OK';

/**
 * Update campaign statistics
 */
function updateCampaignStats($db, $campaignId) {
    if (!$campaignId) return;
    
    $stmt = $db->prepare("
        UPDATE email_campaigns SET
            total_sent = (SELECT COUNT(*) FROM email_tracking WHERE campaign_id = ? AND status IN ('sent', 'delivered')),
            total_opens = (SELECT COUNT(*) FROM email_tracking WHERE campaign_id = ? AND opened_at IS NOT NULL),
            total_clicks = (SELECT COUNT(*) FROM email_tracking WHERE campaign_id = ? AND clicked_at IS NOT NULL)
        WHERE id = ?
    ");
    $stmt->execute([$campaignId, $campaignId, $campaignId, $campaignId]);
}
