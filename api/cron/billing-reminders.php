<?php
/**
 * Billing Reminders Cron
 * Run via: php api/cron/billing-reminders.php
 * XAMPP Windows Task Scheduler: php C:\xampp\htdocs\flowstack\api\cron\billing-reminders.php
 * Linux cron: 0 9 * * * php /var/www/html/flowstack/api/cron/billing-reminders.php
 *
 * Checks expiring subscriptions daily and sends email reminders to tenant admins.
 * - Marks subscriptions as expired when expires_at < NOW()
 * - Sends reminders 7 days and 1 day before expiry
 * - Notifies admins when subscription expires today
 */

if (!defined('CRON_MODE')) define('CRON_MODE', true);
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

$db = getDB();

echo date('[Y-m-d H:i:s]') . " Starting billing reminders check...\n";

// 1. Mark subscriptions as expired
$expireStmt = $db->query("
    UPDATE subscriptions SET status='expired', updated_at=NOW()
    WHERE expires_at IS NOT NULL AND expires_at < NOW() AND status='active'
");
$expiredCount = $expireStmt->rowCount();
echo date('[Y-m-d H:i:s]') . " Marked {$expiredCount} subscriptions as expired.\n";

// 2. Send reminders: 7 days and 1 day before expiry
foreach ([7, 1] as $days) {
    $stmt = $db->prepare("
        SELECT
            s.id AS subscription_id,
            s.tenant_id,
            s.plan,
            s.expires_at,
            t.name AS tenant_name,
            GROUP_CONCAT(DISTINCT u.email SEPARATOR ',') AS admin_emails,
            GROUP_CONCAT(DISTINCT u.display_name SEPARATOR ',') AS admin_names
        FROM subscriptions s
        JOIN tenants t ON t.id = s.tenant_id
        JOIN tenant_users tu ON tu.tenant_id = t.id AND tu.is_admin = 1
        JOIN users u ON u.id = tu.user_id AND u.is_active = 1
        WHERE s.status = 'active'
          AND s.expires_at IS NOT NULL
          AND DATE(s.expires_at) = DATE_ADD(CURDATE(), INTERVAL ? DAY)
        GROUP BY s.id, s.tenant_id, s.plan, s.expires_at, t.name
    ");
    $stmt->execute([$days]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($rows as $row) {
        $emails = explode(',', $row['admin_emails']);
        $names = explode(',', $row['admin_names']);

        foreach ($emails as $idx => $email) {
            $email = trim($email);
            $name = isset($names[$idx]) ? trim($names[$idx]) : 'Administrator';

            $subject = "Flowstack — แผนของคุณจะหมดอายุใน {$days} วัน";
            $body = "สวัสดีคุณ {$name},\n\n"
                  . "แผน {$row['plan']} ของ {$row['tenant_name']} จะหมดอายุในวันที่ "
                  . date('d/m/Y', strtotime($row['expires_at'])) . "\n\n"
                  . "กรุณาเข้าสู่ระบบและชำระเงินที่ /billing\n\n"
                  . "ขอบคุณที่ใช้บริการ Flowstack";

            if (sendReminderEmail($email, $subject, $body)) {
                echo date('[Y-m-d H:i:s]') . " Sent {$days}-day reminder to {$email}\n";
            }
        }
    }
}

// 3. Notify tenants that expired today
$expiredTodayStmt = $db->prepare("
    SELECT
        s.id AS subscription_id,
        s.tenant_id,
        s.plan,
        s.expires_at,
        t.name AS tenant_name,
        GROUP_CONCAT(DISTINCT u.email SEPARATOR ',') AS admin_emails,
        GROUP_CONCAT(DISTINCT u.display_name SEPARATOR ',') AS admin_names
    FROM subscriptions s
    JOIN tenants t ON t.id = s.tenant_id
    JOIN tenant_users tu ON tu.tenant_id = t.id AND tu.is_admin = 1
    JOIN users u ON u.id = tu.user_id AND u.is_active = 1
    WHERE s.status = 'expired'
      AND s.expires_at IS NOT NULL
      AND DATE(s.expires_at) = CURDATE()
    GROUP BY s.id, s.tenant_id, s.plan, s.expires_at, t.name
");
$expiredTodayStmt->execute();
$expiredToday = $expiredTodayStmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($expiredToday as $row) {
    $emails = explode(',', $row['admin_emails']);
    $names = explode(',', $row['admin_names']);

    foreach ($emails as $idx => $email) {
        $email = trim($email);
        $name = isset($names[$idx]) ? trim($names[$idx]) : 'Administrator';

        $subject = "Flowstack — แผนของคุณหมดอายุแล้ว";
        $body = "สวัสดีคุณ {$name},\n\n"
              . "แผน {$row['plan']} ของ {$row['tenant_name']} หมดอายุแล้ว\n\n"
              . "กรุณาชำระเงินที่ /billing เพื่อใช้งานต่อ\n\n"
              . "ขอบคุณที่ใช้บริการ Flowstack";

        if (sendReminderEmail($email, $subject, $body)) {
            echo date('[Y-m-d H:i:s]') . " Sent expiry notice to {$email}\n";
        }
    }
}

echo date('[Y-m-d H:i:s]') . " Billing reminders check completed.\n";

/**
 * Send a reminder email via SMTP.
 * Returns true if email was sent successfully, false otherwise.
 */
function sendReminderEmail(string $to, string $subject, string $body): bool {
    global $db;

    // Check if SMTP is configured
    if (empty(MAIL_FROM_ADDRESS)) {
        return false;
    }

    // Try to load PHPMailer
    if (!class_exists('\PHPMailer\PHPMailer\PHPMailer')) {
        $autoload = __DIR__ . '/../../vendor/autoload.php';
        if (!file_exists($autoload)) {
            return false;
        }
        require_once $autoload;
    }

    try {
        $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = MAIL_HOST;
        $mail->SMTPAuth = true;
        $mail->Username = MAIL_USERNAME;
        $mail->Password = MAIL_PASSWORD;
        $mail->SMTPSecure = MAIL_ENCRYPTION;
        $mail->Port = MAIL_PORT;
        $mail->CharSet = 'UTF-8';
        $mail->setFrom(MAIL_FROM_ADDRESS, MAIL_FROM_NAME);
        $mail->addAddress($to);
        $mail->Subject = $subject;
        $mail->Body = $body;
        $mail->isHTML(false);
        $mail->send();
        return true;
    } catch (\Exception $e) {
        error_log('[billing-reminders] Mail error to ' . $to . ': ' . $e->getMessage());
        return false;
    }
}
