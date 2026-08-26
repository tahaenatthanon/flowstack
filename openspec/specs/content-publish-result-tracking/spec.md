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

### Requirement: การเผยแพร่สำเร็จเขียน platform ให้ตรงกับ channel ที่โพสต์จริง
เมื่อการเผยแพร่ผ่านช่องทางใดสำเร็จ ระบบ SHALL เขียน `content_items.platform` ให้เท่ากับ `platform` ของ channel ที่ใช้โพสต์จริง (ค่าเดียวกับคอลัมน์ `publish_channels.platform`) พร้อมกับ `status='published'` ในทุกเส้นทางเผยแพร่

#### Scenario: send_now เขียน platform จาก channel
- **WHEN** ผู้ใช้เรียก `send_now` ไปยัง channel ที่มี `platform='facebook'` และ dispatch สำเร็จ
- **THEN** `content_items` แถวที่ถูกอัปเดตมี `platform='facebook'` และ `status='published'`

#### Scenario: cron queue เขียน platform จาก channel
- **WHEN** `publish-scheduler.php` ส่งผ่าน channel ที่มี `platform='facebook'` สำเร็จ
- **THEN** `content_items` แถว `content_id` มี `platform='facebook'`

#### Scenario: ?action=publish เขียน platform จาก channel
- **WHEN** ผู้ใช้เรียก `?action=publish` ผ่าน channel ที่มี `platform='facebook'` และสำเร็จ
- **THEN** `content_items` แถว `id=item_id` มี `platform='facebook'`

#### Scenario: ?action=cron-publish เขียน platform จาก schedule channel
- **WHEN** `?action=cron-publish` ส่งผ่าน `content_schedules` ที่ channel มี `platform='facebook'` สำเร็จ
- **THEN** `content_items` ของ `plan_item_id` ที่สอดคล้องมี `platform='facebook'`

### Requirement: published_url ของ facebook มาจาก permalink_url ของ Graph API
เมื่อการเผยแพร่ไป facebook สำเร็จ ระบบ SHALL ดึง `permalink_url` ของโพสต์จาก Graph API และบันทึกลง `content_items.published_url`; หากการดึงลิงก์ไม่สำเร็จ `published_url` SHALL เป็น NULL และการเผยแพร่ที่สำเร็จแล้ว SHALL ยังถือว่าสำเร็จ

id ที่ใช้เรียก permalink lookup SHALL เป็น id ของ **โพสต์** ในรูปแบบผสม `{page_id}_{post_id}` ไม่ใช่ id ของสื่อ — เมื่อโพสต์ผ่าน `/{page_id}/feed` ค่านี้คือ `response.id` แต่เมื่อโพสต์ผ่าน `/{page_id}/photos` ค่านี้คือ `response.post_id` ขณะที่ `response.id` เป็น photo id เปล่าซึ่งใช้ทั้ง lookup permalink และดึง engagement ไม่ได้ ระบบจึง SHALL อ่าน `post_id` ก่อน แล้วจึง fallback ไป `id`

#### Scenario: ดึง permalink สำเร็จ
- **WHEN** `dispatch_facebook()` โพสต์สำเร็จและได้ `platform_post_id` แล้วเรียก GET `/{post_id}?fields=permalink_url` สำเร็จ
- **THEN** ผล dispatch มี `published_url` เท่ากับ `permalink_url`
- **AND** `content_items.published_url` ได้รับค่านั้น

#### Scenario: ดึง permalink ไม่สำเร็จไม่ทำให้การเผยแพร่ล้มเหลว
- **WHEN** `dispatch_facebook()` โพสต์สำเร็จ แต่ GET `permalink_url` ล้มเหลว (เช่น token หมดอายุ / สิทธิ์ไม่พอ)
- **THEN** ผล dispatch ยังคง `success=true`
- **AND** `published_url` เป็น NULL และ `content_items` ยังถูกตั้ง `status='published'`

#### Scenario: โพสต์รูปใช้ post_id เรียก permalink
- **WHEN** `dispatch_facebook()` โพสต์ผ่าน `/photos` สำเร็จและ response มีทั้ง `id` (photo id) และ `post_id` (รูปแบบผสม)
- **THEN** permalink lookup ถูกเรียกด้วยค่า `post_id` ไม่ใช่ `id`
- **AND** `content_items.external_post_id` และ `content_publish_queue.platform_post_id` เก็บค่า `post_id` นั้น

#### Scenario: โพสต์ข้อความเปล่าใช้ id เรียก permalink ตามเดิม
- **WHEN** `dispatch_facebook()` โพสต์ผ่าน `/feed` สำเร็จและ response มีเฉพาะ `id`
- **THEN** permalink lookup ถูกเรียกด้วยค่า `id` นั้นตามพฤติกรรมเดิม
