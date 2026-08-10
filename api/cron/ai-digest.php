<?php
/**
 * AI Daily Digest Cron — วิ่งทุกวันเวลา 07:30
 * สร้าง ai_notifications ประเภท daily_digest + overdue สำหรับทุก user
 */
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../config.php';

$db = getDB();
$today = date('Y-m-d');

// ดึง tenant_users ทั้งหมด (active)
$users = $db->query("
    SELECT tu.user_id, tu.tenant_id, u.display_name
    FROM tenant_users tu
    JOIN users u ON u.id = tu.user_id
    WHERE u.is_active = 1
")->fetchAll();

$created = 0;

foreach ($users as $row) {
    $uid      = $row['user_id'];
    $tid      = $row['tenant_id'];
    $name     = $row['display_name'];

    // งานเกินกำหนด (overdue) ของ user
    $overdueStmt = $db->prepare("
        SELECT COUNT(*) AS cnt
        FROM tasks
        WHERE tenant_id = ? AND assignee_user_id = ?
          AND is_subtask = 0 AND deleted_at IS NULL
          AND status NOT IN ('completed','cancelled')
          AND end_date < CURDATE()
    ");
    $overdueStmt->execute([$tid, $uid]);
    $overdueCnt = (int)$overdueStmt->fetchColumn();

    // งาน deadline วันนี้
    $todayStmt = $db->prepare("
        SELECT COUNT(*) AS cnt
        FROM tasks
        WHERE tenant_id = ? AND assignee_user_id = ?
          AND is_subtask = 0 AND deleted_at IS NULL
          AND status NOT IN ('completed','cancelled')
          AND end_date = CURDATE()
    ");
    $todayStmt->execute([$tid, $uid]);
    $todayCnt = (int)$todayStmt->fetchColumn();

    // ข้าม user ที่ไม่มีงานอะไรเลย
    if ($overdueCnt === 0 && $todayCnt === 0) continue;

    // สร้าง notification
    $parts = [];
    if ($overdueCnt > 0) $parts[] = "งานเกินกำหนด {$overdueCnt} รายการ";
    if ($todayCnt  > 0) $parts[] = "deadline วันนี้ {$todayCnt} รายการ";
    $body = implode(' • ', $parts);

    $notifId = generateUUID();
    $db->prepare("
        INSERT INTO ai_notifications (id, tenant_id, user_id, type, title, body, action_label, action_data, created_at)
        VALUES (?, ?, ?, 'daily_digest', ?, ?, 'ดูรายละเอียด', ?, NOW())
    ")->execute([
        $notifId, $tid, $uid,
        "สรุปงานวันนี้ — $today",
        $body,
        json_encode(['prompt' => "สรุปภาพรวมงานของฉันวันนี้ — งานเกินกำหนด และ deadline วันนี้"]),
    ]);
    $created++;

    // Overdue alert แยก (ถ้ามีงานเกินกำหนด > 3)
    if ($overdueCnt > 3) {
        $alertId = generateUUID();
        $db->prepare("
            INSERT INTO ai_notifications (id, tenant_id, user_id, type, title, body, action_label, action_data, created_at)
            VALUES (?, ?, ?, 'overdue', ?, ?, 'ดูงานที่ค้าง', ?, NOW())
        ")->execute([
            $alertId, $tid, $uid,
            "⚠️ งานค้างเกินกำหนด {$overdueCnt} รายการ",
            "กรุณาตรวจสอบและอัปเดตสถานะงาน",
            json_encode(['prompt' => "แสดงงานที่เกินกำหนดทั้งหมดของฉัน พร้อมแนะนำวิธีจัดการ"]),
        ]);
        $created++;
    }
}

echo json_encode(['created' => $created, 'users_processed' => count($users)]);
