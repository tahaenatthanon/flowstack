# Cron Jobs CRUD — Design Spec
**Date:** 2026-06-08  
**Status:** Approved

## Problem

`cron_jobs` ปัจจุบัน hardcode อยู่ใน `$JOB_REGISTRY` ใน `api/cron-manager.php` ทำให้ Admin ไม่สามารถแก้ไข เปิด/ปิด เพิ่ม หรือลบ job ได้จาก UI ต้องแก้โค้ดโดยตรง

## Approach: DB-first

ย้าย job registry ทั้งหมดไปเก็บใน table `cron_jobs` ใน MariaDB — built-in 4 jobs seed เข้า DB ตอน migrate UI ทำ CRUD ได้ครบ ไม่มี split state ระหว่าง PHP กับ DB

---

## Database

### Table: `cron_jobs`

```sql
CREATE TABLE cron_jobs (
  id            CHAR(36) NOT NULL PRIMARY KEY,
  `key`         VARCHAR(60) NOT NULL UNIQUE,
  name          VARCHAR(100) NOT NULL,
  description   TEXT,
  interval_label VARCHAR(100),
  type          ENUM('http','include') NOT NULL DEFAULT 'http',
  endpoint      VARCHAR(255) DEFAULT NULL,
  file_path     VARCHAR(500) DEFAULT NULL,
  http_method   ENUM('GET','POST') NOT NULL DEFAULT 'GET',
  query_string  VARCHAR(255) DEFAULT NULL,
  enabled       TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Seed data (4 built-in jobs):**

| key | type | endpoint / file_path |
|---|---|---|
| cron-publish | http | cron-publish.php |
| publish-scheduler | include | api/cron/publish-scheduler.php |
| notification-dispatch | http | notification-dispatch.php |
| recurring-tasks | http | recurring-tasks.php (POST) |

### Table: `cron_runs` (ไม่เปลี่ยน schema)

เพิ่มแค่ index บน `job_name` ถ้ายังไม่มี — ใช้สำหรับ history query

---

## API: `api/cron-manager.php`

Auth: `requireAuth()` + `requireAdmin()` ทุก endpoint

| Method | Query params | Body | ผลลัพธ์ |
|---|---|---|---|
| GET | — | — | array of jobs + last_run merged |
| POST | `action=run&job=<key>` | — | run result (success, output, processed, errors) |
| POST | `action=create` | JSON job fields | job object ที่สร้าง |
| PUT | `action=update&job=<key>` | JSON job fields | job object ที่อัพเดต |
| DELETE | `action=delete&job=<key>` | — | `{success: true}` |
| DELETE | `action=clear-history&job=<key>` | — | `{deleted: N}` |

**GET response shape (per job):**
```json
{
  "key": "cron-publish",
  "name": "Content Publish Scheduler",
  "description": "...",
  "interval_label": "ทุก 1 นาที",
  "type": "http",
  "endpoint": "cron-publish.php",
  "file_path": null,
  "http_method": "GET",
  "query_string": null,
  "enabled": 1,
  "last_started_at": "2026-06-08 06:02:44",
  "last_finished_at": "2026-06-08 06:02:45",
  "last_processed": 1,
  "last_errors": 0,
  "last_notes": "..."
}
```

**Validation:**
- `key` ต้องเป็น `[a-z0-9-]+` ไม่ซ้ำ
- `type=http` ต้องมี `endpoint`
- `type=include` ต้องมี `file_path`
- ห้ามลบ job ที่ `enabled=1` โดยไม่ disable ก่อน (frontend enforce, ไม่ใช่ server)

---

## Frontend: `src/components/admin/CronJobsPanel.tsx`

### Layout

```
[ส่วนหัว: "Cron Jobs"  description]          [+ เพิ่ม Job] [รีเฟรช]
─────────────────────────────────────────────────────────────
[card job 1]
  [ชื่อ] [StatusBadge]        [Toggle enable] [Edit] [Delete] [Run Now]
  description · interval
  last run: X นาทีที่แล้ว · ประมวลผล N รายการ
  [▸ ดู History (10 ครั้งล่าสุด)]   [ล้าง History]
