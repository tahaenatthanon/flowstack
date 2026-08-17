## 1. วินิจฉัยสถานะ DB ปัจจุบัน

- [x] 1.1 รัน `SHOW COLUMNS FROM content_items LIKE 'status'` — พบ DB จริง (`flowstack_dev` จาก `.env`) ยังเป็น ENUM เก่า `('published','draft','revision','review','rejected')` — ยังไม่มี `pending_approval`/`approved`
- [x] 1.2 รัน `SELECT status, COUNT(*) FROM content_items GROUP BY status` — พบ `draft` 33 แถว และ empty string `''` 2 แถว (เกิดจากการเขียน `pending_approval` ก่อนที่ ENUM จะรองรับ)

## 2. Migration แก้ ENUM + ข้อมูล

- [x] 2.1 Apply migration `2026_08_11_114953_add_reject_reason.sql` — เพิ่ม column `reject_reason` (ยังขาดใน `flowstack_dev`)
- [x] 2.2 Apply migration `2026_08_11_171224_refactor_content_status_enum.sql` — ENUM → `('published','draft','revision','pending_approval','rejected','approved')`
- [x] 2.3 สร้าง migration `2026_08_13_120000_fix_empty_content_status.sql` — `UPDATE ... SET status='pending_approval' WHERE status=''`
- [x] 2.4 รัน migration ทั้งหมดกับ MariaDB `flowstack_dev`
- [x] 2.5 ตรวจสอบ: `SHOW COLUMNS` แสดง 6 ค่าครบ + `GROUP BY` ไม่มี `''` หรือ `review` เหลือ

## 3. Server-side validation

- [x] 3.1 ใน `api/content-items.php` (method PUT) กำหนด whitelist `$validStatus = ['published','draft','revision','pending_approval','rejected','approved']`
- [x] 3.2 เมื่อ body มี field `status` และค่าไม่อยู่ใน whitelist → `jsonError('สถานะไม่ถูกต้อง', 400)`
- [x] 3.3 ตรวจสอบว่า field อื่น (ไม่ใช่ `status`) ยังอัปเดตได้ตามปกติ (validation จะ trigger เฉพาะเมื่อมี field `status`)
- [x] 3.4 Sync ไฟล์ไปยัง `C:\xampp\htdocs\flowstack\api\content-items.php` (Apache serve จากโฟลเดอร์นี้ ไม่ใช่ `flowstack_dev`) + `php -l` ผ่าน

## 4. การทดสอบ

- [x] 4.1 (manual) หน้ารายการอนุมัติแสดง 2 รายการสถานะ "รออนุมัติ" พร้อมปุ่ม อนุมัติ/ปฏิเสธ (หลัง fix DB ENUM)
- [x] 4.2 (API) `PUT { status: 'invalid_status' }` → HTTP 400 `{"error":"สถานะไม่ถูกต้อง"}`
- [x] 4.3 (DB) ตรวจสอบ `SELECT status, COUNT(*)` → `draft 33`, `pending_approval 2` (ไม่มี empty string)
- [x] 4.4 (manual) ปุ่ม "ขอแก้ไข" แสดงใน dialog รายละเอียด (context='approval') — ตรวจสอบจากโค้ด `ContentDetailView.tsx`
