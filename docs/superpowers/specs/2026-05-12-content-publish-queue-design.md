# Content Publish Queue — Design Spec

**Date:** 2026-05-12  
**Status:** Approved

---

## Overview

เพิ่มระบบ draft/publish status, queue-based scheduling, และ manual send สำหรับ ContentPage โดย content item ที่ status=`published` เท่านั้นสามารถถูก schedule หรือ send ไปยัง platform ได้ การส่งจริงใช้ stub dispatch functions ก่อน (credentials config ทีหลัง)

---

## Section 1: Database Schema

### 1.1 Expand publish_channels.platform enum

```sql
ALTER TABLE `publish_channels`
  MODIFY `platform` ENUM('wordpress','wix','custom','facebook',
                         'lineoa','instagram','tiktok','linkedin','twitter') NOT NULL;
```

**Why:** platform enum เดิมขาด instagram, tiktok, linkedin, twitter

### 1.2 Add scheduled_at to content_items

```sql
ALTER TABLE `content_items`
  ADD COLUMN `scheduled_at` DATETIME DEFAULT NULL
  AFTER `scheduled_date`;
```

**Why:** `scheduled_date` (DATE) ไม่มีเวลา — ต้องการ DATETIME สำหรับ cron precision  
**Note:** `scheduled_date` เก็บไว้เพื่อ backward compat กับ ContentPlanner calendar view

### 1.3 New table: content_publish_queue

```sql
CREATE TABLE `content_publish_queue` (
  `id`           CHAR(36) NOT NULL,
  `tenant_id`    CHAR(36) NOT NULL,
  `content_id`   CHAR(36) NOT NULL COMMENT 'FK → content_items.id',
  `channel_id`   CHAR(36) NOT NULL COMMENT 'FK → publish_channels.id',
  `scheduled_at` DATETIME NOT NULL,
  `status`       ENUM('pending','processing','sent','failed') NOT NULL DEFAULT 'pending',
  `sent_at`      DATETIME DEFAULT NULL,
  `error_msg`    VARCHAR(500) DEFAULT NULL,
  `retry_count`  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at`   DATETIME NOT NULL DEFAULT current_timestamp(),
  `updated_at`   DATETIME NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_tenant_status_scheduled` (`tenant_id`, `status`, `scheduled_at`),
  KEY `idx_content_id` (`content_id`),
  KEY `idx_channel_id` (`channel_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Business rule:** queue entry สร้างได้เฉพาะเมื่อ `content_items.status = 'published'`

---

## Section 2: Backend

### 2.1 API: api/content-publish.php

| Method | Params | Action | Auth |
|--------|--------|--------|------|
| GET | `content_id` | ดู queue entries ของ content | requireAuth |
| POST | `action=schedule`, `content_id`, `channel_ids[]`, `scheduled_at` | เพิ่ม queue entries | requireAuth |
| POST | `action=send_now`, `content_id`, `channel_ids[]` | ส่งทันที (scheduled_at=NOW()) | requireAuth |
| POST | `action=cancel`, `queue_id` | ยกเลิก pending entry | requireAuth |
| DELETE | `id` | ลบ queue entry | requireAuth |

**Validation:**
- `schedule` และ `send_now`: ตรวจ `content_items.status = 'published'` ก่อน ถ้าไม่ใช่ return 422
- `scheduled_at` ต้องไม่อยู่ในอดีต (>= NOW()) สำหรับ `schedule`
- channel_ids ต้องเป็น active channels ของ tenant เดียวกัน

### 2.2 Cron Job: api/cron/publish-scheduler.php

**รันทุก 1 นาที** (เพิ่มใน XAMPP Task Scheduler หรือ cron)

```
Flow:
1. SELECT * FROM content_publish_queue
   WHERE status='pending' AND scheduled_at <= NOW() AND tenant_id = ...
   LIMIT 50

2. สำหรับแต่ละ entry:
   a. UPDATE status='processing'
   b. โหลด content_items + publish_channels
   c. เรียก dispatch_{platform}($channel, $content)
   d. ถ้าสำเร็จ: UPDATE status='sent', sent_at=NOW()
   e. ถ้าล้มเหลว: UPDATE status='failed', error_msg=..., retry_count++
      - retry_count < 3: reset status='pending', scheduled_at = NOW()+5min
      - retry_count >= 3: คงเป็น failed

3. Log ผลลัพธ์ใน error_log
```

