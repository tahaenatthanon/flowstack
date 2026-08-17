<?php
// Run via: php api/cron/publish-scheduler.php
// XAMPP Windows Task Scheduler: php C:\xampp\htdocs\flowstack\api\cron\publish-scheduler.php
// Linux cron: * * * * * php /var/www/html/flowstack/api/cron/publish-scheduler.php

if (!defined('CRON_MODE')) define('CRON_MODE', true);
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/publish-dispatch.php';

$db = getDB();

function isCancelled(PDO $db): bool {
    if (empty($GLOBALS['cron_run_id'])) return false;
    $stmt = $db->prepare('SELECT cancel_requested FROM cron_runs WHERE id = ?');
    $stmt->execute([$GLOBALS['cron_run_id']]);
    return (bool)$stmt->fetchColumn();
}

// Select up to 50 pending entries due now, across all tenants
$stmt = $db->prepare(
    "SELECT q.*, ci.title, ci.caption, ci.article_content, ci.generated_image_url,
            ci.platform AS content_platform,
            pc.platform, pc.endpoint_url, pc.credentials_encrypted, pc.name AS channel_name
     FROM content_publish_queue q
     JOIN content_items ci       ON ci.id = q.content_id
     JOIN publish_channels pc    ON pc.id = q.channel_id
     WHERE q.status = 'pending' AND q.scheduled_at <= NOW()
     ORDER BY q.scheduled_at ASC
     LIMIT 50"
);
// Note: q.content_override is included via q.* above
$stmt->execute();
$entries = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($entries)) {
    echo date('[Y-m-d H:i:s]') . " No pending entries.\n";
    return;
}

echo date('[Y-m-d H:i:s]') . " Processing " . count($entries) . " entries...\n";

foreach ($entries as $entry) {
    if (isCancelled($db)) {
        echo date('[Y-m-d H:i:s]') . " Cancelled by admin.\n";
        break;
    }

    $queueId = $entry['id'];

    // Lock the row by setting processing
    $lock = $db->prepare(
        "UPDATE content_publish_queue SET status='processing' WHERE id=? AND status='pending'"
    );
    $lock->execute([$queueId]);
    if ($lock->rowCount() === 0) {
        echo "  [{$queueId}] Skipped (already processing)\n";
        continue;
    }

    $channel = [
        'id'                     => $entry['channel_id'],
        'platform'               => $entry['platform'],
        'endpoint_url'           => $entry['endpoint_url'],
        'credentials_encrypted'  => $entry['credentials_encrypted'],
        'name'                   => $entry['channel_name'],
    ];
    $content = [
        'id'                  => $entry['content_id'],
        'title'               => $entry['title'],
        'caption'             => $entry['caption'],
        'article_content'     => $entry['article_content'],
        'generated_image_url' => $entry['generated_image_url'],
    ];

    // Apply content_override saved at schedule time
    if (!empty($entry['content_override'])) {
        $ov = $entry['content_override'];
        $content['caption']         = $ov;
        $content['article_content'] = json_encode(['html' => $ov, 'title' => $content['title'], 'excerpt' => '']);
    }

    try {
        $result = dispatch_content($entry['platform'], $channel, $content);
    } catch (Exception $e) {
        $result = ['success' => false, 'error' => $e->getMessage()];
    }

    if ($result['success']) {
        $meta = extract_publish_meta($result, $entry['platform'], $channel);
        $db->prepare(
            "UPDATE content_publish_queue SET status='sent', sent_at=NOW(), platform_post_id=?, published_url=? WHERE id=?"
        )->execute([$meta['platform_post_id'], $meta['published_url'], $queueId]);
        // บันทึกผลเผยแพร่กลับ content_items (content_id คือ content_items.id)
        $db->prepare(
            "UPDATE content_items SET status='published', published_at=NOW(), published_url=?, external_post_id=? WHERE id=? AND tenant_id=?"
        )->execute([$meta['published_url'], $meta['platform_post_id'], $entry['content_id'], $entry['tenant_id']]);
        echo "  [{$queueId}] sent via {$entry['platform']}\n";
    } else {
        $retryCount = (int)$entry['retry_count'] + 1;
        if ($retryCount < 3) {
            // Retry in 5 minutes
            $db->prepare(
                "UPDATE content_publish_queue
                 SET status='pending', error_msg=?, retry_count=?, scheduled_at=DATE_ADD(NOW(), INTERVAL 5 MINUTE)
                 WHERE id=?"
            )->execute([$result['error'] ?? 'dispatch failed', $retryCount, $queueId]);
            echo "  [{$queueId}] failed (retry {$retryCount}/3): " . ($result['error'] ?? '') . "\n";
        } else {
            $db->prepare(
                "UPDATE content_publish_queue SET status='failed', error_msg=?, retry_count=? WHERE id=?"
            )->execute([$result['error'] ?? 'dispatch failed', $retryCount, $queueId]);
            echo "  [{$queueId}] permanently failed after 3 retries\n";
        }
    }
}

echo date('[Y-m-d H:i:s]') . " Done.\n";
