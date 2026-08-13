## ADDED Requirements

### Requirement: Detail view shows reject reason
ระบบ SHALL แสดงเหตุผลที่ขอแก้ไข/ปฏิเสธ (`reject_reason`) ในหน้ารายละเอียดเนื้อหา (`ContentDetailView`) เมื่อ content item มีสถานะ `revision` หรือ `rejected` และมี `reject_reason` ไม่ว่าง

#### Scenario: Show revision reason
- **WHEN** ผู้ใช้เปิดรายละเอียดเนื้อหาที่มีสถานะ `revision` และ `reject_reason` ไม่ว่าง
- **THEN** ระบบแสดงแบนเนอร์พร้อมข้อความ "เหตุผลที่ขอแก้ไข" และเนื้อหาของ `reject_reason`

#### Scenario: Show rejection reason
- **WHEN** ผู้ใช้เปิดรายละเอียดเนื้อหาที่มีสถานะ `rejected` และ `reject_reason` ไม่ว่าง
- **THEN** ระบบแสดงแบนเนอร์พร้อมข้อความ "เหตุผลที่ปฏิเสธ" และเนื้อหาของ `reject_reason`

#### Scenario: No reason banner when reason is empty
- **WHEN** ผู้ใช้เปิดรายละเอียดเนื้อหาที่มีสถานะ `revision` หรือ `rejected` แต่ `reject_reason` เป็นค่าว่างหรือ NULL
- **THEN** ระบบไม่แสดงแบนเนอร์เหตุผล
