<?php
// api/notification-dispatch.php
// Called by cron every 15 minutes:
//   GET /api/notification-dispatch.php?secret=CRON_SECRET
//
// Env vars needed for external channels:
//   LINE_CHANNEL_ACCESS_TOKEN  — Line Messaging API
//   TELEGRAM_BOT_TOKEN         — Telegram Bot
//   MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD, MAIL_ENCRYPTION, MAIL_PORT, MAIL_FROM
//   CRON_SECRET                — override default secret (optional)

require_once __DIR__ . '/config.php';

// Protect endpoint — require cron secret
$secret   = $_GET['secret'] ?? $_GET['token'] ?? '';
$expected = getenv('CRON_SECRET') ?: 'flowstack-cron-2026';
if ($secret !== $expected) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

$db       = getDB();
$now      = new DateTime('now', new DateTimeZone('Asia/Bangkok'));
$today    = $now->format('Y-m-d');
$tomorrow = (clone $now)->modify('+1 day')->format('Y-m-d');

// Load Line + Telegram settings from DB
$notifStmt    = $db->query("SELECT `key`, `value` FROM settings WHERE `key` IN ('line_channel_access_token','line_targets','telegram_bot_token','telegram_targets')");
$notifSettings = $notifStmt->fetchAll(PDO::FETCH_KEY_PAIR);
$lineGroupToken    = $notifSettings['line_channel_access_token'] ?? getenv('LINE_CHANNEL_ACCESS_TOKEN') ?: '';
$lineTargets       = json_decode($notifSettings['line_targets']     ?? '[]', true) ?: [];
$telegramBotToken  = $notifSettings['telegram_bot_token'] ?? getenv('TELEGRAM_BOT_TOKEN') ?: '';
$telegramTargets   = json_decode($notifSettings['telegram_targets'] ?? '[]', true) ?: [];

// Find users whose briefing_time falls within current ±7 minute window
$stmt = $db->prepare(
    "SELECT u.id, u.email, u.display_name, tu.tenant_id,
            ns.line_user_id, ns.telegram_chat_id,
            ns.notify_line, ns.notify_telegram, ns.notify_email,
            ns.notify_tasks_due, ns.notify_tasks_overdue,
            ns.notify_calendar, ns.notify_tomorrow,
            ns.notify_assigned, ns.notify_sla,
            ns.briefing_time
     FROM users u
     JOIN tenant_users tu ON tu.user_id = u.id
     JOIN notification_settings ns ON ns.user_id = u.id
     WHERE u.is_active = 1
       AND ABS(TIMESTAMPDIFF(MINUTE,
             CONCAT(CURDATE(), ' ', ns.briefing_time),
             NOW()
           )) <= 7"
);
$stmt->execute();
$users = $stmt->fetchAll();

$dispatched = 0;
$log        = [];

foreach ($users as $user) {
    $message = buildBriefing($db, $user, $today, $tomorrow);
    if (!$message) {
        $log[] = ['user' => $user['display_name'], 'skipped' => 'nothing to report'];
        continue;
    }

    if ($user['notify_line'] && $user['line_user_id']) {
        sendLine($db, $user, $message);
    }
    if ($user['notify_telegram'] && $user['telegram_chat_id']) {
        sendTelegram($db, $user, $message);
    }
    if ($user['notify_email'] && $user['email']) {
        sendEmail($db, $user, $message);
    }

    $dispatched++;
    $log[] = ['user' => $user['display_name'], 'channels' => [
        'line'     => (bool)($user['notify_line'] && $user['line_user_id']),
        'telegram' => (bool)($user['notify_telegram'] && $user['telegram_chat_id']),
        'email'    => (bool)($user['notify_email'] && $user['email']),
    ]];
}

// ส่งสรุปภาพรวมไปยังทุก target (LINE + Telegram) — ครั้งเดียวต่อ cron run
$groupLog = [];
if ($dispatched > 0) {
    $groupMsg = buildGroupSummary($db, $today, $tomorrow);
    if ($groupMsg) {
        if ($lineGroupToken && !empty($lineTargets)) {
            foreach ($lineTargets as $target) {
                $r = sendLineGroup($lineGroupToken, $target['id'], $groupMsg);
                $groupLog[] = array_merge(['channel' => 'line', 'name' => $target['name']], $r);
            }
        }
        if ($telegramBotToken && !empty($telegramTargets)) {
            foreach ($telegramTargets as $target) {
                $r = sendTelegramGroup($telegramBotToken, $target['id'], $groupMsg);
                $groupLog[] = array_merge(['channel' => 'telegram', 'name' => $target['name']], $r);
            }
        }
    }
}

