<?php
// api/lib/email-campaign-sender.php
//
// Core recipient-resolution and send logic for email campaigns, shared by:
//   - api/email-campaigns.php        → HTTP endpoints (?action=send, recipient_count, create/update)
//   - api/cron/send-scheduled-campaigns.php → cron job that sends campaigns when scheduled_at is due
//
// Pulled out of api/email-campaigns.php (rather than left inline) because that file has
// top-level side effects on every request (requireAuth(), action dispatch based on
// $_SERVER/$_GET) — requiring it directly from a cron context would run those side effects
// too. This file has none: it only declares functions, so it's safe to require from
// anywhere including cron/CLI. ไฟล์นี้รันเดี่ยวไม่ได้ (ไม่มี route ให้เรียกตรง) แต่ require ได้จากทุกที่โดยไม่มีผลข้างเคียง

if (!defined('CRON_MODE')) {
    require_once __DIR__ . '/../config.php';
}
require_once __DIR__ . '/../email-utils.php';
require_once __DIR__ . '/../../vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailException;

/**
 * Resolve the deduplicated recipient list for a campaign: static groups
 * (`$groupIds`) plus, optionally, anyone matching dynamic segment filters
 * (`$segmentFilters`) — computed fresh on every call, never snapshotted.
 *
 * Shared by createEmailCampaign(), updateEmailCampaign(), sendCampaignCore(), and
 * the recipient_count preview action — a single source of truth so the
 * "how many people will this reach" number can never disagree between the
 * call sites again (that mismatch was the original bug this function fixed).
 *
 * Dedup key is the EMAIL, not customer_id: `customers` has a UNIQUE KEY of
 * (company_id, email), not email alone, so the same person's email can
 * legitimately appear as multiple customer rows when they're a contact for
 * more than one company. DISTINCT on customer_id (the old approach) does not
 * catch that — this function does, so the same inbox is never emailed twice.
 *
 * When one email maps to multiple customer rows, the "winning" row (used for
 * personalisation) is chosen by: is_primary_contact=1 first, otherwise the
 * most recently updated row. Done in PHP rather than a SQL window function to
 * avoid depending on a MariaDB version (see the percentile() comment in
 * content-analytics.php for the same reasoning elsewhere in this codebase).
 *
 * $segmentFilters (optional), keys are all optional and combined with AND:
 *   - 'business_type' => string   (matches companies.business_type exactly)
 *   - 'engagement'    => 'has_opened_or_clicked_any'
 *                        (customer has at least one email_tracking row with
 *                         opened_at or clicked_at set, from any campaign)
 * The segment query is scoped to $tenantId directly (unlike the group-based
 * query, which is scoped indirectly via the caller only ever passing group
 * ids that already belong to the tenant) since segment filters have no group
 * to inherit tenant scoping from.
 *
 * @return array Deduplicated customer rows (email normalised via
 *               strtolower(trim())), one per unique email, with company_name joined in.
 */
function resolveCampaignRecipients(PDO $db, array $groupIds, string $tenantId, ?array $segmentFilters = null): array {
    $groupIds = array_values(array_filter($groupIds, static fn($g) => $g !== null && $g !== ''));
    $rows = [];

    if (!empty($groupIds)) {
        $placeholders = implode(',', array_fill(0, count($groupIds), '?'));
        $stmt = $db->prepare("
            SELECT DISTINCT c.*, co.name AS company_name
            FROM customers c
            JOIN email_group_members egm ON c.id = egm.customer_id
            LEFT JOIN companies co ON c.company_id = co.id
            WHERE egm.group_id IN ($placeholders)
              AND c.is_active = 1
              AND c.email != ''
        ");
        $stmt->execute($groupIds);
        $rows = array_merge($rows, $stmt->fetchAll());
    }

    if (!empty($segmentFilters)) {
        $conditions = [];
        $params = [$tenantId];

        if (!empty($segmentFilters['business_type'])) {
            $conditions[] = 'co.business_type = ?';
            $params[] = $segmentFilters['business_type'];
        }
        if (($segmentFilters['engagement'] ?? '') === 'has_opened_or_clicked_any') {
            $conditions[] = 'EXISTS (
                SELECT 1 FROM email_tracking et
                WHERE et.customer_id = c.id AND (et.opened_at IS NOT NULL OR et.clicked_at IS NOT NULL)
            )';
        }

        // No recognised filter key set — treat as "no segment condition" rather
        // than matching every customer in the tenant by accident.
        if (!empty($conditions)) {
            $sql = "
                SELECT DISTINCT c.*, co.name AS company_name
                FROM customers c
                LEFT JOIN companies co ON c.company_id = co.id
                WHERE c.tenant_id = ?
                  AND c.is_active = 1
                  AND c.email != ''
                  AND " . implode(' AND ', $conditions) . "
            ";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $rows = array_merge($rows, $stmt->fetchAll());
        }
    }

    if (empty($rows)) return [];

    $byEmail = [];
    foreach ($rows as $row) {
        $key = strtolower(trim($row['email']));
        if ($key === '') continue;

        if (!isset($byEmail[$key])) {
            $byEmail[$key] = $row;
            continue;
        }

        $current        = $byEmail[$key];
        $rowIsPrimary   = (int)($row['is_primary_contact'] ?? 0) === 1;
        $curIsPrimary   = (int)($current['is_primary_contact'] ?? 0) === 1;

        if ($rowIsPrimary && !$curIsPrimary) {
            $byEmail[$key] = $row; // row wins: it's the primary contact, current isn't
        } elseif ($rowIsPrimary === $curIsPrimary
            && strtotime($row['updated_at']) > strtotime($current['updated_at'])) {
            $byEmail[$key] = $row; // tie on primary-ness: most recently updated wins
        }
        // else: current stays (it's primary and row isn't, or current is newer)
    }

    return array_values($byEmail);
}

