<?php
// Track email link click - redirects to original URL
// GET /api/track-click.php?tracking_id=xxx&url=encoded_url
// OR GET /api/track-click.php?campaign=xxx&url=encoded_url (for editor links)

// Disable output buffering issues
error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/config.php';

// Clear any previous output
if (ob_get_level()) {
    ob_end_clean();
}

$trackingId = $_GET['tracking_id'] ?? '';
$campaignId = $_GET['campaign'] ?? '';
$encodedUrl = $_GET['url'] ?? '';

// Handle HTML entities in URLs (e.g., &amp; -> &)
// This happens when URLs are embedded in HTML emails
$encodedUrl = html_entity_decode($encodedUrl, ENT_QUOTES, 'UTF-8');

// URL decode the encoded URL parameter
$encodedUrl = urldecode($encodedUrl);

$originalUrl = $encodedUrl;

if (empty($originalUrl)) {
    http_response_code(400);
    echo 'Invalid request: missing URL';
    exit;
}

$ipAddress = $_SERVER['REMOTE_ADDR'] ?? '';
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';

// Strict URL validation to prevent open redirect attacks
$parsedUrl = parse_url($originalUrl);

// Only allow http and https protocols
$allowedProtocols = ['http', 'https'];
if (!isset($parsedUrl['scheme']) || !in_array(strtolower($parsedUrl['scheme']), $allowedProtocols)) {
    http_response_code(400);
    echo 'Invalid URL protocol. Only http and https are allowed.';
    exit;
}

// Validate that we have a proper host
if (!isset($parsedUrl['host']) || !preg_match('/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/', $parsedUrl['host'])) {
    http_response_code(400);
    echo 'Invalid URL host format.';
    exit;
}

// Reconstruct the URL to ensure it's properly formatted (prevents encoding tricks)
$originalUrl = $parsedUrl['scheme'] . '://' . $parsedUrl['host'];
if (isset($parsedUrl['port'])) {
    $originalUrl .= ':' . $parsedUrl['port'];
}
if (isset($parsedUrl['path'])) {
    $originalUrl .= $parsedUrl['path'];
}
if (isset($parsedUrl['query'])) {
    $originalUrl .= '?' . $parsedUrl['query'];
}
if (isset($parsedUrl['fragment'])) {
    $originalUrl .= '#' . $parsedUrl['fragment'];
}

$db = getDB();

// Handle tracking ID from email_tracking table
if (!empty($trackingId)) {
    try {
        // Get customer info for activity log (before update)
        $stmt = $db->prepare("SELECT customer_id, campaign_id FROM email_tracking WHERE id = ?");
        $stmt->execute([$trackingId]);
        $tracking = $stmt->fetch();

        if (!$tracking) {
            http_response_code(400);
            echo 'Invalid tracking ID';
            exit;
        }

        // Log every click to email_link_clicks table
        $clickId = generateUUID();
        $stmt = $db->prepare("
            INSERT INTO email_link_clicks (id, tracking_id, url, clicked_at, ip_address, user_agent)
            VALUES (?, ?, ?, NOW(), ?, ?)
        ");
        $stmt->execute([$clickId, $trackingId, $originalUrl, $ipAddress, $userAgent]);

        // Update tracking record - only set clicked_at on first click
        $stmt = $db->prepare("
            UPDATE email_tracking 
            SET clicked_at = NOW(),
                ip_address = ?,
                user_agent = ?
            WHERE id = ?
            AND clicked_at IS NULL
        ");
        $stmt->execute([$ipAddress, $userAgent, $trackingId]);

        // Only increment campaign click count and log activity if this is the first click
        if ($stmt->rowCount() > 0 && $tracking['campaign_id']) {
            // Log activity for first click only
            $activityId = generateUUID();
            $stmt = $db->prepare("
                INSERT INTO customer_activities (id, customer_id, activity_type, reference_id, created_at)
                VALUES (?, ?, 'email_clicked', ?, NOW())
            ");
            $stmt->execute([$activityId, $tracking['customer_id'], $trackingId]);
            
            // Update campaign click count (only for unique first clicks)
            $stmt = $db->prepare("
                UPDATE email_campaigns 
                SET total_clicks = total_clicks + 1 
                WHERE id = ?
            ");
            $stmt->execute([$tracking['campaign_id']]);
        }
    } catch (Exception $e) {
        // Log error but still redirect - don't break the user experience
        error_log('Track click error: ' . $e->getMessage());
    }
} elseif (!empty($campaignId)) {
    // Handle campaign-based tracking (for editor links)
    // Just log the click and redirect, no customer association
    
    try {
        $clickId = generateUUID();
        $stmt = $db->prepare("
            INSERT INTO email_link_clicks (id, tracking_id, url, clicked_at, ip_address, user_agent)
            VALUES (?, NULL, ?, NOW(), ?, ?)
        ");
        $stmt->execute([$clickId, $originalUrl, $ipAddress, $userAgent]);

        // Update campaign click count if campaignId looks like a valid UUID
        if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $campaignId)) {
            $stmt = $db->prepare("
                UPDATE email_campaigns 
                SET total_clicks = total_clicks + 1 
                WHERE id = ?
            ");
            $stmt->execute([$campaignId]);
        }
    } catch (Exception $e) {
        // Log error but still redirect - don't break the user experience
        error_log('Track click error: ' . $e->getMessage());
    }
}

// Redirect to original URL
header('Location: ' . $originalUrl, true, 302);
exit;