header('Content-Type: application/json');
echo json_encode([
    'dispatched'  => $dispatched,
    'time'        => $now->format('H:i'),
    'log'         => $log,
    'group_line'  => $groupLog,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildBriefing(PDO $db, array $user, string $today, string $tomorrow): string
{
    $lines = [];

    // ── Task ครบกำหนดวันนี้ ───────────────────────────────────────────
    if ($user['notify_tasks_due'] ?? 1) {
        $stmt = $db->prepare(
            "SELECT title FROM tasks
             WHERE tenant_id = ? AND assigned_to = ? AND DATE(due_date) = ?
               AND status NOT IN ('completed','cancelled')
             ORDER BY due_date LIMIT 5"
        );
        $stmt->execute([$user['tenant_id'], $user['id'], $today]);
        $dueTasks = $stmt->fetchAll();
        if (!empty($dueTasks)) {
            $lines[] = '✅ Task ครบกำหนดวันนี้:';
            foreach ($dueTasks as $t) $lines[] = "  • {$t['title']}";
            $lines[] = '';
        }
    }

    // ── Task เกินกำหนด ───────────────────────────────────────────────
    if ($user['notify_tasks_overdue'] ?? 1) {
        $stmt = $db->prepare(
            "SELECT title, due_date FROM tasks
             WHERE tenant_id = ? AND assigned_to = ? AND DATE(due_date) < ?
               AND status NOT IN ('completed','cancelled')
             ORDER BY due_date LIMIT 5"
        );
        $stmt->execute([$user['tenant_id'], $user['id'], $today]);
        $overdue = $stmt->fetchAll();
        if (!empty($overdue)) {
            $lines[] = '⚠️ Task เกินกำหนด:';
            foreach ($overdue as $t) {
                $days    = (int)((strtotime($today) - strtotime($t['due_date'])) / 86400);
                $lines[] = "  • {$t['title']} (เกิน {$days} วัน)";
            }
            $lines[] = '';
        }
    }

    // ── กิจกรรมวันนี้ ────────────────────────────────────────────────
    if ($user['notify_calendar'] ?? 1) {
        $stmt = $db->prepare(
            "SELECT title, event_type, start_at, all_day FROM calendar_events
             WHERE tenant_id = ? AND (created_by = ? OR event_type = 'holiday')
               AND DATE(start_at) = ? AND status != 'cancelled'
             ORDER BY start_at"
        );
        $stmt->execute([$user['tenant_id'], $user['id'], $today]);
        $todayEvents = $stmt->fetchAll();
        if (!empty($todayEvents)) {
            $lines[] = '📆 กิจกรรมวันนี้:';
            foreach ($todayEvents as $e) {
                $time    = $e['all_day'] ? '(ทั้งวัน)' : date('H:i', strtotime($e['start_at']));
                $lines[] = "  • {$e['title']} {$time}";
            }
            $lines[] = '';
        }
    }

    // ── กิจกรรมพรุ่งนี้ ──────────────────────────────────────────────
    if ($user['notify_tomorrow'] ?? 1) {
        $stmt = $db->prepare(
            "SELECT title, event_type, start_at, all_day FROM calendar_events
             WHERE tenant_id = ? AND (created_by = ? OR event_type = 'holiday')
               AND DATE(start_at) = ? AND status != 'cancelled'
             ORDER BY start_at"
        );
        $stmt->execute([$user['tenant_id'], $user['id'], $tomorrow]);
        $tomorrowEvents = $stmt->fetchAll();
        if (!empty($tomorrowEvents)) {
            $lines[] = '📌 พรุ่งนี้:';
            foreach ($tomorrowEvents as $e) {
                $time    = $e['all_day'] ? '(ทั้งวัน)' : date('H:i', strtotime($e['start_at']));
                $lines[] = "  • {$e['title']} {$time}";
            }
            $lines[] = '';
        }
    }

    // ── SLA เกิน (support tickets) ───────────────────────────────────
    if ($user['notify_sla'] ?? 1) {
        $stmt = $db->prepare(
            "SELECT t.title, t.priority,
                    TIMESTAMPDIFF(HOUR, t.created_at, NOW()) AS age_hours,
                    CASE t.priority WHEN 'critical' THEN 2 WHEN 'high' THEN 4 WHEN 'medium' THEN 8 ELSE 24 END AS sla_hours
             FROM support_tickets t
             WHERE t.tenant_id = ? AND t.assigned_to = ?
               AND t.status NOT IN ('resolved','closed')
             HAVING age_hours > sla_hours
             ORDER BY age_hours DESC LIMIT 3"
        );
        $stmt->execute([$user['tenant_id'], $user['id']]);
        $slaBreached = $stmt->fetchAll();
        if (!empty($slaBreached)) {
            $lines[] = '🚨 Ticket เกิน SLA:';
            foreach ($slaBreached as $t) {
                $over    = (int)$t['age_hours'] - (int)$t['sla_hours'];
                $lines[] = "  • {$t['title']} (เกิน {$over} ชม.)";
            }
            $lines[] = '';
        }
    }

    if (empty($lines)) return '';

    array_unshift($lines, "📅 สวัสดีตอนเช้า {$user['display_name']}!", '');
    return implode("\n", $lines);
}

function logNotification(PDO $db, string $userId, string $channel, string $message, string $status, string $error = ''): void
{
    $id = generateUUID();
    $db->prepare(
        "INSERT INTO notification_log (id, user_id, channel, message, sent_at, status, error)
         VALUES (?, ?, ?, ?, NOW(), ?, ?)"
    )->execute([$id, $userId, $channel, $message, $status, $error ?: null]);
}

function buildGroupSummary(PDO $db, string $today, string $tomorrow): string
{
    // Tasks due today across all users
    $stmt = $db->query("
        SELECT t.title, u.display_name
        FROM tasks t
        LEFT JOIN users u ON u.id = t.assigned_to
        WHERE DATE(t.due_date) = '$today'
          AND t.status NOT IN ('completed','cancelled')
        ORDER BY t.due_date
        LIMIT 10
    ");
    $tasks = $stmt->fetchAll();

    // Calendar events today
    $stmt2 = $db->query("
        SELECT title, event_type, start_at, all_day
        FROM calendar_events
        WHERE DATE(start_at) = '$today' AND status != 'cancelled'
        ORDER BY start_at
        LIMIT 5
    ");
    $events = $stmt2->fetchAll();

    if (empty($tasks) && empty($events)) return '';

    $lines = ["📋 สรุปงานทีมวันนี้ ({$today})", ''];

    if (!empty($events)) {
        $lines[] = '📆 กิจกรรมวันนี้:';
        foreach ($events as $e) {
            $time    = $e['all_day'] ? '(ทั้งวัน)' : date('H:i', strtotime($e['start_at']));
            $lines[] = "  • {$e['title']} {$time}";
        }
        $lines[] = '';
    }

    if (!empty($tasks)) {
        $lines[] = '✅ Task ครบกำหนดวันนี้:';
        foreach ($tasks as $t) {
            $who     = $t['display_name'] ? " ({$t['display_name']})" : '';
            $lines[] = "  • {$t['title']}{$who}";
        }
    }

    return implode("\n", $lines);
}

function sendLineGroup(string $token, string $groupId, string $message): array
{
    $payload = json_encode([
        'to'       => $groupId,
        'messages' => [['type' => 'text', 'text' => $message]],
    ], JSON_UNESCAPED_UNICODE);

    $ch = curl_init('https://api.line.me/v2/bot/message/push');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json', "Authorization: Bearer $token"],
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_TIMEOUT        => 15,
    ]);
    $res  = curl_exec($ch);
    $info = curl_getinfo($ch);
    curl_close($ch);

    $resp = json_decode($res, true) ?: [];
    $ok   = ($info['http_code'] === 200 && empty($resp['message']));
    return ['ok' => $ok, 'http_code' => $info['http_code'], 'error' => $resp['message'] ?? null];
}

function sendLine(PDO $db, array $user, string $message): void
{
    $token = getenv('LINE_CHANNEL_ACCESS_TOKEN') ?: '';
    if (!$token) {
        $r = $db->query("SELECT `value` FROM settings WHERE `key`='line_channel_access_token' LIMIT 1")->fetchColumn();
        $token = $r ?: '';
    }
    if (!$token) {
        logNotification($db, $user['id'], 'line', $message, 'failed', 'line_channel_access_token not configured');
        return;
    }

    $payload = json_encode([
        'to'       => $user['line_user_id'],
        'messages' => [['type' => 'text', 'text' => $message]],
    ]);
    $ctx = stream_context_create(['http' => [
        'method'        => 'POST',
        'header'        => "Content-Type: application/json\r\nAuthorization: Bearer $token",
        'content'       => $payload,
        'ignore_errors' => true,
    ]]);
    $result = @file_get_contents('https://api.line.me/v2/bot/message/push', false, $ctx);
    $resp   = json_decode((string)$result, true);
    $ok     = empty($resp['message']);
    logNotification($db, $user['id'], 'line', $message, $ok ? 'sent' : 'failed', $resp['message'] ?? '');
}

function sendTelegramGroup(string $token, string $chatId, string $message): array
{
    $url     = "https://api.telegram.org/bot{$token}/sendMessage";
    $payload = json_encode(['chat_id' => $chatId, 'text' => $message, 'parse_mode' => 'Markdown'], JSON_UNESCAPED_UNICODE);
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_HTTPHEADER => ['Content-Type: application/json'], CURLOPT_POSTFIELDS => $payload, CURLOPT_TIMEOUT => 15]);
    $res  = curl_exec($ch);
    $info = curl_getinfo($ch);
    curl_close($ch);
    $resp = json_decode($res, true) ?: [];
    $ok   = ($resp['ok'] ?? false) === true;
    return ['ok' => $ok, 'http_code' => $info['http_code'], 'error' => $resp['description'] ?? null];
}

