# approval-view-content-detail Specification

## Purpose

กำหนดพฤติกรรมการเปิดดูรายละเอียด Content จากตารางในหน้า "รายการอนุมัติ" (`/content-approval`) แบบอ่านอย่างเดียว (View-Only) โดยใช้ `ContentDetailView` component ที่มีอยู่แล้วในระบบ แสดงใน `Dialog` — ผู้ใช้ไม่ต้องออกจากหน้ารายการอนุมัติเพื่อไปดูเนื้อหาที่หน้าผลงานคอนเทนต์

## Requirements

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

#### Scenario: Click row to open content detail
- **WHEN** ผู้ใช้คลิกที่แถวของ Content ในตารางรายการอนุมัติ
- **THEN** ระบบเปิด `Dialog` ที่แสดง `ContentDetailView` สำหรับ Content รายการนั้น พร้อมปุ่ม "ย้อนกลับ" (onBack) ที่ปิด Dialog

#### Scenario: Content detail is view-only
- **WHEN** ผู้ใช้เปิดดูรายละเอียด Content จากหน้ารายการอนุมัติ
- **THEN** เนื้อหาถูกแสดงแบบอ่านอย่างเดียว (View-Only) และไม่มีการเปลี่ยนแปลง Status ของ Content

#### Scenario: Approve and reject buttons still work
- **WHEN** ผู้ใช้คลิก "อนุมัติ" หรือ "ปฏิเสธ" บนรายการ Content ที่สถานะ `review`
- **THEN** ปุ่มทำงานตามปกติ — อนุมัติเปลี่ยนเป็น `published`, ปฏิเสธเปลี่ยนเป็น `rejected` — และการคลิกปุ่มไม่ทำให้เปิด Dialog รายละเอียด (stopPropagation)

#### Scenario: Row hover shows cursor pointer
- **WHEN** ผู้ใช้เลื่อนเมาส์ไปที่แถวของ Content ในตาราง
- **THEN** cursor เปลี่ยนเป็น `pointer` และแถวมีพื้นหลัง `hover:bg-muted/30`

#### Scenario: Close detail dialog
- **WHEN** ผู้ใช้กดปุ่ม "ย้อนกลับ" ใน `ContentDetailView` หรือกดปิด Dialog
- **THEN** Dialog ปิดและผู้ใช้กลับมาที่หน้ารายการอนุมัติตามเดิม
