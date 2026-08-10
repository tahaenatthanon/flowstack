<?php
// POST /api/report-email.php — Send project report via email (SMTP)

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/../vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailException;

$db = getDB();
requireAuth();

if (getMethod() !== 'POST') {
    jsonError('Method not allowed', 405);
}

$body = json_decode(file_get_contents('php://input'), true);
if (!$body) {
    jsonError('Invalid JSON body', 400);
}

$to       = trim($body['to']       ?? '');
$subject  = trim($body['subject']  ?? '');
$htmlBody = $body['html_body']     ?? '';
$note     = trim($body['note']     ?? '');

if (!$to || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
    jsonError('อีเมลปลายทางไม่ถูกต้อง', 400);
}
if (!$subject) {
    jsonError('กรุณาระบุหัวข้ออีเมล', 400);
}

// Append note to body if provided
if ($note !== '') {
    $htmlBody .= '<hr style="margin:24px 0"><p style="color:#666;font-size:13px;">' . nl2br(htmlspecialchars($note)) . '</p>';
}

// Load SMTP config from DB settings (falls back to .env constants)
$smtpStmt = $db->query("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'mail_%'");
$smtpRows = $smtpStmt->fetchAll(PDO::FETCH_KEY_PAIR);

$config = [
    'host'         => $smtpRows['mail_host']         ?? MAIL_HOST,
    'port'         => (int)($smtpRows['mail_port']   ?? MAIL_PORT),
    'encryption'   => $smtpRows['mail_encryption']   ?? MAIL_ENCRYPTION,
    'smtp_auth'    => ($smtpRows['mail_smtp_auth']   ?? '1') !== '0',
    'username'     => $smtpRows['mail_username']     ?? MAIL_USERNAME,
    'password'     => $smtpRows['mail_password']     ?? MAIL_PASSWORD,
    'from_address' => $smtpRows['mail_from_address'] ?? MAIL_FROM_ADDRESS,
    'from_name'    => $smtpRows['mail_from_name']    ?? MAIL_FROM_NAME,
];

if (empty($config['host'])) {
    jsonError('SMTP ยังไม่ได้ตั้งค่า กรุณาไปที่ Admin → ตั้งค่า SMTP', 500);
}

if ($config['smtp_auth'] && (empty($config['username']) || empty($config['password']))) {
    jsonError('กรุณากรอก Username และ Password หรือปิด Authentication สำหรับ internal relay', 500);
}

try {
    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host       = $config['host'];
    $mail->Port       = $config['port'];
    $mail->CharSet    = 'UTF-8';
    $mail->SMTPAuth   = $config['smtp_auth'];

    if ($config['smtp_auth']) {
        $mail->Username = $config['username'];
        $mail->Password = $config['password'];
    }

    if ($config['encryption'] === 'ssl') {
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    } elseif ($config['encryption'] === 'tls') {
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    } else {
        $mail->SMTPSecure  = '';
        $mail->SMTPAutoTLS = false;
    }

    $allowSelfSigned = ($smtpRows['mail_allow_self_signed'] ?? '0') === '1';
    if ($allowSelfSigned) {
        $mail->SMTPOptions = [
            'ssl' => [
                'verify_peer'       => false,
                'verify_peer_name'  => false,
                'allow_self_signed' => true,
            ],
        ];
    }

    $fromAddr = $config['from_address'] ?: $config['username'] ?: 'noreply@flowstack.local';
    $fromName = $config['from_name'] ?: 'FlowStack';

    $mail->setFrom($fromAddr, $fromName);
    $mail->addAddress($to);
    $mail->isHTML(true);
    $mail->Subject = $subject;
    $mail->Body    = $htmlBody;
    $mail->send();

    jsonResponse(['ok' => true, 'method' => 'smtp']);
} catch (MailException $e) {
    jsonError('ส่งอีเมลไม่สำเร็จ: ' . $mail->ErrorInfo, 500);
}
