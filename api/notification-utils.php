<?php
// api/notification-utils.php
// Shared helpers for real-time task activity notifications

require_once __DIR__ . '/config.php';

/**
 * ส่งแจ้งเตือนกิจกรรม Task ให้ผู้ใช้ที่เปิด notify_task_activity
 * (admin / manager เท่านั้นที่ควรเปิด setting นี้)
 *
 * @param PDO    $db
 * @param array  $task     — row จาก tasks table
 * @param string $actor    — display_name ของคนที่ทำ action
 * @param string $action   — 'created' | 'updated' | 'completed' | 'assigned'
 */
function notifyAdminsTaskActivity(PDO $db, array $task, string $actor, string $action): void
{
    // โหลด Public URL สำหรับ deep link
    $publicUrl = $db->query("SELECT `value` FROM settings WHERE `key`='app_public_url' LIMIT 1")->fetchColumn() ?: '';
    $publicUrl = rtrim($publicUrl, '/');

    // สร้างลิงค์ task
    $taskLink = $publicUrl
        ? "{$publicUrl}/#/projects/{$task['project_id']}?task={$task['id']}"
        : '';

    // ข้อความแจ้งเตือน
    $actionLabel = match($action) {
        'created'   => 'สร้างงานใหม่',
        'updated'   => 'อัปเดตงาน',
        'completed' => 'ทำงานเสร็จ',
        'assigned'  => 'มอบหมายงาน',
        default     => 'อัปเดตงาน',
    };
    $statusLabel = match($task['status'] ?? '') {
        'todo'        => 'รอดำเนินการ',
        'in_progress' => 'กำลังทำ',
        'in-progress' => 'กำลังทำ',
        'completed'   => 'เสร็จแล้ว',
        'cancelled'   => 'ยกเลิก',
        'blocked'     => 'ติดขัด',
        default       => $task['status'] ?? '',
    };

    $textMsg = "🔔 {$actionLabel}\n"
             . "งาน: {$task['title']}\n"
             . "โดย: {$actor}\n"
             . "สถานะ: {$statusLabel}";
    if (!empty($task['assignee'])) {
        $textMsg .= "\nผู้รับผิดชอบ: {$task['assignee']}";
    }
    if ($taskLink) {
        $textMsg .= "\n🔗 {$taskLink}";
    }

    $htmlMsg = '<html><body style="font-family:sans-serif;padding:20px;line-height:1.6">'
             . "<h3>🔔 {$actionLabel}</h3>"
             . "<table style='border-collapse:collapse'>"
             . "<tr><td style='padding:4px 12px 4px 0;color:#666'>งาน</td><td><strong>" . htmlspecialchars($task['title']) . "</strong></td></tr>"
             . "<tr><td style='padding:4px 12px 4px 0;color:#666'>โดย</td><td>" . htmlspecialchars($actor) . "</td></tr>"
             . "<tr><td style='padding:4px 12px 4px 0;color:#666'>สถานะ</td><td>{$statusLabel}</td></tr>";
    if (!empty($task['assignee'])) {
        $htmlMsg .= "<tr><td style='padding:4px 12px 4px 0;color:#666'>ผู้รับผิดชอบ</td><td>" . htmlspecialchars($task['assignee']) . "</td></tr>";
    }
    $htmlMsg .= '</table>';
    if ($taskLink) {
        $htmlMsg .= "<p style='margin-top:16px'><a href='" . htmlspecialchars($taskLink) . "' style='background:#6d28d9;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none'>เปิดดู Task</a></p>";
    }
    $htmlMsg .= '</body></html>';

    // โหลด token สำหรับ LINE + Telegram
    $settStmt = $db->query("SELECT `key`, `value` FROM settings WHERE `key` IN ('line_channel_access_token','telegram_bot_token')");
    $setts    = $settStmt->fetchAll(PDO::FETCH_KEY_PAIR);
    $lineToken = $setts['line_channel_access_token'] ?? '';
    $tgToken   = $setts['telegram_bot_token']        ?? '';

    // หาผู้ใช้ที่เปิด notify_task_activity
    $stmt = $db->prepare(
        "SELECT u.id, u.email, u.display_name,
                ns.line_user_id, ns.telegram_chat_id,
                ns.task_activity_via_line, ns.task_activity_via_telegram, ns.task_activity_via_email
         FROM users u
         JOIN notification_settings ns ON ns.user_id = u.id
         WHERE u.is_active = 1 AND ns.notify_task_activity = 1
           AND u.id != ?"
    );
    $stmt->execute([$task['user_id'] ?? '']);
    $recipients = $stmt->fetchAll();

    foreach ($recipients as $r) {
        // LINE
        if ($r['task_activity_via_line'] && $r['line_user_id'] && $lineToken) {
            _pushLine($lineToken, $r['line_user_id'], $textMsg);
        }
        // Telegram
        if ($r['task_activity_via_telegram'] && $r['telegram_chat_id'] && $tgToken) {
            _pushTelegram($tgToken, $r['telegram_chat_id'], $textMsg);
        }
        // Email
        if ($r['task_activity_via_email'] && $r['email']) {
            _sendEmailActivity($r['email'], $r['display_name'], "🔔 {$actionLabel}: {$task['title']}", $htmlMsg);
        }
    }
}

