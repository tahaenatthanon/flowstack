<?php
/**
 * cron-publish.php โ€” Standalone scheduled-post processor
 *
 * Designed to be called by Windows Task Scheduler every minute:
 *   php C:\xampp\htdocs\flowstack\api\cron-publish.php
 *
 * Or via HTTP with a secret token (for frontend polling without auth):
 *   GET /api/cron-publish.php?token=<CRON_SECRET>
 *
 * Processes content_schedules rows where status='pending' AND scheduled_at <= NOW()
 * across ALL tenants.
 */

// Allow CLI or HTTP with secret token
$isCli = php_sapi_name() === 'cli';
if (!$isCli) {
    header('Content-Type: application/json; charset=utf-8');
    // Simple secret token guard for HTTP calls
    require_once __DIR__ . '/config.php'; // loads .env
    $cronSecret = getenv('CRON_SECRET') ?: ($_ENV['CRON_SECRET'] ?? '');
    if (empty($cronSecret)) {
        http_response_code(500);
        echo json_encode(['error' => 'Server misconfiguration: CRON_SECRET is not set. Add CRON_SECRET to your .env file.']);
        exit;
    }
    $token = $_GET['token'] ?? '';
    if (!hash_equals($cronSecret, $token)) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden']);
        exit;
    }
}

require_once __DIR__ . '/config.php';

function cp_getDB(): PDO {
    return getDB();
}

function cp_decryptValue(string $encrypted): string {
    return decryptApiKey($encrypted);
}

function cp_publish(array $sc, array $creds): array {
    $artData = !empty($sc['article_content']) ? json_decode($sc['article_content'], true) : null;
    $title   = $artData['title']   ?? $sc['topic'];
    $content = $artData['html']    ?? $sc['caption'];
    $excerpt = $artData['excerpt'] ?? '';
    $imgUrl  = $sc['generated_image_url'] ?? '';

    $ok = false; $result = [];
    try {
        if ($sc['platform'] === 'wordpress') {
            $wpUrl  = rtrim($sc['endpoint_url'] ?? '', '/');
            $wpUser = $creds['username'] ?? '';
            $wpPass = $creds['app_password'] ?? '';
            $ch = curl_init("$wpUrl/wp-json/wp/v2/posts");
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Basic ' . base64_encode("$wpUser:$wpPass")],
                CURLOPT_POSTFIELDS => json_encode(['title' => $title, 'content' => $content, 'excerpt' => $excerpt, 'status' => 'publish']),
                CURLOPT_TIMEOUT => 30, CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true]);
            $res = curl_exec($ch); curl_close($ch);
            $result = json_decode($res, true) ?: ['raw' => substr($res, 0, 500)];
            $ok = !empty($result['id']);

        } elseif ($sc['platform'] === 'facebook') {
            $pageId = $creds['page_id'] ?? '';
            $token  = $creds['access_token'] ?? '';
            $msg    = $title . "\n\n" . substr($sc['caption'], 0, 63000);
            $ch     = curl_init("https://graph.facebook.com/v19.0/$pageId/feed");
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => http_build_query(['message' => $msg, 'access_token' => $token]),
                CURLOPT_TIMEOUT => 30]);
            $res    = curl_exec($ch); curl_close($ch);
            $result = json_decode($res, true) ?: ['raw' => substr($res, 0, 500)];
            $ok     = !empty($result['id']);

        } elseif ($sc['platform'] === 'lineoa') {
            $token  = $creds['channel_access_token'] ?? '';
            $msg    = $title . "\n\n" . substr($sc['caption'], 0, 4900);
            $ch     = curl_init('https://api.line.me/v2/bot/message/broadcast');
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json', "Authorization: Bearer $token"],
                CURLOPT_POSTFIELDS => json_encode(['messages' => [['type' => 'text', 'text' => $msg]]]),
                CURLOPT_TIMEOUT => 30]);
            $res    = curl_exec($ch); curl_close($ch);
            $result = json_decode($res, true) ?: ['raw' => substr($res, 0, 500)];
            $ok     = empty($result['message']);

        } elseif ($sc['platform'] === 'wix') {
            $apiKey = $creds['api_key'] ?? '';
            $siteId = $creds['site_id'] ?? '';
            $ch     = curl_init('https://www.wixapis.com/blog/v3/posts');
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json', "Authorization: $apiKey", "wix-site-id: $siteId"],
                CURLOPT_POSTFIELDS => json_encode(['post' => ['title' => $title, 'richContent' => ['nodes' => [['type' => 'PARAGRAPH', 'nodes' => [['type' => 'TEXT', 'textData' => ['text' => strip_tags($content)]]]]]]]]),
                CURLOPT_TIMEOUT => 30]);
            $res    = curl_exec($ch); curl_close($ch);
            $result = json_decode($res, true) ?: ['raw' => substr($res, 0, 500)];
            $ok     = !empty($result['post']['id']);

        } elseif ($sc['platform'] === 'custom') {
            $url     = $sc['endpoint_url'] ?? '';
            $headers = ['Content-Type: application/json'];
            foreach (($creds['headers'] ?? []) as $k => $v) { $headers[] = "$k: $v"; }
            $ch = curl_init($url);
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_POSTFIELDS => json_encode(['title' => $title, 'content' => $content, 'excerpt' => $excerpt, 'image_url' => $imgUrl]),
                CURLOPT_TIMEOUT => 30]);
            $res    = curl_exec($ch); curl_close($ch);
            $result = json_decode($res, true) ?: ['raw' => substr($res, 0, 500)];
            $ok     = true;
        }
    } catch (Exception $e) {
        $result = ['error' => $e->getMessage()];
    }

    return ['ok' => $ok, 'result' => $result];
}