function sendTelegram(PDO $db, array $user, string $message): void
{
    $token = getenv('TELEGRAM_BOT_TOKEN') ?: '';
    if (!$token) {
        // fallback: try DB setting
        $r = $db->query("SELECT `value` FROM settings WHERE `key`='telegram_bot_token' LIMIT 1")->fetchColumn();
        $token = $r ?: '';
    }
    if (!$token) {
        logNotification($db, $user['id'], 'telegram', $message, 'failed', 'TELEGRAM_BOT_TOKEN not configured');
        return;
    }

    $url     = "https://api.telegram.org/bot{$token}/sendMessage";
    $payload = json_encode([
        'chat_id'    => $user['telegram_chat_id'],
        'text'       => $message,
        'parse_mode' => 'Markdown',
    ]);
    $ctx = stream_context_create(['http' => [
        'method'        => 'POST',
        'header'        => "Content-Type: application/json",
        'content'       => $payload,
        'ignore_errors' => true,
    ]]);
    $result = @file_get_contents($url, false, $ctx);
    $resp   = json_decode((string)$result, true);
    $ok     = ($resp['ok'] ?? false) === true;
    logNotification($db, $user['id'], 'telegram', $message, $ok ? 'sent' : 'failed', $resp['description'] ?? '');
}

function sendEmail(PDO $db, array $user, string $message): void
{
    $subject     = '📅 FlowStack Morning Briefing — ' . date('d/m/Y');
    $htmlMessage = '<html><body style="font-family:sans-serif;padding:20px;line-height:1.6">'
        . nl2br(htmlspecialchars($message, ENT_QUOTES, 'UTF-8'))
        . '</body></html>';

    $vendorAutoload = __DIR__ . '/../vendor/autoload.php';
    if (file_exists($vendorAutoload)) {
        require_once $vendorAutoload;
        try {
            $mail = new PHPMailer\PHPMailer\PHPMailer(true);
            $mail->isSMTP();
            $mail->CharSet    = 'UTF-8';
            $mail->Host       = getenv('MAIL_HOST') ?: 'localhost';
            $mail->SMTPAuth   = (bool)getenv('MAIL_USERNAME');
            $mail->Username   = getenv('MAIL_USERNAME') ?: '';
            $mail->Password   = getenv('MAIL_PASSWORD') ?: '';
            $mail->SMTPSecure = getenv('MAIL_ENCRYPTION') ?: 'tls';
            $mail->Port       = (int)(getenv('MAIL_PORT') ?: 587);
            $mail->setFrom(getenv('MAIL_FROM') ?: 'noreply@flowstack.app', 'FlowStack');
            $mail->addAddress($user['email'], $user['display_name']);
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body    = $htmlMessage;
            $mail->AltBody = strip_tags($message);
            $mail->send();
            logNotification($db, $user['id'], 'email', $message, 'sent');
        } catch (\Exception $e) {
            logNotification($db, $user['id'], 'email', $message, 'failed', $e->getMessage());
        }
    } else {
        // Fallback: native mail()
        $headers  = "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n";
        $headers .= "From: FlowStack <noreply@flowstack.app>\r\n";
        $sent     = @mail($user['email'], $subject, $htmlMessage, $headers);
        logNotification($db, $user['id'], 'email', $message, $sent ? 'sent' : 'failed',
            $sent ? '' : 'mail() returned false');
    }
}
