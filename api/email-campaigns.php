<?php
// GET /api/email-campaigns.php - List all campaigns
// POST /api/email-campaigns.php - Create new campaign
// GET /api/email-campaigns.php?id=xxx - Get single campaign
// PUT /api/email-campaigns.php?id=xxx - Update campaign
// DELETE /api/email-campaigns.php?id=xxx - Delete campaign
// POST /api/email-campaigns.php?action=send - Send campaign immediately
// POST /api/email-campaigns.php?action=schedule - Schedule campaign
// GET /api/email-campaigns.php?action=stats - Get campaign stats

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/email-utils.php';
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
} elseif ($method === 'GET' && $action === 'stats') {
    getCampaignStats($db, $tenantId);
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
 * Create new email campaign
 */
function createEmailCampaign($db, $userId, string $tenantId = '') {
    $body = getRequestBody();
    
    $name = trim($body['name'] ?? '');
    $subject = trim($body['subject'] ?? '');
    $bodyHtml = $body['body_html'] ?? '';
    $bodyText = $body['body_text'] ?? '';
    $senderName = trim($body['sender_name'] ?? '');
    $senderEmail = trim($body['sender_email'] ?? '');
    $groupIds = $body['group_ids'] ?? [];
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
            id, tenant_id, name, subject, body_html, body_text,
            sender_name, sender_email, enable_track_opens, enable_track_clicks,
            status, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, NOW())
    ");
    $stmt->execute([
        $id, $tenantId, $name, $subject, $bodyHtml, $bodyText,
        $senderName, $senderEmail, $enableTrackOpens, $enableTrackClicks, $userId
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
        
        // Count total recipients
        $stmt = $db->prepare("
            SELECT COUNT(*) as count FROM email_group_members 
            WHERE group_id IN (" . implode(',', array_fill(0, count($groupIds), '?')) . ")
        ");
        $stmt->execute($groupIds);
        $result = $stmt->fetch();
        $totalRecipients = $result['count'] ?? 0;
        
        // Update total recipients
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
    
    if (!empty($updates)) {
        $params[] = $id;
        $params[] = $tenantId;
        $sql = "UPDATE email_campaigns SET " . implode(', ', $updates) . " WHERE id = ? AND tenant_id = ?";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
    }
    
    // Update recipient groups if provided
    if ($groupIds !== null && is_array($groupIds)) {
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
            
            // Count total recipients
            $stmt = $db->prepare("
                SELECT COUNT(*) as count FROM email_group_members 
                WHERE group_id IN (" . implode(',', array_fill(0, count($groupIds), '?')) . ")
            ");
            $stmt->execute($groupIds);
            $result = $stmt->fetch();
            $totalRecipients = $result['count'] ?? 0;
            
            $stmt = $db->prepare("UPDATE email_campaigns SET total_recipients = ? WHERE id = ?");
            $stmt->execute([$totalRecipients, $id]);
        }
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

/**
 * Send campaign immediately via PHPMailer (SMTP)
 */
function sendCampaign($db, $userId, string $tenantId) {
    $body = getRequestBody();
    $id = $body['id'] ?? $_GET['id'] ?? '';

    if (empty($id)) {
        jsonError('Campaign ID required', 400);
    }

    // Load SMTP config from DB settings (falls back to .env constants)
    $smtpStmt = $db->query("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'mail_%'");
    $smtpRows = $smtpStmt->fetchAll(PDO::FETCH_KEY_PAIR);
    $cfg = [
        'host'         => $smtpRows['mail_host']         ?? MAIL_HOST,
        'port'         => (int)($smtpRows['mail_port']   ?? MAIL_PORT),
        'encryption'   => $smtpRows['mail_encryption']   ?? MAIL_ENCRYPTION,
        'smtp_auth'    => ($smtpRows['mail_smtp_auth']   ?? '1') !== '0',
        'username'     => $smtpRows['mail_username']     ?? MAIL_USERNAME,
        'password'     => $smtpRows['mail_password']     ?? MAIL_PASSWORD,
        'from_address' => $smtpRows['mail_from_address'] ?? MAIL_FROM_ADDRESS,
        'from_name'    => $smtpRows['mail_from_name']    ?? MAIL_FROM_NAME,
    ];

    if (empty($cfg['host'])) {
        jsonError('SMTP ยังไม่ได้ตั้งค่า กรุณาไปที่ Admin → ตั้งค่า SMTP', 500);
    }
    if ($cfg['smtp_auth'] && (empty($cfg['username']) || empty($cfg['password']))) {
        jsonError('กรุณากรอก Username และ Password หรือปิด Authentication สำหรับ internal relay', 500);
    }

    // Load campaign (verify tenant ownership)
    $stmt = $db->prepare("SELECT * FROM email_campaigns WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$id, $tenantId]);
    $campaign = $stmt->fetch();

    if (!$campaign) {
        jsonError('Campaign not found', 404);
    }
    if (!in_array($campaign['status'], ['draft', 'scheduled'])) {
        jsonError('Campaign cannot be sent', 400);
    }

    // Load recipients (distinct active customers with email)
    $stmt = $db->prepare("
        SELECT DISTINCT c.*, co.name AS company_name
        FROM customers c
        JOIN email_group_members egm ON c.id = egm.customer_id
        JOIN email_campaign_recipients ecr ON egm.group_id = ecr.group_id
        LEFT JOIN companies co ON c.company_id = co.id
        WHERE ecr.campaign_id = ?
          AND c.is_active = 1
          AND c.email != ''
    ");
    $stmt->execute([$id]);
    $recipients = $stmt->fetchAll();

    if (empty($recipients)) {
        jsonError('ไม่พบผู้รับอีเมลในกลุ่มที่เลือก', 400);
    }

    // Allow up to 5 minutes for large campaigns
    set_time_limit(300);

    // Mark campaign as sending
    $db->prepare("UPDATE email_campaigns SET status = 'sending' WHERE id = ?")->execute([$id]);

    // Use base URL from settings (should include /flowstack path if needed)
    $baseUrl = getBaseUrl();
    $sent = 0;
    $failed = 0;
    $errors = [];

    // Reusable SMTP connection
    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host     = $cfg['host'];
    $mail->Username = $cfg['username'];
    $mail->Password = $cfg['password'];
    $mail->Port     = (int) $cfg['port'];
    $mail->CharSet  = 'UTF-8';
    $mail->SMTPKeepAlive = true;

    // Encryption
    if ($cfg['encryption'] === 'ssl') {
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    } elseif ($cfg['encryption'] === 'tls') {
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    } else {
        $mail->SMTPSecure  = '';
        $mail->SMTPAutoTLS = false;
    }

    // Authentication
    $mail->SMTPAuth = $cfg['smtp_auth'];
    if ($cfg['smtp_auth']) {
        $mail->Username = $cfg['username'];
        $mail->Password = $cfg['password'];
    }

    // Only disable SSL verification when explicitly configured (e.g., self-signed local SMTP)
    $allowSelfSigned = ($smtpRows['mail_allow_self_signed'] ?? '0') === '1';
    if ($allowSelfSigned) {
        $mail->SMTPOptions = [
            'ssl' => [
                'verify_peer'       => false,
                'verify_peer_name'  => false,
                'allow_self_signed' => true,
            ],
        ];
    }

    // Load company settings for merge tags
    $companySettings = getCompanySettings($db);
    
    foreach ($recipients as $recipient) {
        $trackingId = generateUUID();
        $messageId  = generateUUID() . '@flowstack.local';

        // Insert tracking record (queued)
        $db->prepare("
            INSERT INTO email_tracking (id, campaign_id, customer_id, message_id, to_email, status, sent_at)
            VALUES (?, ?, ?, ?, ?, 'queued', NOW())
        ")->execute([$trackingId, $id, $recipient['id'], $messageId, $recipient['email']]);

        // Build personalised content
        $company    = ['name' => $recipient['company_name'] ?? ''];
        $subject    = processMergeTags($campaign['subject'],   $recipient, $company, $companySettings);
        $rawHtml    = $campaign['body_html'] ?? '';
        if (empty(trim($rawHtml))) {
            $rawHtml = '<p>' . htmlspecialchars($subject) . '</p>';
        }
        $htmlBody   = processMergeTags($rawHtml, $recipient, $company, $companySettings);
        $htmlBody   = wrapEmailHtml($htmlBody, $subject, $companySettings);
        $htmlBody   = processEmailHtml(
            $htmlBody, $trackingId, $baseUrl,
            (bool)($campaign['enable_track_opens']  ?? 1),
            (bool)($campaign['enable_track_clicks'] ?? 1)
        );
        $textBody   = processMergeTags($campaign['body_text'] ?? '', $recipient, $company, $companySettings);

        try {
            $mail->clearAddresses();
            $mail->clearReplyTos();
            $mail->clearCustomHeaders();

            $fromName    = $campaign['sender_name']  ?: $cfg['from_name']    ?: 'Flowstack';
            $fromAddress = $campaign['sender_email'] ?: $cfg['from_address'] ?: $cfg['username'];
            $mail->setFrom($fromAddress, $fromName);
            $mail->addAddress($recipient['email'], trim($recipient['first_name'] . ' ' . $recipient['last_name']));
            $mail->Subject   = $subject;
            $mail->isHTML(true);
            $mail->Body      = $htmlBody;
            $mail->AltBody   = $textBody ?: strip_tags($htmlBody);
            $mail->MessageID = '<' . $messageId . '>';

            $mail->send();

            // Mark as sent
            $db->prepare("UPDATE email_tracking SET status = 'sent', sent_at = NOW() WHERE id = ?")->execute([$trackingId]);
            logCustomerActivity($db, $recipient['id'], 'email_sent', $trackingId, [
                'campaign_id' => $id, 'campaign_name' => $campaign['name']
            ]);
            $sent++;
        } catch (MailException $e) {
            $err = $mail->ErrorInfo;
            $db->prepare("UPDATE email_tracking SET status = 'failed' WHERE id = ?")->execute([$trackingId]);
            $errors[] = $recipient['email'] . ': ' . $err;
            $failed++;
        }
    }

    $mail->smtpClose();

    // Finalise campaign status
    $finalStatus = ($sent > 0) ? 'sent' : 'draft';
    $db->prepare("
        UPDATE email_campaigns SET status = ?, sent_at = NOW(), total_sent = ? WHERE id = ?
    ")->execute([$finalStatus, $sent, $id]);

    jsonSuccess([
        'message'    => "ส่งสำเร็จ {$sent} ฉบับ" . ($failed > 0 ? ", ล้มเหลว {$failed} ฉบับ" : ''),
        'recipients' => $sent,
        'failed'     => $failed,
        'errors'     => $errors,
    ]);
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

/**
 * Log customer activity
 */
function logCustomerActivity($db, $customerId, $activityType, $referenceId, $details = []) {
    $id = generateUUID();
    $detailsJson = json_encode($details);
    
    $stmt = $db->prepare("
        INSERT INTO customer_activities (id, customer_id, activity_type, reference_id, details, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
    ");
    $stmt->execute([$id, $customerId, $activityType, $referenceId, $detailsJson]);
}