// โ”€โ”€โ”€ Main โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
$db = cp_getDB();

// Record cron start
$cronRunId = null;
try {
    $db->prepare("INSERT INTO cron_runs (job_name, started_at) VALUES ('cron-publish', NOW())")->execute();
    $cronRunId = $db->lastInsertId();
} catch (Throwable $e) { /* non-fatal if cron_runs doesn't exist yet */ }

$stmt = $db->query("
    SELECT cs.id, cs.plan_item_id, cs.channel_id, cs.scheduled_at,
           cs.retry_count,
           pc.platform, pc.endpoint_url, pc.credentials_encrypted,
           cpi.topic, cpi.caption, cpi.generated_image_url, cpi.article_content
    FROM content_schedules cs
    JOIN publish_channels pc    ON pc.id  = cs.channel_id
    JOIN content_plan_items cpi ON cpi.id = cs.plan_item_id
    WHERE cs.status = 'pending'
      AND cs.scheduled_at <= NOW()
      AND (cs.next_retry_at IS NULL OR cs.next_retry_at <= NOW())
    LIMIT 50
");
$due = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];

$processed = [];
foreach ($due as $sc) {
    // Atomic claim โ€” skip if another process already claimed it
    $upd = $db->prepare("UPDATE content_schedules SET status='publishing' WHERE id=? AND status='pending'");
    $upd->execute([$sc['id']]);
    if ($upd->rowCount() === 0) continue;

    $creds = [];
    if (!empty($sc['credentials_encrypted'])) {
        $plain = cp_decryptValue($sc['credentials_encrypted']);
        if ($plain) $creds = json_decode($plain, true) ?: [];
    }

    $res = cp_publish($sc, $creds);

    $maxRetries = 3;
    if ($res['ok']) {
        $status = 'sent';
        $db->prepare("UPDATE content_schedules SET status='sent', publish_result=?, updated_at=NOW() WHERE id=?")
           ->execute([json_encode($res['result']), $sc['id']]);
    } else {
        $retryCount = (int)($sc['retry_count'] ?? 0) + 1;
        if ($retryCount <= $maxRetries) {
            // Exponential backoff: 2^retry minutes (2, 4, 8 minutes)
            $delaySec   = (int)pow(2, $retryCount) * 60;
            $nextRetry  = date('Y-m-d H:i:s', time() + $delaySec);
            $status     = 'pending'; // stays pending for retry
            $db->prepare("UPDATE content_schedules SET status='pending', retry_count=?, next_retry_at=?, publish_result=?, updated_at=NOW() WHERE id=?")
               ->execute([$retryCount, $nextRetry, json_encode($res['result']), $sc['id']]);
        } else {
            $status = 'failed';
            $db->prepare("UPDATE content_schedules SET status='failed', publish_result=?, updated_at=NOW() WHERE id=?")
               ->execute([json_encode($res['result']), $sc['id']]);
        }
    }

    $entry = ['id' => $sc['id'], 'topic' => $sc['topic'], 'platform' => $sc['platform'], 'status' => $status, 'retry_count' => (int)($sc['retry_count'] ?? 0)];
    $processed[] = $entry;

    if ($isCli) {
        $ts = date('Y-m-d H:i:s');
        echo "[$ts] {$status}: {$sc['topic']} โ’ {$sc['platform']}\n";
    }
}

$failCount = count(array_filter($processed, fn($p) => $p['status'] === 'failed'));
$out = ['processed' => count($processed), 'items' => $processed, 'ran_at' => date('c')];

// Record cron completion
if ($cronRunId) {
    try {
        $db->prepare("UPDATE cron_runs SET finished_at = NOW(), records_processed = ?, errors = ? WHERE id = ?")
           ->execute([count($processed), $failCount, $cronRunId]);
    } catch (Throwable $e) {}
}

if ($isCli) {
    echo "Done. Processed: " . count($processed) . "\n";
} else {
    echo json_encode($out);
}
