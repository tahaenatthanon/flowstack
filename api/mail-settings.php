<?php
// GET  /api/mail-settings.php            — อ่านค่า SMTP (password masked)
// PUT  /api/mail-settings.php            — บันทึกค่า SMTP (admin only)
// POST /api/mail-settings.php?action=test — ส่งอีเมลทดสอบ (admin only)

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/email-utils.php';
require_once __DIR__ . '/imap-client.php';
require_once __DIR__ . '/../vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailException;

$tokenData = requireAuth();
requireAdmin(getDB(), $tokenData['user_id'], $tokenData['tenant_id']);

$db     = getDB();
$method = getMethod();
$action = $_GET['action'] ?? '';

// ── GET action=line-group-info — ดึงชื่อกลุ่ม LINE ────────────────
if ($method === 'GET' && $action === 'line-group-info') {
    $groupId = trim($_GET['group_id'] ?? '');
    if (!$groupId) jsonError('กรุณาระบุ group_id', 400);
    $token = $db->query("SELECT `value` FROM settings WHERE `key`='line_channel_access_token' LIMIT 1")->fetchColumn() ?: '';
    if (!$token) jsonError('ยังไม่ได้ตั้งค่า LINE Channel Access Token', 400);
    $ch = curl_init("https://api.line.me/v2/bot/group/{$groupId}/summary");
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => ["Authorization: Bearer $token"], CURLOPT_TIMEOUT => 10]);
    $res  = curl_exec($ch);
    $info = curl_getinfo($ch);
    curl_close($ch);
    $data = json_decode($res, true) ?: [];
    if ($info['http_code'] !== 200) jsonError($data['message'] ?? 'ดึงข้อมูลกลุ่มไม่สำเร็จ', 400);
    jsonSuccess(['groupId' => $data['groupId'], 'groupName' => $data['groupName'], 'pictureUrl' => $data['pictureUrl'] ?? null]);
}

// ── GET action=telegram-chat-info — ดึงชื่อแชท Telegram ────────────
if ($method === 'GET' && $action === 'telegram-chat-info') {
    $chatId = trim($_GET['chat_id'] ?? '');
    if (!$chatId) jsonError('กรุณาระบุ chat_id', 400);
    $token = $db->query("SELECT `value` FROM settings WHERE `key`='telegram_bot_token' LIMIT 1")->fetchColumn() ?: '';
    if (!$token) jsonError('ยังไม่ได้ตั้งค่า Telegram Bot Token', 400);
    $ch = curl_init('https://api.telegram.org/bot' . $token . '/getChat?chat_id=' . urlencode($chatId));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
    $res  = curl_exec($ch);
    curl_close($ch);
    $data = json_decode($res, true) ?: [];
    if (!($data['ok'] ?? false)) jsonError($data['description'] ?? 'ดึงข้อมูลแชทไม่สำเร็จ', 400);
    $chat = $data['result'];
    jsonSuccess(['chatId' => $chat['id'], 'title' => $chat['title'] ?? ($chat['first_name'] ?? $chatId), 'type' => $chat['type'] ?? 'group']);
}

