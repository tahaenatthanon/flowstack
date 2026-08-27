<?php
/**
 * api/lib/ops-alert.php
 * ตัวแจ้งเตือนความล้มเหลวระดับปฏิบัติการ (ops alert)
 * spec: openspec/specs/ops-failure-alerting
 *
 * ข้อบังคับ 4 ข้อของไฟล์นี้ — ห้ามละเมิดเวลาแก้:
 *
 *  1) ห้ามโยน exception ออกไปหาผู้เรียก จุดเรียกทุกจุดอยู่ในเส้นทางที่กำลังจัดการ
 *     ความล้มเหลวอยู่แล้ว ถ้าตัวแจ้งเตือนล้มพร้อมกันจะกลบข้อมูลความล้มเหลวต้นทาง
 *     ความล้มเหลวภายในรายงานผ่าน error_log() เท่านั้น
 *
 *  2) ชื่อ global ทุกตัว (ฟังก์ชัน + ค่าคงที่) ขึ้นต้นด้วย `ops_` / `OPS_`
 *     ไฟล์งาน cron แบบ type='include' ถูก include เข้าโปรเซสเดียวกันทั้งหมด
 *     ชื่อ global ที่ซ้ำกันทำให้ PHP fatal "Cannot redeclare" ซึ่ง try/catch ดักไม่ได้
 *     และฆ่า tick ทั้งรอบ
 *
 *  3) ไฟล์นี้ไม่พิมพ์อะไรออก stdout เลย — api/lib/cron-runner.php อ่านจำนวนที่ประมวลผล
 *     และจำนวน error จาก output ของงานด้วย preg_match('/(\d+)\s+entries/i') และ
 *     preg_match('/(\d+)\s+error/i') แบบ match แรกชนะ ข้อความจากตัวแจ้งเตือนที่มี
 *     รูปแบบ "<เลข> error" จะทำให้ cron_runs นับผิด รายงานทั้งหมดจึงออกทาง error_log()
 *
 *  4) เวลาทุกค่ามาจากฐานข้อมูล (NOW() / TIMESTAMPDIFF) ห้ามใช้ time()/date() ของ PHP
 *     ตามข้อกำหนดเรื่องนาฬิกาของเส้นทาง cron
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../notification-utils.php';

/** เพดานการแจ้งซ้ำของ alert_key เดียวกัน (นาที) — จุดเดียวที่กำหนดค่านี้ */
if (!defined('OPS_ALERT_RATE_LIMIT_MINUTES')) {
    define('OPS_ALERT_RATE_LIMIT_MINUTES', 60);
}

/** settings key ที่เก็บปลายทาง LINE ของ ops alert — ไม่ใช่ key `line_targets` เดิม */
if (!defined('OPS_ALERT_LINE_TARGETS_KEY')) {
    define('OPS_ALERT_LINE_TARGETS_KEY', 'ops_alert_line_targets');
}

/**
 * ส่งแจ้งเตือนความล้มเหลวหนึ่งเรื่อง
 *
 * @param PDO         $db
 * @param string|null $tenantId  tenant ของทรัพยากรที่ล้มเหลว — null = ความล้มเหลวระดับงาน
 *                               ให้หา tenant จากข้อมูลจริงเอง (ops_alert_tenants_with_active_channels)
 * @param string      $key       alert_key ที่อธิบาย "เรื่อง" ไม่ใช่เหตุการณ์ครั้งเดียว
 *                               เช่น cron_fail:publish-scheduler, publish_auth:facebook
 * @param string      $title     หัวเรื่อง (ภาษาไทย) — ถูกตัดที่ 255 ตัวอักษรตามคอลัมน์
 * @param string      $body      เนื้อหา (ภาษาไทย)
 * @param bool        $urgent    true = ส่งอีเมลเพิ่มจากแจ้งเตือนในแอป
 */
