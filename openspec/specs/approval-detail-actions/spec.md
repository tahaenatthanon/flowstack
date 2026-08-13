# approval-detail-actions Specification

## Purpose

กำหนดว่าหน้ารายละเอียดเนื้อหาที่เปิดจากรายการอนุมัติ (`context='approval'`) แสดงเฉพาะปุ่มที่เกี่ยวข้องกับการอนุมัติ — อนุมัติ, ขอแก้ไข, ปฏิเสธ — และตัดปุ่มฝั่งผู้สร้างเนื้อหา (แก้ไข, ตั้งเวลาโพสต์, สร้างเนื้อหา AI, สร้างภาพ, สร้างวิดีโอ) ออกทั้งหมด

## Requirements

### Requirement: Approval detail shows approve/reject/revision buttons
ระบบ SHALL แสดงปุ่ม อนุมัติ, ขอแก้ไข, และ ปฏิเสธ ในหน้ารายละเอียดเนื้อหาที่เปิดจากรายการอนุมัติ สำหรับ items ที่มี status `pending_approval` และเปลี่ยน status ปลายทางเป็น `approved` แทน `published`

#### Scenario: Display approve button in detail view
- **WHEN** ผู้ใช้ดูรายละเอียดเนื้อหาจากหน้ารายการอนุมัติ และเนื้อหามี status `pending_approval`
- **THEN** ระบบแสดงปุ่ม "อนุมัติ" ในแถว action ด้านล่างของเนื้อหา

#### Scenario: Approve transitions to approved
- **WHEN** ผู้ใช้คลิก "อนุมัติ" และยืนยัน
- **THEN** ระบบเปลี่ยน status เป็น `approved` (ไม่ใช่ `published`)

#### Scenario: Display request revision button in detail view
- **WHEN** ผู้ใช้ดูรายละเอียดเนื้อหาจากหน้ารายการอนุมัติ และเนื้อหามี status `pending_approval`
- **THEN** ระบบแสดงปุ่ม "ขอแก้ไข" ในแถว action ด้านล่างของเนื้อหา

#### Scenario: Display reject button in detail view
- **WHEN** ผู้ใช้ดูรายละเอียดเนื้อหาจากหน้ารายการอนุมัติ และเนื้อหามี status `pending_approval`
- **THEN** ระบบแสดงปุ่ม "ปฏิเสธ" ในแถว action ด้านล่างของเนื้อหา

### Requirement: Non-approval buttons removed from approval detail
ระบบ SHALL NOT แสดงปุ่มที่ไม่เกี่ยวข้องกับการอนุมัติในหน้ารายละเอียดที่เปิดจากรายการอนุมัติ

#### Scenario: AI content generation button removed
- **WHEN** ผู้ใช้ดูรายละเอียดเนื้อหาจากหน้ารายการอนุมัติ
- **THEN** ไม่แสดงปุ่ม "สร้างเนื้อหา AI" (handleGenerateArticle)

#### Scenario: Image generation button removed
- **WHEN** ผู้ใช้ดูรายละเอียดเนื้อหาจากหน้ารายการอนุมัติ
- **THEN** ไม่แสดงปุ่ม "สร้างภาพทุกฉาก" หรือ generate-image action ใดๆ

#### Scenario: Video generation button removed
- **WHEN** ผู้ใช้ดูรายละเอียดเนื้อหาจากหน้ารายการอนุมัติ
- **THEN** ไม่แสดงปุ่ม "สร้างวิดีโอ" หรือ video generation action ใดๆ

#### Scenario: Edit button removed
- **WHEN** ผู้ใช้ดูรายละเอียดเนื้อหาจากหน้ารายการอนุมัติ
- **THEN** ไม่แสดงปุ่ม "แก้ไข" ในแถบด้านบนขวาของหน้ารายละเอียด

#### Scenario: Schedule post button removed
- **WHEN** ผู้ใช้ดูรายละเอียดเนื้อหาจากหน้ารายการอนุมัติ
- **THEN** ไม่แสดงปุ่ม "ตั้งเวลาโพสต์" ในแถบด้านบนขวาของหน้ารายละเอียด

### Requirement: Approve action not available on non-pending items
ระบบ SHALL NOT แสดงปุ่ม อนุมัติ/ขอแก้ไข/ปฏิเสธ สำหรับ content items ที่มีสถานะอื่นที่ไม่ใช่ `pending_approval`

#### Scenario: No approve action on approved item
- **WHEN** ผู้ใช้ดูรายละเอียดเนื้อหาจากหน้ารายการอนุมัติ และเนื้อหามี status `approved`
- **THEN** ไม่แสดงปุ่ม อนุมัติ/ขอแก้ไข/ปฏิเสธ

#### Scenario: No approve action on published item
- **WHEN** ผู้ใช้ดูรายละเอียดเนื้อหาจากหน้ารายการอนุมัติ และเนื้อหามี status `published`
- **THEN** ไม่แสดงปุ่ม อนุมัติ/ขอแก้ไข/ปฏิเสธ
