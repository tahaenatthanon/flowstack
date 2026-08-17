## Why

ทุกเส้นทางการเผยแพร่คอนเทนต์ (ส่งเดี๋ยวนี้ `send_now`, cron queue, เผยแพร่จากแผน `?action=publish`, และ `?action=cron-publish`) เขียนเฉพาะสถานะ `sent` ลงใน `content_publish_queue`/`content_schedules` แต่**ไม่เคยแตะ `content_items` เลย** ทำให้ระบบไม่รู้ว่าเนื้อหาชิ้นไหนเผยแพร่สำเร็จแล้ว เมื่อไหร่ ที่ URL ไหน และมี post id อะไร — ปัจจุบัน `content_items` ทั้ง 35 แถวเป็น `draft` ทั้งหมด และ `content_publish_queue` ยังไม่เคยมีแถว `sent` สำเร็จเลยสักครั้ง ยิ่งกว่านั้น เส้นทาง `?action=publish` ใน `brand-content.php` ยังมีบั๊กใช้คีย์ไม่ตรงกัน (โหลดด้วย `WHERE id=?` แต่อัปเดตด้วย `WHERE plan_item_id=?`) จึงไม่เคยตั้ง `status='published'` ได้สำเร็จ ผลลัพธ์คือ เมตริกผลลัพธ์ (เวลาผลิต/ความถี่) และเฟสถัดไป (SEO, ติดตามอันดับ, ซิงก์ประสิทธิภาพโพสต์) ไม่มีวัตถุดิบในการคำนวณ

## What Changes

- เพิ่มคอลัมน์ `published_at`, `published_url`, `external_post_id`, `approved_at` ใน `content_items` (migration)
- เพิ่มคอลัมน์ `platform_post_id`, `published_url` ใน `content_publish_queue` และ `content_schedules` (migration)
- Patch เส้นทาง `send_now` (`api/content-publish.php`) ให้เมื่อ `dispatch_content()` สำเร็จ อัปเดต `content_items` เป็น `status='published', published_at=NOW(), published_url=…, external_post_id=…`
- Patch `api/cron/publish-scheduler.php` ให้อัปเดต `content_items` เช่นเดียวกัน พร้อมเขียน `platform_post_id`/`published_url` กลับ `content_publish_queue`
- Patch `?action=publish` (`api/brand-content.php`) แก้บั๊กคีย์ `WHERE plan_item_id=?` → `WHERE id=?` และบันทึกผลเผยแพร่ (post id/url) จากผล inline curl แต่ละ platform
- Patch `?action=cron-publish` (`api/brand-content.php`) ให้บันทึกผลเผยแพร่ลง `content_items` และ `content_schedules` เช่นเดียวกัน
- ตั้ง `approved_at=NOW()` เมื่อสถานะเปลี่ยนเป็น `approved` (จุด PUT ใน `api/content-items.php`)

## Capabilities

### New Capabilities

- `content-publish-result-tracking`: บันทึกผลเผยแพร่คอนเทนต์ — เมื่อเผยแพร่สำเร็จผ่านเส้นทางใดก็ตาม ระบบจะบันทึก `status='published'`, `published_at`, `published_url`, `external_post_id` ลง `content_items` และบันทึก `platform_post_id`, `published_url` ลง `content_publish_queue`/`content_schedules` รวมถึง schema migration สำหรับคอลัมน์เหล่านี้

### Modified Capabilities

- `content-approved-status`: เพิ่ม requirement ให้บันทึกเวลา `approved_at` เมื่อสถานะของเนื้อหาเปลี่ยนเป็น `approved`

## Impact

- `api/content-publish.php` — patch `send_now` ให้เขียนผลกลับ `content_items`
- `api/cron/publish-scheduler.php` — patch ให้เขียนผลกลับ `content_items` + `content_publish_queue`
- `api/brand-content.php` — patch `?action=publish` (แก้บั๊กคีย์) และ `?action=cron-publish`
- `api/content-items.php` — patch PUT ให้ตั้ง `approved_at` เมื่อสถานะเป็น `approved`
- `api/lib/publish-dispatch.php` — เพิ่ม helper (additive) สกัด `platform_post_id`/`published_url` จากผล dispatch
- `database/migrations/` — migration ใหม่ 1 ไฟล์ (เพิ่มคอลัมน์ 8 คอลัมน์ใน 3 ตาราง)
- ไม่กระทบ frontend ในเฟสนี้ (คอลัมน์ใหม่จะถูกอ่านใช้งานในเฟส 5 — เมตริกผลลัพธ์)
