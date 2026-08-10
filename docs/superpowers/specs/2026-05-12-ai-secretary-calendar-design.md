# FlowStack AI Secretary & Central Calendar — Design Spec
**Date:** 2026-05-12  
**Status:** Approved for implementation planning  
**Scope:** Phase 1 — Central Calendar + AI Persona System + Proactive Notifications

> **Current-State Addendum (2026-05-20):**
> - เอกสารนี้เป็น design spec ณ ช่วงเริ่มต้นโครงการ
> - สถานะปัจจุบันกำหนดให้ `calendar_events` เป็น source-of-truth สำหรับ `holiday`/`leave`
> - ข้อมูล `task_type='holiday'|'leave'` ใน `tasks` ใช้เพื่อ compatibility เท่านั้น

---

## 1. Overview

ขยาย FlowStack AI Chat Widget ให้ทำงานเป็น "เลขาส่วนตัว AI" ที่:
- มีตาราง Calendar กลางเก็บวันหยุด, ลา, นัดหมาย, deadline โครงการ
- สามารถบันทึกและอ่านนัดหมายผ่านแชตด้วยภาษาธรรมชาติ
- มี AI Persona ที่เลือกบทบาท/บุคลิกได้ พร้อมปรับ data scope
- ส่ง briefing และแจ้งเตือนผ่าน Line OA, Telegram, Email

---

## 2. Database Schema

### 2.1 `calendar_events`

```sql
CREATE TABLE calendar_events (
  id           CHAR(36) PRIMARY KEY,
  tenant_id    CHAR(36) NOT NULL,
  created_by   CHAR(36) NOT NULL REFERENCES users(id),
  project_id   CHAR(36) DEFAULT NULL REFERENCES projects(id) ON DELETE SET NULL,

  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  location     VARCHAR(255),

  event_type   ENUM('meeting','leave','holiday','other') NOT NULL,
  start_at     DATETIME NOT NULL,
  end_at       DATETIME NOT NULL,
  all_day      TINYINT(1) DEFAULT 0,

  recurrence   VARCHAR(50) DEFAULT NULL,  -- 'weekly', 'monthly', NULL
  status       ENUM('confirmed','tentative','cancelled') DEFAULT 'confirmed',

  attendees    JSON DEFAULT NULL,  -- [{"user_id": "...", "name": "..."}]

  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_tenant_start (tenant_id, start_at),
  INDEX idx_created_by (created_by),
  INDEX idx_project (project_id)
);
-- หมายเหตุ: task deadlines ไม่เก็บที่นี่ — อ่านจาก tasks.due_date โดยตรง
```

**หมายเหตุ:**
- `event_type = 'holiday'` → วันหยุดบริษัท ไม่ผูก user, visible ทุกคน
- `event_type = 'leave'` → ลาหยุด ผูกกับ `created_by`
- `project_id` optional — event อยู่ได้โดยไม่ต้องมี project
- tasks เดิมใน KTN Operations 2026 ไม่ migrate — Calendar page แสดง tasks.due_date ควบคู่กับ calendar_events

### 2.2 `ai_personas`

