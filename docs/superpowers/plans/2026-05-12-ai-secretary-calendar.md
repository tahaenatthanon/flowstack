# AI Secretary & Central Calendar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม Central Calendar, AI Persona System และ Proactive Notifications เพื่อให้ FlowStack ทำงานเป็น "เลขาส่วนตัว AI"

**Architecture:** ตาราง `calendar_events` ใหม่เก็บ meeting/leave/holiday events โดยไม่ซ้ำกับ tasks เดิม; `ai_personas` + `user_persona_preference` inject personality เข้า ChatWidget system prompt; `notification_dispatch.php` รัน cron ส่ง Line/Telegram/Email

**Tech Stack:** PHP 8 + MariaDB (backend), React 18 + TypeScript + TanStack Query (frontend), FullCalendar v6 (already installed), PHPMailer (already in vendor/)

> **Current-State Addendum (2026-05-20):**
> - เอกสารนี้เป็น implementation plan เชิง historical
> - สถานะปัจจุบันให้ใช้ `calendar_events` (`event_type='holiday'|'leave'`) เป็น source-of-truth สำหรับวันหยุด/วันลา
> - ค่า `task_type='holiday'|'leave'` ใน `tasks` ให้ถือเป็น compatibility/legacy data

---

## Status Summary (อัปเดต 2026-05-14)

| งาน | สถานะ | หมายเหตุ |
|-----|--------|---------|
| DB migration (calendar_events, ai_personas, user_persona_preference, notification_settings, notification_log) | ✅ เสร็จ | `2026_05_12_000001_create_calendar_and_persona_tables.sql` — **ต้องรัน manual ใน phpMyAdmin** |
| `api/calendar.php` | ✅ เสร็จ | GET/POST/PUT/DELETE, รวม tasks ใน range, ใช้ `getBaseCalendarProjectId()` จาก auth.php |
| `api/personas.php` | ✅ เสร็จ | list/get-preference/set-preference/create/update/delete |
| `api/notification-dispatch.php` | ✅ เสร็จ | cron ส่ง Line/Telegram/Email, log ใน notification_log |
| `src/lib/schemaContext.ts` | ✅ เสร็จ | calendar tool-calls + persona injection ใน getSystemPrompt() |
| `src/components/ChatWidget.tsx` | ✅ เสร็จ | persona state, switcher dropdown, getSystemPrompt(user, activePersona) |
| `src/pages/CalendarPage.tsx` | ✅ เสร็จ | FullCalendar v6, filter toggles, create/edit/detail dialogs, TaskDetailSheet integration |
| `src/App.tsx` | ✅ เสร็จ | `/calendar` route ด้วย PermissionRoute |
| `src/components/AppSidebar.tsx` | ✅ เสร็จ | nav item "ปฏิทินทีม" + icon Calendar |
| `api/auth.php` ALL_MENU_KEYS | ✅ เสร็จ | 'calendar' และ 'task_intelligence' เพิ่มแล้ว |
| `api/profile.php` notification_settings | ✅ เสร็จ | GET/PUT ?action=notification_settings เพิ่มแล้ว 2026-05-14 |
| `src/pages/ProfilePage.tsx` | ✅ เสร็จ | notification settings UI (briefing_time, notify_line/telegram/email) |
| TypeScript build check | ✅ ผ่าน | `tsc --noEmit` — ไม่มี errors |

**⚠️ Manual steps ที่ยังต้องทำ:**
1. รัน migration ใน phpMyAdmin: `SOURCE C:/xampp/htdocs/flowstack/database/migrations/2026_05_12_000001_create_calendar_and_persona_tables.sql;`
2. รัน migration task_validation_rules ด้วย: `SOURCE C:/xampp/htdocs/flowstack/database/migrations/2026_05_14_000000_create_task_validation_rules.sql;`
3. ทดสอบ cron: `GET http://localhost/flowstack/api/notification-dispatch.php?secret=flowstack-cron-2026`
4. ตั้งค่า env vars สำหรับ Line/Telegram/Email หากต้องการใช้งาน notification จริง

---

## File Map

**New files:**
- `database/migrations/2026_05_12_000001_create_calendar_and_persona_tables.sql`
- `api/calendar.php`
- `api/personas.php`
- `api/notification-dispatch.php`
- `src/pages/CalendarPage.tsx`

**Modified files:**
- `api/auth.php` — add `'calendar'` to `ALL_MENU_KEYS`
- `src/App.tsx` — add `/calendar` route
- `src/components/AppSidebar.tsx` — add "ปฏิทินทีม" nav entry
- `src/lib/schemaContext.ts` — add calendar tool-calls + persona injection support
- `src/components/ChatWidget.tsx` — add persona switcher + daily briefing logic
- `src/pages/ProfilePage.tsx` — add notification settings section

---

## Task 1: Database Migration

**Files:**
- Create: `database/migrations/2026_05_12_000001_create_calendar_and_persona_tables.sql`

- [x] **Step 1: Create migration file**

