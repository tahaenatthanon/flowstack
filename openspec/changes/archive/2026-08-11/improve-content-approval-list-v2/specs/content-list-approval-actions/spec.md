## ADDED Requirements

### Requirement: User can approve content from Content List
ระบบ SHALL แสดงปุ่ม "อนุมัติ" ในหน้า Content List สำหรับ content item ที่มีสถานะ `review`

#### Scenario: Approve from content list
- **WHEN** ผู้ใช้ hover บนรายการ content item ที่มี status `review` ในหน้า Content List
- **THEN** ระบบแสดงปุ่ม "อนุมัติ" ในกลุ่ม hover actions พร้อม icon เช็ค (Check)

#### Scenario: Confirm approve dialog
- **WHEN** ผู้ใช้คลิกปุ่ม "อนุมัติ"
- **THEN** ระบบแสดง dialog ยืนยัน "ยืนยันการอนุมัติ" พร้อมชื่อ content item

#### Scenario: Approve success
- **WHEN** ผู้ใช้ยืนยันใน dialog
- **THEN** ระบบเปลี่ยน status ของ content item เป็น `published` และแสดง toast "อนุมัติเรียบร้อย"

### Requirement: User can request revision from Content List
ระบบ SHALL แสดงปุ่ม "ขอแก้ไข" ในหน้า Content List สำหรับ content item ที่มีสถานะ `review`

#### Scenario: Request revision from content list
- **WHEN** ผู้ใช้ hover บนรายการ content item ที่มี status `review` ในหน้า Content List
- **THEN** ระบบแสดงปุ่ม "ขอแก้ไข" ในกลุ่ม hover actions พร้อม icon ดินสอ (Pencil)

#### Scenario: Revision reason dialog
- **WHEN** ผู้ใช้คลิกปุ่ม "ขอแก้ไข"
- **THEN** ระบบแสดง dialog ให้กรอกเหตุผลที่ขอแก้ไข (textarea) พร้อมปุ่มยืนยันและยกเลิก

#### Scenario: Revision request success
- **WHEN** ผู้ใช้กรอกเหตุผลและคลิกยืนยัน
- **THEN** ระบบเปลี่ยน status ของ content item เป็น `revision` พร้อมบันทึก `reject_reason` และแสดง toast "ขอแก้ไขแล้ว"

### Requirement: User can reject content from Content List
ระบบ SHALL แสดงปุ่ม "ปฏิเสธ" ในหน้า Content List สำหรับ content item ที่มีสถานะ `review`

#### Scenario: Reject from content list
- **WHEN** ผู้ใช้ hover บนรายการ content item ที่มี status `review` ในหน้า Content List
- **THEN** ระบบแสดงปุ่ม "ปฏิเสธ" ในกลุ่ม hover actions พร้อม icon กากบาท (X)

#### Scenario: Reject with reason dialog
- **WHEN** ผู้ใช้คลิกปุ่ม "ปฏิเสธ"
- **THEN** ระบบแสดง dialog ให้กรอกเหตุผลที่ปฏิเสธ (textarea) พร้อมปุ่มยืนยันและยกเลิก

#### Scenario: Reject success
- **WHEN** ผู้ใช้กรอกเหตุผลและคลิกยืนยัน
- **THEN** ระบบเปลี่ยน status ของ content item เป็น `rejected` พร้อมบันทึก `reject_reason` และแสดง toast "ปฏิเสธแล้ว"

### Requirement: Approval actions visible only on review items
ระบบ SHALL แสดงปุ่ม อนุมัติ/ขอแก้ไข/ปฏิเสธ เฉพาะสำหรับ content items ที่มี status `review` เท่านั้น — รายการ status อื่นไม่แสดงปุ่มเหล่านี้

#### Scenario: Non-review items show no approval actions
- **WHEN** ผู้ใช้ hover บนรายการ content item ที่มี status `draft`, `published`, `revision`, หรือ `rejected`
- **THEN** ไม่มีปุ่ม อนุมัติ/ขอแก้ไข/ปฏิเสธ แสดงใน hover actions
