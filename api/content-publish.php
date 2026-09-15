<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/lib/publish-dispatch.php';
require_once __DIR__ . '/lib/seo-checklist.php';

$db       = getDB();
$method   = getMethod();
$auth     = requireAuth();
$userId   = $auth['user_id'];
$tenantId = $auth['tenant_id'];

function publish_load_research_brief(PDO $db, string $tenantId, string $contentId): ?array {
    $stmt = $db->prepare("SELECT analysis FROM content_research_jobs WHERE content_item_id=? AND tenant_id=? AND status='done' ORDER BY created_at DESC LIMIT 1");
    $stmt->execute([$contentId, $tenantId]);
    $analysis = $stmt->fetchColumn();
    if (!$analysis) return null;
    $brief = json_decode((string)$analysis, true);
    return is_array($brief) ? $brief : null;
}

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

    if ($action === 'platform_status') {
        $cs = $db->prepare('SELECT id, status, approved_at, platform, platforms FROM content_items WHERE id=? AND tenant_id=?');
        $cs->execute([$contentId, $tenantId]);
        $content = $cs->fetch(PDO::FETCH_ASSOC);
        if (!$content) jsonError('Content not found', 404);
        $selected = publish_content_platforms($content);
        $published = get_published_content_platforms($db, $tenantId, $contentId);
        $pendingStmt = $db->prepare(
            "SELECT DISTINCT LOWER(pc.platform) AS platform
             FROM content_publish_queue q
             JOIN publish_channels pc ON pc.id=q.channel_id
             WHERE q.tenant_id=? AND q.content_id=? AND q.status IN ('pending','processing')
             UNION
             SELECT DISTINCT LOWER(pc.platform) AS platform
             FROM content_schedules cs
             JOIN content_plan_items cpi ON cpi.id=cs.plan_item_id
             JOIN content_items ci ON ci.plan_item_id=cpi.id
             JOIN publish_channels pc ON pc.id=cs.channel_id
             WHERE ci.tenant_id=? AND ci.id=? AND cs.status IN ('pending','publishing')"
        );
        $pendingStmt->execute([$tenantId, $contentId, $tenantId, $contentId]);
        $pending = array_values(array_filter(array_map(
            static fn($row): string => strtolower(trim((string)$row['platform'])),
            $pendingStmt->fetchAll(PDO::FETCH_ASSOC)
        )));
        $result = [];
        foreach ($selected as $platform) {
            $result[$platform] = [
                'published' => in_array($platform, $published, true),
                'pending' => in_array($platform, $pending, true),
            ];
        }
        jsonResponse(['content_id' => $contentId, 'status' => $content['status'], 'platforms' => $result]);
    }

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

        // Verify content exists, belongs to tenant, and has current approval.
        // Scheduling is a publish action too: it must never create a queue row for
        // content that has not been approved.
        $cs = $db->prepare("SELECT * FROM content_items WHERE id=? AND tenant_id=? AND status!='archived'");
        $cs->execute([$contentId, $tenantId]);
        $content = $cs->fetch(PDO::FETCH_ASSOC);
        if (!$content) jsonError('Content not found', 422);
        if ($content['status'] !== 'approved' || empty($content['approved_at'])) {
            jsonError('ตั้งเวลาไม่ได้ — คอนเทนต์นี้ยังไม่ผ่านการอนุมัติ กรุณาอนุมัติก่อนตั้งเวลา', 422);
        }

        // Verify all channels belong to tenant and are active
        $placeholders = implode(',', array_fill(0, count($channelIds), '?'));
        $chs = $db->prepare(
            "SELECT id, platform FROM publish_channels WHERE id IN ($placeholders) AND tenant_id=? AND is_active=1"
        );
        $chs->execute([...$channelIds, $tenantId]);
        $channelRows = $chs->fetchAll(PDO::FETCH_ASSOC);
        $validIds = array_column($channelRows, 'id');
        if (count($validIds) !== count($channelIds)) jsonError('Invalid or inactive channel(s)', 422);

        // Preflight every requested platform independently. A failing platform is
        // blocked without preventing passing platforms from being scheduled.
        $channelPlatformMap = [];
        $scriptGateByChannel = [];
        foreach ($channelRows as $row) {
            $channelPlatformMap[$row['id']] = strtolower(trim((string)$row['platform']));
            $scriptGateByChannel[$row['id']] = final_publish_gate_check($db, $tenantId, $content, $channelPlatformMap[$row['id']]);
        }

        $created = [];
        $blocked = [];
        foreach ($channelIds as $channelId) {
            if (!empty($scriptGateByChannel[$channelId]['blocked'])) {
                $blocked[] = [
                    'channel_id' => $channelId,
                    'platform' => $channelPlatformMap[$channelId] ?? '',
                    'reason' => $scriptGateByChannel[$channelId]['reason'],
                ];
                continue;
            }
            $channelPlatformStmt = $db->prepare('SELECT platform FROM publish_channels WHERE id=? AND tenant_id=? AND is_active=1');
            $channelPlatformStmt->execute([$channelId, $tenantId]);
            $channelPlatform = strtolower(trim((string)$channelPlatformStmt->fetchColumn()));
            if ($channelPlatform === '') continue;

            $sentStmt = $db->prepare(
                "SELECT COUNT(*) FROM content_publish_queue q
                 JOIN publish_channels pc ON pc.id=q.channel_id
                 WHERE q.tenant_id=? AND q.content_id=? AND LOWER(pc.platform)=? AND q.status='sent'"
            );
            $sentStmt->execute([$tenantId, $contentId, $channelPlatform]);
            if ((int)$sentStmt->fetchColumn() > 0) {
                jsonError("ตั้งเวลาไม่ได้ — แพลตฟอร์ม {$channelPlatform} ของคอนเทนต์นี้เผยแพร่แล้ว", 422);
            }

            $pendingStmt = $db->prepare(
                "SELECT COUNT(*) FROM content_publish_queue q
                 JOIN publish_channels pc ON pc.id=q.channel_id
                 WHERE q.tenant_id=? AND q.content_id=? AND LOWER(pc.platform)=? AND q.status IN ('pending','processing')"
            );
            $pendingStmt->execute([$tenantId, $contentId, $channelPlatform]);
            if ((int)$pendingStmt->fetchColumn() > 0) {
                jsonError("ตั้งเวลาไม่ได้ — แพลตฟอร์ม {$channelPlatform} มีรายการเผยแพร่ที่รอดำเนินการอยู่แล้ว", 422);
            }

            $id = generateUUID();
            $override = !empty($channelOverrides[$channelId]) ? $channelOverrides[$channelId] : null;
            $db->prepare(
                "INSERT INTO content_publish_queue (id,tenant_id,content_id,channel_id,scheduled_at,content_override)
                 VALUES (?,?,?,?,?,?)"
            )->execute([$id, $tenantId, $contentId, $channelId, $scheduledAt, $override]);
            $created[] = $id;
        }
        jsonResponse(['created' => $created, 'blocked' => $blocked]);
    }

    // ── send_now ──────────────────────────────────────────────────────────────
    // All immediate publishing goes through the central executor in
    // publish-dispatch.php. This keeps Approval, Quality, Platform, idempotency,
    // dispatch and history rules identical to the other publish entry points.
    if ($action === 'send_now') {
        $contentId = trim((string)($body['content_id'] ?? ''));
        $channelIds = array_values(array_unique(array_filter(array_map('strval', $body['channel_ids'] ?? []))));
        $channelOverrides = is_array($body['channel_overrides'] ?? null) ? $body['channel_overrides'] : [];
        if ($contentId === '' || empty($channelIds)) {
            jsonError('content_id, channel_ids required', 400);
        }

        $contentStmt = $db->prepare('SELECT * FROM content_items WHERE id=? AND tenant_id=?');
        $contentStmt->execute([$contentId, $tenantId]);
        $content = $contentStmt->fetch(PDO::FETCH_ASSOC);
        if (!$content) jsonError('Content not found', 422);

        $placeholders = implode(',', array_fill(0, count($channelIds), '?'));
        $channelStmt = $db->prepare("SELECT * FROM publish_channels WHERE id IN ($placeholders) AND tenant_id=? AND is_active=1");
        $channelStmt->execute([...$channelIds, $tenantId]);
        $channelsById = [];
        foreach ($channelStmt->fetchAll(PDO::FETCH_ASSOC) as $channel) $channelsById[(string)$channel['id']] = $channel;
        if (count($channelsById) !== count($channelIds)) jsonError('Invalid or inactive channel(s)', 422);

        $results = [];
        foreach ($channelIds as $channelId) {
            $result = publish_via_central_flow(
                $db,
                $tenantId,
                $content,
                $channelsById[$channelId],
                (string)$userId,
                null,
                isset($channelOverrides[$channelId]) ? (string)$channelOverrides[$channelId] : null
            );
            $results[] = [
                'channel_id' => $channelId,
                'platform' => strtolower((string)$channelsById[$channelId]['platform']),
                'success' => (bool)($result['success'] ?? false),
                'status' => $result['status'] ?? 'failed',
                'reason' => $result['error'] ?? null,
            ];
        }
        jsonResponse(['results' => $results]);
    }

    // Legacy send_now implementation is disabled and cannot bypass the central flow.
    if ($action === 'send_now-legacy') {
        jsonError('Legacy send_now flow disabled — use the central publish flow', 410);
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