```sql
-- database/migrations/2026_05_12_000001_create_calendar_and_persona_tables.sql

-- 1. calendar_events
CREATE TABLE IF NOT EXISTS `calendar_events` (
  `id`          CHAR(36)      NOT NULL,
  `tenant_id`   CHAR(36)      NOT NULL,
  `created_by`  CHAR(36)      NOT NULL,
  `project_id`  CHAR(36)      DEFAULT NULL,
  `title`       VARCHAR(255)  NOT NULL,
  `description` TEXT          DEFAULT NULL,
  `location`    VARCHAR(255)  DEFAULT NULL,
  `event_type`  ENUM('meeting','leave','holiday','other') NOT NULL,
  `start_at`    DATETIME      NOT NULL,
  `end_at`      DATETIME      NOT NULL,
  `all_day`     TINYINT(1)    NOT NULL DEFAULT 0,
  `recurrence`  VARCHAR(50)   DEFAULT NULL,
  `status`      ENUM('confirmed','tentative','cancelled') NOT NULL DEFAULT 'confirmed',
  `attendees`   JSON          DEFAULT NULL,
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_tenant_start` (`tenant_id`, `start_at`),
  INDEX `idx_created_by`   (`created_by`),
  INDEX `idx_project`      (`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. ai_personas
CREATE TABLE IF NOT EXISTS `ai_personas` (
  `id`           CHAR(36)      NOT NULL,
  `tenant_id`    CHAR(36)      NOT NULL,
  `name`         VARCHAR(100)  NOT NULL,
  `avatar_emoji` VARCHAR(10)   NOT NULL DEFAULT '🤖',
  `description`  VARCHAR(255)  DEFAULT NULL,
  `personality`  TEXT          NOT NULL,
  `data_scope`   ENUM('personal','team','admin') NOT NULL DEFAULT 'personal',
  `is_default`   TINYINT(1)    NOT NULL DEFAULT 0,
  `created_by`   CHAR(36)      NOT NULL,
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. user_persona_preference
CREATE TABLE IF NOT EXISTS `user_persona_preference` (
  `user_id`    CHAR(36) NOT NULL,
  `persona_id` CHAR(36) NOT NULL,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. notification_settings
CREATE TABLE IF NOT EXISTS `notification_settings` (
  `user_id`          CHAR(36)     NOT NULL,
  `line_user_id`     VARCHAR(100) DEFAULT NULL,
  `telegram_chat_id` VARCHAR(100) DEFAULT NULL,
  `briefing_time`    TIME         NOT NULL DEFAULT '08:00:00',
  `notify_line`      TINYINT(1)   NOT NULL DEFAULT 0,
  `notify_telegram`  TINYINT(1)   NOT NULL DEFAULT 0,
  `notify_email`     TINYINT(1)   NOT NULL DEFAULT 1,
  `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. notification_log
CREATE TABLE IF NOT EXISTS `notification_log` (
  `id`      CHAR(36)                                        NOT NULL,
  `user_id` CHAR(36)                                        NOT NULL,
  `channel` ENUM('line','telegram','email','in_app')        NOT NULL,
  `message` TEXT                                            DEFAULT NULL,
  `sent_at` DATETIME                                        DEFAULT NULL,
  `status`  ENUM('sent','failed')                           NOT NULL DEFAULT 'sent',
  `error`   VARCHAR(255)                                    DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_user_sent` (`user_id`, `sent_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Seed default personas (use a placeholder tenant_id '00000000-0000-0000-0000-000000000000' 
--    — personas.php will return these for any tenant since created_by = system)
INSERT IGNORE INTO `ai_personas` (`id`, `tenant_id`, `created_by`, `name`, `avatar_emoji`, `description`, `personality`, `data_scope`, `is_default`) VALUES
('persona-std-00000000-0000-0001', '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000',
 'ผู้ช่วยมาตรฐาน', '🤖', 'กระชับ ทางการ ตรงประเด็น',
 'คุณคือผู้ช่วย AI ที่กระชับ ตรงประเด็น และทางการ ตอบสิ่งที่ถามโดยตรงโดยไม่วกวน', 'personal', 1),
('persona-nina-00000000-0000-0001', '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000',
 'นิน่า', '👩‍💼', 'สุภาพแบบญี่ปุ่น ใส่ใจรายละเอียด',
 'คุณชื่อนิน่า เป็นผู้ช่วยส่วนตัวที่สุภาพเรียบร้อยแบบสไตล์ญี่ปุ่น ใส่ใจรายละเอียด มักเริ่มด้วยการสรุปสิ่งที่จะทำก่อนลงมือ ใช้ภาษาสุภาพ และมักจบด้วยการถามว่าต้องการอะไรเพิ่มเติมไหม', 'personal', 0),
('persona-tong-00000000-0000-0001', '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000',
 'พี่โต้ง', '😎', 'เป็นกันเอง ตรงไปตรงมา',
 'คุณชื่อพี่โต้ง เป็นกันเองและตรงไปตรงมา พูดภาษาสบายๆ ไม่พิธีรีตรอง ให้คำแนะนำตรงๆ และมีอารมณ์ขันได้บ้าง', 'personal', 0),
('persona-ceo-000000000-0000-0001', '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000',
 'CEO Analyst', '📊', 'เชิงกลยุทธ์ KPI-focused',
 'คุณคือที่ปรึกษาเชิงกลยุทธ์ที่เน้นการวิเคราะห์ KPI และข้อมูลธุรกิจ ตอบในเชิงตัวเลข แนวโน้ม และการตัดสินใจเชิงธุรกิจ', 'admin', 0),
('persona-sched-0000000-0000-0001', '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000',
 'เลขา Scheduler', '📅', 'เน้น calendar และนัดหมาย',
 'คุณคือเลขาส่วนตัวที่เชี่ยวชาญด้านการจัดตารางเวลา นัดหมาย และการลา ตอบด้วยความรอบคอบและแนะนำการจัดตารางเวลาที่เหมาะสม', 'personal', 0),
('persona-coach-000000-0000-0001', '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000',
 'Coach', '🎯', 'กระตุ้น ให้กำลังใจ ติดตาม goal',
 'คุณคือโค้ชส่วนตัวที่กระตุ้นและให้กำลังใจ ช่วยติดตาม goal และ deadline คอยเตือนและให้กำลังใจเมื่อเผชิญอุปสรรค', 'personal', 0);
```

- [ ] **Step 2: Run migration via PHP runner** _(manual — phpMyAdmin)_

```
GET http://localhost/flowstack/database/run_migration.php?file=2026_05_12_000001_create_calendar_and_persona_tables.sql
```

Expected: `{"success": true}` หรือเปิดใน browser แล้วเห็น success message

- [ ] **Step 3: Verify tables exist**

เปิด phpMyAdmin หรือรัน:
```
GET http://localhost/flowstack/api/test_endpoint.php
```

ตรวจสอบว่ามีตาราง `calendar_events`, `ai_personas`, `user_persona_preference`, `notification_settings`, `notification_log` และมี 6 rows ใน `ai_personas`

- [ ] **Step 4: Commit**

```bash
git add database/migrations/2026_05_12_000001_create_calendar_and_persona_tables.sql
git commit -m "feat: add calendar, persona, and notification tables (migration)"
```

---

## Task 2: `api/calendar.php`

**Files:**
- Create: `api/calendar.php`

- [x] **Step 1: Create the file**

```php
<?php
// api/calendar.php
// GET    ?start=YYYY-MM-DD&end=YYYY-MM-DD  — list events in range
// GET    ?id=UUID                           — get single event
// POST                                      — create event
// PUT    ?id=UUID                           — update event
// DELETE ?id=UUID                           — soft-delete (status=cancelled)

require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId    = $tokenData['user_id'];
$tenantId  = $tokenData['tenant_id'];
$isAdmin   = (bool)($tokenData['is_admin'] ?? false);
$db        = getDB();
$method    = getMethod();

if ($method === 'GET') {
    $id = $_GET['id'] ?? null;
    if ($id) {
        // Single event
        $stmt = $db->prepare(
            "SELECT * FROM calendar_events WHERE id = ? AND tenant_id = ? AND status != 'cancelled'"
        );
        $stmt->execute([$id, $tenantId]);
        $event = $stmt->fetch();
        if (!$event) jsonError('Event not found', 404);
        if (!$isAdmin && $event['created_by'] !== $userId && $event['event_type'] !== 'holiday') {
            jsonError('Forbidden', 403);
        }
        jsonResponse($event);
    }

    // Range query
    $start = $_GET['start'] ?? date('Y-m-01');
    $end   = $_GET['end']   ?? date('Y-m-t');

    if ($isAdmin) {
        $stmt = $db->prepare(
            "SELECT e.*, u.display_name as creator_name
             FROM calendar_events e
             LEFT JOIN users u ON u.id = e.created_by
             WHERE e.tenant_id = ?
               AND e.start_at <= ?
               AND e.end_at   >= ?
               AND e.status   != 'cancelled'
             ORDER BY e.start_at"
        );
        $stmt->execute([$tenantId, $end . ' 23:59:59', $start . ' 00:00:00']);
    } else {
        // Non-admin: own events + all holidays
        $stmt = $db->prepare(
            "SELECT e.*, u.display_name as creator_name
             FROM calendar_events e
             LEFT JOIN users u ON u.id = e.created_by
             WHERE e.tenant_id = ?
               AND e.start_at <= ?
               AND e.end_at   >= ?
               AND e.status   != 'cancelled'
               AND (e.created_by = ? OR e.event_type = 'holiday')
             ORDER BY e.start_at"
        );
        $stmt->execute([$tenantId, $end . ' 23:59:59', $start . ' 00:00:00', $userId]);
    }

    // Also pull tasks from KTN Ops (due_date in range, types meeting/leave/holiday)
    $taskStmt = $db->prepare(
        "SELECT t.id, t.title, t.due_date as start_at, t.due_date as end_at,
                t.task_type as event_type, t.description, NULL as location,
                1 as all_day, 'confirmed' as status, NULL as attendees,
                NULL as project_id, t.assigned_to as created_by,
                u.display_name as creator_name, 'task' as source
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assigned_to
         WHERE t.tenant_id = ?
           AND t.due_date BETWEEN ? AND ?
           AND t.task_type IN ('meeting','leave','holiday')
           AND (t.assigned_to = ? OR t.task_type = 'holiday' OR ? = 1)
         ORDER BY t.due_date"
    );
    $taskStmt->execute([$tenantId, $start, $end, $userId, (int)$isAdmin]);

    $events = $stmt->fetchAll();
    foreach ($events as &$e) {
        $e['source'] = 'calendar';
        if ($e['attendees']) $e['attendees'] = json_decode($e['attendees'], true);
    }
    $tasks = $taskStmt->fetchAll();

    jsonResponse(array_merge($events, $tasks));
}

if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];

    $required = ['title', 'event_type', 'start_at', 'end_at'];
    foreach ($required as $field) {
        if (empty($data[$field])) jsonError("Missing required field: $field");
    }

    $allowed_types = ['meeting', 'leave', 'holiday', 'other'];
    if (!in_array($data['event_type'], $allowed_types)) jsonError('Invalid event_type');

    // Only admin can create company-wide holidays
    if ($data['event_type'] === 'holiday' && !$isAdmin) jsonError('Only admin can create holidays', 403);

    $id = generateUUID();
    $stmt = $db->prepare(
        "INSERT INTO calendar_events
         (id, tenant_id, created_by, project_id, title, description, location,
          event_type, start_at, end_at, all_day, recurrence, status, attendees)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $id, $tenantId, $userId,
        $data['project_id'] ?? null,
        $data['title'],
        $data['description'] ?? null,
        $data['location'] ?? null,
        $data['event_type'],
        $data['start_at'],
        $data['end_at'],
        (int)($data['all_day'] ?? 0),
        $data['recurrence'] ?? null,
        $data['status'] ?? 'confirmed',
        isset($data['attendees']) ? json_encode($data['attendees']) : null,
    ]);

    $created = $db->query("SELECT * FROM calendar_events WHERE id = '$id'")->fetch();
    jsonResponse($created, 201);
}