function _pushLine(string $token, string $to, string $text): void
{
    $payload = json_encode(['to' => $to, 'messages' => [['type' => 'text', 'text' => $text]]], JSON_UNESCAPED_UNICODE);
    $ch = curl_init('https://api.line.me/v2/bot/message/push');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json', "Authorization: Bearer $token"],
        CURLOPT_POSTFIELDS     => $payload, CURLOPT_TIMEOUT => 8,
    ]);
    curl_exec($ch);
    curl_close($ch);
}

function _pushTelegram(string $token, string $chatId, string $text): void
{
    $payload = json_encode(['chat_id' => $chatId, 'text' => $text], JSON_UNESCAPED_UNICODE);
    $ch = curl_init("https://api.telegram.org/bot{$token}/sendMessage");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => $payload, CURLOPT_TIMEOUT => 8,
    ]);
    curl_exec($ch);
    curl_close($ch);
}

function _sendEmailActivity(string $toEmail, string $toName, string $subject, string $htmlBody): void
{
    $vendorAutoload = __DIR__ . '/../vendor/autoload.php';
    if (!file_exists($vendorAutoload)) {
        @mail($toEmail, $subject, strip_tags($htmlBody), "Content-Type: text/html; charset=UTF-8\r\nFrom: FlowStack <noreply@flowstack.app>\r\n");
        return;
    }
    require_once $vendorAutoload;
    $db = getDB();
    $cfgStmt = $db->query("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'mail_%'");
    $cfg = $cfgStmt->fetchAll(PDO::FETCH_KEY_PAIR);
    try {
        $mail = new PHPMailer\PHPMailer\PHPMailer(true);
        $mail->isSMTP();
        $mail->CharSet    = 'UTF-8';
        $mail->Host       = $cfg['mail_host']         ?? 'localhost';
        $mail->SMTPAuth   = !empty($cfg['mail_username']);
        $mail->Username   = $cfg['mail_username']      ?? '';
        $mail->Password   = $cfg['mail_password']      ?? '';
        $mail->SMTPSecure = $cfg['mail_encryption']    ?? 'tls';
        $mail->Port       = (int)($cfg['mail_port']    ?? 587);
        $mail->setFrom($cfg['mail_from_address'] ?? 'noreply@flowstack.app', $cfg['mail_from_name'] ?? 'FlowStack');
        $mail->addAddress($toEmail, $toName);
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $htmlBody;
        $mail->AltBody = strip_tags($htmlBody);
        $mail->send();
    } catch (\Exception $e) {
        error_log('[notify-task] email failed: ' . $e->getMessage());
    }
}
