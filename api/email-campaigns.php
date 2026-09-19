<?php
// GET /api/email-campaigns.php - List all campaigns
// POST /api/email-campaigns.php - Create new campaign
// GET /api/email-campaigns.php?id=xxx - Get single campaign
// PUT /api/email-campaigns.php?id=xxx - Update campaign
// DELETE /api/email-campaigns.php?id=xxx - Delete campaign
// POST /api/email-campaigns.php?action=send - Send campaign immediately
// POST /api/email-campaigns.php?action=schedule - Schedule campaign
// GET /api/email-campaigns.php?action=stats - Get campaign stats
// GET /api/email-campaigns.php?action=recipient_count&group_ids=g1,g2 - Live dedup'd recipient count for a set of groups (preview, before the campaign is saved)

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/email-utils.php';
require_once __DIR__ . '/lib/email-campaign-sender.php';
require_once __DIR__ . '/../vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception as MailException;

$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Use requireAuth for consistent tenant-aware auth
$tokenData = requireAuth();
$userId = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];

// Handle different actions
if ($method === 'GET' && $action === 'recipients') {
    getCampaignRecipients($db, $tenantId);
} elseif ($method === 'GET' && $action === 'recipient_count') {
    getRecipientCount($db, $tenantId);
} elseif ($method === 'GET' && $action === 'stats') {
    getCampaignStats($db, $tenantId);
} elseif ($method === 'GET' && $action === 'suggest_campaign') {
    suggestCampaignForCustomer($db, $tenantId);
} elseif ($method === 'POST' && $action === 'send') {
    sendCampaign($db, $userId, $tenantId);
} elseif ($method === 'POST' && $action === 'schedule') {
    scheduleCampaign($db, $tenantId);
} elseif ($method === 'GET') {
    if (isset($_GET['id'])) {
        getEmailCampaign($db, $tenantId);
    } else {
        listEmailCampaigns($db, $tenantId);
    }
} elseif ($method === 'POST') {
    createEmailCampaign($db, $userId, $tenantId);
} elseif ($method === 'PUT') {
    updateEmailCampaign($db, $tenantId);
} elseif ($method === 'DELETE') {
    deleteEmailCampaign($db, $tenantId);
} else {
    jsonError('Method not allowed', 405);
}

/**
 * List all email campaigns
 */
function listEmailCampaigns($db, string $tenantId) {
    $status = $_GET['status'] ?? '';
    
    $sql = "SELECT c.*, 
            u.display_name as creator_name,
            (SELECT COUNT(*) FROM email_group_members egm 
             JOIN email_campaign_recipients ecr ON egm.group_id = ecr.group_id 
             WHERE ecr.campaign_id = c.id) as recipient_count
            FROM email_campaigns c
            LEFT JOIN users u ON c.created_by = u.id
            WHERE c.tenant_id = ?";
    
    $params = [$tenantId];
    if ($status) {
        $sql .= " AND c.status = ?";
        $params[] = $status;
    }
    
    $sql .= " ORDER BY c.created_at DESC";
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $campaigns = $stmt->fetchAll();
    
    jsonSuccess($campaigns);
}

/**
 * Get single campaign with details
 */