if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id');

    $stmt = $db->prepare("SELECT * FROM calendar_events WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$id, $tenantId]);
    $event = $stmt->fetch();
    if (!$event) jsonError('Event not found', 404);
    if (!$isAdmin && $event['created_by'] !== $userId) jsonError('Forbidden', 403);

    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    $fields = ['title', 'description', 'location', 'event_type', 'start_at', 'end_at',
               'all_day', 'recurrence', 'status', 'attendees', 'project_id'];
    $sets = []; $vals = [];
    foreach ($fields as $f) {
        if (array_key_exists($f, $data)) {
            $sets[] = "`$f` = ?";
            $vals[] = ($f === 'attendees' && is_array($data[$f])) ? json_encode($data[$f]) : $data[$f];
        }
    }
    if (empty($sets)) jsonError('No fields to update');
    $vals[] = $id;
    $db->prepare("UPDATE calendar_events SET " . implode(', ', $sets) . " WHERE id = ?")->execute($vals);

    $updated = $db->query("SELECT * FROM calendar_events WHERE id = '$id'")->fetch();
    jsonResponse($updated);
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id');

    $stmt = $db->prepare("SELECT * FROM calendar_events WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$id, $tenantId]);
    $event = $stmt->fetch();
    if (!$event) jsonError('Event not found', 404);
    if (!$isAdmin && $event['created_by'] !== $userId) jsonError('Forbidden', 403);

    $db->prepare("UPDATE calendar_events SET status = 'cancelled' WHERE id = ?")->execute([$id]);
    jsonResponse(['deleted' => true]);
}

jsonError('Method not allowed', 405);
```

- [ ] **Step 2: Smoke test via browser**

```
GET http://localhost/flowstack/api/calendar.php?start=2026-05-01&end=2026-05-31
```

Expected: JSON array (empty or with tasks from KTN Ops)  
If 401 → need auth token header; test via DevTools Network tab in FlowStack app

- [ ] **Step 3: Commit**

```bash
git add api/calendar.php
git commit -m "feat: add api/calendar.php (CRUD calendar events)"
```

---

## Task 3: `api/personas.php`

**Files:**
- Create: `api/personas.php`

- [x] **Step 1: Create the file**

```php
<?php
// api/personas.php
// GET                              — list all personas for tenant (+ global seeds)
// GET  ?action=my_preference       — get current user's active persona
// POST ?action=set_preference      — set current user's persona { persona_id }
// POST                             — create persona (admin only)
// PUT  ?id=UUID                    — update persona (admin only)
// DELETE ?id=UUID                  — delete persona (admin only, non-seed)

require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId    = $tokenData['user_id'];
$tenantId  = $tokenData['tenant_id'];
$isAdmin   = (bool)($tokenData['is_admin'] ?? false);
$db        = getDB();
$method    = getMethod();
$action    = $_GET['action'] ?? null;

if ($method === 'GET') {
    if ($action === 'my_preference') {
        $stmt = $db->prepare(
            "SELECT p.* FROM ai_personas p
             JOIN user_persona_preference pp ON pp.persona_id = p.id
             WHERE pp.user_id = ?"
        );
        $stmt->execute([$userId]);
        $persona = $stmt->fetch();

        if (!$persona) {
            // Return default persona for tenant, or global default
            $stmt2 = $db->prepare(
                "SELECT * FROM ai_personas
                 WHERE (tenant_id = ? OR tenant_id = '00000000-0000-0000-0000-000000000000')
                   AND is_default = 1
                 ORDER BY tenant_id DESC LIMIT 1"
            );
            $stmt2->execute([$tenantId]);
            $persona = $stmt2->fetch();
        }
        jsonResponse($persona ?: null);
    }

    // List all personas available to this tenant
    $stmt = $db->prepare(
        "SELECT * FROM ai_personas
         WHERE tenant_id = ? OR tenant_id = '00000000-0000-0000-0000-000000000000'
         ORDER BY is_default DESC, name"
    );
    $stmt->execute([$tenantId]);
    jsonResponse($stmt->fetchAll());
}

if ($method === 'POST') {
    $action = $_GET['action'] ?? ($_POST['action'] ?? null);
    $data   = json_decode(file_get_contents('php://input'), true) ?? [];
    $action = $data['action'] ?? $action;

    if ($action === 'set_preference') {
        $personaId = $data['persona_id'] ?? null;
        if (!$personaId) jsonError('Missing persona_id');

        // Verify persona exists and is accessible
        $stmt = $db->prepare(
            "SELECT id FROM ai_personas
             WHERE id = ? AND (tenant_id = ? OR tenant_id = '00000000-0000-0000-0000-000000000000')"
        );
        $stmt->execute([$personaId, $tenantId]);
        if (!$stmt->fetch()) jsonError('Persona not found', 404);

        $db->prepare(
            "INSERT INTO user_persona_preference (user_id, persona_id)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE persona_id = VALUES(persona_id)"
        )->execute([$userId, $personaId]);
        jsonResponse(['saved' => true]);
    }

    // Create persona (admin only)
    if (!$isAdmin) jsonError('Forbidden', 403);
    foreach (['name', 'personality'] as $f) {
        if (empty($data[$f])) jsonError("Missing: $f");
    }
    $id = generateUUID();
    $db->prepare(
        "INSERT INTO ai_personas (id, tenant_id, created_by, name, avatar_emoji, description, personality, data_scope, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )->execute([
        $id, $tenantId, $userId,
        $data['name'],
        $data['avatar_emoji'] ?? '🤖',
        $data['description'] ?? null,
        $data['personality'],
        $data['data_scope'] ?? 'personal',
        (int)($data['is_default'] ?? 0),
    ]);
    $created = $db->query("SELECT * FROM ai_personas WHERE id = '$id'")->fetch();
    jsonResponse($created, 201);
}

