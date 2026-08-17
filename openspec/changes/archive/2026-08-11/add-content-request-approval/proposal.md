## Why

ผู้สร้างคอนเทนต์ในปัจจุบันไม่มีทางส่งเนื้อหาเข้าสู่กระบวนการอนุมัติจากหน้ารายละเอียดเนื้อหา (ContentDetailView) โดยตรง — ต้องเปลี่ยนสถานะผ่าน API หรือให้ admin จัดการเอง นอกจากนี้ในรายการผลงานคอนเทนต์ (ContentListTab) ไม่มีการแสดงสถานะ (status) บนแต่ละแถว ทำให้ผู้ใช้ไม่สามารถแยกแยะได้ว่ารายการใดอยู่ในสถานะใดโดยไม่ต้องดูผ่านตัวกรอง

## What Changes

- เพิ่มปุ่ม "ขออนุมัติ" ใน `ContentDetailView` (context='content') สำหรับรายการที่มีสถานะ `draft` หรือ `revision` — เมื่อคลิกจะเปลี่ยนสถานะเป็น `review` และส่งเข้า approval workflow
- เพิ่มปุ่ม "ขออนุมัติ" ใน `ContentCardDialog` footer สำหรับรายการที่มีสถานะ `draft` หรือ `revision` — วางขวาสุดต่อจากปุ่ม "บันทึก" ให้ผู้ใช้สามารถขออนุมัติได้ทันทีหลังจากแก้ไขเนื้อหา
- เพิ่มการแสดง Status badge ต่อท้ายชื่อบทความในแต่ละแถวของ `ContentListTab` — แสดงในรูปแบบ `ชื่อบทความ (สถานะ)` โดยใช้สีตัวอักษรเท่านั้น (ไม่มีพื้นหลัง)
- สีของ Status badge สอดคล้องกับ Status Filter tabs — ใช้เฉพาะ text color จาก `STATUS_MAP` (เช่น `text-green-700`, `text-amber-700` โดยไม่ใช้ bg classes)
- แสดง Status badge เฉพาะเมื่อไม่ได้อยู่ใน tab ที่กรองสถานะนั้นอยู่แล้ว (เช่น ถ้ากำลังดู tab "รอเผยแพร่" จะไม่แสดง "รอเผยแพร่" ซ้ำในทุกแถว)

## Capabilities

### New Capabilities
- `content-request-approval`: ปุ่ม "ขออนุมัติ" ในหน้ารายละเอียดเนื้อหา (ContentDetailView, context='content') — เปลี่ยนสถานะจาก `draft`/`revision` เป็น `review` เพื่อส่งเข้า workflow การอนุมัติ
- `content-dialog-request-approval`: ปุ่ม "ขออนุมัติ" ใน footer ของ `ContentCardDialog` — วางขวาสุดต่อจากปุ่ม "บันทึก" สำหรับรายการ draft/revision ที่มี `existingItem`
- `content-list-status-badge`: แสดง Status badge ต่อท้ายชื่อบทความใน `ContentListTab` ด้วยสีที่แตกต่างตามสถานะ สอดคล้องกับ Status Filter tabs

### Modified Capabilities
<!-- No existing specs are being modified at the requirement level -->

## Impact

- **Frontend**: `ContentDetailView.tsx` — เพิ่มปุ่ม "ขออนุมัติ" ใน action bar (context='content'); `ContentCardDialog.tsx` — เพิ่ม prop `contentStatus`, ปุ่ม "ขออนุมัติ" ใน footer, confirm dialog; `ContentListTab.tsx` — เพิ่ม Status badge ต่อท้าย `item.title` และส่ง `contentStatus` ไปยัง `ContentCardDialog`
- **Backend**: ไม่มีการเปลี่ยนแปลง API — ใช้ endpoint `PUT /content-items.php?id={id}` ที่มีอยู่แล้วเพื่ออัปเดต `status: 'review'`
- **Database**: ไม่ต้องเปลี่ยนแปลง — `content_items.status` รองรับค่า `review` อยู่แล้ว
