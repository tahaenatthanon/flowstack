## ADDED Requirements

### Requirement: Content items store reject reason
ระบบ SHALL รองรับการบันทึกเหตุผลการปฏิเสธ/ขอแก้ไข (`reject_reason`) ในตาราง `content_items`

#### Scenario: Reject reason stored in database
- **WHEN** ผู้ใช้ปฏิเสธหรือขอแก้ไข content item พร้อมระบุเหตุผล
- **THEN** ระบบบันทึก `reject_reason` ใน column `content_items.reject_reason` พร้อมกับ `status` ที่เปลี่ยนเป็น `rejected` หรือ `revision`

#### Scenario: Reject reason is optional
- **WHEN** ผู้ใช้ปฏิเสธหรือขอแก้ไขโดยไม่ระบุเหตุผล
- **THEN** ระบบยังคงเปลี่ยนสถานะได้ — `reject_reason` เก็บเป็น NULL

## MODIFIED Requirements

### Requirement: User can reject a content item
ระบบ SHALL ให้ผู้ใช้ที่มีสิทธิ์สามารถปฏิเสธ content item พร้อมระบุเหตุผล โดยเปลี่ยนสถานะเป็น `rejected` และบันทึกเหตุผลลง `reject_reason`

#### Scenario: Reject content with reason
- **WHEN** ผู้ใช้คลิก "ปฏิเสธ" บนรายการคอนเทนต์
- **THEN** ระบบแสดง dialog ให้กรอกเหตุผล และเมื่อส่งแล้ว สถานะเปลี่ยนเป็น `rejected`, `reject_reason` ถูกบันทึก, และรายการนั้นปรากฏใน Tab "ปฏิเสธ"

### Requirement: Rejected status is distinct from draft
ระบบ SHALL แยกสถานะ `rejected` (ถูกปฏิเสธโดยผู้อนุมัติ) ออกจาก `draft` (บันทึกเป็นร่างโดยผู้สร้าง) ใน `STATUS_MAP` และเก็บ `reject_reason` ใน `content_items.reject_reason` ผ่าน database migration

#### Scenario: Rejected items appear in "ปฏิเสธ" tab
- **WHEN** content item ถูกปฏิเสธโดยผู้อนุมัติ
- **THEN** สถานะเป็น `rejected` และปรากฏใน Tab "ปฏิเสธ" ไม่ใช่ Tab "ร่าง"

#### Scenario: Database schema supports rejected status and reason
- **WHEN** ระบบ INSERT หรือ UPDATE `content_items.status` เป็น `'rejected'` พร้อม `reject_reason`
- **THEN** ฐานข้อมูลยอมรับค่าทั้งสองโดยไม่มี error เนื่องจาก schema รองรับแล้ว

## MODIFIED Requirements

### Requirement: Revision items store reason
เมื่อเปลี่ยน status เป็น `revision` (ขอแก้ไข) ระบบ SHALL บันทึกเหตุผลที่ขอแก้ไขลงใน `reject_reason` column

#### Scenario: Revision request with reason
- **WHEN** ผู้ใช้คลิก "ขอแก้ไข" และกรอกเหตุผล
- **THEN** ระบบเปลี่ยน status เป็น `revision` และบันทึก `reject_reason` 
#### Scenario: Revision request without reason
- **WHEN** ผู้ใช้คลิก "ขอแก้ไข" โดยไม่กรอกเหตุผล
- **THEN** ระบบยังคงเปลี่ยน status เป็น `revision` — `reject_reason` เป็น NULL