if ($method === 'PUT') {
    if (!$isAdmin) jsonError('Forbidden', 403);
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id');

    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    $fields = ['name', 'avatar_emoji', 'description', 'personality', 'data_scope', 'is_default'];
    $sets = []; $vals = [];
    foreach ($fields as $f) {
        if (array_key_exists($f, $data)) { $sets[] = "`$f` = ?"; $vals[] = $data[$f]; }
    }
    if (empty($sets)) jsonError('No fields to update');
    $vals[] = $id; $vals[] = $tenantId;
    $db->prepare("UPDATE ai_personas SET " . implode(', ', $sets) . " WHERE id = ? AND tenant_id = ?")->execute($vals);
    jsonResponse($db->query("SELECT * FROM ai_personas WHERE id = '$id'")->fetch());
}

if ($method === 'DELETE') {
    if (!$isAdmin) jsonError('Forbidden', 403);
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id');
    // Prevent deleting global seeds
    $stmt = $db->prepare("SELECT tenant_id FROM ai_personas WHERE id = ?");
    $stmt->execute([$id]);
    $p = $stmt->fetch();
    if (!$p) jsonError('Not found', 404);
    if ($p['tenant_id'] === '00000000-0000-0000-0000-000000000000') jsonError('Cannot delete default personas', 403);
    $db->prepare("DELETE FROM ai_personas WHERE id = ? AND tenant_id = ?")->execute([$id, $tenantId]);
    jsonResponse(['deleted' => true]);
}

jsonError('Method not allowed', 405);
```

- [ ] **Step 2: Smoke test**

```
GET http://localhost/flowstack/api/personas.php
```

Expected: JSON array with 6 seed personas

- [ ] **Step 3: Commit**

```bash
git add api/personas.php
git commit -m "feat: add api/personas.php (persona CRUD + user preference)"
```

---

## Task 4: `api/notification-dispatch.php`

**Files:**
- Create: `api/notification-dispatch.php`

> **หมายเหตุ:** Line OA และ Telegram ต้องการ API keys ที่ตั้งค่าใน `company_settings` หรือ `.env` — ในขั้นตอนนี้สร้าง dispatcher โครงสร้างพร้อม placeholder สำหรับ keys เหล่านั้น

- [x] **Step 1: Create the file**

```php
<?php
// api/notification-dispatch.php
// Called by cron: GET /api/notification-dispatch.php?secret=CRON_SECRET
// Sends morning briefings via Line, Telegram, Email based on user preferences

require_once __DIR__ . '/config.php';

// Basic security: require cron secret from env or fixed token
$secret = $_GET['secret'] ?? '';
$expected = getenv('CRON_SECRET') ?: 'flowstack-cron-2026';
if ($secret !== $expected) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

$db = getDB();
$now = new DateTime('now', new DateTimeZone('Asia/Bangkok'));
$currentTime = $now->format('H:i');
$today = $now->format('Y-m-d');
$tomorrow = (clone $now)->modify('+1 day')->format('Y-m-d');

