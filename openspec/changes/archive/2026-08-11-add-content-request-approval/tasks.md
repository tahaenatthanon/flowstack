## 1. ContentDetailView — ปุ่มขออนุมัติ

- [x] 1.1 เพิ่ม state `requestApprovalConfirm` ใน `ContentDetailView` (`useState(false)`)
- [x] 1.2 เพิ่มปุ่ม "ขออนุมัติ" ใน action bar (context='content') เมื่อ `item.status` เป็น `draft` หรือ `revision` — ใช้ `<Send>` icon, `variant="outline"`, สีน้ำเงิน/primary
- [x] 1.3 สร้าง `handleRequestApproval` function — เรียก `PUT /content-items.php?id={item.id}` ด้วย `{ status: 'review' }`, invalidate queries, toast "ส่งอนุมัติแล้ว"
- [x] 1.4 เพิ่ม Confirm Dialog — title "ยืนยันการขออนุมัติ", description แสดงชื่อ content, ปุ่ม "ยกเลิก" และ "ยืนยัน"
- [x] 1.5 ตรวจสอบ: ปุ่มไม่แสดงเมื่อ `status` เป็น `review`, `published`, หรือ `rejected`
- [x] 1.6 ตรวจสอบ: ปุ่มไม่แสดงเมื่อ `context='approval'`

## 2. ContentCardDialog — ปุ่มขออนุมัติใน Footer

- [x] 2.1 เพิ่ม prop `contentStatus?: string` ใน `ContentCardDialog` interface
- [x] 2.2 เพิ่มปุ่ม "ขออนุมัติ" ใน `DialogFooter` ขวาสุดต่อจาก "บันทึก" — เมื่อ `existingItem` มีอยู่ และ `contentStatus` เป็น `draft` หรือ `revision`
- [x] 2.3 ใช้ `<Send>` icon, `variant="default"`, สี primary เพื่อให้เด่นกว่า "บันทึก"
- [x] 2.4 เพิ่ม state `requestApprovalConfirm` และ confirm dialog ใน `ContentCardDialog`
- [x] 2.5 สร้าง `handleRequestApproval` — เรียก `PUT /content-items.php?id={existingItem.id}` ด้วย `{ status: 'review' }`, invalidate queries, toast "ส่งอนุมัติแล้ว", ปิด dialog
- [x] 2.6 อัปเดต `ContentListTab` — ส่ง `contentStatus={editItemLatest?.status}` ไปยัง `ContentCardDialog`
- [x] 2.7 อัปเดต `ContentDetailView` — ส่ง `contentStatus={item.status}` ไปยัง `ContentCardDialog`
- [x] 2.8 ตรวจสอบ: ปุ่มไม่แสดงเมื่อสร้างใหม่ (ไม่มี `existingItem`)

## 3. ContentListTab — Status Badge

- [x] 3.1 เพิ่ม Status badge ต่อท้าย `item.title` ในแต่ละแถว — ใช้ `<span>` แสดง `(สถานะ)` ด้วยสีตัวอักษรเท่านั้น (ไม่มีพื้นหลัง) โดยเอาเฉพาะ text color classes จาก `STATUS_MAP[item.status].color`
- [x] 3.2 แสดง badge ในรูปแบบ `ชื่อบทความ (สถานะ)` — ใช้ Thai label จาก `STATUS_MAP[item.status].label`
- [x] 3.3 เพิ่ม logic ซ่อน badge เมื่อ `statusFilter !== 'all'` และ `statusFilter === item.status` (อยู่ใน tab ที่กรองด้วยสถานะนั้น)
- [x] 3.4 ตรวจสอบ: badge แสดงใน tab "ทั้งหมด" เสมอ
- [x] 3.5 ตรวจสอบ: badge แสดงเมื่อกรองด้วย type หรือ platform (แต่ statusFilter เป็น 'all')

## 4. Integration & Verification

- [x] 4.1 Run `pnpm build` — ตรวจสอบไม่มี TypeScript errors
- [x] 4.2 Run `pnpm lint` — ตรวจสอบไม่มี ESLint errors
- [ ] 4.3 Manual test: เปิด ContentDetailView ของ draft item → เห็นปุ่ม "ขออนุมัติ" → กด → เปลี่ยนเป็น review
- [ ] 4.4 Manual test: เปิด ContentDetailView ของ revision item → เห็นปุ่ม "ขออนุมัติ" → กด → เปลี่ยนเป็น review
- [ ] 4.5 Manual test: เปิด ContentDetailView ของ published item → ไม่เห็นปุ่ม "ขออนุมัติ"
- [ ] 4.6 Manual test: เปิด ContentDetailView จาก approval page → ไม่เห็นปุ่ม "ขออนุมัติ"
- [ ] 4.7 Manual test: เปิด ContentCardDialog จาก ContentListTab (draft item) → เห็นปุ่ม "ขออนุมัติ" ใน footer → กด → เปลี่ยนเป็น review
- [ ] 4.8 Manual test: เปิด ContentCardDialog จาก ContentDetailView (draft item) → เห็นปุ่ม "ขออนุมัติ" ใน footer
- [ ] 4.9 Manual test: ContentListTab แสดง status badge ใน tab "ทั้งหมด"
- [ ] 4.10 Manual test: ContentListTab ไม่แสดง status badge ใน tab "ฉบับร่าง" (statusFilter='draft')
- [ ] 4.11 Manual test: สีของ badge แต่ละสถานะถูกต้อง