function getEmailCampaign($db, string $tenantId = '') {
    $id = $_GET['id'] ?? '';
    
    if (empty($id)) {
        jsonError('Campaign ID required', 400);
    }
    
    $stmt = $db->prepare("SELECT c.*, u.display_name as creator_name 
                          FROM email_campaigns c 
                          LEFT JOIN users u ON c.created_by = u.id 
                          WHERE c.id = ? AND c.tenant_id = ?");
    $stmt->execute([$id, $tenantId]);
    $campaign = $stmt->fetch();
    
    if (!$campaign) {
        jsonError('Campaign not found', 404);
    }
    
    // Get recipient groups
    $stmt = $db->prepare("
        SELECT eg.id, eg.name, ecr.group_id
        FROM email_campaign_recipients ecr
        JOIN email_groups eg ON ecr.group_id = eg.id
        WHERE ecr.campaign_id = ?
    ");
    $stmt->execute([$id]);
    $groups = $stmt->fetchAll();
    
    // Get tracking stats
    $stmt = $db->prepare("
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
            SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
            SUM(CASE WHEN status = 'bounced' THEN 1 ELSE 0 END) as bounced,
            SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
            SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked
        FROM email_tracking
        WHERE campaign_id = ?
    ");
    $stmt->execute([$id]);
    $stats = $stmt->fetch();
    
    jsonSuccess([
        'campaign' => $campaign,
        'groups' => $groups,
        'stats' => $stats
    ]);
}

/**
 * Get campaign statistics
 */
function getCampaignStats($db, string $tenantId) {
    $id = $_GET['id'] ?? '';

    if (empty($id)) {
        jsonError('Campaign ID required', 400);
    }

    // Verify ownership before returning stats
    $check = $db->prepare("SELECT id FROM email_campaigns WHERE id = ? AND tenant_id = ?");
    $check->execute([$id, $tenantId]);
    if (!$check->fetch()) {
        jsonError('Campaign not found', 404);
    }

    $stmt = $db->prepare("
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
            SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
            SUM(CASE WHEN status = 'bounced' THEN 1 ELSE 0 END) as bounced,
            SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
            SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked
        FROM email_tracking
        WHERE campaign_id = ?
    ");
    $stmt->execute([$id]);
    $stats = $stmt->fetch();
    
    // Get recent opens
    $stmt = $db->prepare("
        SELECT et.*, c.first_name, c.last_name, c.email, co.name as company_name
        FROM email_tracking et
        JOIN customers c ON et.customer_id = c.id
        LEFT JOIN companies co ON c.company_id = co.id
        WHERE et.campaign_id = ? AND et.opened_at IS NOT NULL
        ORDER BY et.opened_at DESC
        LIMIT 20
    ");
    $stmt->execute([$id]);
    $recentOpens = $stmt->fetchAll();
    
    // Get recent clicks
    $stmt = $db->prepare("
        SELECT elc.*, et.customer_id, c.first_name, c.last_name, c.email
        FROM email_link_clicks elc
        JOIN email_tracking et ON elc.tracking_id = et.id
        JOIN customers c ON et.customer_id = c.id
        WHERE et.campaign_id = ?
        ORDER BY elc.clicked_at DESC
        LIMIT 20
    ");
    $stmt->execute([$id]);
    $recentClicks = $stmt->fetchAll();
    
    jsonSuccess([
        'stats' => $stats,
        'recent_opens' => $recentOpens,
        'recent_clicks' => $recentClicks
    ]);
}

/**
 * Get per-recipient tracking log for a campaign
 * GET /api/email-campaigns.php?action=recipients&id=xxx
 */
function getCampaignRecipients($db, string $tenantId) {
    $id = $_GET['id'] ?? '';
    if (empty($id)) jsonError('Campaign ID required', 400);

    // Verify campaign belongs to tenant
    $stmt = $db->prepare("SELECT id, name, subject, body_html, sender_name, sender_email, sent_at FROM email_campaigns WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$id, $tenantId]);
    $campaign = $stmt->fetch();
    if (!$campaign) jsonError('Campaign not found', 404);

    // Get all tracking records for this campaign
    $stmt = $db->prepare("
        SELECT et.id, et.customer_id, et.to_email, et.status,
               et.sent_at, et.opened_at, et.clicked_at, et.bounce_reason,
               c.first_name, c.last_name, co.name AS company_name,
               (SELECT COUNT(*) FROM email_link_clicks elc WHERE elc.tracking_id = et.id) AS click_count
        FROM email_tracking et
        LEFT JOIN customers c ON et.customer_id = c.id
        LEFT JOIN companies co ON c.company_id = co.id
        WHERE et.campaign_id = ?
        ORDER BY et.sent_at ASC
    ");
    $stmt->execute([$id]);
    $recipients = $stmt->fetchAll();

    jsonSuccess([
        'campaign' => $campaign,
        'recipients' => $recipients,
        'total' => count($recipients),
    ]);
}

/**
 * Live dedup'd recipient count for a set of groups — used by the campaign
 * form's "จะส่งถึง N คน" preview while the user is still ticking groups,
 * before the campaign exists as a row (so it can't key off a campaign id).
 * GET /api/email-campaigns.php?action=recipient_count&group_ids=g1,g2
 */
function getRecipientCount($db, string $tenantId) {
    $raw = trim($_GET['group_ids'] ?? '');
    $segmentFiltersRaw = trim($_GET['segment_filters'] ?? '');
    $segmentFilters = $segmentFiltersRaw !== '' ? json_decode($segmentFiltersRaw, true) : null;

    $groupIds = $raw !== ''
        ? array_values(array_filter(array_map('trim', explode(',', $raw)), fn($g) => $g !== ''))
        : [];

    if (empty($groupIds) && empty($segmentFilters)) {
        jsonSuccess(['count' => 0]);
    }

    $ownedGroupIds = [];
    if (!empty($groupIds)) {
        // Only count groups that actually belong to this tenant — group_ids here
        // come straight from the client (no campaign row to anchor tenant
        // ownership to yet), so this must be checked explicitly.
        $placeholders = implode(',', array_fill(0, count($groupIds), '?'));
        $stmt = $db->prepare("SELECT id FROM email_groups WHERE id IN ($placeholders) AND tenant_id = ?");
        $stmt->execute([...$groupIds, $tenantId]);
        $ownedGroupIds = array_column($stmt->fetchAll(), 'id');
    }

    jsonSuccess(['count' => count(resolveCampaignRecipients($db, $ownedGroupIds, $tenantId, $segmentFilters))]);
}

/**
 * Suggest the campaign a customer most recently clicked — used by
 * CreateOpportunityDialog.tsx to pre-fill the Campaign field when the sales
 * rep picks a contact who arrived via a tracked email click.
 * GET /api/email-campaigns.php?action=suggest_campaign&customer_id=xxx
 */
function suggestCampaignForCustomer($db, string $tenantId) {
    $customerId = $_GET['customer_id'] ?? '';
    if (empty($customerId)) {
        jsonSuccess(['campaign_id' => null]);
    }

    // 180-day window: a click from over 6 months ago is unlikely to be the
    // reason this lead exists today, and would be a confusing/stale suggestion.
    $stmt = $db->prepare("
        SELECT et.campaign_id, ec.name AS campaign_name, et.clicked_at
        FROM email_tracking et
        JOIN email_campaigns ec ON ec.id = et.campaign_id
        JOIN customers c ON c.id = et.customer_id
        WHERE et.customer_id = ? AND c.tenant_id = ?
          AND et.clicked_at IS NOT NULL
          AND et.clicked_at >= NOW() - INTERVAL 180 DAY
        ORDER BY et.clicked_at DESC
        LIMIT 1
    ");
    $stmt->execute([$customerId, $tenantId]);
    $row = $stmt->fetch();

    jsonSuccess($row ?: ['campaign_id' => null]);
}

/**
 * Create new email campaign
 */
function createEmailCampaign($db, $userId, string $tenantId = '') {
    $body = getRequestBody();
    
    $name = trim($body['name'] ?? '');
    $subject = trim($body['subject'] ?? '');
    $bodyHtml = $body['body_html'] ?? '';
    $bodyText = $body['body_text'] ?? '';
    $templateId = $body['template_id'] ?? null;
    $editableContent = $body['editable_content'] ?? null;
    $ctaText = $body['cta_text'] ?? null;
    $ctaUrl = $body['cta_url'] ?? null;
    $discountPercent = $body['discount_percent'] ?? null;
    $countdown = $body['countdown_text'] ?? null;
    $senderName = trim($body['sender_name'] ?? '');
    $senderEmail = trim($body['sender_email'] ?? '');
    $groupIds = $body['group_ids'] ?? [];
    $segmentFilters = !empty($body['segment_filters']) ? $body['segment_filters'] : null;
    $enableTrackOpens  = isset($body['enable_track_opens'])  ? (int)(bool)$body['enable_track_opens']  : 1;
    $enableTrackClicks = isset($body['enable_track_clicks']) ? (int)(bool)$body['enable_track_clicks'] : 1;

    if (empty($name)) {
        jsonError('Campaign name is required', 400);
    }

    if (empty($subject)) {
        jsonError('Email subject is required', 400);
    }

    if (empty($senderName) || empty($senderEmail)) {
        jsonError('Sender name and email are required', 400);
    }

    $id = generateUUID();
    $stmt = $db->prepare("
        INSERT INTO email_campaigns (
            id, tenant_id, name, subject, body_html, body_text, template_id,
            editable_content, cta_text, cta_url, discount_percent, countdown_text,
            sender_name, sender_email, enable_track_opens, enable_track_clicks, segment_filters,
            status, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, NOW())
    ");
    $stmt->execute([
        $id, $tenantId, $name, $subject, $bodyHtml, $bodyText, $templateId,
        $editableContent, $ctaText, $ctaUrl, $discountPercent, $countdown,
        $senderName, $senderEmail, $enableTrackOpens, $enableTrackClicks,
        $segmentFilters ? json_encode($segmentFilters) : null, $userId
    ]);

    // Save recipient groups
    if (!empty($groupIds) && is_array($groupIds)) {
        $stmt = $db->prepare("
            INSERT INTO email_campaign_recipients (id, campaign_id, group_id)
            VALUES (?, ?, ?)
        ");
        foreach ($groupIds as $groupId) {
            $stmt->execute([generateUUID(), $id, $groupId]);
        }
    }

    // Count total recipients — deduplicated by email (not raw group
    // membership count) and inclusive of segment filter matches, same rule
    // sendCampaignCore() uses at send time. Runs whenever either source of
    // recipients is set, not just when static groups are picked.
    if ((!empty($groupIds) && is_array($groupIds)) || !empty($segmentFilters)) {
        $totalRecipients = count(resolveCampaignRecipients($db, $groupIds, $tenantId, $segmentFilters));
        $stmt = $db->prepare("UPDATE email_campaigns SET total_recipients = ? WHERE id = ?");
        $stmt->execute([$totalRecipients, $id]);
    }
    
    $stmt = $db->prepare("SELECT * FROM email_campaigns WHERE id = ?");
    $stmt->execute([$id]);
    $campaign = $stmt->fetch();
    
    jsonSuccess($campaign, 201);
}

/**
 * Update email campaign
 */
function updateEmailCampaign($db, string $tenantId) {
    $body = getRequestBody();
    $id = $body['id'] ?? $_GET['id'] ?? '';

    if (empty($id)) {
        jsonError('Campaign ID required', 400);
    }

    // Check campaign exists, is owned by tenant, and is draft
    $stmt = $db->prepare("SELECT id, status FROM email_campaigns WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$id, $tenantId]);
    $campaign = $stmt->fetch();
    
    if (!$campaign) {
        jsonError('Campaign not found', 404);
    }
    
    if ($campaign['status'] !== 'draft') {
        jsonError('Only draft campaigns can be edited', 400);
    }
    
    $name = trim($body['name'] ?? '');
    $subject = trim($body['subject'] ?? '');
    $bodyHtml = $body['body_html'] ?? '';
    $bodyText = $body['body_text'] ?? '';
    $senderName = trim($body['sender_name'] ?? '');
    $senderEmail = trim($body['sender_email'] ?? '');
    $groupIds = $body['group_ids'] ?? null;

    $updates = [];
    $params = [];

    if ($name) {
        $updates[] = 'name = ?';
        $params[] = $name;
    }
    if ($subject) {
        $updates[] = 'subject = ?';
        $params[] = $subject;
    }
    if ($bodyHtml !== null) {
        $updates[] = 'body_html = ?';
        $params[] = $bodyHtml;
    }
    if ($bodyText !== null) {
        $updates[] = 'body_text = ?';
        $params[] = $bodyText;
    }
    if ($senderName) {
        $updates[] = 'sender_name = ?';
        $params[] = $senderName;
    }
    if ($senderEmail) {
        $updates[] = 'sender_email = ?';
        $params[] = $senderEmail;
    }
    if (array_key_exists('enable_track_opens', $body)) {
        $updates[] = 'enable_track_opens = ?';
        $params[] = (int)(bool)$body['enable_track_opens'];
    }
    if (array_key_exists('enable_track_clicks', $body)) {
        $updates[] = 'enable_track_clicks = ?';
        $params[] = (int)(bool)$body['enable_track_clicks'];
    }
    if (array_key_exists('template_id', $body)) {
        $updates[] = 'template_id = ?';
        $params[] = $body['template_id'];
    }
    if (array_key_exists('editable_content', $body)) {
        $updates[] = 'editable_content = ?';
        $params[] = $body['editable_content'];
    }
    if (array_key_exists('cta_text', $body)) {
        $updates[] = 'cta_text = ?';
        $params[] = $body['cta_text'];
    }
    if (array_key_exists('cta_url', $body)) {
        $updates[] = 'cta_url = ?';
        $params[] = $body['cta_url'];
    }
    if (array_key_exists('discount_percent', $body)) {
        $updates[] = 'discount_percent = ?';
        $params[] = $body['discount_percent'];
    }
    if (array_key_exists('countdown_text', $body)) {
        $updates[] = 'countdown_text = ?';
        $params[] = $body['countdown_text'];
    }
    if (array_key_exists('segment_filters', $body)) {
        $updates[] = 'segment_filters = ?';
        $params[] = !empty($body['segment_filters']) ? json_encode($body['segment_filters']) : null;
    }

    if (!empty($updates)) {
        $params[] = $id;
        $params[] = $tenantId;
        $sql = "UPDATE email_campaigns SET " . implode(', ', $updates) . " WHERE id = ? AND tenant_id = ?";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
    }
    
    // Update recipient groups if provided
    $groupsChanged = $groupIds !== null && is_array($groupIds);
    if ($groupsChanged) {
        // Delete existing recipients
        $stmt = $db->prepare("DELETE FROM email_campaign_recipients WHERE campaign_id = ?");
        $stmt->execute([$id]);

        // Insert new recipients
        if (!empty($groupIds)) {
            $stmt = $db->prepare("
                INSERT INTO email_campaign_recipients (id, campaign_id, group_id)
                VALUES (?, ?, ?)
            ");
            foreach ($groupIds as $groupId) {
                $stmt->execute([generateUUID(), $id, $groupId]);
            }
        }
    }

    // Recompute total_recipients whenever groups or segment filters changed —
    // reads back the definitive current state of BOTH (not just what this
    // request touched), so a request that only changes segment_filters still
    // counts against the groups saved earlier, and vice versa.
    if ($groupsChanged || array_key_exists('segment_filters', $body)) {
        $groupsStmt = $db->prepare("SELECT group_id FROM email_campaign_recipients WHERE campaign_id = ?");
        $groupsStmt->execute([$id]);
        $currentGroupIds = array_column($groupsStmt->fetchAll(), 'group_id');

        $sfStmt = $db->prepare("SELECT segment_filters FROM email_campaigns WHERE id = ?");
        $sfStmt->execute([$id]);
        $rawSegmentFilters = $sfStmt->fetchColumn();
        $currentSegmentFilters = $rawSegmentFilters ? json_decode($rawSegmentFilters, true) : null;

        $totalRecipients = count(resolveCampaignRecipients($db, $currentGroupIds, $tenantId, $currentSegmentFilters));
        $stmt = $db->prepare("UPDATE email_campaigns SET total_recipients = ? WHERE id = ?");
        $stmt->execute([$totalRecipients, $id]);
    }


    $stmt = $db->prepare("SELECT * FROM email_campaigns WHERE id = ?");
    $stmt->execute([$id]);
    $campaign = $stmt->fetch();
    
    jsonSuccess($campaign);
}

/**
 * Delete email campaign
 */
function deleteEmailCampaign($db, string $tenantId) {
    $id = $_GET['id'] ?? '';

    if (empty($id)) {
        jsonError('Campaign ID required', 400);
    }

    // Check campaign exists and belongs to this tenant
    $stmt = $db->prepare("SELECT id, status FROM email_campaigns WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$id, $tenantId]);
    $campaign = $stmt->fetch();
    
    if (!$campaign) {
        jsonError('Campaign not found', 404);
    }
    
    // Delete tracking records
    $stmt = $db->prepare("DELETE FROM email_tracking WHERE campaign_id = ?");
    $stmt->execute([$id]);
    
    // Delete recipients
    $stmt = $db->prepare("DELETE FROM email_campaign_recipients WHERE campaign_id = ?");
    $stmt->execute([$id]);
    
    // Delete campaign
    $stmt = $db->prepare("DELETE FROM email_campaigns WHERE id = ?");
    $stmt->execute([$id]);
    
    jsonSuccess(['message' => 'Campaign deleted successfully']);
}

// resolveCampaignRecipients() and sendCampaignCore() now live in
// api/lib/email-campaign-sender.php (required near the top of this file) so
// that api/cron/send-scheduled-campaigns.php can reuse them without pulling
// in this file's top-level requireAuth()/action-dispatch side effects.

/**
 * HTTP wrapper for action=send — reads the campaign id from the request and
 * translates sendCampaignCore()'s result array into the usual jsonSuccess()/
 * jsonError() response. Behavior of this endpoint is unchanged from before
 * the sendCampaignCore() extraction.
 */
function sendCampaign($db, $userId, string $tenantId) {
    $body = getRequestBody();
    $id = $body['id'] ?? $_GET['id'] ?? '';

    if (empty($id)) {
        jsonError('Campaign ID required', 400);
    }

    $result = sendCampaignCore($db, $id, $userId, $tenantId);
    if (!$result['ok']) {
        jsonError($result['error'], $result['code']);
    }
    jsonSuccess($result['data']);
}

/**
 * Schedule campaign
 */
function scheduleCampaign($db, string $tenantId) {
    $body = getRequestBody();
    $id = $body['id'] ?? '';
    $scheduledAt = $body['scheduled_at'] ?? '';
    
    if (empty($id) || empty($scheduledAt)) {
        jsonError('Campaign ID and scheduled time required', 400);
    }
    
    // Validate datetime
    $timestamp = strtotime($scheduledAt);
    if (!$timestamp || $timestamp <= time()) {
        jsonError('Scheduled time must be in the future', 400);
    }
    
    // Check campaign exists, belongs to tenant, and is draft
    $stmt = $db->prepare("SELECT id, status FROM email_campaigns WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$id, $tenantId]);
    $campaign = $stmt->fetch();

    if (!$campaign) {
        jsonError('Campaign not found', 404);
    }

    if ($campaign['status'] !== 'draft') {
        jsonError('Only draft campaigns can be scheduled', 400);
    }

    $stmt = $db->prepare("UPDATE email_campaigns SET status = 'scheduled', scheduled_at = ? WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$scheduledAt, $id, $tenantId]);
    
    jsonSuccess(['message' => 'Campaign scheduled', 'scheduled_at' => $scheduledAt]);
}

// logCustomerActivity() moved to api/lib/email-campaign-sender.php — its only
// caller (sendCampaignCore()) lives there now, and that file must be
// self-contained since api/cron/send-scheduled-campaigns.php requires it
// directly without loading this file (see that file's own header comment).
