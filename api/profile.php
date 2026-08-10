<?php
// GET  /api/profile.php                        - get current user's profile
// PUT  /api/profile.php                        - update display_name, position
// POST /api/profile.php (action=change_password) - change own password
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db = getDB();

function rewriteAvatarUrl(?string $raw): ?string {
    if (!$raw) return $raw;
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];
    if (str_starts_with($raw, 'http://') || str_starts_with($raw, 'https://')) {
        return $protocol . '://' . $host . parse_url($raw, PHP_URL_PATH);
    }
    return $protocol . '://' . $host . $raw;
}

function fetchProfile(PDO $db, string $userId): array {
    $stmt = $db->prepare('
        SELECT u.id, u.email, u.display_name, u.position, u.avatar_url,
               u.is_admin, u.is_active, u.role_id, r.label AS role_label, u.created_at
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.id = ?
    ');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    if (!$user) jsonError('ไม่พบผู้ใช้', 404);
    $user['avatar_url'] = rewriteAvatarUrl($user['avatar_url']);
    return $user;
}

// Audit-log every profile request (GET or POST) — intentional mutation, not a side effect
function logActivity(PDO $db, string $userId, string $action, string $description): void {
    try {
        $ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
        $stmt = $db->prepare('INSERT INTO user_activity_logs (id, user_id, action, description, ip_address, user_agent, created_at) VALUES (UUID(), ?, ?, ?, ?, ?, NOW())');
        $stmt->execute([$userId, $action, $description, $ipAddress, $userAgent]);
    } catch (Exception $e) {
        // Table doesn't exist yet, ignore
    }
}

$method = getMethod();

if ($method === 'GET') {
    // notification settings sub-resource
    if (($_GET['action'] ?? '') === 'notification_settings') {
        $stmt = $db->prepare("SELECT * FROM notification_settings WHERE user_id = ?");
        $stmt->execute([$userId]);
        $settings = $stmt->fetch();
        if (!$settings) {
            $settings = [
                'user_id'             => $userId,
                'line_user_id'        => null,
                'telegram_chat_id'    => null,
                'briefing_time'       => '08:00:00',
                'notify_line'         => 0,
                'notify_telegram'     => 0,
                'notify_email'        => 1,
                'notify_tasks_due'          => 1,
                'notify_tasks_overdue'      => 1,
                'notify_calendar'           => 1,
                'notify_tomorrow'           => 1,
                'notify_assigned'           => 1,
                'notify_sla'               => 1,
                'notify_task_activity'      => 0,
                'task_activity_via_line'    => 1,
                'task_activity_via_telegram'=> 1,
                'task_activity_via_email'   => 0,
            ];
        }
        jsonResponse($settings);
    }

    jsonResponse(fetchProfile($db, $userId));
}

if ($method === 'PUT') {
    $body = getRequestBody();

    // notification settings sub-resource
    if (($body['action'] ?? '') === 'notification_settings') {
        $db->prepare(
            "INSERT INTO notification_settings
             (user_id, line_user_id, telegram_chat_id, briefing_time,
              notify_line, notify_telegram, notify_email,
              notify_tasks_due, notify_tasks_overdue, notify_calendar, notify_tomorrow, notify_assigned, notify_sla,
              notify_task_activity, task_activity_via_line, task_activity_via_telegram, task_activity_via_email)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               line_user_id               = VALUES(line_user_id),
               telegram_chat_id           = VALUES(telegram_chat_id),
               briefing_time              = VALUES(briefing_time),
               notify_line                = VALUES(notify_line),
               notify_telegram            = VALUES(notify_telegram),
               notify_email               = VALUES(notify_email),
               notify_tasks_due           = VALUES(notify_tasks_due),
               notify_tasks_overdue       = VALUES(notify_tasks_overdue),
               notify_calendar            = VALUES(notify_calendar),
               notify_tomorrow            = VALUES(notify_tomorrow),
               notify_assigned            = VALUES(notify_assigned),
               notify_sla                 = VALUES(notify_sla),
               notify_task_activity       = VALUES(notify_task_activity),
               task_activity_via_line     = VALUES(task_activity_via_line),
               task_activity_via_telegram = VALUES(task_activity_via_telegram),
               task_activity_via_email    = VALUES(task_activity_via_email)"
        )->execute([
            $userId,
            $body['line_user_id']     ?? null,
            $body['telegram_chat_id'] ?? null,
            $body['briefing_time']    ?? '08:00:00',
            (int)($body['notify_line']                ?? 0),
            (int)($body['notify_telegram']             ?? 0),
            (int)($body['notify_email']                ?? 1),
            (int)($body['notify_tasks_due']            ?? 1),
            (int)($body['notify_tasks_overdue']        ?? 1),
            (int)($body['notify_calendar']             ?? 1),
            (int)($body['notify_tomorrow']             ?? 1),
            (int)($body['notify_assigned']             ?? 1),
            (int)($body['notify_sla']                  ?? 1),
            (int)($body['notify_task_activity']        ?? 0),
            (int)($body['task_activity_via_line']      ?? 1),
            (int)($body['task_activity_via_telegram']  ?? 1),
            (int)($body['task_activity_via_email']     ?? 0),
        ]);
        jsonResponse(['saved' => true]);
    }

    $displayName = trim($body['display_name'] ?? '');
    $position    = trim($body['position'] ?? '');

    if ($displayName === '') {
        jsonError('กรุณากรอกชื่อแสดงผล', 400);
    }

    // Get old values for logging
    $oldStmt = $db->prepare('SELECT display_name, position FROM users WHERE id = ?');
    $oldStmt->execute([$userId]);
    $oldData = $oldStmt->fetch();

    $stmt = $db->prepare('UPDATE users SET display_name = ?, position = ? WHERE id = ?');
    $stmt->execute([$displayName, $position, $userId]);

    // Log profile update activity
    $changes = [];
    if ($oldData['display_name'] !== $displayName) {
        $changes[] = 'ชื่อ: ' . $oldData['display_name'] . ' → ' . $displayName;
    }
    if ($oldData['position'] !== $position) {
        $changes[] = 'ตำแหน่ง: ' . ($oldData['position'] ?: '-') . ' → ' . ($position ?: '-');
    }
    if (!empty($changes)) {
        logActivity($db, $userId, 'profile_update', 'แก้ไขโปรไฟล์: ' . implode(', ', $changes));
    }

    jsonResponse(fetchProfile($db, $userId));
}

if ($method === 'POST') {
    $body   = getRequestBody();
    $action = $body['action'] ?? '';

    if ($action === 'change_password') {
        $currentPassword = $body['current_password'] ?? '';
        $newPassword     = $body['new_password'] ?? '';

        if (strlen($newPassword) < 6) {
            jsonError('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร', 400);
        }

        // Verify current password
        $stmt = $db->prepare('SELECT password_hash FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $row = $stmt->fetch();

        if (!$row || !password_verify($currentPassword, $row['password_hash'])) {
            jsonError('รหัสผ่านปัจจุบันไม่ถูกต้อง', 400);
        }

        $db->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
           ->execute([password_hash($newPassword, PASSWORD_DEFAULT), $userId]);

        // Log password change activity
        logActivity($db, $userId, 'profile_update', 'เปลี่ยนรหัสผ่าน');

        jsonResponse(['updated' => true]);
    }

    jsonError('Unknown action', 400);
}

jsonError('Method not allowed', 405);
