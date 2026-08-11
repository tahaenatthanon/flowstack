## ADDED Requirements

### Requirement: User can view content detail from approval list
ระบบ SHALL ให้ผู้ใช้สามารถกดเลือก Content แต่ละรายการในตารางรายการอนุมัติเพื่อเปิดดูรายละเอียดของ Content ได้ โดยใช้ `ContentDetailView` component ที่มีอยู่แล้วในระบบ แสดงใน `Dialog`

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