**Dispatch stubs (api/lib/publish-dispatch.php):**

```php
function dispatch_facebook($channel, $content): array {
  // TODO: Meta Graph API POST /me/feed
  return ['success' => true, 'platform_post_id' => null];
}
function dispatch_instagram($channel, $content): array { ... }
function dispatch_tiktok($channel, $content): array { ... }
function dispatch_lineoa($channel, $content): array { ... }
function dispatch_linkedin($channel, $content): array { ... }
function dispatch_twitter($channel, $content): array { ... }
function dispatch_wordpress($channel, $content): array { ... }
function dispatch_wix($channel, $content): array { ... }
function dispatch_custom($channel, $content): array { ... }
```

แต่ละ stub return `['success' => true]` และ log ว่าถูกเรียก

### 2.3 Reminder Data

`GET api/content-publish.php?action=overdue_count` — return จำนวน entries ที่ `status='pending'` และ `scheduled_at < NOW()` (cron ไม่ทำงาน หรือยังไม่ถูก process)

---

## Section 3: Frontend UI

### 3.1 Content Item Status

`content_items.status` มี 3 ค่า:
- `draft` — ร่าง (gray badge) — แสดงแค่ปุ่ม **แก้ไข** + **เผยแพร่**
- `review` — รออนุมัติ (amber badge) — แสดงแค่ปุ่ม **อนุมัติ** + **ปฏิเสธ**
- `published` — เผยแพร่ (green badge) — แสดงปุ่ม **ตั้งเวลา** + **ส่งเลย**

### 3.2 Schedule Dialog

เปิดจากปุ่ม **ตั้งเวลา** บน published content:
```
[x] Facebook — "Facebook Page"
[x] Instagram — "IG Business"
[ ] TikTok
[ ] Line OA
─────────────────────────────
📅 วันที่  [2026-05-15]
🕐 เวลา   [10:00]
─────────────────────────────
[ยกเลิก]              [ตั้งเวลา]
```
- แสดงเฉพาะ channels ที่ `is_active=1` ของ tenant
- validate: ต้องเลือก channel อย่างน้อย 1 และเวลาต้องไม่ผ่านมาแล้ว

### 3.3 Queue Status Chips (บน content card)

| สถานะ queue | Chip |
|------------|------|
| pending, scheduled_at > NOW() | `⏳ รอส่ง 15 พ.ค. 10:00` |
| pending, scheduled_at <= NOW() | `🔴 เลยเวลา` + ปุ่ม **ส่งเลย** |
| processing | `🔄 กำลังส่ง...` |
| sent | `✅ ส่งแล้ว` |
| failed | `⚠️ ส่งไม่สำเร็จ` + ปุ่ม **ลองใหม่** |

### 3.4 Reminder Banner (ด้านบน ContentPage)

แสดงเมื่อมี overdue_count > 0:
```
⚠️  มี {n} โพสต์เลยเวลาที่ตั้งไว้แต่ยังไม่ถูกส่ง   [ดูรายการ]
```
กด **ดูรายการ** → filter content list เหลือแค่ที่มี overdue queue

### 3.5 Filter Bar

เพิ่ม dropdown กรอง status: ทั้งหมด / ร่าง / รออนุมัติ / เผยแพร่

---

## Data Flow Summary

```
User กด "เผยแพร่" → content_items.status = 'published'

User กด "ตั้งเวลา" → POST api/content-publish.php?action=schedule
  → INSERT content_publish_queue (status=pending, scheduled_at=X)

User กด "ส่งเลย" → POST api/content-publish.php?action=send_now
  → INSERT content_publish_queue (status=processing, scheduled_at=NOW())
  → dispatch_{platform}() ทันที (synchronous, ไม่รอ cron)
  → UPDATE status=sent/failed ก่อน return response

Cron (ทุก 1 นาที) → publish-scheduler.php
  → SELECT pending entries WHERE scheduled_at <= NOW()
  → dispatch_{platform}() → UPDATE status=sent/failed

Frontend poll (ทุก 30 วินาที) → GET overdue_count
  → แสดง reminder banner ถ้า > 0
```

---

## Out of Scope (ทำทีหลัง)

- Actual API credentials integration (Meta Graph, TikTok API, etc.)
- Multi-image / carousel posts
- Post performance metrics after publishing
- Approval workflow (review status)