function ops_alert(PDO $db, ?string $tenantId, string $key, string $title, string $body, bool $urgent = false): void
{
    try {
        $anyDelivered = false;

        foreach (ops_alert_target_tenants($db, $tenantId) as $tid) {
            $rowId = ops_alert_claim($db, $tid, $key);
            if ($rowId === null) {
                // ติดเพดาน 1 ครั้ง/ชั่วโมง — ไม่แตะ send_count / last_sent_at
                error_log("[ops-alert] suppressed by rate limit: key={$key} tenant={$tid}");
                continue;
            }

            $recipients = ops_alert_recipients($db, $tid);
            if (!$recipients) {
                // ไม่มีแอดมิน = ไม่มีใครรับ ไม่นับว่าส่งแล้ว รอบหน้าจะลองอีกครั้ง
                error_log("[ops-alert] no active admin for tenant={$tid} key={$key}");
                continue;
            }

            $sent = ops_alert_deliver($db, $tid, $recipients, $title, $body, $urgent);
            if ($sent > 0) {
                ops_alert_mark_sent($db, $rowId);
                $anyDelivered = true;
            }
        }

        // LINE ส่งครั้งเดียวต่อการแจ้งหนึ่งเรื่อง ไม่ใช่ต่อ tenant
        // (ปลายทาง LINE เก็บใน settings แถวเดียวที่ tenant_id เป็น NULL = ปลายทางร่วม)
        if ($anyDelivered) {
            ops_alert_push_line_targets($db, $title, $body);
        }
    } catch (Throwable $e) {
        error_log('[ops-alert] ops_alert failed: ' . $e->getMessage());
    }
}

/**
 * ปิดเรื่องที่เคยแจ้งไปแล้วและบอกว่ากลับมาปกติ (ส่งครั้งเดียว)
 * ไม่มีแถวที่ยังเปิดอยู่ = ไม่เคยแจ้งเรื่องนี้ = ไม่ต้องส่งอะไรเลย
 */
function ops_alert_resolve(PDO $db, ?string $tenantId, string $key, string $title, string $body): void
{
    try {
        foreach (ops_alert_target_tenants($db, $tenantId) as $tid) {
            $stmt = $db->prepare(
                "SELECT id, send_count
                   FROM ops_alerts
                  WHERE alert_key = ? AND tenant_id = ? AND resolved_at IS NULL
                  LIMIT 1"
            );
            $stmt->execute([$key, $tid]);
            $row = $stmt->fetch();
            if (!$row) {
                continue;
            }

            $db->prepare("UPDATE ops_alerts SET resolved_at = NOW() WHERE id = ?")->execute([$row['id']]);

            if ((int) $row['send_count'] < 1) {
                // มีแถวแต่ยังไม่เคยส่งถึงใครจริง (เช่นไม่มีแอดมินในตอนนั้น)
                // ปิดเรื่องเงียบ ๆ การบอกว่า "กลับมาปกติ" ในเรื่องที่ไม่มีใครเคยได้ยินจะสร้างความสับสน
                error_log("[ops-alert] resolved without notice (never delivered): key={$key} tenant={$tid}");
                continue;
            }

            $recipients = ops_alert_recipients($db, $tid);
            if ($recipients) {
                ops_alert_deliver($db, $tid, $recipients, $title, $body, false);
            }
        }
    } catch (Throwable $e) {
        error_log('[ops-alert] ops_alert_resolve failed: ' . $e->getMessage());
    }
}

/**
 * ผู้รับ = แอดมินของ tenant นั้น
 * แหล่งความจริงของสิทธิ์แอดมินคือ tenant_users.is_admin (ตามที่ requireAuth()/requireAdmin() ใช้)
 * ไม่ใช่ users.is_admin และตาราง users ไม่มีคอลัมน์ tenant_id
 * ห้าม join notification_settings — แอดมินส่วนใหญ่ไม่มีแถวในตารางนั้น
 * การอิงตารางนั้นจะทำให้แจ้งเตือนถึงคนเดียวโดยดูเหมือนทำงานปกติ
 */
