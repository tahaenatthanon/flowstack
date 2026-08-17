## Context

ระบบมีเส้นทางการเผยแพร่คอนเทนต์ 4 เส้นทางที่ทำงานแยกจากกัน:

1. `send_now` ใน `api/content-publish.php` — เรียก `dispatch_content()` กลาง แล้วอัปเดต `content_publish_queue.status='sent'` เท่านั้น
2. cron `api/cron/publish-scheduler.php` — เรียก `dispatch_content()` กลาง แล้วอัปเดต `content_publish_queue.status='sent'` เท่านั้น
3. `?action=publish` ใน `api/brand-content.php` — เขียน curl เอง 8 platform (~163 บรรทัด) ไม่เรียก dispatcher กลาง; อัปเดต `content_schedules` + พยายามอัปเดต `content_items.status='published'` แต่โหลดด้วย `WHERE id=?` แล้วอัปเดตด้วย `WHERE plan_item_id=?` (คีย์ไม่ตรง → ไม่โดนแถว)
4. `?action=cron-publish` ใน `api/brand-content.php` — เขียน curl เองซ้ำอีกชุด อัปเดตเฉพาะ `content_schedules`

`dispatch_content()` (`api/lib/publish-dispatch.php`) รองรับ 9 platform ผ่าน `match()` และแต่ละ platform ตั้ง `platform_post_id` ไว้ในผลลัพธ์เมื่อสำเร็จ แต่**ไม่รวม `lotusdomino`** ซึ่งมีเฉพาะใน inline curl ของเส้นทาง 3/4

`content_items` ปัจจุบัน (PRD 2026-07-26 + migration `2026_08_*`) ไม่มีคอลัมน์ `published_at` / `published_url` / `external_post_id` / `approved_at` และ `content_publish_queue`/`content_schedules` ไม่มี `platform_post_id` / `published_url`

## Goals / Non-Goals

**Goals:**
- เมื่อเผยแพร่สำเร็จผ่านทุกเส้นทาง → `content_items` ได้ `status='published'`, `published_at`, `published_url`, `external_post_id`
- `content_publish_queue`/`content_schedules` ได้ `platform_post_id`, `published_url` (ถ้ามี)
- แก้บั๊กคีย์ไม่ตรงกันใน `?action=publish`
- บันทึก `approved_at` เมื่อสถานะเปลี่ยนเป็น `approved`
- ใช้กลยุทธ์ **patch ไม่ refactor** — ไม่รวมโค้ดเส้นทาง 3/4 กลับไปใช้ dispatcher กลางในรอบนี้

**Non-Goals:**
- ไม่ refactor `?action=publish`/`?action=cron-publish` ให้เรียก `dispatch_content()` (เก็บเป็น task แยก)
- ไม่เพิ่ม `lotusdomino` เข้า `dispatch_content()`
- ไม่สร้าง UI ใหม่ (คอลัมน์ใหม่ถูกอ่านในเฟส 5)
- ไม่แตะ logic การ retry หรือสถานะอื่นของ queue/schedules

## Decisions

### 1. กลยุทธ์ patch ทีละเส้นทาง (ไม่ refactor รวมโค้ด)
- Patch จุดที่เขียน `status='sent'` ในแต่ละไฟล์ ให้เขียนผลกลับ `content_items` เพิ่ม
- **Rationale**: `dispatch_content()` ไม่รองรับ `lotusdomino` ขณะที่ inline curl ของเส้นทาง 3/4 รองรับ การ refactor รวมโค้ดตอนนี้จะตก `lotusdomino` ซึ่งมี channel จริงใน DB
- **Alternative considered**: รวมเส้นทาง 3/4 มาใช้ `dispatch_content()` + เพิ่ม `lotusdomino` เข้า match — ปฏิเสธในรอบนี้ (กว้างเกิน scope, เสี่ยง regression) เปิดเป็น task แยกตาม roadmap

### 2. helper สกัด post id/url ไว้ที่ publish-dispatch.php (additive)
- เพิ่มฟังก์ชัน `extract_publish_meta(array $result, string $platform, array $channel): array` คืน `['platform_post_id' => string|null, 'published_url' => string|null]`
- ใช้ `$result['platform_post_id']` (ตั้งแล้วโดยแต่ละ dispatch) และพยายามหา `published_url` จาก `$result['data']['link']` (WordPress) เป็นหลัก; platform อื่นที่ไม่มี URL คืน null
- **Rationale**: ให้ `send_now` กับ scheduler ใช้ helper ตัวเดียวกัน ไม่ duplicate logic; เป็น additive ไม่เปลี่ยนพฤติกรรม dispatch เดิม
- **Alternative considered**: แก้แต่ละ dispatch_* ให้ตั้ง `published_url` เอง — ปฏิเสธ เพราะแตะฟังก์ชัน platform หลายตัวโดยไม่จำเป็น

