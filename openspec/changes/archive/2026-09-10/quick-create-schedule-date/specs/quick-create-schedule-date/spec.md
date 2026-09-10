## ADDED Requirements

### Requirement: Quick Create schedules the item to the current date automatically
เมื่อ `QuickCreateDialog` สร้าง content item ผ่าน `generate-plan` สำเร็จ ระบบ SHALL เรียก `action=plan-item-date` ตั้ง `scheduled_date` ของ item นั้นเป็นวันที่ปัจจุบัน (local date) โดยอัตโนมัติ โดยไม่มีช่องให้ผู้ใช้เลือกวันที่เอง

#### Scenario: สร้าง content ผ่าน Quick Create สำเร็จ
- **WHEN** ผู้ใช้กรอกหัวข้อและกดสร้างจาก Quick Create แล้ว `generate-plan` คืนผลสำเร็จ
- **THEN** ระบบเรียก `action=plan-item-date` ด้วย `item_id` ของ item ที่สร้างและ `scheduled_date` เป็นวันที่ปัจจุบัน
- **AND** การคำนวณวันที่ปัจจุบันใช้ local date components (`getFullYear`/`getMonth`/`getDate`) ไม่ใช้ `toISOString()`

#### Scenario: การเรียกตั้งวันที่เกิดขึ้นก่อน Research
- **WHEN** `generate-plan` สำเร็จและได้ `item.id`
- **THEN** ระบบเรียก `plan-item-date` ก่อนเริ่ม Research/Generate เนื้อหาสำหรับ item นั้นเสมอ

### Requirement: Scheduling failure does not fail the whole creation flow
ถ้าการเรียก `plan-item-date` ล้มเหลว ระบบ SHALL ไม่ทำให้ Research/Generate เนื้อหาของ item นั้นหยุดทำงานตาม และ SHALL แจ้งผู้ใช้ด้วย toast ทันทีว่า content สร้างสำเร็จแต่ยังไม่ได้กำหนดวันที่

#### Scenario: plan-item-date ล้มเหลวแต่ generate/research สำเร็จ
- **WHEN** การเรียก `plan-item-date` เกิด error
- **THEN** ระบบยังคงเรียก Research และ generate-article ให้ item นั้นต่อตามปกติ
- **AND** แสดง toast แจ้งผู้ใช้ว่า content สร้างสำเร็จแต่ยังไม่ได้กำหนดวันที่ ให้ไปตั้งเองภายหลังได้จาก Calendar หรือ List

#### Scenario: plan-item-date สำเร็จ ไม่มี toast แจ้งเตือนเพิ่ม
- **WHEN** การเรียก `plan-item-date` สำเร็จ
- **THEN** ระบบไม่ต้องแสดง toast แยกสำหรับการตั้งวันที่ (ใช้ toast สำเร็จของการสร้าง content ตามปกติ)
