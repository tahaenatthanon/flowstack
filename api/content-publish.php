<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/lib/publish-dispatch.php';

$db       = getDB();
$method   = getMethod();
$auth     = requireAuth();
$userId   = $auth['user_id'];
$tenantId = $auth['tenant_id'];

// ── GET ──────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $action = $_GET['action'] ?? '';

    if ($action === 'overdue_count') {
        $stmt = $db->prepare(
            "SELECT COUNT(*) FROM content_publish_queue
             WHERE tenant_id = ? AND status = 'pending' AND scheduled_at < NOW()"
        );
        $stmt->execute([$tenantId]);
        jsonResponse(['count' => (int)$stmt->fetchColumn()]);
    }

    $contentId = $_GET['content_id'] ?? '';
    if (!$contentId) jsonError('content_id required', 400);

    $stmt = $db->prepare(
        "SELECT q.*, pc.name AS channel_name, pc.platform
         FROM content_publish_queue q
         JOIN publish_channels pc ON pc.id = q.channel_id
         WHERE q.content_id = ? AND q.tenant_id = ?
         ORDER BY q.scheduled_at ASC"
    );
    $stmt->execute([$contentId, $tenantId]);
    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

// ── POST ─────────────────────────────────────────────────────────────────────
if ($method === 'POST') {
    $body   = json_decode(file_get_contents('php://input'), true) ?? [];
    $action = $body['action'] ?? '';

    // ── schedule ──────────────────────────────────────────────────────────────
    if ($action === 'schedule') {
        $contentId        = $body['content_id']        ?? '';
        $channelIds       = array_values(array_unique($body['channel_ids'] ?? []));
        $scheduledAt      = $body['scheduled_at']      ?? '';
        $channelOverrides = $body['channel_overrides'] ?? [];

        if (!$contentId || empty($channelIds) || !$scheduledAt) {
            jsonError('content_id, channel_ids, scheduled_at required', 400);
        }
        if (strtotime($scheduledAt) <= time()) {
            jsonError('scheduled_at must be in the future', 422);
        }

        // Verify content exists and belongs to tenant (allow any status except archived)
        $cs = $db->prepare("SELECT id FROM content_items WHERE id=? AND tenant_id=? AND status!='archived'");
        $cs->execute([$contentId, $tenantId]);
        if (!$cs->fetch()) jsonError('Content not found', 422);

        // Verify all channels belong to tenant and are active
        $placeholders = implode(',', array_fill(0, count($channelIds), '?'));
        $chs = $db->prepare(
            "SELECT id FROM publish_channels WHERE id IN ($placeholders) AND tenant_id=? AND is_active=1"
        );
        $chs->execute([...$channelIds, $tenantId]);
        $validIds = array_column($chs->fetchAll(PDO::FETCH_ASSOC), 'id');
        if (count($validIds) !== count($channelIds)) jsonError('Invalid or inactive channel(s)', 422);

        $created = [];
        foreach ($channelIds as $channelId) {
            $id = generateUUID();
            $override = !empty($channelOverrides[$channelId]) ? $channelOverrides[$channelId] : null;
            $db->prepare(
                "INSERT INTO content_publish_queue (id,tenant_id,content_id,channel_id,scheduled_at,content_override)
                 VALUES (?,?,?,?,?,?)"
            )->execute([$id, $tenantId, $contentId, $channelId, $scheduledAt, $override]);
            $created[] = $id;
        }
        jsonResponse(['created' => $created]);
    }

    // ── send_now ──────────────────────────────────────────────────────────────
    if ($action === 'send_now') {
        $contentId        = $body['content_id']        ?? '';
        $channelIds       = array_values(array_unique($body['channel_ids'] ?? []));
        $channelOverrides = $body['channel_overrides'] ?? [];

        if (!$contentId || empty($channelIds)) {
            jsonError('content_id, channel_ids required', 400);
        }

        // Verify content exists and belongs to tenant (allow any status)
        $cs = $db->prepare("SELECT * FROM content_items WHERE id=? AND tenant_id=?");
        $cs->execute([$contentId, $tenantId]);
        $content = $cs->fetch(PDO::FETCH_ASSOC);
        if (!$content) jsonError('Content not found', 422);

        $placeholders = implode(',', array_fill(0, count($channelIds), '?'));
        $chs = $db->prepare(
            "SELECT * FROM publish_channels WHERE id IN ($placeholders) AND tenant_id=? AND is_active=1"
        );
        $chs->execute([...$channelIds, $tenantId]);
        $channels = $chs->fetchAll(PDO::FETCH_ASSOC);
        if (count($channels) !== count($channelIds)) jsonError('Invalid or inactive channel(s)', 422);

        $results = [];
        foreach ($channels as $channel) {
            $id = generateUUID();
            $now = date('Y-m-d H:i:s');

            $db->prepare(
                "INSERT INTO content_publish_queue (id,tenant_id,content_id,channel_id,scheduled_at,status)
                 VALUES (?,?,?,?,?,?)"
            )->execute([$id, $tenantId, $contentId, $channel['id'], $now, 'processing']);

            // Apply per-channel content override if provided
            $contentForChannel = $content;
            if (!empty($channelOverrides[$channel['id']])) {
                $overrideText = $channelOverrides[$channel['id']];
                $contentForChannel = array_merge($content, [
                    'caption'         => $overrideText,
                    'article_content' => json_encode(['html' => $overrideText, 'title' => $content['title'] ?? '', 'excerpt' => '']),
                ]);
            }

            $result = dispatch_content($channel['platform'], $channel, $contentForChannel);

            if ($result['success']) {
                $meta = extract_publish_meta($result, $channel['platform'], $channel);
                $db->prepare(
                    "UPDATE content_publish_queue SET status='sent', sent_at=NOW(), platform_post_id=?, published_url=? WHERE id=?"
                )->execute([$meta['platform_post_id'], $meta['published_url'], $id]);
                // บันทึกผลเผยแพร่กลับ content_items (content_id คือ content_items.id ที่โหลดมา)
                $db->prepare(
                    "UPDATE content_items SET status='published', published_at=NOW(), published_url=?, external_post_id=? WHERE id=? AND tenant_id=?"
                )->execute([$meta['published_url'], $meta['platform_post_id'], $contentId, $tenantId]);
                $results[] = ['channel_id' => $channel['id'], 'success' => true];
            } else {
                $db->prepare(
                    "UPDATE content_publish_queue SET status='failed', error_msg=? WHERE id=?"
                )->execute([$result['error'] ?? 'dispatch failed', $id]);
                $results[] = ['channel_id' => $channel['id'], 'success' => false, 'error' => $result['error'] ?? ''];
            }
        }
        jsonResponse(['results' => $results]);
    }

    // ── cancel ────────────────────────────────────────────────────────────────
    if ($action === 'cancel') {
        $queueId = $body['queue_id'] ?? '';
        if (!$queueId) jsonError('queue_id required', 400);
        $db->prepare(
            "UPDATE content_publish_queue SET status='failed', error_msg='cancelled by user'
             WHERE id=? AND tenant_id=? AND status='pending'"
        )->execute([$queueId, $tenantId]);
        jsonResponse(['ok' => true]);
    }

    jsonError('Unknown action', 400);
}

// ── DELETE ───────────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? '';
    if (!$id) jsonError('id required', 400);
    $db->prepare(
        "DELETE FROM content_publish_queue WHERE id=? AND tenant_id=?"
    )->execute([$id, $tenantId]);
    jsonResponse(['ok' => true]);
}

jsonError('Method not allowed', 405);
