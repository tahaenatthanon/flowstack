<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/lib/publish-dispatch.php';
require_once __DIR__ . '/lib/seo-checklist.php';
require_once __DIR__ . '/lib/script-quality-checklist.php';

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

function publish_script_gate(PDO $db, string $tenantId, array $content, string $platform): array {
    $platform = strtolower(trim($platform));
    $selected = publish_content_platforms($content);
    if (!in_array($platform, $selected, true)) {
        return ['blocked' => true, 'reason' => "แพลตฟอร์ม {$platform} ไม่ได้ถูกเลือกไว้ใน Content Item"];
    }
    if (!in_array($platform, SCRIPT_PLATFORMS, true)) {
        return ['blocked' => false, 'reason' => null];
    }

    $brief = publish_load_research_brief($db, $tenantId, (string)$content['id']);
    $quality = script_quality_check_platform($content, $platform, $brief);
    if (!empty($quality['passed'])) return ['blocked' => false, 'reason' => null, 'quality' => $quality];

    $reasons = [];
    foreach (['seo' => 'Script SEO', 'aeo' => 'Script AEO'] as $key => $label) {
        $failed = array_filter($quality[$key]['rules'] ?? [], static fn(array $r): bool => ($r['status'] ?? '') === 'failed');
        if ($failed) {
            $reasons[] = $label . ': ' . implode('; ', array_map(static fn(array $r): string => $r['message'] ?? '', $failed));
        }
    }
    if (!$reasons) {
        $reasons[] = "Script {$platform} SEO/AEO score ยังไม่ถึง 80 (SEO {$quality['seo']['score']}/100, AEO {$quality['aeo']['score']}/100)";
    }
    return ['blocked' => true, 'reason' => implode("\n", $reasons), 'quality' => $quality];
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
    if ($action === 'send_now') {
        $contentId        = $body['content_id']        ?? '';
        $channelIds       = array_values(array_unique($body['channel_ids'] ?? []));
        $channelOverrides = $body['channel_overrides'] ?? [];

        if (!$contentId || empty($channelIds)) {
            jsonError('content_id, channel_ids required', 400);
        }

        // Verify content exists and belongs to tenant
        $cs = $db->prepare("SELECT * FROM content_items WHERE id=? AND tenant_id=?");
        $cs->execute([$contentId, $tenantId]);
        $content = $cs->fetch(PDO::FETCH_ASSOC);
        if (!$content) jsonError('Content not found', 422);

        // เกตอนุมัติ — ต้องอยู่ก่อนเกต SEO: ไม่ต้อง query เพิ่ม (approved_at มาพร้อม SELECT * ด้านบน)
        // และเป็นเงื่อนไขเด็ดขาดกว่า จึงควรตอบเรื่องอนุมัติก่อนเรื่อง SEO
        // ใช้ approved_at ไม่ใช่ status เพราะเป็นหลักฐานเวลาที่อนุมัติจริง
        // บล็อกก่อนสร้างแถวคิวและก่อน dispatch → ไม่มี request ออกไปยังปลายทางเลย
        if (($content['status'] ?? '') !== 'approved' || empty($content['approved_at'])) {
            jsonError('เผยแพร่ไม่ได้ — คอนเทนต์นี้ยังไม่ผ่านการอนุมัติ กรุณาอนุมัติก่อนส่ง', 422);
        }

        $placeholders = implode(',', array_fill(0, count($channelIds), '?'));
        $chs = $db->prepare(
            "SELECT * FROM publish_channels WHERE id IN ($placeholders) AND tenant_id=? AND is_active=1"
        );
        $chs->execute([...$channelIds, $tenantId]);
        $channels = $chs->fetchAll(PDO::FETCH_ASSOC);
        if (count($channels) !== count($channelIds)) jsonError('Invalid or inactive channel(s)', 422);

        // Preflight each requested platform before any external dispatch.
        // A failed platform is blocked independently; other platforms can still be published.
        $scriptGateByPlatform = [];
        foreach ($channels as $channel) {
            $platform = strtolower(trim((string)$channel['platform']));
            $scriptGateByPlatform[$platform] = final_publish_gate_check($db, $tenantId, $content, $platform);
        }

        $results = [];
        foreach ($channels as $channel) {
            // ── idempotency guard ต่อคู่ (content_id, platform) ─────────────────
                // ใช้ advisory lock เพื่อกัน concurrent requests ของแพลตฟอร์มเดียวกัน
                // แม้ผู้ใช้จะเลือกหลาย channel ที่อยู่บน platform เดียวกันก็ตาม
                $lockName = 'sp:' . md5($contentId . ':' . strtolower((string)$channel['platform']));
            $lk = $db->prepare("SELECT GET_LOCK(?, 5) AS got");
            $lk->execute([$lockName]);
            $got = (int) ($lk->fetchColumn() ?: 0);
            if ($got !== 1) {
                // มีคำขออื่นถือล็อกคู่นี้อยู่ = กำลังยิงซ้ำพร้อมกัน → ข้าม ไม่ใช่ error
                $results[] = [
                    'channel_id' => $channel['id'], 'success' => false, 'status' => 'skipped',
                    'reason'     => 'มีคำขอเผยแพร่ช่องทางนี้กำลังทำงานอยู่',
                ];
                continue;
            }

            try {
                $platform = strtolower((string)$channel['platform']);
                if (!empty($scriptGateByPlatform[$platform]['blocked'])) {
                    $results[] = [
                        'channel_id' => $channel['id'],
                        'platform' => $platform,
                        'success' => false,
                        'status' => 'blocked',
                        'reason' => $scriptGateByPlatform[$platform]['reason'],
                    ];
                    continue;
                }

                // Business rule: 1 content × 1 platform = publish once.
                // Lock by platform, not channel, so two channels on the same platform
                // cannot race and both publish the same content.
                $sentStmt = $db->prepare(
                    "SELECT COUNT(*) FROM content_publish_queue q
                     JOIN publish_channels pc ON pc.id=q.channel_id
                     WHERE q.tenant_id=? AND q.content_id=? AND LOWER(pc.platform)=? AND q.status='sent'"
                );
                $sentStmt->execute([$tenantId, $contentId, strtolower((string)$channel['platform'])]);
                if ((int)$sentStmt->fetchColumn() > 0) {
                    $results[] = [
                        'channel_id' => $channel['id'], 'platform' => strtolower((string)$channel['platform']), 'success' => false, 'status' => 'skipped',
                        'reason' => 'แพลตฟอร์มนี้เผยแพร่คอนเทนต์นี้ไปแล้ว — อนุญาตให้เผยแพร่ได้เพียงครั้งเดียวต่อแพลตฟอร์ม',
                    ];
                    continue;
                }

                // Existing pending/processing work also blocks a second request for the same platform.
                $pendingStmt = $db->prepare(
                    "SELECT COUNT(*) FROM content_publish_queue q
                     JOIN publish_channels pc ON pc.id=q.channel_id
                     WHERE q.tenant_id=? AND q.content_id=? AND LOWER(pc.platform)=? AND q.status IN ('pending','processing')"
                );
                $pendingStmt->execute([$tenantId, $contentId, strtolower((string)$channel['platform'])]);
                if ((int)$pendingStmt->fetchColumn() > 0) {
                    $results[] = [
                        'channel_id' => $channel['id'], 'platform' => strtolower((string)$channel['platform']), 'success' => false, 'status' => 'skipped',
                        'reason' => 'แพลตฟอร์มนี้มีรายการเผยแพร่ที่กำลังดำเนินการอยู่แล้ว',
                    ];
                    continue;
                }

                // Legacy 10-minute guard remains as an additional safety net.
                $dupe = $db->prepare(
                    "SELECT COUNT(*) FROM content_publish_queue
                     WHERE tenant_id=? AND content_id=? AND channel_id=?
                       AND status IN ('processing','sent')
                       AND created_at >= NOW() - INTERVAL 10 MINUTE"
                );
                $dupe->execute([$tenantId, $contentId, $channel['id']]);
                if ((int) $dupe->fetchColumn() > 0) {
                    $results[] = [
                        'channel_id' => $channel['id'], 'success' => false, 'status' => 'skipped',
                        'reason'     => 'เพิ่งส่งช่องทางนี้ไปภายใน 10 นาที — ข้ามเพื่อกันเผยแพร่ซ้ำ',
                    ];
                    continue;
                }

                $id = generateUUID();

                // scheduled_at เขียนด้วย NOW() ของฐานข้อมูล ไม่ใช่ date() ของ PHP
                // เพราะคอลัมน์นี้ถูกเทียบด้วย `scheduled_at <= NOW()` ที่
                // api/cron/publish-scheduler.php:30 และถูกเขียนทับด้วย
                // DATE_ADD(NOW(), INTERVAL 5 MINUTE) ตอน retry ที่บรรทัด 131
                // → ต้องเป็นนาฬิกาเดียวกันทั้งคอลัมน์ ไม่ให้ขึ้นกับ date.timezone ของ runtime
                $db->prepare(
                    "INSERT INTO content_publish_queue (id,tenant_id,content_id,channel_id,scheduled_at,status)
                     VALUES (?,?,?,?,NOW(),?)"
                )->execute([$id, $tenantId, $contentId, $channel['id'], 'processing']);

                // Apply per-channel content override if provided
                $contentForChannel = $content;
                if (!empty($channelOverrides[$channel['id']])) {
                    $overrideText = $channelOverrides[$channel['id']];
                    $contentForChannel = array_merge($content, [
                        'caption'         => $overrideText,
                        'article_content' => json_encode(['html' => $overrideText, 'title' => $content['title'] ?? '', 'excerpt' => '']),
                    ]);
                } else {
                    $articleContent = json_decode($content['article_content'] ?? '', true);
                    $scripts = is_array($articleContent['scripts'] ?? null) ? $articleContent['scripts'] : [];
                    $platform = strtolower((string)$channel['platform']);
                    $socialPlatforms = ['facebook', 'instagram', 'tiktok', 'lineoa', 'linkedin', 'twitter'];
                    if (in_array($platform, $socialPlatforms, true) && !empty($scripts[$platform])) {
                        $contentForChannel['caption'] = trim((string)$scripts[$platform]);
                    }
                }

                $result  = dispatch_content($channel['platform'], $channel, $contentForChannel);
                // เก็บเนื้อ response ทุกกรณี — status='sent' เพียงอย่างเดียวพิสูจน์ไม่ได้ว่าปลายทางรับจริง
                $snippet = extract_response_snippet($result);

                if ($result['success']) {
                    $meta = extract_publish_meta($result, $channel['platform'], $channel);
                    $db->prepare(
                        "UPDATE content_publish_queue SET status='sent', sent_at=NOW(), platform_post_id=?, published_url=?, response_snippet=? WHERE id=?"
                    )->execute([$meta['platform_post_id'], $meta['published_url'], $snippet, $id]);
                    // บันทึกผลเผยแพร่กลับ content_items (content_id คือ content_items.id ที่โหลดมา)
                    // platform: เขียนตาม channel ที่โพสต์จริง — analytics-recalculate group by คอลัมน์นี้
                    // ถ้าไม่เขียน ค่าจะค้างจากตอนสร้างคอนเทนต์และแจกแจงแพลตฟอร์มผิด
                    $db->prepare(
                        "UPDATE content_items SET published_url=COALESCE(?, published_url), external_post_id=COALESCE(?, external_post_id), updated_at=NOW() WHERE id=? AND tenant_id=?"
                    )->execute([$meta['published_url'], $meta['platform_post_id'], $contentId, $tenantId]);
                    sync_content_publish_status($db, $tenantId, $content);
                    $results[] = ['channel_id' => $channel['id'], 'platform' => strtolower((string)$channel['platform']), 'success' => true, 'status' => 'success'];
                } else {
                    $errMsg = mb_substr((string) ($result['error'] ?? 'dispatch failed'), 0, 500);
                    $db->prepare(
                        "UPDATE content_publish_queue SET status='failed', error_msg=?, response_snippet=? WHERE id=?"
                    )->execute([$errMsg, $snippet, $id]);
                    $results[] = [
                        'channel_id' => $channel['id'], 'success' => false, 'status' => 'failed',
                        'error'      => $errMsg,
                    ];
                }
            } finally {
                $db->prepare("SELECT RELEASE_LOCK(?)")->execute([$lockName]);
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