function ops_alert_recipients(PDO $db, string $tenantId): array
{
    $stmt = $db->prepare(
        "SELECT tu.user_id, tu.tenant_id, u.email, u.display_name
           FROM tenant_users tu
           JOIN users u ON u.id = tu.user_id
          WHERE tu.is_admin = 1
            AND u.is_active = 1
            AND tu.tenant_id = ?"
    );
    $stmt->execute([$tenantId]);
    return $stmt->fetchAll();
}

/**
 * tenant ที่มีช่องทางเผยแพร่เปิดใช้อยู่อย่างน้อยหนึ่งช่องทาง
 * ใช้เมื่อความล้มเหลวไม่มี tenant ให้อ้าง (ความล้มเหลวระดับงาน cron)
 * หาจากข้อมูลจริงเสมอ ห้ามฝัง tenant id ไว้ในโค้ด
 */
function ops_alert_tenants_with_active_channels(PDO $db): array
{
    $rows = $db->query(
        "SELECT DISTINCT tenant_id
           FROM publish_channels
          WHERE is_active = 1
            AND tenant_id IS NOT NULL
            AND tenant_id <> ''"
    )->fetchAll(PDO::FETCH_COLUMN);

    return array_map('strval', $rows ?: []);
}

/** แปลง tenant ที่ผู้เรียกระบุ (หรือไม่ระบุ) ให้เป็นรายการ tenant ที่ต้องแจ้ง */
function ops_alert_target_tenants(PDO $db, ?string $tenantId): array
{
    if ($tenantId !== null && $tenantId !== '') {
        return [$tenantId];
    }
    return ops_alert_tenants_with_active_channels($db);
}

/**
 * จองสิทธิ์ส่งของ (alert_key, tenant_id) หนึ่งคู่
 *
 * @return string|null id ของแถว ops_alerts เมื่อส่งได้ / null เมื่อติดเพดาน
 */
function ops_alert_claim(PDO $db, string $tenantId, string $key): ?string
{
    $sel = $db->prepare(
        "SELECT id, resolved_at,
                CASE WHEN last_sent_at IS NULL THEN NULL
                     ELSE TIMESTAMPDIFF(MINUTE, last_sent_at, NOW())
                END AS minutes_since_sent
           FROM ops_alerts
          WHERE alert_key = ? AND tenant_id = ?
          LIMIT 1"
    );
    $sel->execute([$key, $tenantId]);
    $row = $sel->fetch();

    if (!$row) {
        // เรื่องใหม่ — ON DUPLICATE KEY กัน race กับอีกโปรเซสที่ insert คู่เดียวกันพร้อมกัน
        $db->prepare(
            "INSERT INTO ops_alerts (id, alert_key, tenant_id, first_seen_at, last_sent_at, send_count, resolved_at)
             VALUES (?, ?, ?, NOW(), NULL, 0, NULL)
             ON DUPLICATE KEY UPDATE id = id"
        )->execute([generateUUID(), $key, $tenantId]);

        $sel->execute([$key, $tenantId]);
        $row = $sel->fetch();
        if (!$row) {
            error_log("[ops-alert] cannot read back ops_alerts row: key={$key} tenant={$tenantId}");
            return null;
        }
        return (string) $row['id'];
    }

    if ($row['resolved_at'] !== null) {
        // เรื่องที่ปิดแล้วกลับมาล้มอีก = รอบใหม่ ส่งทันทีโดยไม่ติดเพดานของรอบก่อน
        $db->prepare("UPDATE ops_alerts SET resolved_at = NULL, first_seen_at = NOW() WHERE id = ?")
           ->execute([$row['id']]);
        return (string) $row['id'];
    }

    $mins = $row['minutes_since_sent'];
    if ($mins !== null && (int) $mins < OPS_ALERT_RATE_LIMIT_MINUTES) {
        return null;
    }

    return (string) $row['id'];
}