─────────────────────────────────────────────────────────────
[card job 2] ...
```

### Dialogs

**Add / Edit Dialog** (shared form):
- `name` — Input (required)
- `key` — Input (required, disabled ถ้า edit)
- `description` — Textarea
- `interval_label` — Input (display text เท่านั้น เช่น "ทุก 1 นาที")
- `type` — Select: http / include
- `endpoint` — Input (แสดงเมื่อ type=http)
- `file_path` — Input (แสดงเมื่อ type=include)
- `http_method` — Select: GET / POST (แสดงเมื่อ type=http)
- `query_string` — Input optional

**Delete Confirm Dialog:**
> "ต้องการลบ job \<name\> ใช่ไหม? การลบจะไม่สามารถกู้คืนได้"
> ปุ่ม: ยกเลิก | ลบ (destructive)

**History Panel** (expand inline ใต้ card):
- ตาราง 10 แถวล่าสุดจาก cron_runs: started_at, duration, processed, errors, notes snippet
- ปุ่ม "ล้าง History" → confirm → `DELETE ?action=clear-history&job=key`

### State & Data Fetching

- `useQuery(['cron-jobs'])` — refetch interval 15s
- `useMutation` แยกต่อ action: create, update, delete, clear-history, run
- หลัง mutate ทุกอย่าง: `invalidateQueries(['cron-jobs'])`
- Toggle enable/disable: เรียก `PUT ?action=update&job=key` body `{enabled: 0|1}` ทันที (optimistic update)

### History data

GET `/cron-manager.php?action=history&job=<key>` → 10 rows ล่าสุดจาก `cron_runs`  
(เพิ่ม action นี้ใน API)

---

## Migration File

`database/migrations/2026_06_08_000001_create_cron_jobs_table.sql`

1. `CREATE TABLE cron_jobs`
2. `INSERT` seed data 4 jobs
3. `ALTER TABLE cron_runs ADD INDEX IF NOT EXISTS` บน `job_name`

---

## Run Conditions

### 1. Job disabled (enabled = 0)
ยังกด Run Now ได้ แต่ระบบแสดง confirm dialog ก่อน:
> "Job นี้ถูกปิดอยู่ ต้องการรันครั้งเดียวโดยไม่เปิด job ไหม?"
> ปุ่ม: ยกเลิก | รันครั้งเดียว

### 2. Job กำลังรันอยู่ (running state)
ตรวจจาก: `last_started_at IS NOT NULL AND last_finished_at IS NULL AND last_started_at > NOW() - INTERVAL 10 MINUTE`
→ ถือว่า running → block ปุ่ม Run Now (disabled) แสดง badge "กำลังรัน" สีเหลือง

### 3. Job ค้าง / timeout (stuck state)
ตรวจจาก: `last_started_at IS NOT NULL AND last_finished_at IS NULL AND last_started_at <= NOW() - INTERVAL 10 MINUTE`
→ ถือว่า stuck → แสดง badge "ค้าง" สีแดง → ปลดล็อกปุ่ม Run Now ให้รันใหม่ได้
→ เมื่อกด Run Now ขณะ stuck: อัพเดต cron_runs record เดิมให้ `finished_at = NOW(), errors = 1, notes = 'Force-restarted after timeout'` ก่อน แล้วค่อย insert run ใหม่

### 4. Scheduling
`interval_label` เป็น **display text เท่านั้น** (เช่น "ทุก 1 นาที") — ไม่มี auto-trigger ใน app การ schedule จริงทำผ่าน Windows Task Scheduler / OS cron แยกต่างหาก

---

## Out of Scope

- ไม่มี cron expression editor หรือ in-app scheduler
- ไม่มี per-tenant jobs (cron เป็น system-level)
- ไม่มี webhook trigger จากภายนอก