```sql
CREATE TABLE ai_personas (
  id           CHAR(36) PRIMARY KEY,
  tenant_id    CHAR(36) NOT NULL,
  name         VARCHAR(100) NOT NULL,
  avatar_emoji VARCHAR(10) DEFAULT '🤖',
  description  VARCHAR(255),
  personality  TEXT NOT NULL,   -- system prompt fragment สำหรับบุคลิก
  data_scope   ENUM('personal','team','admin') DEFAULT 'personal',
  is_default   TINYINT(1) DEFAULT 0,
  created_by   CHAR(36) NOT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**data_scope:**
- `personal` — เห็นเฉพาะงานและ calendar ของตัวเอง
- `team` — เห็นงานและ calendar ของทีม
- `admin` — เห็น KPI และข้อมูลทั้งบริษัท (เฉพาะ admin user)

### 2.3 `user_persona_preference`

```sql
CREATE TABLE user_persona_preference (
  user_id    CHAR(36) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  persona_id CHAR(36) NOT NULL REFERENCES ai_personas(id) ON DELETE SET NULL
);
```

### 2.4 `notification_settings` (เพิ่มคอลัมน์ใน users หรือตารางแยก)

```sql
CREATE TABLE notification_settings (
  user_id          CHAR(36) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  line_user_id     VARCHAR(100) DEFAULT NULL,
  telegram_chat_id VARCHAR(100) DEFAULT NULL,
  briefing_time    TIME DEFAULT '08:00:00',
  notify_line      TINYINT(1) DEFAULT 0,
  notify_telegram  TINYINT(1) DEFAULT 0,
  notify_email     TINYINT(1) DEFAULT 1,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 2.5 `notification_log`

```sql
CREATE TABLE notification_log (
  id       CHAR(36) PRIMARY KEY,
  user_id  CHAR(36) NOT NULL,
  channel  ENUM('line','telegram','email','in_app'),
  message  TEXT,
  sent_at  DATETIME,
  status   ENUM('sent','failed'),
  error    VARCHAR(255) DEFAULT NULL
);
```

---

## 3. API Endpoints

### 3.1 `api/calendar.php`

| Method | Parameters | Description |
|--------|-----------|-------------|
| GET | `?start=&end=` | ดู events ในช่วงเวลา (ของ user ปัจจุบัน + holidays) |
| GET | `?user_id=&type=` | ดู events รายคน/ประเภท (admin เท่านั้น) |
| GET | `?id=` | ดู event เดียว |
| POST | body: event object | สร้าง event ใหม่ |
| PUT | `?id=` + body | แก้ไข event |
| DELETE | `?id=` | soft-delete (status='cancelled') |

**Security:** `requireAuth()` บังคับ, non-admin เขียนได้เฉพาะ event ของตัวเอง

### 3.2 `api/personas.php`

| Method | Description |
|--------|-------------|
| GET | ดูรายการ personas ของ tenant |
| POST | สร้าง persona ใหม่ (admin) |
| PUT `?id=` | แก้ไข persona (admin) |
| DELETE `?id=` | ลบ persona (admin) |
| POST `?action=set_preference` | user เลือก persona ที่ต้องการใช้ |
| GET `?action=my_preference` | ดู persona ปัจจุบันของ user |

### 3.3 `api/notification-dispatch.php`

- ถูกเรียกโดย cron job ทุก 15 นาที
- ตรวจ `briefing_time` ของแต่ละ user
- Query events + tasks ใน 24h ข้างหน้า
- ส่งผ่าน Line Messaging API, Telegram Bot API, PHPMailer
- บันทึกผลใน `notification_log`

---

## 4. Chat System Prompt Extensions

### 4.1 Calendar Tool-Calls ใหม่

เพิ่มใน `src/lib/schemaContext.ts` (system prompt section):

```
## Calendar Tools
You can read and write calendar events using these tool calls:

Read upcoming events:
[TOOL_CALL]
--endpoint--> /api/calendar.php
--method--> GET
--body--> {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}
[/TOOL_CALL]

Create a leave/meeting/holiday event:
[TOOL_CALL]
--endpoint--> /api/calendar.php
--method--> POST
--body--> {"title": "...", "event_type": "leave|meeting|holiday", "start_at": "YYYY-MM-DD HH:MM:SS", "end_at": "YYYY-MM-DD HH:MM:SS", "all_day": 1}
[/TOOL_CALL]
```

### 4.2 Persona System Prompt Injection

`ChatWidget.tsx` จะ:
1. โหลด persona ที่ user เลือกไว้จาก `api/personas.php?action=my_preference`
2. นำ `personality` field ใส่ต่อท้าย system prompt
3. นำ `data_scope` กำหนดส่วน "data access instructions" ใน prompt

ตัวอย่าง personality text ของ **นิน่า:**
```
คุณชื่อนิน่า เป็นผู้ช่วยส่วนตัวที่สุภาพเรียบร้อยแบบสไตล์ญี่ปุ่น 
ใส่ใจรายละเอียด มักเริ่มต้นด้วยการสรุปสิ่งที่ทำได้ก่อนลงมือทำ 
ใช้ภาษาสุภาพ ไม่ใช้คำสแลง และมักจบด้วยการถามว่าต้องการอะไรเพิ่มเติมไหม
```

### 4.3 Daily Briefing Logic

เมื่อ user เปิดแชตครั้งแรกของวัน (ตรวจจาก `chat_sessions` วันนี้ยังไม่มี):
1. AI query `calendar.php` วันนี้
2. AI query tasks ที่ due วันนี้และพรุ่งนี้
3. สรุป briefing ตาม persona ที่เลือก

---

## 5. Frontend Components

### 5.1 Calendar Page (`src/pages/CalendarPage.tsx`)

- Route: `/calendar`
- PermissionRoute: `menuKey="calendar"` (ต้องเพิ่มใหม่)
- Page title แสดง: "ปฏิทินทีม" (ไม่ใช่ "ปฏิทิน" เพื่อไม่สับสนกับ "ปฏิทินคอนเทนต์" ใน Marketing)
- Views: Month view, Week view, Day view
- Filter: event_type, user (admin)
- สร้าง event ได้ผ่าน click บน calendar
- ใช้ library: `@fullcalendar/react` + `@fullcalendar/daygrid` + `@fullcalendar/timegrid` + `@fullcalendar/interaction` — **ติดตั้งอยู่แล้ว** ไม่ต้อง install เพิ่ม

### 5.2 Persona Switcher (ใน `ChatWidget.tsx`)

- Dropdown ที่ chat header แสดง avatar_emoji + name
- เลือก persona → reload system prompt + บันทึก preference
- แสดง "แนะนำ" badge บน persona ที่ AI แนะนำ

### 5.3 Notification Settings (ใน Profile page)

- Line User ID input + instructions
- Telegram Chat ID input + instructions  
- Time picker สำหรับ briefing time
- Toggle สำหรับแต่ละช่องทาง

---

## 6. Seed Data — Default Personas

| Name | Emoji | Scope | บุคลิก |
|------|-------|-------|--------|
| ผู้ช่วยมาตรฐาน | 🤖 | personal | กระชับ ทางการ ตรงประเด็น |
| นิน่า | 👩‍💼 | personal | ญี่ปุ่น สุภาพ ใส่ใจรายละเอียด |
| พี่โต้ง | 😎 | personal | เป็นกันเอง ตรงไปตรงมา |
| CEO Analyst | 📊 | admin | เชิงกลยุทธ์ KPI-focused |
| เลขา Scheduler | 📅 | personal | เน้น calendar/นัดหมาย |
| Coach | 🎯 | personal | กระตุ้น ให้กำลังใจ ติดตาม goal |

---

## 7. Navigation & Permissions

เพิ่มใน `src/components/AppSidebar.tsx` NAV_GROUPS:
```
{ title: "ปฏิทินทีม", url: "/calendar", icon: Calendar, menuKey: "calendar" }
```
**หมายเหตุ:** ใช้ icon `Calendar` (ไม่ใช่ `CalendarDays` ที่ใช้อยู่แล้วใน "ปฏิทินคอนเทนต์" ของ Marketing)

เพิ่มใน `api/auth.php` ALL_MENU_KEYS:
```
"calendar"
```

---

## 8. Compatibility Notes

- `calendar_events` เป็น source-of-truth สำหรับ `holiday` และ `leave`; ค่า `task_type='holiday'|'leave'` ใน `tasks` ใช้เพื่อ compatibility เท่านั้น
- `tasks` table ยังมี `task_type` ENUM (`'meeting','holiday','leave'`) สำหรับข้อมูลเก่าและการอ่านย้อนหลังในบางรายงาน
- `company_settings` มี `ai_*` columns หลายตัวอยู่แล้ว → ไม่เพิ่ม column ใหม่ใน company_settings สำหรับ persona (ใช้ตาราง `ai_personas` แทน)
- `getCalendarContext()` ใน schemaContext.ts เป็น date-math utility ไม่เกี่ยวกับ calendar events — ไม่ต้องแก้ไข

## 9. Out of Scope (Phase 1)

- Google Calendar / Outlook sync (Phase 2)
- `task_deadline` event type — Calendar page อ่าน tasks.due_date โดยตรงแทน
- Admin CRUD UI สำหรับ personas — ใช้ seed data ผ่าน migration, เลื่อนไป Phase 2
- Multi-step agent loop (ทำ tool call หลายรอบต่อ turn)
- Recurring event UI (recurrence field มีใน DB แต่ UI รองรับในภายหลัง)
- การ migrate tasks จาก KTN Operations 2026 เข้า calendar_events

---

## 10. Implementation Order

1. DB migration (4 ตาราง: calendar_events, ai_personas, user_persona_preference, notification_settings, notification_log)
2. `api/calendar.php`
3. `api/personas.php` + seed data (6 personas via migration)
4. `api/notification-dispatch.php` + cron
5. Update `src/lib/schemaContext.ts` (calendar tools + persona injection)
6. Update `ChatWidget.tsx` (persona switcher + briefing logic)
7. `CalendarPage.tsx` + route + sidebar (แสดง calendar_events + tasks.due_date รวมกัน)
8. Notification settings UI ใน Profile
