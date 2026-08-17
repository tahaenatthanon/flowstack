## MODIFIED Requirements

### Requirement: Approval detail view displays full content
ระบบ SHALL แสดงรายละเอียดเนื้อหาครบถ้วนเมื่อเปิดจากหน้ารายการอนุมัติ — ในรูปแบบเดียวกับ `ContentDetailView` ของหน้าผลงานคอนเทนต์ทั้งหมด

#### Scenario: View complete content from approval list
- **WHEN** ผู้ใช้คลิกที่ content item ในหน้ารายการอนุมัติ
- **THEN** ระบบแสดง `ContentDetailView` พร้อมข้อมูล: ชื่อ, ประเภท, แพลตฟอร์ม, วันที่, เนื้อหาบทความ/วิดีโอ, แคปชั่น, รูปภาพ — เหมือนกับหน้าผลงานคอนเทนต์ทั้งหมด

#### Scenario: Detail view includes action buttons when viewed from approval
- **WHEN** `ContentDetailView` แสดงโดยมี `context='approval'`
- **THEN** หน้ารายละเอียดแสดงปุ่ม อนุมัติ, ขอแก้ไข, ปฏิเสธ ในแถว action — ไม่แสดงปุ่ม แก้ไข, ตั้งเวลาโพสต์, สร้างเนื้อหา AI, สร้างภาพ, สร้างวิดีโอ

#### Scenario: Detail view unchanged when viewed from content page
- **WHEN** `ContentDetailView` แสดงโดยมี `context='content'` (default)
- **THEN** หน้ารายละเอียดแสดงปุ่ม แก้ไข, ตั้งเวลาโพสต์, สร้างเนื้อหา AI — เหมือนเดิม ไม่มีการเปลี่ยนแปลง
