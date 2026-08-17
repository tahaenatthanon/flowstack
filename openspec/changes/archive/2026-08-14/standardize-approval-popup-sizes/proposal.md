## Why

Popup ยืนยันการอนุมัติ "ยืนยันการอนุมัติ", "ขอแก้ไขเนื้อหา" และ "ปฏิเสธเนื้อหา" ในหน้า "รายการอนุมัติ" (`ContentApprovalTab.tsx`) ใช้ `<DialogContent>` โดยไม่กำหนดความกว้าง ทำให้ default กว้างเกือบเต็มจอ (base `sm:max-w-[calc(100vw-2rem)]`) ขณะที่ popup ชุดเดียวกันในหน้ารายละเอียด (`ContentDetailView.tsx`) ใช้ `sm:max-w-md` — ส่งผลให้ popup ประเภทเดียวกันมีขนาดไม่เท่ากัน ขาดความสม่ำเสมอของ UI

## What Changes

- กำหนดความกว้างของ popup ทั้ง 3 ("ยืนยันการอนุมัติ", "ขอแก้ไขเนื้อหา", "ปฏิเสธเนื้อหา") ให้เท่ากันด้วย `w-full sm:max-w-md` (448px) ซึ่งเป็นมาตรฐานเดียวกับ popup เดิมใน `ContentDetailView`
- ปรับ `DialogContent` ของ "ยืนยันการอนุมัติ" และ reason dialog ("ขอแก้ไขเนื้อหา" / "ปฏิเสธเนื้อหา") ใน `ContentApprovalTab.tsx` ให้มี width class ตรงกับมาตรฐาน
- คง Layout ภายในเดิมของแต่ละ popup (header + description + textarea สำหรับ reason dialog / footer ปุ่ม) โดยไม่ขยายให้กว้างเกินความจำเป็น
- ปรับช่องกรอกเหตุผล (textarea) ใน popup "ขอแก้ไขเนื้อหา" และ "ปฏิเสธเนื้อหา" ให้ปรับความสูงอัตโนมัติตามจำนวนบรรทัดของข้อความที่กรอก (auto-resize)

## Capabilities

### New Capabilities

- `approval-dialog-sizing`: กำหนดความกว้างและขนาดโดยรวมของ popup "ยืนยันการอนุมัติ", "ขอแก้ไขเนื้อหา" และ "ปฏิเสธเนื้อหา" ให้เป็นมาตรฐานเดียวกัน และปรับช่องกรอกเหตุผลให้ปรับความสูงอัตโนมัติตามเนื้อหา

### Modified Capabilities

<!-- ไม่มีการเปลี่ยนแปลง requirement ของ spec เดิม -->

## Impact

- `src/components/content/tabs/ContentApprovalTab.tsx` — เพิ่ม `className="w-full sm:max-w-md"` บน `DialogContent` ของ approve confirm dialog และ reason dialog; เพิ่ม auto-resize บน textarea เหตุผล
- `src/components/content/views/ContentDetailView.tsx` — ไม่ต้องแก้ width (ใช้ `sm:max-w-md` อยู่แล้ว) แต่เพิ่ม auto-resize บน textarea เหตุผลของ reason dialog เพื่อความสม่ำเสมอ
- ไม่กระทบ API, hooks, หรือ logic การอนุมัติ/ขอแก้ไข/ปฏิเสธ