// ── GET — อ่านค่า SMTP + Line ──────────────────────────────────────
if ($method === 'GET') {
    $stmt = $db->query("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'app_%' OR `key` LIKE 'mail_%' OR `key` LIKE 'imap_%' OR `key` LIKE 'line_%' OR `key` LIKE 'telegram_%' ORDER BY `key`");
    $rows = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    // Default values (fallback)
    $defaults = [
        'imap_host'                 => '',
        'imap_port'                 => '993',
        'imap_encryption'           => 'ssl',
        'imap_user'                 => '',
        'imap_password'             => '',
        'mail_provider'             => 'custom',
        'mail_host'                 => MAIL_HOST,
        'mail_port'                 => (string) MAIL_PORT,
        'mail_encryption'           => MAIL_ENCRYPTION,
        'mail_smtp_auth'            => '1',
        'mail_username'             => MAIL_USERNAME,
        'mail_password'             => MAIL_PASSWORD,
        'mail_from_address'         => MAIL_FROM_ADDRESS,
        'mail_from_name'            => MAIL_FROM_NAME,
        'app_public_url'            => '',
        'line_channel_access_token' => '',
        'line_channel_secret'       => '',
        'line_targets'              => '[]',
        'line_discovered_groups'    => '[]',
        'telegram_bot_token'        => '',
        'telegram_targets'          => '[]',
    ];

    $result = array_merge($defaults, $rows);
    $result['line_channel_access_token_set'] = !empty($result['line_channel_access_token']);
    $result['line_channel_secret_set']       = !empty($result['line_channel_secret']);
    $result['telegram_bot_token_set']        = !empty($result['telegram_bot_token']);
    $result['line_targets']          = json_decode($result['line_targets']          ?? '[]', true) ?: [];
    $result['line_discovered_groups'] = json_decode($result['line_discovered_groups'] ?? '[]', true) ?: [];
    $result['telegram_targets']      = json_decode($result['telegram_targets']      ?? '[]', true) ?: [];
    // mask channel secret
    if (!empty($result['line_channel_secret'])) $result['line_channel_secret'] = '••••••••';
    // mask imap password (ส่งแค่ flag ว่ามีบันทึกไว้)
    $result['imap_password_set'] = !empty($result['imap_password']);
    if (!empty($result['imap_password'])) $result['imap_password'] = '••••••••';

    jsonSuccess($result);
}

// ── PUT — บันทึกค่า SMTP ─────────────────────────────────────
if ($method === 'PUT') {
    $body = getRequestBody();
    if (empty($body)) jsonError('ไม่มีข้อมูล', 400);

    $allowed = ['app_public_url', 'mail_provider', 'mail_host', 'mail_port', 'mail_encryption', 'mail_smtp_auth', 'mail_username', 'mail_password', 'mail_from_address', 'mail_from_name', 'imap_host', 'imap_port', 'imap_encryption', 'imap_user', 'imap_password', 'line_channel_access_token', 'line_channel_secret', 'telegram_bot_token'];

    $stmt = $db->prepare("INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `updated_at` = NOW()");

    foreach ($allowed as $key) {
        if (!array_key_exists($key, $body)) continue;
        $val = strval($body[$key]);
        // Skip if value is empty or still the masked placeholder
        if ($key === 'mail_password' && ($val === '' || $val === '••••••••')) continue;
        if ($key === 'imap_password' && ($val === '' || $val === '••••••••')) continue;
        if ($key === 'line_channel_secret' && ($val === '' || $val === '••••••••')) continue;
        // allow saving empty line_channel_access_token to clear it
        $stmt->execute([$key, $val]);
    }

    // Save telegram_targets separately (JSON array)
    if (array_key_exists('telegram_targets', $body)) {
        $tgTargets = is_array($body['telegram_targets']) ? $body['telegram_targets'] : (json_decode($body['telegram_targets'], true) ?: []);
        $tgClean = array_values(array_filter(array_map(function($t) {
            $id   = trim($t['id']   ?? '');
            $name = trim($t['name'] ?? '');
            $type = in_array($t['type'] ?? '', ['group','channel','user']) ? $t['type'] : 'group';
            return $id ? ['id' => $id, 'name' => $name ?: $id, 'type' => $type] : null;
        }, $tgTargets)));
        $stmt->execute(['telegram_targets', json_encode($tgClean, JSON_UNESCAPED_UNICODE)]);
    }

    // Save line_targets separately (JSON array)
    if (array_key_exists('line_targets', $body)) {
        $targets = is_array($body['line_targets']) ? $body['line_targets'] : (json_decode($body['line_targets'], true) ?: []);
        // Sanitize each target
        $clean = array_values(array_filter(array_map(function($t) {
            $id   = trim($t['id']   ?? '');
            $name = trim($t['name'] ?? '');
            $type = in_array($t['type'] ?? '', ['group','user']) ? $t['type'] : 'group';
            return $id ? ['id' => $id, 'name' => $name ?: $id, 'type' => $type] : null;
        }, $targets)));
        $stmt->execute(['line_targets', json_encode($clean, JSON_UNESCAPED_UNICODE)]);
    }

    jsonSuccess(['message' => 'บันทึกการตั้งค่าสำเร็จ']);
}

