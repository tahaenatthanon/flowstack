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

        // Verify content exists and belongs to tenant
        $cs = $db->prepare("SELECT * FROM content_items WHERE id=? AND tenant_id=?");
        $cs->execute([$contentId, $tenantId]);
        $content = $cs->fetch(PDO::FETCH_ASSOC);
        if (!$content) jsonError('Content not found', 422);

        // เกตอนุมัติ — ต้องอยู่ก่อนเกต SEO: ไม่ต้อง query เพิ่ม (approved_at มาพร้อม SELECT * ด้านบน)
        // และเป็นเงื่อนไขเด็ดขาดกว่า จึงควรตอบเรื่องอนุมัติก่อนเรื่อง SEO
        // ใช้ approved_at ไม่ใช่ status เพราะเป็นหลักฐานเวลาที่อนุมัติจริง
        // บล็อกก่อนสร้างแถวคิวและก่อน dispatch → ไม่มี request ออกไปยังปลายทางเลย
        if (empty($content['approved_at'])) {
            jsonError('เผยแพร่ไม่ได้ — คอนเทนต์นี้ยังไม่ผ่านการอนุมัติ กรุณาอนุมัติก่อนส่ง', 422);
        }

        // เกต SEO — ตรวจครั้งเดียวก่อน dispatch ทุก channel; บล็อกถ้าเปิดเกตและมีกฎ fail/คะแนนต่ำ
        $gate = seo_gate_check($db, $tenantId, $content);
        if ($gate['blocked']) {
            jsonError('เผยแพร่ไม่ได้ — ไม่ผ่านเกณฑ์ SEO' . "\n" . $gate['reason'], 422);
        }

        $placeholders = implode(',', array_fill(0, count($channelIds), '?'));
        $chs = $db->prepare(
            "SELECT * FROM publish_channels WHERE id IN ($placeholders) AND tenant_id=? AND is_active=1"
        );
        $chs->execute([...$channelIds, $tenantId]);
        $channels = $chs->fetchAll(PDO::FETCH_ASSOC);
        if (count($channels) !== count($channelIds)) jsonError('Invalid or inactive channel(s)', 422);

        $results = [];
        foreach ($channels as $channel) {
            // ── idempotency guard ต่อคู่ (content_id, channel_id) ─────────────────
            // ใช้ advisory lock ไม่ใช่ SELECT ... FOR UPDATE เพราะตารางไม่มี composite index
            // บน (content_id, channel_id, status) → FOR UPDATE จะ lock ช่วงกว้างเกินจำเป็น
            // ชื่อ lock ยาว 35 ตัวอักษร (เพดาน MariaDB = 64) — raw uuid สองตัวจะยาว 76 ตัว เกิน
            $lockName = 'sn:' . md5($contentId . ':' . $channel['id']);
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
                // เพิ่งส่งคู่นี้ไปในกรอบ 10 นาที และยังไม่ล้มเหลว → ข้าม ไม่สร้างแถว ไม่ dispatch
                // แถว failed ไม่นับ เพื่อให้ปุ่ม "ลองส่งใหม่" ยังทำงานได้ทันที
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
                        "UPDATE content_items SET status='published', published_at=NOW(), published_url=?, external_post_id=?, platform=? WHERE id=? AND tenant_id=?"
                    )->execute([$meta['published_url'], $meta['platform_post_id'], $channel['platform'], $contentId, $tenantId]);
                    $results[] = ['channel_id' => $channel['id'], 'success' => true, 'status' => 'success'];
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
