## ข้อกำหนดที่แก้ไข

### Requirement: ผู้ใช้สามารถอนุมัติเนื้อหาจากรายการผลงาน
ระบบ SHALL แสดงปุ่ม "อนุมัติ" ในหน้า Content List สำหรับ content item ที่มีสถานะ `pending_approval` และเปลี่ยนสถานะเป็น `approved`

#### Scenario: Approve from content list
- **WHEN** ผู้ใช้ hover บนรายการ content item ที่มี status `pending_approval` ในหน้า Content List
- **THEN** ระบบแสดงปุ่ม "อนุมัติ" ในกลุ่ม hover actions พร้อม icon เช็ค (Check)

#### Scenario: Approve success
- **WHEN** ผู้ใช้ยืนยันใน dialog
- **THEN** ระบบเปลี่ยน status ของ content item เป็น `approved` และแสดง toast "อนุมัติเรียบร้อย"

### Requirement: ผู้ใช้สามารถขอแก้ไขจากรายการผลงาน
ระบบ SHALL แสดงปุ่ม "ขอแก้ไข" ในหน้า Content List สำหรับ content item ที่มีสถานะ `pending_approval`

#### Scenario: Request revision from content list
- **WHEN** ผู้ใช้ hover บนรายการ content item ที่มี status `pending_approval` ในหน้า Content List
- **THEN** ระบบแสดงปุ่ม "ขอแก้ไข" ในกลุ่ม hover actions พร้อม icon ดินสอ (Pencil)

#### Scenario: Revision request success
- **WHEN** ผู้ใช้กรอกเหตุผลและคลิกยืนยัน
- **THEN** ระบบเปลี่ยน status ของ content item เป็น `revision` พร้อมบันทึก `reject_reason` และแสดง toast "ขอแก้ไขแล้ว"

### Requirement: ผู้ใช้สามารถปฏิเสธเนื้อหาจากรายการผลงาน
ระบบ SHALL แสดงปุ่ม "ปฏิเสธ" ในหน้า Content List สำหรับ content item ที่มีสถานะ `pending_approval`

#### Scenario: Reject from content list
- **WHEN** ผู้ใช้ hover บนรายการ content item ที่มี status `pending_approval` ในหน้า Content List
- **THEN** ระบบแสดงปุ่ม "ปฏิเสธ" ในกลุ่ม hover actions พร้อม icon กากบาท (X)

### Requirement: ปุ่มอนุมัติแสดงเฉพาะรายการ pending_approval
ระบบ SHALL แสดงปุ่ม อนุมัติ/ขอแก้ไข/ปฏิเสธ เฉพาะสำหรับ content items ที่มี status `pending_approval` เท่านั้น — รายการ status อื่นไม่แสดงปุ่มเหล่านี้

#### Scenario: รายการที่ไม่ใช่ pending_approval ไม่แสดงปุ่มอนุมัติ
- **WHEN** ผู้ใช้ hover บนรายการ content item ที่มี status `draft`, `approved`, `published`, `revision`, หรือ `rejected`
- **THEN** ไม่มีปุ่ม อนุมัติ/ขอแก้ไข/ปฏิเสธ แสดงใน hover actions
