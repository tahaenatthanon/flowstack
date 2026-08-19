## 1. Migration: response_snippet

- [x] 1.1 สร้าง `database/migrations/YYYY_MM_DD_HHMMSS_add_response_snippet_to_publish_queue.sql` — `ALTER TABLE content_publish_queue ADD COLUMN response_snippet TEXT NULL AFTER error_msg;`
- [x] 1.2 รัน migration ด้วย `/c/xampp/mysql/bin/mysql.exe -u root flowstack < <file>` แล้วยืนยันด้วย `SHOW COLUMNS FROM content_publish_queue` ว่ามีคอลัมน์ `response_snippet`

## 2. ชั้น dispatch: เลิก assume-ok (D1)

- [x] 2.1 ลบบล็อกพลิกค่าใน `dispatch_lotusdomino()` (`api/lib/publish-dispatch.php:464-471`) — ปล่อยผลจาก `_dispatch_post()` ไหลตามจริง ตั้ง `platform_post_id` เฉพาะเมื่อ `success` เป็นจริง
- [x] 2.2 ตรวจว่า `dispatch_lotusdomino()` ยังส่ง `response`/`data` และ `http_code` กลับให้ผู้เรียก เพื่อให้ `send_now`/cron เก็บ `response_snippet` ได้

## 3. ชั้น API: approval gate + idempotency + เก็บ response (D2, D3, D4)

- [x] 3.1 เพิ่ม approval gate ใน `send_now` (`api/content-publish.php`) — ถ้า `empty($content['approved_at'])` ตอบ `jsonError(422)` ข้อความภาษาไทยว่าต้องอนุมัติก่อน วางไว้ **ก่อน** SEO gate (บรรทัด 103) ไม่สร้างแถวคิว ไม่ dispatch
- [x] 3.2 เพิ่ม idempotency guard ต่อคู่ `(content_id, channel_id)` — `GET_LOCK(CONCAT('sn:', MD5(CONCAT(content_id,':',channel_id))), 5)`; ในเขตล็อกนับแถว `status IN ('processing','sent') AND created_at >= NOW() - INTERVAL 10 MINUTE`; ถ้าพบ → คืนผลช่องนั้นเป็น `skipped` ไม่ INSERT ไม่ dispatch; `RELEASE_LOCK` ใน `finally` เสมอ; `GET_LOCK` คืน 0 → `skipped` ไม่ใช่ error
- [x] 3.3 เขียน `response_snippet` ทั้งเส้นทางสำเร็จและล้มเหลว — อ่าน `$result['data']`/`$result['response']`, `json_encode` ถ้าเป็น array, ตัดด้วย `mb_substr(..., 0, 2000)` แล้วรวมไว้ใน UPDATE queue เดิม (สำเร็จ บรรทัด 138-147 / ล้มเหลว บรรทัด 149-153)
- [x] 3.4 ให้ `results[]` ของ `send_now` มี `status: 'success'|'skipped'|'failed'` รายช่องทางครบทุกกรณี

## 4. cron: เก็บ response (D2)

- [x] 4.1 เขียน `response_snippet` ในเส้นทางเขียนกลับของ `api/cron/publish-scheduler.php` (บรรทัด 110-136) ทั้งสำเร็จและล้มเหลว ตัดที่ 2000 ตัวอักษรเช่นเดียวกับ `send_now`

## 5. Frontend: รายงานผลรายช่องทางตามจริง (D5)

- [x] 5.1 แก้ `useSendNow` ใน `src/hooks/useContent.ts` ให้ส่งต่อ `results[]` กลับให้ผู้เรียกอ่านได้
- [x] 5.2 แก้ `SchedulePublishDialog.handleSubmit` (`src/components/content/SchedulePublishDialog.tsx:86-88`) — เลิก toast "ส่งสำเร็จ!" แบบไม่มีเงื่อนไข อ่าน `results[]` นับ สำเร็จ/ข้าม/ล้มเหลว เลือกข้อความ+variant ตามจริง และไม่แสดงว่าสำเร็จเมื่อไม่มีช่องใดสำเร็จ
- [x] 5.3 ปรับ `handleRetry` / การ์ด "ลองส่งใหม่" ใน `ContentDashboardPage.tsx` ให้แสดงผล `skipped` ได้ (ถูกข้ามเพราะเพิ่งส่งไปแล้ว) แยกจากสำเร็จและล้มเหลว

## 6. ทดสอบด้วย local mock (ไม่มี traffic ไป production)

- [x] 6.1 ทดสอบ D1: mock endpoint ตอบ HTTP 500 → `dispatch_lotusdomino()` คืน `success=false`, `error_msg` มีเลข status, `response_snippet` มีเนื้อ response, แถวเป็น `failed` และคอนเทนต์ไม่กลายเป็น `published`
- [x] 6.2 ทดสอบ D1: mock ตอบ HTTP 200 → `success=true`, มี `platform_post_id`, `response_snippet` ไม่ NULL
- [x] 6.3 ทดสอบ D3: ยิง `send_now` คู่ `(content_id, channel_id)` เดิมซ้ำในกรอบ 10 นาที → ครั้งหลังได้ `skipped` ไม่มีแถวใหม่ ไม่มี request ออก; แถว `failed` ส่งซ้ำได้
- [x] 6.4 ทดสอบ D4: `send_now` กับคอนเทนต์ `approved_at IS NULL` → 422 ไม่มีแถวคิว ไม่มี request ออก
- [x] 6.5 ยืนยันไม่มี regression บนคอนเทนต์ที่อนุมัติแล้ว + channel ปกติ (path สำเร็จเดิมยังทำงาน)

## 7. ปิดงาน

- [x] 7.1 รัน `pnpm lint` และ `pnpm build` ให้ผ่าน (กฎ VERIFY BEFORE DONE)
- [x] 7.2 บันทึกผลทดสอบ mock ของ D1/D3/D4 ลง `design.md` หรือ tasks เพื่อเป็นหลักฐาน (เชื่อมกับงาน 5.2 ที่ archive ที่ต้องพิสูจน์ใหม่)
