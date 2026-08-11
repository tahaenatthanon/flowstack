## Why

หน้ารายการอนุมัติ (`/content-approval`) ปัจจุบันแสดง Stat Cards และตารางรายการ แต่ผู้ใช้งานไม่สามารถเปิดดูรายละเอียดของ Content แต่ละรายการได้ ทำให้ต้องออกจากหน้ารายการอนุมัติเพื่อกลับไปดู Content ในหน้าผลงานคอนเทนต์ ("ผลงานคอนเทนต์ทั้งหมด") และ Stat Cards มีรูปแบบที่แตกต่างจาก UI Pattern ที่ใช้ในระบบ

## What Changes

- ปรับรูปแบบ Stat Card ให้มีหัวข้อ (Title) และ Icon อยู่ในแถวเดียวกัน และ Count แสดงอยู่ด้านล่าง โดยใช้ UI Pattern ที่สอดคล้องกับ Design System เดิมของระบบ
- เพิ่มความสามารถในการเปิดดูรายละเอียด Content จากรายการใน Approval List โดยใช้ Component / UI Pattern เดิมที่มีอยู่แล้ว (`ContentDetailView` — อ่านอย่างเดียว, ไม่แก้ไข)
- **ไม่เปลี่ยนแปลง** Business Logic ของการอนุมัติ (`approve`), ขอแก้ไข (`revision`), และปฏิเสธ (`rejected`)
- **ไม่เปลี่ยนแปลง** Calculation หรือ Business Logic ของ Count ใน Stat Card
- **ไม่เปลี่ยนแปลง** Workflow หรือ UI ของส่วนอื่นที่ไม่เกี่ยวข้อง

## Capabilities

### New Capabilities
- `approval-stat-card-style`: ปรับรูปแบบ Stat Card ให้ Title + Icon อยู่ในแถวเดียวกัน และ Count อยู่ด้านล่าง สอดคล้องกับ Design System
- `approval-view-content-detail`: รองรับการเปิดดูรายละเอียด Content จากรายการใน Approval List แบบ View-Only โดยใช้ Component `ContentDetailView` ที่มีอยู่แล้ว

### Modified Capabilities
<!-- ไม่มี Requirement ไหนที่ถูกแก้ไข — เป็นการเพิ่มฟีเจอร์ใหม่ล้วน ๆ ไม่ใช่การเปลี่ยน spec เดิม -->

## Impact

- `src/pages/ContentApprovalPage.tsx` — ปรับ UI Stat Cards, เพิ่ม onClick บน TableRow เพื่อเปิด ContentDetailView
- `src/components/content/views/ContentDetailView.tsx` — อาจต้องตรวจสอบเรื่องการเปิดแบบ dialog (ไม่ได้ผ่าน route)