// ── POST action=test — ส่งอีเมลทดสอบ ────────────────────────
if ($method === 'POST' && $action === 'test') {
    $body    = getRequestBody();
    $toEmail = trim($body['to_email'] ?? '');
    if (empty($toEmail)) jsonError('กรุณาระบุอีเมลสำหรับทดสอบ', 400);

    // ถ้า frontend ส่ง config มาด้วยให้ใช้ค่านั้นก่อน (ไม่ต้องบันทึกก่อนทดสอบ)
    $dbCfg = getMailConfig($db);
    $cfg = [
        'host'         => trim($body['mail_host']         ?? '') ?: $dbCfg['host'],
        'port'         => (int)(trim($body['mail_port']   ?? '') ?: $dbCfg['port']),
        'encryption'   => trim($body['mail_encryption']   ?? '') ?: $dbCfg['encryption'],
        'smtp_auth'    => isset($body['mail_smtp_auth'])
                            ? ($body['mail_smtp_auth'] !== '0' && $body['mail_smtp_auth'] !== false)
                            : $dbCfg['smtp_auth'],
        'username'     => trim($body['mail_username']     ?? '') ?: $dbCfg['username'],
        'password'     => (isset($body['mail_password']) && $body['mail_password'] !== '')
                            ? $body['mail_password']
                            : $dbCfg['password'],
        'from_address' => trim($body['mail_from_address'] ?? '') ?: $dbCfg['from_address'],
        'from_name'    => trim($body['mail_from_name']    ?? '') ?: $dbCfg['from_name'],
    ];

    if (empty($cfg['host'])) {
        jsonError('กรุณากรอก SMTP Host ก่อนทดสอบ', 400);
    }
    if ($cfg['smtp_auth'] && empty($cfg['username'])) {
        jsonError('กรุณากรอก Username หรือปิด Authentication สำหรับ internal relay', 400);
    }

    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host    = $cfg['host'];
        $mail->Port    = (int) $cfg['port'];
        $mail->CharSet = 'UTF-8';

        if ($cfg['encryption'] === 'ssl') {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        } elseif ($cfg['encryption'] === 'tls') {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        } else {
            $mail->SMTPSecure  = '';
            $mail->SMTPAutoTLS = false;
        }

        $mail->SMTPAuth = $cfg['smtp_auth'];
        if ($cfg['smtp_auth']) {
            $mail->Username = $cfg['username'];
            $mail->Password = $cfg['password'];
        }
        $mail->SMTPOptions = [
            'ssl' => [
                'verify_peer'       => false,
                'verify_peer_name'  => false,
                'allow_self_signed' => true,
            ],
        ];

        $fromAddr = $cfg['from_address'] ?: $cfg['username'] ?: 'noreply@flowstack.local';
        $fromName = $cfg['from_name']    ?: 'Flowstack';

        $mail->setFrom($fromAddr, $fromName);
        $mail->addAddress($toEmail);
        $mail->Subject = '[Flowstack] ทดสอบการส่งอีเมล SMTP';
        $mail->isHTML(true);
        $mail->Body    = '
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
              <h2 style="margin:0 0 12px;color:#1e293b">✓ ทดสอบ SMTP สำเร็จ</h2>
              <p style="color:#64748b">หากคุณได้รับอีเมลนี้ แสดงว่าการตั้งค่า SMTP ของ Flowstack ถูกต้องแล้ว</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
              <p style="color:#94a3b8;font-size:12px">ส่งจาก Flowstack · ' . date('d/m/Y H:i') . '</p>
            </div>';
        $mail->AltBody = 'ทดสอบ SMTP สำเร็จ — หากได้รับอีเมลนี้แสดงว่าตั้งค่าถูกต้องแล้ว';
        $mail->send();

        jsonSuccess(['message' => "ส่งอีเมลทดสอบไปที่ {$toEmail} สำเร็จ ✓"]);
    } catch (MailException $e) {
        jsonError('ส่งไม่สำเร็จ: ' . $mail->ErrorInfo, 500);
    }
}