// Get users whose briefing_time matches current time (within 15min window)
$stmt = $db->prepare(
    "SELECT u.id, u.email, u.display_name, u.tenant_id,
            ns.line_user_id, ns.telegram_chat_id,
            ns.notify_line, ns.notify_telegram, ns.notify_email,
            ns.briefing_time
     FROM users u
     JOIN notification_settings ns ON ns.user_id = u.id
     WHERE u.is_active = 1
       AND TIME(ns.briefing_time) BETWEEN TIME(DATE_SUB(NOW(), INTERVAL 8 MINUTE))
                                      AND TIME(DATE_ADD(NOW(), INTERVAL 7 MINUTE))"
);
$stmt->execute();
$users = $stmt->fetchAll();

$dispatched = 0;
foreach ($users as $user) {
    $message = buildBriefing($db, $user, $today, $tomorrow);
    if (!$message) continue;

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
}

echo json_encode(['dispatched' => $dispatched, 'time' => $currentTime]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildBriefing(PDO $db, array $user, string $today, string $tomorrow): string {
    // Today's calendar events
    $stmt = $db->prepare(
        "SELECT title, event_type, start_at, all_day FROM calendar_events
         WHERE tenant_id = ? AND (created_by = ? OR event_type = 'holiday')
           AND DATE(start_at) = ? AND status != 'cancelled'
         ORDER BY start_at"
    );
    $stmt->execute([$user['tenant_id'], $user['id'], $today]);
    $todayEvents = $stmt->fetchAll();

    // Tomorrow's events
    $stmt->execute([$user['tenant_id'], $user['id'], $tomorrow]);
    $tomorrowEvents = $stmt->fetchAll();

    // Tasks due today
    $stmt2 = $db->prepare(
        "SELECT title, status FROM tasks
         WHERE tenant_id = ? AND assigned_to = ? AND DATE(due_date) = ?
           AND status NOT IN ('completed','cancelled')
         ORDER BY due_date LIMIT 5"
    );
    $stmt2->execute([$user['tenant_id'], $user['id'], $today]);
    $dueTasks = $stmt2->fetchAll();

    if (empty($todayEvents) && empty($tomorrowEvents) && empty($dueTasks)) {
        return ''; // Nothing to report
    }

    $lines = ["📅 *สวัสดีตอนเช้า {$user['display_name']}!*\n"];

    if ($todayEvents) {
        $lines[] = "📆 *วันนี้:*";
        foreach ($todayEvents as $e) {
            $time = $e['all_day'] ? '(ทั้งวัน)' : date('H:i', strtotime($e['start_at']));
            $lines[] = "  • {$e['title']} {$time}";
        }
    }
    if ($dueTasks) {
        $lines[] = "\n✅ *Task ครบกำหนดวันนี้:*";
        foreach ($dueTasks as $t) {
            $lines[] = "  • {$t['title']}";
        }
    }
    if ($tomorrowEvents) {
        $lines[] = "\n📌 *พรุ่งนี้:*";
        foreach ($tomorrowEvents as $e) {
            $time = $e['all_day'] ? '(ทั้งวัน)' : date('H:i', strtotime($e['start_at']));
            $lines[] = "  • {$e['title']} {$time}";
        }
    }

    return implode("\n", $lines);
}

function logNotification(PDO $db, string $userId, string $channel, string $message, string $status, string $error = ''): void {
    $id = generateUUID();
    $db->prepare(
        "INSERT INTO notification_log (id, user_id, channel, message, sent_at, status, error)
         VALUES (?, ?, ?, ?, NOW(), ?, ?)"
    )->execute([$id, $userId, $channel, $message, $status, $error ?: null]);
}

function sendLine(PDO $db, array $user, string $message): void {
    $token = getenv('LINE_CHANNEL_ACCESS_TOKEN') ?: '';
    if (!$token) { logNotification($db, $user['id'], 'line', $message, 'failed', 'No LINE token configured'); return; }

    $payload = json_encode(['to' => $user['line_user_id'], 'messages' => [['type' => 'text', 'text' => $message]]]);
    $ctx = stream_context_create(['http' => [
        'method'  => 'POST',
        'header'  => "Content-Type: application/json\r\nAuthorization: Bearer $token",
        'content' => $payload,
        'ignore_errors' => true,
    ]]);
    $result = file_get_contents('https://api.line.me/v2/bot/message/push', false, $ctx);
    $resp = json_decode($result, true);
    $status = isset($resp['message']) ? 'failed' : 'sent';
    logNotification($db, $user['id'], 'line', $message, $status, $resp['message'] ?? '');
}

function sendTelegram(PDO $db, array $user, string $message): void {
    $token = getenv('TELEGRAM_BOT_TOKEN') ?: '';
    if (!$token) { logNotification($db, $user['id'], 'telegram', $message, 'failed', 'No Telegram token configured'); return; }

    $url = "https://api.telegram.org/bot{$token}/sendMessage";
    $payload = json_encode(['chat_id' => $user['telegram_chat_id'], 'text' => $message, 'parse_mode' => 'Markdown']);
    $ctx = stream_context_create(['http' => [
        'method'  => 'POST',
        'header'  => "Content-Type: application/json",
        'content' => $payload,
        'ignore_errors' => true,
    ]]);
    $result = file_get_contents($url, false, $ctx);
    $resp = json_decode($result, true);
    $status = ($resp['ok'] ?? false) ? 'sent' : 'failed';
    logNotification($db, $user['id'], 'telegram', $message, $status, $resp['description'] ?? '');
}

function sendEmail(PDO $db, array $user, string $message): void {
    // Use PHPMailer if available, fallback to mail()
    $subject = '📅 FlowStack Morning Briefing — ' . date('d/m/Y');
    $htmlMessage = nl2br(htmlspecialchars($message));
    $body = "<html><body style='font-family:sans-serif;padding:20px'>{$htmlMessage}</body></html>";

    if (file_exists(__DIR__ . '/../vendor/autoload.php')) {
        require_once __DIR__ . '/../vendor/autoload.php';
        try {
            $mail = new PHPMailer\PHPMailer\PHPMailer(true);
            $mail->isSMTP();
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
            $mail->Body    = $body;
            $mail->send();
            logNotification($db, $user['id'], 'email', $message, 'sent');
        } catch (\Exception $e) {
            logNotification($db, $user['id'], 'email', $message, 'failed', $e->getMessage());
        }
    } else {
        $sent = mail($user['email'], $subject, strip_tags($message));
        logNotification($db, $user['id'], 'email', $message, $sent ? 'sent' : 'failed');
    }
}
```

- [ ] **Step 2: Add cron setup instructions to README**

เพิ่มใน `README.md` section Cron:
```
# Cron Jobs
# Windows Task Scheduler / XAMPP cron:
# Every 15 minutes:
# curl "http://localhost/flowstack/api/notification-dispatch.php?secret=flowstack-cron-2026"
```

- [ ] **Step 3: Smoke test (no users with notification_settings yet — OK)**

```
GET http://localhost/flowstack/api/notification-dispatch.php?secret=flowstack-cron-2026
```

Expected: `{"dispatched":0,"time":"HH:MM"}`

- [ ] **Step 4: Commit**

```bash
git add api/notification-dispatch.php
git commit -m "feat: add notification-dispatch.php (Line/Telegram/Email briefing cron)"
```

---

## Task 5: Update `src/lib/schemaContext.ts`

**Files:**
- Modify: `src/lib/schemaContext.ts`

ดู current content ก่อน:

- [x] **Step 1: Add calendar tool docs to API_ENDPOINTS**

เปิดไฟล์ `src/lib/schemaContext.ts` หา section `API_ENDPOINTS` และเพิ่ม text ต่อท้ายก่อน closing backtick ของ template literal:

```typescript
// เพิ่มต่อท้าย API_ENDPOINTS string (ก่อน closing backtick)

## ปฏิทิน (calendar_events)
ดู events ในช่วงวันที่:
[TOOL_CALL]
--endpoint--> /api/calendar.php
--method--> GET
--body--> {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}
[/TOOL_CALL]

สร้าง event ลาหยุด/ประชุม/วันหยุดบริษัท:
[TOOL_CALL]
--endpoint--> /api/calendar.php
--method--> POST
--body--> {"title": "ชื่อ event", "event_type": "leave|meeting|holiday|other", "start_at": "YYYY-MM-DD HH:MM:SS", "end_at": "YYYY-MM-DD HH:MM:SS", "all_day": 1}
[/TOOL_CALL]

แก้ไข event:
[TOOL_CALL]
--endpoint--> /api/calendar.php
--method--> PUT
--body--> {"id": "UUID", "title": "ชื่อใหม่", "status": "cancelled"}
[/TOOL_CALL]
```

- [x] **Step 2: Modify `getSystemPrompt` to accept and inject persona**

แก้ signature และ body ของ `getSystemPrompt`:

```typescript
// เปลี่ยน signature จาก:
export const getSystemPrompt = (user?: { id: string; display_name: string; tenant_id?: string }) => {

// เป็น:
export const getSystemPrompt = (
  user?: { id: string; display_name: string; tenant_id?: string },
  persona?: { name: string; personality: string; data_scope: string; avatar_emoji: string } | null
) => {
```

และเพิ่ม persona injection ก่อน return statement ใน function (ก่อน string ที่ return):

```typescript
  const personaBlock = persona
    ? `\n=== บุคลิก AI ===\nคุณกำลังทำงานในบทบาท: ${persona.avatar_emoji} ${persona.name}\n${persona.personality}\n` +
      (persona.data_scope === 'personal'
        ? 'ให้ข้อมูลเฉพาะงานของผู้ใช้ปัจจุบันเท่านั้น (กรองด้วย assigned_to = user_id)\n'
        : persona.data_scope === 'team'
        ? 'สามารถแสดงข้อมูลของทีมได้ (กรองด้วย tenant_id)\n'
        : 'สามารถแสดง KPI และข้อมูลทั้งบริษัทได้\n')
    : '';
```

แล้วใส่ `${personaBlock}` ในตำแหน่งที่เหมาะสมภายใน return template string (หลัง user info block)

- [x] **Step 3: Build and check for TypeScript errors**

```bash
cd c:\xampp\htdocs\flowstack
pnpm build 2>&1 | Select-String "error"
```

Expected: ไม่มี TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/schemaContext.ts
git commit -m "feat: add calendar tool-calls and persona injection to system prompt"
```

---

## Task 6: Update `ChatWidget.tsx`

**Files:**
- Modify: `src/components/ChatWidget.tsx`

- [x] **Step 1: Add persona state and loader**

หาบรรทัด `const [selectedModel, setSelectedModel] = useState<string>('')` (line ~320) และเพิ่มหลังจากนั้น:

```typescript
  // Persona
  const [personas, setPersonas] = useState<Array<{
    id: string; name: string; avatar_emoji: string; description: string;
    personality: string; data_scope: string; is_default: number;
  }>>([]);
  const [activePersona, setActivePersona] = useState<typeof personas[0] | null>(null);
```

- [x] **Step 2: Load personas on mount**

หา `useEffect` ที่โหลด models (search for `ai-models.php`) และเพิ่ม persona loading ภายใน useEffect เดียวกัน หรือสร้างใหม่:

```typescript
  useEffect(() => {
    const loadPersonas = async () => {
      try {
        const [listRes, prefRes] = await Promise.all([
          apiFetch('/api/personas.php'),
          apiFetch('/api/personas.php?action=my_preference'),
        ]);
        if (listRes?.data) setPersonas(listRes.data);
        if (prefRes?.data) setActivePersona(prefRes.data);
        else if (listRes?.data?.length) {
          const def = listRes.data.find((p: typeof personas[0]) => p.is_default) ?? listRes.data[0];
          setActivePersona(def);
        }
      } catch (_) {}
    };
    loadPersonas();
  }, []);
```

- [x] **Step 3: Update both getSystemPrompt call sites**

บรรทัด 642 และ 691 — เปลี่ยนจาก:
```typescript
content: getSystemPrompt(user ?? undefined)
```
เป็น:
```typescript
content: getSystemPrompt(user ?? undefined, activePersona)
```

- [x] **Step 4: Add persona switcher UI in chat header**

หา header ของ ChatWidget (ที่มี model selector) และเพิ่ม persona dropdown:

```tsx
{/* เพิ่มข้างๆ model selector */}
{personas.length > 0 && (
  <Select
    value={activePersona?.id ?? ''}
    onValueChange={async (id) => {
      const p = personas.find(x => x.id === id);
      if (!p) return;
      setActivePersona(p);
      await apiFetch('/api/personas.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'set_preference', persona_id: id }),
      });
    }}
  >
    <SelectTrigger className="h-7 w-36 text-xs">
      <SelectValue>
        {activePersona ? `${activePersona.avatar_emoji} ${activePersona.name}` : 'เลือก Persona'}
      </SelectValue>
    </SelectTrigger>
    <SelectContent>
      {personas.map(p => (
        <SelectItem key={p.id} value={p.id}>
          <span className="mr-1">{p.avatar_emoji}</span>
          <span>{p.name}</span>
          {p.description && <span className="ml-1 text-muted-foreground text-xs">— {p.description}</span>}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
)}
```

- [x] **Step 5: Add daily briefing trigger**

หา useEffect ที่โหลด sessions (`GET /chat-history.php?action=sessions`) และหลังจาก sessions โหลดแล้ว เพิ่ม briefing logic:

```typescript
  // After sessions load — trigger daily briefing if no session today
  useEffect(() => {
    if (!sessions.length || !isOpen) return;
    const today = new Date().toDateString();
    const hasSessionToday = sessions.some(s => {
      const d = new Date(s.created_at ?? s.updated_at ?? '');
      return d.toDateString() === today;
    });
    if (!hasSessionToday && activePersona) {
      // Auto-send briefing request
      setTimeout(() => {
        handleSend('สรุป briefing เช้าวันนี้ให้หน่อย: มีนัดหมาย ลา หรือ task ครบกำหนดวันนี้อะไรบ้าง');
      }, 800);
    }
  }, [sessions, isOpen, activePersona]);
```

> หมายเหตุ: `handleSend` ต้องมี signature รับ string override — ตรวจสอบว่า ChatWidget มี function นี้หรือปรับให้รับ optional message parameter

- [x] **Step 6: Build check**

```bash
pnpm build 2>&1 | Select-String "error"
```

Expected: ไม่มี errors

- [ ] **Step 7: Commit**

```bash
git add src/components/ChatWidget.tsx
git commit -m "feat: add persona switcher and daily briefing to ChatWidget"
```

---

## Task 7: `CalendarPage.tsx` + Route + Sidebar

**Files:**
- Create: `src/pages/CalendarPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/AppSidebar.tsx`
- Modify: `api/auth.php`

- [x] **Step 1: Create CalendarPage**

```tsx
// src/pages/CalendarPage.tsx
import { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';
import DashboardLayout from '@/components/DashboardLayout';

const EVENT_TYPE_COLORS: Record<string, string> = {
  meeting: '#3b82f6',
  leave:   '#f59e0b',
  holiday: '#ef4444',
  other:   '#8b5cf6',
  task:    '#10b981',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  meeting: 'ประชุม', leave: 'ลาหยุด', holiday: 'วันหยุด', other: 'อื่นๆ', task: 'Task',
};

interface CalendarEvent {
  id: string; title: string; event_type: string;
  start_at: string; end_at: string; all_day: number;
  description?: string; location?: string; status: string; source?: string;
}

export default function CalendarPage() {
  const qc = useQueryClient();
  const [range, setRange] = useState({ start: '', end: '' });
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    title: '', event_type: 'meeting', start_at: '', end_at: '', all_day: '1',
    description: '', location: '',
  });

  const { data: events = [] } = useQuery<CalendarEvent[]>({
    queryKey: ['calendar', range.start, range.end],
    queryFn: async () => {
      if (!range.start) return [];
      const res = await apiFetch(`/api/calendar.php?start=${range.start}&end=${range.end}`);
      return res?.data ?? [];
    },
    enabled: !!range.start,
  });

  const fcEvents = events
    .filter(e => e.status !== 'cancelled')
    .map(e => ({
      id: e.id,
      title: e.title,
      start: e.all_day ? e.start_at.slice(0, 10) : e.start_at.replace(' ', 'T'),
      end:   e.all_day ? e.end_at.slice(0, 10)   : e.end_at.replace(' ', 'T'),
      allDay: !!e.all_day,
      backgroundColor: EVENT_TYPE_COLORS[e.event_type] ?? '#6b7280',
      borderColor: EVENT_TYPE_COLORS[e.event_type] ?? '#6b7280',
      extendedProps: { event_type: e.event_type, source: e.source },
    }));

  const handleSubmit = async () => {
    if (!form.title || !form.start_at || !form.end_at) {
      toast.error('กรุณากรอกข้อมูลให้ครบ'); return;
    }
    try {
      await apiFetch('/api/calendar.php', {
        method: 'POST',
        body: JSON.stringify({ ...form, all_day: parseInt(form.all_day) }),
      });
      toast.success('บันทึก event เรียบร้อย');
      qc.invalidateQueries({ queryKey: ['calendar'] });
      setShowDialog(false);
      setForm({ title: '', event_type: 'meeting', start_at: '', end_at: '', all_day: '1', description: '', location: '' });
    } catch {
      toast.error('บันทึกไม่สำเร็จ');
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">ปฏิทินทีม</h1>
            <p className="text-muted-foreground text-sm">นัดหมาย วันลา และวันหยุดบริษัท</p>
          </div>
          <Button onClick={() => setShowDialog(true)}>+ เพิ่ม Event</Button>
        </div>

        {/* Legend */}
        <div className="flex gap-4 flex-wrap text-xs">
          {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full inline-block" style={{ background: EVENT_TYPE_COLORS[k] }} />
              {v}
            </span>
          ))}
        </div>

        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale="th"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
          events={fcEvents}
          height="auto"
          datesSet={(info) => setRange({ start: info.startStr.slice(0,10), end: info.endStr.slice(0,10) })}
          dateClick={(info) => {
            setForm(f => ({ ...f, start_at: info.dateStr + ' 09:00:00', end_at: info.dateStr + ' 10:00:00' }));
            setShowDialog(true);
          }}
          eventContent={(arg) => (
            <div className="px-1 truncate text-xs font-medium text-white">
              {arg.event.title}
            </div>
          )}
        />

        {/* Create event dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่ม Event ใหม่</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>ชื่อ Event *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="เช่น ประชุมทีม, ลาพักร้อน" />
              </div>
              <div>
                <Label>ประเภท</Label>
                <Select value={form.event_type} onValueChange={v => setForm(f => ({ ...f, event_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meeting">ประชุม</SelectItem>
                    <SelectItem value="leave">ลาหยุด</SelectItem>
                    <SelectItem value="holiday">วันหยุดบริษัท</SelectItem>
                    <SelectItem value="other">อื่นๆ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>วันที่เริ่ม *</Label>
                  <Input type="datetime-local" value={form.start_at.replace(' ', 'T')}
                    onChange={e => setForm(f => ({ ...f, start_at: e.target.value.replace('T', ' ') }))} />
                </div>
                <div>
                  <Label>วันที่สิ้นสุด *</Label>
                  <Input type="datetime-local" value={form.end_at.replace(' ', 'T')}
                    onChange={e => setForm(f => ({ ...f, end_at: e.target.value.replace('T', ' ') }))} />
                </div>
              </div>
              <div>
                <Label>สถานที่</Label>
                <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
              </div>
              <div>
                <Label>หมายเหตุ</Label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>ยกเลิก</Button>
              <Button onClick={handleSubmit}>บันทึก</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
```

- [x] **Step 2: Add route in `src/App.tsx`**

หา import ล่าสุดของ pages และเพิ่ม:
```typescript
import CalendarPage from './pages/CalendarPage';
```

หาก route ที่มีอยู่ (เช่น `/support`) และเพิ่ม route ใหม่ข้างๆ:
```tsx
<Route path="/calendar" element={
  <PermissionRoute menuKey="calendar">
    <CalendarPage />
  </PermissionRoute>
} />
```

- [x] **Step 3: Add to AppSidebar**

เปิด `src/components/AppSidebar.tsx` หา NAV_GROUPS array และ group ที่เหมาะสม (เช่น `projects` group) เพิ่ม item:
```typescript
{ title: 'ปฏิทินทีม', href: '/calendar', icon: Calendar, menuKey: 'calendar' }
```

(icon `Calendar` น่าจะ import อยู่แล้วใน ChatWidget — ตรวจสอบ import ใน AppSidebar และเพิ่มถ้ายังไม่มี)

- [x] **Step 4: Add 'calendar' to ALL_MENU_KEYS in `api/auth.php`**

หาบรรทัด:
```php
const ALL_MENU_KEYS = ['home','projects','sales','quotations','companies','revenue','resources','timesheet','reports','analytics','marketing','goals','automation','budget','support','admin','inbox'];
```

เปลี่ยนเป็น:
```php
const ALL_MENU_KEYS = ['home','projects','sales','quotations','companies','revenue','resources','timesheet','reports','analytics','marketing','goals','automation','budget','support','admin','inbox','calendar'];
```

- [x] **Step 5: Build check**

```bash
pnpm build 2>&1 | Select-String "error"
```

Expected: ไม่มี errors

- [ ] **Step 6: Dev test**

```bash
pnpm dev
```

เปิด `http://localhost:8080/#/calendar` ตรวจสอบว่า:
- Calendar แสดงผลได้
- sidebar มี "ปฏิทินทีม"
- คลิกวันในปฏิทินแล้ว dialog เปิด
- สร้าง event แล้ว refresh เห็น event บน calendar

- [ ] **Step 7: Commit**

```bash
git add src/pages/CalendarPage.tsx src/App.tsx src/components/AppSidebar.tsx api/auth.php
git commit -m "feat: add CalendarPage with FullCalendar + route + sidebar nav"
```

---

## Task 8: Notification Settings in Profile Page

**Files:**
- Modify: `src/pages/ProfilePage.tsx` (หรือ path ที่ profile page อยู่)
- Modify: `api/profile.php`

- [x] **Step 1: Find profile page path**

```bash
Get-ChildItem -Recurse -Path "c:\xampp\htdocs\flowstack\src" -Filter "*rofile*"
```

- [x] **Step 2: Add notification settings API to `api/profile.php`**

เพิ่ม GET action สำหรับโหลด notification settings (ต่อท้าย fetchProfile function):

```php
// เพิ่ม action handler ใน profile.php
if ($method === 'GET' && ($_GET['action'] ?? '') === 'notification_settings') {
    $stmt = $db->prepare("SELECT * FROM notification_settings WHERE user_id = ?");
    $stmt->execute([$userId]);
    $settings = $stmt->fetch() ?: [
        'user_id' => $userId, 'line_user_id' => null, 'telegram_chat_id' => null,
        'briefing_time' => '08:00:00', 'notify_line' => 0, 'notify_telegram' => 0, 'notify_email' => 1,
    ];
    jsonResponse($settings);
}

// เพิ่ม PUT action สำหรับบันทึก notification settings
if ($method === 'PUT' && ($_GET['action'] ?? '') === 'notification_settings') {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    $db->prepare(
        "INSERT INTO notification_settings (user_id, line_user_id, telegram_chat_id, briefing_time, notify_line, notify_telegram, notify_email)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           line_user_id = VALUES(line_user_id),
           telegram_chat_id = VALUES(telegram_chat_id),
           briefing_time = VALUES(briefing_time),
           notify_line = VALUES(notify_line),
           notify_telegram = VALUES(notify_telegram),
           notify_email = VALUES(notify_email)"
    )->execute([
        $userId,
        $data['line_user_id'] ?? null,
        $data['telegram_chat_id'] ?? null,
        $data['briefing_time'] ?? '08:00:00',
        (int)($data['notify_line'] ?? 0),
        (int)($data['notify_telegram'] ?? 0),
        (int)($data['notify_email'] ?? 1),
    ]);
    jsonResponse(['saved' => true]);
}
```

- [x] **Step 3: Add notification settings UI section in ProfilePage**

เพิ่ม section ใหม่ใน ProfilePage (หลัง profile form เดิม):

```tsx
// เพิ่ม state
const [notifSettings, setNotifSettings] = useState({
  line_user_id: '', telegram_chat_id: '', briefing_time: '08:00',
  notify_line: false, notify_telegram: false, notify_email: true,
});

// โหลดใน useEffect
useEffect(() => {
  apiFetch('/api/profile.php?action=notification_settings').then(res => {
    if (res?.data) {
      setNotifSettings({
        line_user_id: res.data.line_user_id ?? '',
        telegram_chat_id: res.data.telegram_chat_id ?? '',
        briefing_time: (res.data.briefing_time ?? '08:00:00').slice(0, 5),
        notify_line: !!res.data.notify_line,
        notify_telegram: !!res.data.notify_telegram,
        notify_email: !!res.data.notify_email,
      });
    }
  });
}, []);

// Save handler
const saveNotifSettings = async () => {
  await apiFetch('/api/profile.php?action=notification_settings', {
    method: 'PUT',
    body: JSON.stringify({
      ...notifSettings,
      briefing_time: notifSettings.briefing_time + ':00',
      notify_line: notifSettings.notify_line ? 1 : 0,
      notify_telegram: notifSettings.notify_telegram ? 1 : 0,
      notify_email: notifSettings.notify_email ? 1 : 0,
    }),
  });
  toast.success('บันทึกการแจ้งเตือนเรียบร้อย');
};

// UI section (เพิ่มใน return JSX):
<Card>
  <CardHeader><CardTitle>การแจ้งเตือน</CardTitle></CardHeader>
  <CardContent className="space-y-4">
    <div className="flex items-center justify-between">
      <Label>เวลา Briefing เช้า</Label>
      <Input type="time" className="w-32" value={notifSettin