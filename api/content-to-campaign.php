<?php
// api/content-to-campaign.php
// Bridge: Content Items → Email Campaigns
//
// POST ?action=to-campaign — Create/update campaign from content item
// GET  ?action=from-campaign&campaign_id=X — Get source content for a campaign

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

$db     = getDB();
$method = getMethod();
$auth   = requireAuth();
$userId = $auth['user_id'];
$tenantId = $auth['tenant_id'];
$action = $_GET['action'] ?? '';
if ($action === 'from-campaign' && $method === 'GET') {
    $campaignId = $_GET['campaign_id'] ?? '';
    if (!$campaignId) jsonError('campaign_id required', 400);

    $stmt = $db->prepare("
        SELECT ec.source_content_id, ci.title, ci.article_content
        FROM email_campaigns ec
        LEFT JOIN content_items ci ON ci.id = ec.source_content_id
        WHERE ec.id = ? AND ec.tenant_id = ?
    ");
    $stmt->execute([$campaignId, $tenantId]);
    $row = $stmt->fetch();

    if (!$row || !$row['source_content_id']) {
        jsonResponse(['source_content_id' => null, 'item' => null]);
    } else {
        $art = null;
        if ($row['article_content']) {
            $dec = json_decode($row['article_content'], true);
            if ($dec) $art = $dec;
        }
        jsonResponse([
            'source_content_id' => $row['source_content_id'],
            'item' => ['title' => $row['title'], 'article_content' => $art],
        ]);
    }
}

if ($action === 'to-campaign' && $method === 'POST') {
    $body = getRequestBody();
    $contentItemId = $body['content_item_id'] ?? '';
    $campaignId    = $body['campaign_id'] ?? null;
    $campaignName  = $body['campaign_name'] ?? '';

    if (empty($contentItemId)) jsonError('content_item_id required', 400);

    // Load content item directly (all fields now on content_items)
    $stmt = $db->prepare("SELECT * FROM content_items WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$contentItemId, $tenantId]);
    $item = $stmt->fetch();
    if (!$item) jsonError('Content item not found', 404);

    $art = null;
    $articleContent = $item['article_content'] ?? '';
    if ($articleContent) {
        $dec = json_decode($articleContent, true);
        if ($dec) $art = $dec;
    }

    $subject = is_array($art) ? ($art['title'] ?? $item['title']) : $item['title'];
    $bodyHtml = is_array($art) ? ($art['html'] ?? $articleContent) : ($articleContent ?: '');
    $bodyText = strip_tags($bodyHtml);
    $footerTags = (is_array($art) && isset($art['hashtags'])) ? implode(' ', $art['hashtags']) : '';
    if ($footerTags) {
        $bodyHtml .= "\n\n<p style=\"color:#888;font-size:13px\">{$footerTags}</p>";
        $bodyText .= "\n\n{$footerTags}";
    }

    // Get default sender from settings
    $senderName = 'Flowstack';
    $senderEmail = 'noreply@flowstack.com';
    try {
        $sStmt = $db->prepare("SELECT sender_name, sender_email FROM email_campaigns WHERE tenant_id = ? AND sender_email != '' ORDER BY created_at DESC LIMIT 1");
        $sStmt->execute([$tenantId]);
        $sRow = $sStmt->fetch();
        if ($sRow && !empty($sRow['sender_email'])) {
            $senderName = $sRow['sender_name'] ?: $senderName;
            $senderEmail = $sRow['sender_email'];
        }
    } catch (Exception $e) {}

    if ($campaignId) {
        // Update existing campaign
        $check = $db->prepare("SELECT id FROM email_campaigns WHERE id = ? AND tenant_id = ? AND status = 'draft'");
        $check->execute([$campaignId, $tenantId]);
        if (!$check->fetch()) jsonError('Campaign not found or not in draft status', 400);

        $db->prepare("
            UPDATE email_campaigns
            SET subject = ?, body_html = ?, body_text = ?, source_content_id = ?, updated_at = NOW()
            WHERE id = ?
        ")->execute([$subject, $bodyHtml, $bodyText, $contentItemId, $campaignId]);

        jsonResponse(['campaign_id' => $campaignId, 'updated' => true]);
    } else {
        // Create new campaign
        $name = !empty($campaignName) ? $campaignName : $subject;
        $id = generateUUID();

        $db->prepare("
            INSERT INTO email_campaigns (id, tenant_id, name, subject, body_html, body_text, sender_name, sender_email, status, source_content_id, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, NOW())
        ")->execute([$id, $tenantId, $name, $subject, $bodyHtml, $bodyText, $senderName, $senderEmail, $contentItemId, $userId]);

        jsonResponse(['campaign_id' => $id, 'created' => true], 201);
    }
}

jsonError('Invalid action', 400);
