<?php
// api/line-webhook.php
// LINE Messaging API Webhook receiver
// Register URL in LINE Developers Console → Messaging API → Webhook settings
//   https://your-domain.com/api/line-webhook.php

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

$rawBody = file_get_contents('php://input');
$method  = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// GET — health check (LINE Developers Console ใช้ verify endpoint)
if ($method === 'GET') {
    echo json_encode(['status' => 'ok', 'service' => 'Flowstack LINE Webhook']);
    exit;
}

if ($method !== 'POST') {
    http_response_code(405);
    exit;
}

$db = getDB();

// ── ตรวจ Signature ด้วย Channel Secret (ถ้าตั้งค่าไว้) ──────────────
$secret = $db->query("SELECT `value` FROM settings WHERE `key`='line_channel_secret' LIMIT 1")->fetchColumn() ?: '';
if ($secret) {
    $sig  = $_SERVER['HTTP_X_LINE_SIGNATURE'] ?? '';
    $hash = base64_encode(hash_hmac('sha256', $rawBody, $secret, true));
    if (!hash_equals($hash, $sig)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid signature']);
        exit;
    }
}

// ── ประมวลผล events ──────────────────────────────────────────────────
$payload = json_decode($rawBody, true);
$events  = $payload['events'] ?? [];
$token   = $db->query("SELECT `value` FROM settings WHERE `key`='line_channel_access_token' LIMIT 1")->fetchColumn() ?: '';

foreach ($events as $event) {
    $source     = $event['source']     ?? [];
    $eventType  = $event['type']       ?? '';
    $replyToken = $event['replyToken'] ?? '';
    $sourceType = $source['type']      ?? '';

    // บันทึก Group ID อัตโนมัติ
    if ($sourceType === 'group' && !empty($source['groupId'])) {
        captureGroup($db, $source['groupId']);
    }

    // ตอบกลับ ID เมื่อมีคนส่งข้อความ (ช่วยตรวจสอบ ID)
    if ($eventType === 'message' && $replyToken && $token) {
        if ($sourceType === 'group') {
            $reply = "📋 Group ID:\n{$source['groupId']}\n\nUser ID:\n{$source['userId']}";
        } elseif ($sourceType === 'user') {
            $reply = "📋 User ID:\n{$source['userId']}";
        } else {
            $reply = '';
        }
        if ($reply) replyMessage($token, $replyToken, $reply);
    }
}

// LINE requires HTTP 200 with empty or minimal body
echo json_encode(['status' => 'ok']);
exit;

// ─── Helpers ─────────────────────────────────────────────────────────

function replyMessage(string $token, string $replyToken, string $text): void
{
    $payload = json_encode([
        'replyToken' => $replyToken,
        'messages'   => [['type' => 'text', 'text' => $text]],
    ], JSON_UNESCAPED_UNICODE);
    $ch = curl_init('https://api.line.me/v2/bot/message/reply');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json', "Authorization: Bearer $token"],
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_TIMEOUT        => 5,
    ]);
    curl_exec($ch);
    curl_close($ch);
}

function captureGroup(PDO $db, string $groupId): void
{
    $existing = json_decode(
        $db->query("SELECT `value` FROM settings WHERE `key`='line_discovered_groups' LIMIT 1")->fetchColumn() ?: '[]',
        true
    ) ?: [];

    foreach ($existing as $g) {
        if ($g['id'] === $groupId) return; // already known
    }

    // ดึงชื่อกลุ่มจาก LINE API
    $token = $db->query("SELECT `value` FROM settings WHERE `key`='line_channel_access_token' LIMIT 1")->fetchColumn() ?: '';
    $groupName = $groupId;
    if ($token) {
        $ch = curl_init("https://api.line.me/v2/bot/group/{$groupId}/summary");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => ["Authorization: Bearer $token"], CURLOPT_TIMEOUT => 5]);
        $res  = curl_exec($ch);
        curl_close($ch);
        $data = json_decode($res, true) ?: [];
        $groupName = $data['groupName'] ?? $groupId;
    }

    $existing[] = ['id' => $groupId, 'name' => $groupName, 'discovered_at' => date('Y-m-d H:i:s')];
    $db->prepare(
        "INSERT INTO settings (`key`, `value`) VALUES ('line_discovered_groups', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `updated_at` = NOW()"
    )->execute([json_encode($existing, JSON_UNESCAPED_UNICODE)]);
}