/** นับและลงเวลาเฉพาะครั้งที่ส่งถึงผู้รับได้จริง */
function ops_alert_mark_sent(PDO $db, string $rowId): void
{
    $db->prepare("UPDATE ops_alerts SET last_sent_at = NOW(), send_count = send_count + 1 WHERE id = ?")
       ->execute([$rowId]);
}

/**
 * ส่งถึงแอดมินของ tenant หนึ่ง
 * in-app ทุกกรณี + อีเมลเมื่อเป็นเรื่องด่วน
 *
 * @return int จำนวนการส่งที่สำเร็จ นับเป็นคู่ (ผู้รับ × ช่องทาง)
 */
function ops_alert_deliver(PDO $db, string $tenantId, array $recipients, string $title, string $body, bool $urgent): int
{
    $sent      = 0;
    $shortTitle = mb_substr($title, 0, 255);
    $logMsg     = mb_substr($title . ' — ' . $body, 0, 2000);
    $html       = ops_alert_html($title, $body);

    foreach ($recipients as $r) {
        $userId = (string) ($r['user_id'] ?? '');
        if ($userId === '') {
            continue;
        }
        // tenant_id ของแถวแจ้งเตือนคือของแอดมินคนนั้นเอง
        $rowTenant = (string) ($r['tenant_id'] ?? '') !== '' ? (string) $r['tenant_id'] : $tenantId;

        // ── in-app: ช่องทางหลัก ไม่ต้องตั้งค่าอะไรและไม่พึ่งบริการภายนอก
        // ai_notifications.type ใช้ค่า 'custom' ที่มีอยู่แล้ว ห้ามเพิ่มค่าใน enum
        try {
            $db->prepare(
                "INSERT INTO ai_notifications (id, tenant_id, user_id, type, title, body, created_at)
                 VALUES (?, ?, ?, 'custom', ?, ?, NOW())"
            )->execute([generateUUID(), $rowTenant, $userId, $shortTitle, $body]);
            ops_alert_log($db, $userId, 'in_app', $logMsg, 'sent');
            $sent++;
        } catch (Throwable $e) {
            ops_alert_log($db, $userId, 'in_app', $logMsg, 'failed', $e->getMessage());
            error_log("[ops-alert] in_app failed for user={$userId}: " . $e->getMessage());
        }

        // ── อีเมล: เฉพาะเรื่องด่วน เพราะแจ้งเตือนในแอปเห็นได้เฉพาะเมื่อมีคนเปิดเว็บ
        if ($urgent && !empty($r['email'])) {
            $ok = _sendEmailActivity(
                (string) $r['email'],
                (string) ($r['display_name'] ?? ''),
                '[FlowStack] ' . $shortTitle,
                $html
            );
            if ($ok) {
                ops_alert_log($db, $userId, 'email', $logMsg, 'sent');
                $sent++;
            } else {
                ops_alert_log($db, $userId, 'email', $logMsg, 'failed', 'ตัวส่งอีเมลรายงานว่าล้มเหลว — ดูรายละเอียดใน PHP error log');
                error_log("[ops-alert] email failed for user={$userId} <{$r['email']}>");
            }
        }
    }

    return $sent;
}

/**
 * push ข้อความไปปลายทาง LINE ของ ops alert
 * ปลายทางว่าง = ไม่มี request ออกไปยัง LINE Messaging API เลย (ค่าเริ่มต้นของระบบ)
 */