### 3. content_items writeback ใช้คีย์ `id`
- `send_now`/scheduler: `content_id` จาก queue คือ `content_items.id` → `UPDATE ... WHERE id=? AND tenant_id=?`
- `?action=publish`: `$itemId` โหลดจาก `WHERE id=?` แล้ว → เปลี่ยนเงื่อนไขอัปเดตจาก `WHERE plan_item_id=?` เป็น `WHERE id=?`
- `?action=cron-publish`: เดินจาก `content_schedules.plan_item_id` → ต้อง resolve `content_items.id` ผ่าน `plan_item_id` (query หา `id` ก่อน หรืออัปเดตด้วย subquery `WHERE id=(SELECT id FROM content_items WHERE plan_item_id=? LIMIT 1)`) — ใช้ subquery เพื่อหลีกเลี่ยงการ query แยก
- **Rationale**: `plan_item_id` อาจเป็น NULL ในหลายแถว (เห็นจากข้อมูลจริง) การอัปเดตด้วย `id` จึงแม่นยำกว่า

### 4. การสกัด post id/url ใน inline curl (เส้นทาง 3/4) เป็นแบบ per-branch
- wordpress: `platform_post_id = $result['id']`, `published_url = $result['link']`
- facebook: `platform_post_id = $result['id']`
- wix: `platform_post_id = $result['post']['id']`
- lineoa/custom/lotusdomino/linkedin/instagram/tiktok/twitter: ไม่มี id ที่เชื่อถือได้จาก response ใน inline curl → `platform_post_id`/`published_url` เป็น NULL
- **Rationale**: response shape ต่างกัน per platform; ไม่อิงข้อมูลที่ไม่มี

### 5. approved_at ใช้ pattern เดียวกับ requested_at
- ใน `api/content-items.php` PUT เพิ่มเงื่อนไข `if (($body['status'] ?? null) === 'approved') { $fields[] = 'approved_at = NOW()'; }` ข้าง ๆ เงื่อนไข `pending_approval` → `requested_at` ที่มีอยู่แล้ว
- **Rationale**: สอดคล้องกับ code เดิม, ไม่ต้องเพิ่ม endpoint ใหม่

### 6. Migration ไฟล์เดียว 3 ตาราง
- `ALTER TABLE content_items ADD COLUMN ...` (4 คอลัมน์), `ALTER TABLE content_publish_queue ADD COLUMN ...` (2), `ALTER TABLE content_schedules ADD COLUMN ...` (2)
- ตั้งชื่อไฟล์ `2026_08_17_HHMMSS_add_publish_result_columns.sql` ตามกติกา CLAUDE.md และรัน + ยืนยัน `SHOW COLUMNS`
- **Rationale**: การเปลี่ยน 3 ตารางสัมพันธ์กัน (atomic intent), เก็บประวัติในที่เดียว

## Risks / Trade-offs

- [platform อื่นนอกจาก WordPress ตรวจสอบได้แค่ระดับโค้ด เพราะไม่มี credentials ทดสอบ] → ยืนยันผ่าน WordPress channel ที่มีคีย์จริง; platform ที่เหลือตรวจด้วยการอ่านโค้ด + unit/static
- [`published_url` อาจเป็น NULL สำหรับ platform ที่ response ไม่คืน URL (facebook บางกรณี)] → `external_post_id`/`platform_post_id` ยังถูกบันทึกเสมอ; `published_url` เป็น best-effort
- [cron-publish ต้อง resolve `content_items.id` จาก `plan_item_id` และ plan_item_id อาจ NULL] → ใช้ subquery + `WHERE id=…` จะไม่โดนแถวถ้า resolve ไม่ได้ → ปลอดภัย (ไม่เขียนผิดแถว)
- [queue ปัจจุบันมีแถว `failed` ค้างจาก `Unknown platform: lotusdomino`] → เฟสนี้ไม่แก้ lotusdomino (out of scope) — เปิด task แยก

## Migration Plan

1. สร้างไฟล์ migration ตามกติกาใน `database/migrations/`
2. รัน `/c/xampp/mysql/bin/mysql.exe -u root flowstack < database/migrations/<file>.sql`
3. ยืนยัน `SHOW COLUMNS FROM content_items;` `content_publish_queue;` `content_schedules;`
4. Rollback (ถ้าจำเป็น): `ALTER TABLE ... DROP COLUMN ...` ตามลำดับย้อนกลับ — คอลัมน์ใหม่ทั้งหมดเป็น NULL ปลอดภัย ไม่กระทบข้อมูลเดิม

## Open Questions

- ไม่มี — ขอบเขตชัดเจนจาก roadmap (เฟส 0); การ refactor รวมโค้ด + เพิ่ม lotusdomino เข้า dispatcher ถูกเลื่อนเป็น task แยกตามที่ตัดสินใจไว้
