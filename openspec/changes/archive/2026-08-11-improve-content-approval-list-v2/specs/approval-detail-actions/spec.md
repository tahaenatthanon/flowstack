## ADDED Requirements

### Requirement: Approval detail shows approve/reject/revision buttons
ระบบ SHALL แสดงปุ่ม อนุมัติ, ขอแก้ไข, และ ปฏิเสธ ในหน้ารายละเอียดเนื้อหาที่เปิดจากรายการอนุมัติ

#### Scenario: Display approve button in detail view
- **WHEN** ผู้ใช้ดูรายละเอียดเนื้อหาจากหน้ารายการอนุมัติ และเนื้อหามี status `review`
- **THEN** ระบบแสดงปุ่ม "อนุมัติ" ในแถว action ด้านล่างของเนื้อหา

#### Scenario: Display request revision button in detail view
- **WHEN** ผู้ใช้ดูรายละเอียดเนื้อหาจากหน้ารายการอนุมัติ และเนื้อหามี status `review`
- **THEN** ระบบแสดงปุ่ม "ขอแก้ไข" ในแถว action ด้านล่างของเนื้อหา

#### Scenario: Display reject button in detail view
- **WHEN** ผู้ใช้ดูรายละเอียดเนื้อหาจากหน้ารายการอนุมัติ และเนื้อหามี status `review`
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

### Requirement: Approve action available on approved items
ระบบ SHALL NOT แสดงปุ่ม อนุมัติ/ขอแก้ไข/ปฏิเสธ สำหรับ content items ที่มีสถานะอื่นที่ไม่ใช่ `review`

#### Scenario: No approve action on published item
- **WHEN** ผู้ใช้ดูรายละเอียดเนื้อหาจากหน้ารายการอนุมัติ และเนื้อหามี status `published`
- **THEN** ไม่แสดงปุ่ม อนุมัติ/ขอแก้ไข/ปฏิเสธ