function ops_alert_push_line_targets(PDO $db, string $title, string $body): void
{
    $targets = ops_alert_line_targets($db);
    if (!$targets) {
        return;
    }

    $token = (string) ($db->query("SELECT `value` FROM settings WHERE `key`='line_channel_access_token' LIMIT 1")->fetchColumn() ?: '');
    if ($token === '') {
        error_log('[ops-alert] line targets configured but line_channel_access_token is empty');
        return;
    }

    $text   = mb_substr($title . "\n" . $body, 0, 4000);
    $logMsg = mb_substr($title . ' — ' . $body, 0, 2000);

    foreach ($targets as $t) {
        $to = (string) ($t['id'] ?? '');
        if ($to === '') {
            continue;
        }
        $res = ops_alert_push_line($token, $to, $text);
        // notification_log.user_id ไม่มี FK — สำหรับ channel='line' ผู้รับคือปลายทาง LINE
        // จึงเก็บ id ของปลายทางในคอลัมน์นั้นตรง ๆ (LINE user/group id ยาว 33 ตัวอักษร พอดี CHAR(36))
        ops_alert_log($db, $to, 'line', $logMsg, $res['ok'] ? 'sent' : 'failed', $res['ok'] ? '' : $res['error']);
        if (!$res['ok']) {
            error_log("[ops-alert] line push failed to {$to}: " . $res['error']);
        }
    }
}

/**
 * ปลายทาง LINE จาก settings key ops_alert_line_targets
 * รูปแบบเดียวกับ key `line_targets` เดิม: JSON array ของ {"id": "...", "name": "..."}
 * ค่าว่าง / JSON พัง → รายการว่าง (ไม่ส่ง)
 */
function ops_alert_line_targets(PDO $db): array
{
    $raw = $db->query("SELECT `value` FROM settings WHERE `key`='" . OPS_ALERT_LINE_TARGETS_KEY . "' LIMIT 1")->fetchColumn();
    if (!is_string($raw) || trim($raw) === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        error_log('[ops-alert] ' . OPS_ALERT_LINE_TARGETS_KEY . ' is not valid JSON, ignoring');
        return [];
    }
    return array_values(array_filter($decoded, fn($t) => is_array($t) && !empty($t['id'])));
}

/** ยิง LINE Messaging API แล้วคืนสถานะจริง (ต่างจาก _pushLine() ที่ทิ้งผลลัพธ์) */
function ops_alert_push_line(string $token, string $to, string $text): array
{
    $payload = json_encode(
        ['to' => $to, 'messages' => [['type' => 'text', 'text' => $text]]],
        JSON_UNESCAPED_UNICODE
    );
    $ch = curl_init('https://api.line.me/v2/bot/message/push');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json', "Authorization: Bearer {$token}"],
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_TIMEOUT        => 8,
    ]);
    $resp = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $cerr = curl_error($ch);
    curl_close($ch);

    $ok = $code >= 200 && $code < 300;
    return [
        'ok'    => $ok,
        'code'  => $code,
        'error' => $ok ? '' : mb_substr($cerr !== '' ? $cerr : "HTTP {$code} " . (string) $resp, 0, 255),
    ];
}

/** บันทึกการส่งลง notification_log — ตัวมันเองต้องไม่ทำให้การแจ้งเตือนล้ม */
function ops_alert_log(PDO $db, string $userId, string $channel, string $message, string $status, string $error = ''): void
{
    try {
        $db->prepare(
            "INSERT INTO notification_log (id, user_id, channel, message, sent_at, status, error)
             VALUES (?, ?, ?, ?, NOW(), ?, ?)"
        )->execute([generateUUID(), $userId, $channel, $message, $status, $error !== '' ? mb_substr($error, 0, 255) : null]);
    } catch (Throwable $e) {
        error_log('[ops-alert] notification_log insert failed: ' . $e->getMessage());
    }
}

/** เนื้ออีเมล HTML ภาษาไทย */
function ops_alert_html(string $title, string $body): string
{
    return '<html><body style="font-family:sans-serif;padding:20px;line-height:1.7">'
         . '<h3 style="margin:0 0 12px">' . htmlspecialchars($title) . '</h3>'
         . '<div style="white-space:pre-wrap;color:#333">' . htmlspecialchars($body) . '</div>'
         . '<p style="margin-top:20px;color:#888;font-size:12px">ข้อความนี้ส่งอัตโนมัติจากระบบเฝ้าระวังของ FlowStack</p>'
         . '</body></html>';
}
