## ข้อกำหนดที่แก้ไข

### Requirement: รายละเอียดอนุมัติแสดงปุ่มอนุมัติ/ขอแก้ไข/ปฏิเสธ
ระบบ SHALL แสดงปุ่ม อนุมัติ, ขอแก้ไข, และ ปฏิเสธ ในหน้ารายละเอียดเนื้อหาที่เปิดจากรายการอนุมัติ สำหรับ items ที่มี status `pending_approval` และเปลี่ยน status ปลายทางเป็น `approved` แทน `published`

#### Scenario: Display approve button in detail view
- **WHEN** ผู้ใช้ดูรายละเอียดเนื้อหาจากหน้ารายการอนุมัติ และเนื้อหามี status `pending_approval`
- **THEN** ระบบแสดงปุ่ม "อนุมัติ" ในแถว action ด้านล่างของเนื้อหา

#### Scenario: Approve transitions to approved
- **WHEN** ผู้ใช้คลิก "อนุมัติ" และยืนยัน
- **THEN** ระบบเปลี่ยน status เป็น `approved` (ไม่ใช่ `published`)

#### Scenario: Display request revision button in detail view
- **WHEN** ผู้ใช้ดูรายละเอียดเนื้อหาจากหน้ารายการอนุมัติ และเนื้อหามี status `pending_approval`
- **THEN** ระบบแสดงปุ่ม "ขอแก้ไข" ในแถว action

#### Scenario: Display reject button in detail view
- **WHEN** ผู้ใช้ดูรายละเอียดเนื้อหาจากหน้ารายการอนุมัติ และเนื้อหามี status `pending_approval`
- **THEN** ระบบแสดงปุ่ม "ปฏิเสธ" ในแถว action

### Requirement: ปุ่มอนุมัติไม่แสดงสำหรับรายการที่ไม่ใช่ pending
ระบบ SHALL NOT แสดงปุ่ม อนุมัติ/ขอแก้ไข/ปฏิเสธ สำหรับ content items ที่มีสถานะอื่นที่ไม่ใช่ `pending_approval`

#### Scenario: No approve action on approved item
- **WHEN** ผู้ใช้ดูรายละเอียดเนื้อหาจากหน้ารายการอนุมัติ และเนื้อหามี status `approved`
- **THEN** ไม่แสดงปุ่ม อนุมัติ/ขอแก้ไข/ปฏิเสธ

#### Scenario: No approve action on published item
- **WHEN** ผู้ใช้ดูรายละเอียดเนื้อหาจากหน้ารายการอนุมัติ และเนื้อหามี status `published`
- **THEN** ไม่แสดงปุ่ม อนุมัติ/ขอแก้ไข/ปฏิเสธ