// ── POST action=test-line — ทดสอบส่ง Line ไปทุก target ────────────────────────
if ($method === 'POST' && $action === 'test-line') {
    $body    = getRequestBody();
    $testId  = trim($body['target_id'] ?? ''); // optional: ทดสอบ target เดียว

    $stmt = $db->query("SELECT `key`, `value` FROM settings WHERE `key` IN ('line_channel_access_token','line_targets')");
    $rows = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
    $token   = $rows['line_channel_access_token'] ?? '';
    $targets = json_decode($rows['line_targets'] ?? '[]', true) ?: [];

    if (!$token)          jsonError('ยังไม่ได้ตั้งค่า LINE Channel Access Token', 400);
    if (empty($targets))  jsonError('ยังไม่มีรายชื่อ Target — กรุณาเพิ่มและบันทึกก่อนทดสอบ', 400);

    $results     = [];
    $sendTargets = $testId ? array_filter($targets, fn($t) => $t['id'] === $testId) : $targets;
    if (empty($sendTargets)) {
        jsonError($testId ? "ไม่พบ target ID: {$testId} — กรุณาบันทึก target ก่อนทดสอบ" : 'ไม่มี target ที่ตรงกัน', 400);
    }
    foreach ($sendTargets as $t) {
        $payload = json_encode([
            'to'       => $t['id'],
            'messages' => [['type' => 'text', 'text' => "✅ ทดสอบการแจ้งเตือน Flowstack → {$t['name']} สำเร็จ!"]],
        ], JSON_UNESCAPED_UNICODE);
        $ch = curl_init('https://api.line.me/v2/bot/message/push');
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_HTTPHEADER => ['Content-Type: application/json', "Authorization: Bearer $token"], CURLOPT_POSTFIELDS => $payload, CURLOPT_TIMEOUT => 15]);
        $res  = curl_exec($ch);
        $info = curl_getinfo($ch);
        curl_close($ch);
        $resp = json_decode($res, true) ?: [];
        $ok   = ($info['http_code'] === 200 && empty($resp['message']));
        $results[] = ['name' => $t['name'], 'id' => $t['id'], 'ok' => $ok, 'error' => $resp['message'] ?? null];
    }

    $allOk = !empty($results) && count(array_filter($results, fn($r) => !$r['ok'])) === 0;
    $sent  = count(array_filter($results, fn($r) => $r['ok']));
    if ($allOk) {
        jsonSuccess(['message' => "ส่งสำเร็จทุก target ({$sent} รายการ) ✓", 'results' => $results]);
    } else {
        $failed = array_filter($results, fn($r) => !$r['ok']);
        $errors = implode(', ', array_column(array_values($failed), 'name'));
        jsonSuccess(['ok' => false, 'message' => "ส่งไม่สำเร็จบางรายการ: {$errors}", 'results' => $results]);
    }
}

// ── POST action=test-telegram — ทดสอบส่ง Telegram ────────────────
if ($method === 'POST' && $action === 'test-telegram') {
    $body    = getRequestBody();
    $testId  = trim($body['target_id'] ?? '');

    $stmt = $db->query("SELECT `key`, `value` FROM settings WHERE `key` IN ('telegram_bot_token','telegram_targets')");
    $rows = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
    $token   = $rows['telegram_bot_token'] ?? '';
    $targets = json_decode($rows['telegram_targets'] ?? '[]', true) ?: [];

    if (!$token)         jsonError('ยังไม่ได้ตั้งค่า Telegram Bot Token', 400);
    if (empty($targets)) jsonError('ยังไม่มีรายชื่อ Target — กรุณาเพิ่ม Group หรือ Channel ก่อน', 400);

    $results = [];
    $sendTargets = $testId ? array_filter($targets, fn($t) => $t['id'] === $testId) : $targets;
    foreach ($sendTargets as $t) {
        $url     = "https://api.telegram.org/bot{$token}/sendMessage";
        $payload = json_encode(['chat_id' => $t['id'], 'text' => "✅ ทดสอบการแจ้งเตือน Flowstack → {$t['name']} สำเร็จ!", 'parse_mode' => 'Markdown'], JSON_UNESCAPED_UNICODE);
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_HTTPHEADER => ['Content-Type: application/json'], CURLOPT_POSTFIELDS => $payload, CURLOPT_TIMEOUT => 15]);
        $res  = curl_exec($ch);
        $info = curl_getinfo($ch);
        curl_close($ch);
        $resp = json_decode($res, true) ?: [];
        $ok   = ($resp['ok'] ?? false) === true;
        $results[] = ['name' => $t['name'], 'id' => $t['id'], 'ok' => $ok, 'error' => $resp['description'] ?? null];
    }

    $allOk = !empty($results) && count(array_filter($results, fn($r) => !$r['ok'])) === 0;
    $sent  = count(array_filter($results, fn($r) => $r['ok']));
    if ($allOk) {
        jsonSuccess(['message' => "ส่งสำเร็จทุก target ({$sent} รายการ) ✓", 'results' => $results]);
    } else {
        $failed = array_filter($results, fn($r) => !$r['ok']);
        $errors = implode(', ', array_column(array_values($failed), 'name'));
        jsonSuccess(['ok' => false, 'message' => "ส่งไม่สำเร็จบางรายการ: {$errors}", 'results' => $results]);
    }
}

