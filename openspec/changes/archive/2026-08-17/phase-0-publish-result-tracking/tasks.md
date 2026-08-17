## 1. Database migration

- [x] 1.1 สร้าง `database/migrations/2026_08_17_HHMMSS_add_publish_result_columns.sql` เพิ่ม `published_at`, `published_url`, `external_post_id`, `approved_at` ใน `content_items` และ `platform_post_id`, `published_url` ใน `content_publish_queue` + `content_schedules`
- [x] 1.2 รัน migration ผ่าน `/c/xampp/mysql/bin/mysql.exe -u root flowstack < database/migrations/<file>.sql`
- [x] 1.3 ยืนยันด้วย `SHOW COLUMNS FROM content_items;` / `content_publish_queue;` / `content_schedules;` ครบ 8 คอลัมน์ใหม่

## 2. Helper สกัดผลเผยแพร่ (additive)

- [x] 2.1 เพิ่ม `extract_publish_meta(array $result, string $platform, array $channel): array` ใน `api/lib/publish-dispatch.php` คืน `platform_post_id` / `published_url` (WordPress ใช้ `data.link`)

## 3. Patch send_now (content-publish.php)

- [x] 3.1 ใน `api/content-publish.php` `send_now` เมื่อ `$result['success']` — เรียก `extract_publish_meta()` แล้วอัปเดต `content_items SET status='published', published_at=NOW(), published_url=?, external_post_id=? WHERE id=? AND tenant_id=?`
- [x] 3.2 เขียน `platform_post_id`, `published_url` กลับแถว `content_publish_queue` เดียวกับที่อัปเดต `sent`

## 4. Patch publish-scheduler.php

- [x] 4.1 ใน `api/cron/publish-scheduler.php` เมื่อ `$result['success']` — เรียก `extract_publish_meta()` และอัปเดต `content_items` (ใช้ `$entry['content_id']`) เป็น `status='published', published_at=NOW(), published_url=?, external_post_id=?`
- [x] 4.2 เขียน `platform_post_id`, `published_url` กลับแถว `content_publish_queue` ที่กำลังประมวลผล

## 5. Patch ?action=publish (brand-content.php)

- [x] 5.1 แก้บั๊กคีย์: เปลี่ยน `UPDATE content_items ... WHERE plan_item_id=?` เป็น `WHERE id=?` (ใช้ `$itemId` เดียวกับที่โหลดมา)
- [x] 5.2 ต่อท้ายเงื่อนไข success — บันทึก `status='published', published_at=NOW(), published_url=?, external_post_id=?` โดยสกัด post id/url per-branch (wordpress `id`+`link`, facebook `id`, wix `post.id`)
- [x] 5.3 เขียน `platform_post_id`, `published_url` ลง `content_schedules` (ทั้งกรณีมี `scheduleId` และกรณี insert history ใหม่)

## 6. Patch ?action=cron-publish (brand-content.php)

- [x] 6.1 เมื่อ platform ส่งสำเร็จ — resolve `content_items.id` จาก `plan_item_id` แล้วอัปเดต `content_items` เป็น `status='published', published_at=NOW()`
- [x] 6.2 เขียน `platform_post_id`, `published_url` ลง `content_schedules` ที่กำลังประมวลผล

## 7. Patch approved_at (content-items.php)

- [x] 7.1 ใน `api/content-items.php` PUT เพิ่มเงื่อนไข `if (($body['status'] ?? null) === 'approved') { $fields[] = 'approved_at = NOW()'; }` คู่กับเงื่อนไข `pending_approval`→`requested_at` เดิม

## 8. Verify

- [x] 8.1 `pnpm lint` ผ่าน (โค้ด PHP ไม่ถูก lint โดย pnpm — ยืนยันไม่มี syntax error ผ่าน `php -l` กับไฟล์ที่แก้)
- [ ] 8.2 ทดสอบ `send_now` ผ่าน WordPress channel จริง → `SELECT status, published_at, published_url, external_post_id FROM content_items WHERE id=…` มีค่าครบ (ตอนนี้ NULL) — ⏸️ รอ user ทดสอบเอง (โพสต์ WordPress จริง ย้อนกลับไม่ได้)
- [ ] 8.3 จัดคิว + รัน `php api/cron/publish-scheduler.php` → ได้แถว `content_publish_queue.status='sent'` แรกของระบบ + `platform_post_id` ไม่ NULL + `content_items` ถูกอัปเดต — ⏸️ รอ user ทดสอบเอง (โพสต์ WordPress จริง ย้อนกลับไม่ได้)
- [x] 8.4 approve 1 item (PUT status='approved') → `SELECT approved_at FROM content_items WHERE id=…` ไม่ NULL
