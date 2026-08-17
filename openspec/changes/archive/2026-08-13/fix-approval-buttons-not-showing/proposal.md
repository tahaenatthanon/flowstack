## Why

หลัง refactor สถานะคอนเทนต์ (`review` → `pending_approval`, เพิ่ม `approved`) พบว่าเมื่อผู้สร้างกด "ขออนุมัติ" แล้วหน้ารายการอนุมัติแสดงรายการนั้นแต่ไม่มีปุ่ม อนุมัติ / ขอแก้ไข / ปฏิเสธ (แสดง "ดำเนินการแล้ว" แทน) ปุ่มเหล่านี้จะแสดงก็ต่อเมื่อ `item.status === 'pending_approval'` แต่ค่า `pending_approval` ที่ frontend ส่งไปไม่ถูกเขียนลง DB จริง เพราะ ENUM ของ `content_items.status` ในฐานข้อมูลจริงยังไม่ใช่ state ปลายทาง (migration `2026_08_11_171224_refactor_content_status_enum.sql` ไม่ถูก apply หรือถูก apply กับ state ที่ไม่ตรงกับที่ migration คาดไว้) ผลลัพธ์คือ strict mode → `UPDATE` throw error ส่วน non-strict mode → ค่าถูกเขียนเป็น empty string `''` ทำให้ item โผล่บนหน้ารายการอนุมัติแต่ `isPending === false` จึงไม่มีปุ่ม

## What Changes

- เพิ่ม migration ใหม่ที่ migrate `content_items.status` ENUM ไปยัง state ปลายทาง `('published','draft','revision','pending_approval','rejected','approved')` อย่างปลอดภัย โดยรองรับ state ต้นทางใดก็ได้ (มี/ไม่มี `revision`, `review`, `rejected`)
- แก้ข้อมูลค้าง: แถวที่ status เป็น empty string `''` → `draft` และ `review` → `pending_approval` (ถ้ายังหลงเหลือ)
- เพิ่ม server-side validation ใน `api/content-items.php` เพื่อ reject ค่า `status` ที่ ENUM ไม่ยอมรับ แทนการปล่อยให้ MariaDB ตัดค่าอย่างเงียบ ๆ
- เพิ่ม test ครอบคลุมการ validate ค่า status ฝั่ง server

## Capabilities

### New Capabilities
- `content-status-validation`: ระบบ SHALL ตรวจสอบค่า `status` ฝั่ง server ก่อนเขียนลง `content_items` — ค่าที่อยู่นอก whitelist (`draft`, `revision`, `pending_approval`, `approved`, `rejected`, `published`) จะถูกปฏิเสธด้วย HTTP 400 แทนการถูกตัดเป็น empty string หรือ throw error ที่ไม่ชัดเจน

### Modified Capabilities
<!-- ไม่มี spec-level requirement เปลี่ยน — spec ปัจจุบัน (content-request-approval, approval-detail-actions, content-status-filter) ระบุ behavior ที่ถูกต้องอยู่แล้ว ปัญหาอยู่ที่ชั้นข้อมูล/backend ไม่ใช่ requirement -->

## Impact

- **Database**: `content_items.status` ENUM + data cleanup (empty string, `review` ที่หลงเหลือ)
- **Migrations**: ไฟล์ migration ใหม่ 1 ไฟล์ (`database/migrations/`)
- **Backend**: `api/content-items.php` — เพิ่ม validate ค่า `status` ใน method PUT
- **Frontend**: ไม่ต้องแก้ไข (โค้ด frontend ใช้ `pending_approval` ถูกต้องอยู่แล้ว)
- **Tests**: เพิ่มกรณีทดสอบ status validation