// ── POST action=test-imap — ทดสอบเชื่อมต่อ IMAP (raw socket ไม่ใช้ extension) ──
if ($method === 'POST' && $action === 'test-imap') {
    $body = getRequestBody();

    // ใช้ค่าจาก body ถ้าส่งมา ไม่งั้น fallback ไปค่าใน DB
    $rows = $db->query("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'imap_%'")->fetchAll(PDO::FETCH_KEY_PAIR);
    $host = trim($body['imap_host'] ?? '') ?: ($rows['imap_host'] ?? '');
    $port = (int)(trim((string)($body['imap_port'] ?? '')) ?: ($rows['imap_port'] ?? 993));
    $enc  = trim($body['imap_encryption'] ?? '') ?: ($rows['imap_encryption'] ?? 'ssl');
    $user = trim($body['imap_user'] ?? '') ?: ($rows['imap_user'] ?? '');
    $pass = (isset($body['imap_password']) && $body['imap_password'] !== '' && $body['imap_password'] !== '••••••••')
              ? $body['imap_password']
              : ($rows['imap_password'] ?? '');

    if ($host === '' || $user === '' || $pass === '') {
        jsonError('กรุณากรอก Host / User / Password ของ IMAP ก่อนทดสอบ', 400);
    }
    if (!function_exists('stream_socket_client')) {
        jsonError('เซิร์ฟเวอร์ไม่รองรับ socket — ติดต่อผู้ดูแลระบบ', 501);
    }

    try {
        $imap = new SocketImapClient($host, $port, $enc);
        $imap->login($user, $pass);
        $imap->select('INBOX');
        $count = count($imap->searchAll());
        $imap->logout();
        jsonSuccess(['message' => "เชื่อมต่อ IMAP สำเร็จ ✓ พบอีเมลในกล่อง INBOX {$count} ฉบับ"]);
    } catch (Exception $e) {
        jsonError('เชื่อมต่อ IMAP ไม่สำเร็จ: ' . $e->getMessage(), 502);
    }
}

jsonError('Method not allowed', 405);

// ── Helper: อ่าน config จาก DB (fallback ไป .env constants) ──
function getMailConfig(PDO $db): array {
    $stmt = $db->query("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'mail_%'");
    $rows = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    return [
        'host'         => $rows['mail_host']         ?? MAIL_HOST,
        'port'         => $rows['mail_port']         ?? MAIL_PORT,
        'encryption'   => $rows['mail_encryption']   ?? MAIL_ENCRYPTION,
        'smtp_auth'    => ($rows['mail_smtp_auth']   ?? '1') !== '0',
        'username'     => $rows['mail_username']     ?? MAIL_USERNAME,
        'password'     => $rows['mail_password']     ?? MAIL_PASSWORD,
        'from_address' => $rows['mail_from_address'] ?? MAIL_FROM_ADDRESS,
        'from_name'    => $rows['mail_from_name']    ?? MAIL_FROM_NAME,
    ];
}
