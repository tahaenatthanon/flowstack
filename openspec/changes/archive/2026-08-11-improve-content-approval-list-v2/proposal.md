## Why

หน้ารายการอนุมัติ (`/content-approval`) และหน้า Content List ปัจจุบันมี workflow การอนุมัติที่ไม่สมบูรณ์: ผู้อนุมัติต้องเข้าหน้าแยกเพื่อดูรายละเอียดเนื้อหาก่อนตัดสินใจ, ไม่สามารถขอแก้ไขจากหน้า Content List ได้โดยตรง, และหน้ารายละเอียดที่เปิดจากรายการอนุมัติมีปุ่มที่ไม่เกี่ยวข้อง (สร้างภาพ, สร้างวิดีโอ) ปะปนกับ action การอนุมัติ นอกจากนี้ Image Viewer ยังมีปัญหา hover ทำให้ container ขยายใหญ่เกินรูปบดบังเนื้อหา

การปรับปรุงนี้จะทำให้ workflow การอนุมัติสมบูรณ์ในจุดเดียว ตั้งแต่ดูรายการ → ดูรายละเอียด → อนุมัติ/ขอแก้ไข/ปฏิเสธ โดยไม่ต้องสลับหน้าจอไปมา

## What Changes

- เพิ่มปุ่ม อนุมัติ, ขอแก้ไข, และ ปฏิเสธ ในหน้า Content List (`ContentListTab`) — แสดงเฉพาะรายการสถานะ `review`
- หน้ารายละเอียดเนื้อหาที่เปิดจากรายการอนุมัติ แสดงข้อมูลครบถ้วนเหมือนหน้าผลงานคอนเทนต์ทั้งหมด (บทความ, แคปชั่น, รูปภาพ, แพลตฟอร์ม, กำหนดการ)
- แก้ไข Image Viewer (`ImageViewer`) ไม่ให้ container ขยายใหญ่เกินรูปเมื่อ hover
- ปรับปุ่มในหน้ารายละเอียดให้เหลือเฉพาะ อนุมัติ, ขอแก้ไข, และ ปฏิเสธ — นำปุ่ม สร้างเนื้อหา AI, สร้างภาพทุกฉาก, สร้างวิดีโอ, แก้ไข, และ ตั้งเวลาโพสต์ ออก
- เปลี่ยน label ปุ่ม "แก้ไข" เป็น "ขอแก้ไข" ใน `ContentDetailView` เพื่อสื่อว่าเป็น action ของผู้อนุมัติ
- เพิ่ม `reject_reason` column ใน `content_items` และส่งค่านี้ผ่าน API เมื่อปฏิเสธ
- **BREAKING**: เปลี่ยน behavior ของ `ContentDetailView` ให้รับ prop `context` เพื่อแสดง/ซ่อนปุ่มตามบริบท (approval vs content)

## Capabilities

### New Capabilities
- `content-list-approval-actions`: ปุ่ม อนุมัติ, ขอแก้ไข, และ ปฏิเสธ ในหน้า Content List สำหรับรายการสถานะ `review` พร้อม dialog ยืนยัน/กรอกเหตุผล
- `approval-detail-full-content`: หน้าแสดงรายละเอียดเนื้อหาครบถ้วนจากรายการอนุมัติ — เหมือนหน้าผลงานคอนเทนต์ทั้งหมด (บทความ/วิดีโอ, รูปภาพ, แคปชั่น, แพลตฟอร์ม, กำหนดการ)
- `approval-detail-actions`: ปุ่ม อนุมัติ, ขอแก้ไข, ปฏิเสธ ในหน้ารายละเอียดที่เปิดจากหน้ารายการอนุมัติ — ไม่มีปุ่ม AI/video/edit/schedule

### Modified Capabilities
- `content-image-lightbox`: แก้ไขการแสดงผล hover — container ไม่ขยายใหญ่เกินรูป, แสดงรูปเต็มพื้นที่อย่างชัดเจน
- `content-approval-list`: เพิ่ม `reject_reason` ใน database และ API; เปลี่ยน label ปุ่ม "แก้ไข" เป็น "ขอแก้ไข" บน `ContentDetailView`; เพิ่มปุ่ม action ใน `ContentListTab`
- `approval-view-content-detail`: เปลี่ยนจาก dialog อ่านอย่างเดียว เป็นมุมมองเต็มรูปแบบที่แสดงเนื้อหาครบถ้วนและมี action การอนุมัติ

## Impact

- **Frontend**: `ContentApprovalPage.tsx`, `ContentListTab.tsx`, `ContentDetailView.tsx`, `ImageViewer.tsx`
- **Backend**: `api/content-items.php` — เพิ่ม `reject_reason` ใน `$allowed` array สำหรับ PUT
- **Database**: `content_items` table — ALTER TABLE เพิ่ม column `reject_reason TEXT NULL`
- **Migration**: `database/migrations/` — ไฟล์ SQL ใหม่สำหรับเพิ่ม column