/**
 * Log customer activity — moved here from api/email-campaigns.php because
 * sendCampaignCore() (below) is its only caller, and this file must be
 * self-contained: api/cron/send-scheduled-campaigns.php requires it directly
 * without loading email-campaigns.php.
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

/**
 * Send campaign immediately via PHPMailer (SMTP) — core logic, reusable by
 * both the HTTP action=send endpoint and the send-scheduled-campaigns cron
 * job. Returns a result array instead of writing an HTTP response directly
 * (jsonSuccess()/jsonError() both call exit(), which would abort a cron loop
 * after the first campaign processed).
 */
function sendCampaignCore(PDO $db, string $id, string $userId, string $tenantId): array {
    if (empty($id)) {
        return ['ok' => false, 'error' => 'Campaign ID required', 'code' => 400];
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
        return ['ok' => false, 'error' => 'SMTP ยังไม่ได้ตั้งค่า กรุณาไปที่ Admin → ตั้งค่า SMTP', 'code' => 500];
    }
    if ($cfg['smtp_auth'] && (empty($cfg['username']) || empty($cfg['password']))) {
        return ['ok' => false, 'error' => 'กรุณากรอก Username และ Password หรือปิด Authentication สำหรับ internal relay', 'code' => 500];
    }

    // Load campaign (verify tenant ownership)
    $stmt = $db->prepare("SELECT * FROM email_campaigns WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$id, $tenantId]);
    $campaign = $stmt->fetch();

    if (!$campaign) {
        return ['ok' => false, 'error' => 'Campaign not found', 'code' => 404];
    }
    if (!in_array($campaign['status'], ['draft', 'scheduled'])) {
        return ['ok' => false, 'error' => 'Campaign cannot be sent', 'code' => 400];
    }

    // Load recipients — deduplicated by email across every group this
    // campaign is linked to (resolveCampaignRecipients() also collapses
    // the same person appearing under multiple companies), plus anyone
    // matching the campaign's dynamic segment filters, if any.
    $groupsStmt = $db->prepare("SELECT group_id FROM email_campaign_recipients WHERE campaign_id = ?");
    $groupsStmt->execute([$id]);
    $campaignGroupIds = array_column($groupsStmt->fetchAll(), 'group_id');
    $segmentFilters = !empty($campaign['segment_filters']) ? json_decode($campaign['segment_filters'], true) : null;
    $recipients = resolveCampaignRecipients($db, $campaignGroupIds, $tenantId, $segmentFilters);

    if (empty($recipients)) {
        return ['ok' => false, 'error' => 'ไม่พบผู้รับอีเมลในกลุ่มที่เลือก', 'code' => 400];
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
        $htmlBody   = processMergeTags($rawHtml, $recipient, $company, $companySettings, $subject);
        if (empty($campaign['template_id'])) {
            $htmlBody = wrapEmailHtml($htmlBody, $subject, $companySettings);
        }
        $htmlBody   = processEmailHtml(
            $htmlBody, $trackingId, $baseUrl,
            (bool)($campaign['enable_track_opens']  ?? 1),
            (bool)($campaign['enable_track_clicks'] ?? 1)
        );
        $textBody   = processMergeTags($campaign['body_text'] ?? '', $recipient, $company, $companySettings, $subject);

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
            $db->prepare("UPDATE email_tracking SET status = 'failed', bounce_reason = ? WHERE id = ?")
               ->execute([$err, $trackingId]);
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

    return ['ok' => true, 'data' => [
        'message'    => "ส่งสำเร็จ {$sent} ฉบับ" . ($failed > 0 ? ", ล้มเหลว {$failed} ฉบับ" : ''),
        'recipients' => $sent,
        'failed'     => $failed,
        'errors'     => $errors,
    ]];
}
