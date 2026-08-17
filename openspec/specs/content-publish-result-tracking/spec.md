# content-publish-result-tracking Specification

## Purpose

กำหนดให้ระบบบันทึกผลการเผยแพร่คอนเทนต์อย่างเป็นระบบ — เมื่อเผยแพร่สำเร็จผ่านเส้นทางใดก็ตาม (`send_now`, cron queue, `?action=publish`, `?action=cron-publish`) ระบบจะอัปเดต `content_items` เป็น `published` พร้อมเวลาและข้อมูลอ้างอิงของโพสต์จริง (post id / URL) และบันทึกข้อมูลอ้างอิงเดียวกันลงใน `content_publish_queue` / `content_schedules` เพื่อให้เฟสถัดไป (เมตริกผลลัพธ์, SEO, ติดตามอันดับ) มีวัตถุดิบที่ครบถ้วน

## Requirements

### Requirement: schema มีคอลัมน์สำหรับบันทึกผลเผยแพร่
ฐานข้อมูล SHALL มีคอลัมน์ใหม่ดังนี้

- `content_items`: `published_at DATETIME NULL`, `published_url VARCHAR(1000) NULL`, `external_post_id VARCHAR(255) NULL`
- `content_publish_queue`: `platform_post_id VARCHAR(255) NULL`, `published_url VARCHAR(1000) NULL`
- `content_schedules`: `platform_post_id VARCHAR(255) NULL`, `published_url VARCHAR(1000) NULL`

#### Scenario: migration เพิ่มคอลัมน์สำเร็จ
- **WHEN** database migration ของเฟสนี้รันสำเร็จ
- **THEN** `SHOW COLUMNS FROM content_items` มีคอลัมน์ `published_at`, `published_url`, `external_post_id`
- **AND** `content_publish_queue` และ `content_schedules` มีคอลัมน์ `platform_post_id`, `published_url`

### Requirement: การเผยแพร่สำเร็จบันทึกผลลง content_items
เมื่อการเผยแพร่ผ่านช่องทางใดสำเร็จ ระบบ SHALL อัปเดต `content_items` เป็น `status='published'`, `published_at=NOW()`, และบันทึก `published_url`/`external_post_id` (ถ้ามี) โดยใช้คีย์ `id` ที่ตรงกับแถวที่โหลดมา

#### Scenario: send_now เผยแพร่สำเร็จ
- **WHEN** ผู้ใช้เรียก `send_now` และ `dispatch_content()` คืน `success=true`
- **THEN** `content_items` แถว `id = content_id` ได้รับ `status='published'`, `published_at` ไม่เป็น NULL, `external_post_id = platform_post_id` (ถ้ามี), และ `published_url` (ถ้ามี)

#### Scenario: cron queue เผยแพร่สำเร็จ
- **WHEN** `publish-scheduler.php` ประมวลผลแถว pending และ `dispatch_content()` คืน `success=true`
- **THEN** `content_items` แถว `id = content_id` ได้รับ `status='published'`, `published_at` ไม่เป็น NULL, `external_post_id = platform_post_id` (ถ้ามี)

#### Scenario: ?action=publish เผยแพร่สำเร็จด้วยคีย์ที่ตรงกัน
- **WHEN** ผู้ใช้เรียก `?action=publish` ด้วย `item_id` และ inline curl ของ platform คืนผลสำเร็จ (เช่น WordPress มี `id`)
- **THEN** `content_items` แถว `id = item_id` ได้รับ `status='published'`, `published_at` ไม่เป็น NULL
- **AND** ไม่ใช้ `plan_item_id` เป็นเงื่อนไขอัปเดตอีกต่อไป (แก้บั๊กคีย์ไม่ตรงกัน)

#### Scenario: ?action=cron-publish เผยแพร่สำเร็จ
- **WHEN** `?action=cron-publish` ประมวลผล `content_schedules` ที่ถึงกำหนดและ platform คืนผลสำเร็จ
- **THEN** `content_items` ของ `plan_item_id` ที่สอดคล้องได้รับ `status='published'`, `published_at` ไม่เป็น NULL

### Requirement: บันทึกข้อมูลอ้างอิงโพสต์ลง content_publish_queue
เมื่อ cron queue ส่งสำเร็จ ระบบ SHALL เขียน `platform_post_id` และ `published_url` (ถ้ามี) กลับลงแถว `content_publish_queue` ที่กำลังประมวลผล

#### Scenario: queue ได้ platform_post_id
- **WHEN** `publish-scheduler.php` ส่งสำเร็จและผล dispatch มี `platform_post_id`
- **THEN** แถว `content_publish_queue` นั้นมี `platform_post_id` ไม่เป็น NULL และ `status='sent'`

### Requirement: บันทึกข้อมูลอ้างอิงโพสต์ลง content_schedules
เมื่อเผยแพร่ผ่าน `content_schedules` สำเร็จ ระบบ SHALL เขียน `platform_post_id` และ `published_url` (ถ้ามี) ลงแถว `content_schedules` ที่เกี่ยวข้อง

#### Scenario: schedules ได้ platform_post_id
- **WHEN** `?action=publish` หรือ `?action=cron-publish` ส่งสำเร็จและได้ post id/url จากผล platform
- **THEN** แถว `content_schedules` ที่เกี่ยวข้องมี `platform_post_id`/`published_url` (ถ้ามี) พร้อม `status='sent'`

### Requirement: การเผยแพร่ล้มเหลวไม่ทำให้ content_items เป็น published
เมื่อการเผยแพร่ล้มเหลว ระบบ SHALL ไม่ตั้ง `content_items.status='published'` และไม่ตั้ง `published_at`

#### Scenario: ส่งล้มเหลว
- **WHEN** `dispatch_content()` คืน `success=false` (หรือ inline curl ล้มเหลว)
- **THEN** `content_items` ยังคงสถานะเดิมและ `published_at` เป็น NULL
- **AND** แถว queue/schedules ถูกตั้งเป็น `failed` พร้อม `error_msg`
