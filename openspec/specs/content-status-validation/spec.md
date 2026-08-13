# content-status-validation Specification

## Purpose

กำหนดให้ระบบตรวจสอบค่า `status` ฝั่ง server ก่อนเขียนลง `content_items` เพื่อป้องกันการเขียนค่าที่ไม่ถูกต้อง (เช่น ค่าที่ ENUM ไม่รองรับ) ลง DB ซึ่งปัจจุบัน MariaDB อาจตัดค่าอย่างเงียบ ๆ เป็น empty string หรือ throw error ที่ไม่ชัดเจน ส่งผลให้หน้ารายการอนุมัติไม่แสดงปุ่ม อนุมัติ / ขอแก้ไข / ปฏิเสธ

## Requirements

### Requirement: Reject invalid content status on update
ระบบ SHALL ตรวจสอบค่า `status` ที่ส่งมาพร้อม `PUT /content-items.php` และปฏิเสธค่าที่ไม่อยู่ใน whitelist `['draft','revision','pending_approval','approved','rejected','published']` ด้วย HTTP 400

#### Scenario: Update with valid status
- **WHEN** client ส่ง `PUT /content-items.php?id={id}` พร้อม `{ status: 'pending_approval' }`
- **THEN** ระบบอัปเดต status เป็น `pending_approval` และคืนค่า 200 พร้อม item ที่อัปเดตแล้ว

#### Scenario: Update with invalid status
- **WHEN** client ส่ง `PUT /content-items.php?id={id}` พร้อม `{ status: 'nonexistent_status' }`
- **THEN** ระบบตอบกลับด้วย HTTP 400 และไม่มีการเปลี่ยนแปลงข้อมูลใน DB

#### Scenario: Update without status field
- **WHEN** client ส่ง `PUT /content-items.php?id={id}` โดยไม่มี field `status` (อัปเดต field อื่น เช่น `title`)
- **THEN** ระบบไม่ validate status และดำเนินการอัปเดต field ที่ส่งมาตามปกติ

### Requirement: Content status enum includes approval workflow values
`content_items.status` ENUM SHALL ประกอบด้วยค่า `('published','draft','revision','pending_approval','rejected','approved')` ครบ 6 ค่า หลังการ migrate

#### Scenario: Enum contains all six values
- **WHEN** ตรวจสอบ schema ด้วย `SHOW COLUMNS FROM content_items LIKE 'status'`
- **THEN** column `status` มี ENUM ประกอบด้วย `published`, `draft`, `revision`, `pending_approval`, `rejected`, `approved`

### Requirement: Legacy status data is normalized
ระบบ SHALL แก้ข้อมูลค้างให้เป็นค่าที่ถูกต้องหลังการ migrate: status ที่เป็น empty string `''` → `pending_approval` (เพราะเกิดจากการเขียน `pending_approval` ก่อนที่ ENUM จะรองรับค่า) และ status ที่เป็น `review` → `pending_approval`

#### Scenario: Empty string status normalized to pending_approval
- **WHEN** มีแถว `content_items` ที่ `status = ''`
- **THEN** ระบบเปลี่ยน status ของแถวนั้นเป็น `pending_approval`

#### Scenario: Legacy review status normalized to pending_approval
- **WHEN** มีแถว `content_items` ที่ `status = 'review'`
- **THEN** ระบบเปลี่ยน status ของแถวนั้นเป็น `pending_approval`
