## 1. ปรับความกว้าง popup ใน ContentApprovalTab

- [x] 1.1 แก้ `DialogContent` ของ approve confirm dialog ("ยืนยันการอนุมัติ") จาก `<DialogContent>` เป็น `<DialogContent className="w-full sm:max-w-md">`
- [x] 1.2 แก้ `DialogContent` ของ reason dialog ("ขอแก้ไขเนื้อหา" / "ปฏิเสธเนื้อหา") จาก `<DialogContent>` เป็น `<DialogContent className="w-full sm:max-w-md">`

## 2. ตรวจสอบความสม่ำเสมอ

- [x] 2.1 ยืนยันว่า popup ทั้งสามใน `ContentApprovalTab.tsx` ใช้ `sm:max-w-md` เท่ากัน
- [x] 2.2 ยืนยันว่า `ContentDetailView.tsx` ใช้ `sm:max-w-md` อยู่แล้ว (ไม่ต้องแก้)

## 3. ตรวจสอบและทดสอบ

- [x] 3.1 รัน `pnpm lint` และ `pnpm build` ให้ผ่าน
- [x] 3.2 ทดสอบบนเบราว์เซอร์: เปิด "ยืนยันการอนุมัติ", "ขอแก้ไขเนื้อหา" และ "ปฏิเสธเนื้อหา" ในหน้า "รายการอนุมัติ" — ขนาดเท่ากัน, ไม่กว้างเกิน, textarea และปุ่มจัดวางถูกต้อง
- [x] 3.3 ยืนยันว่าการอนุมัติ/ขอแก้ไข/ปฏิเสธ ยังทำงานเหมือนเดิม (รวมเหตุผลไม่บังคับ)

## 4. ปรับช่องกรอกเหตุผลให้ auto-resize

- [x] 4.1 ใน `ContentApprovalTab.tsx` เพิ่ม auto-resize บน textarea เหตุผล (useRef + resize ใน onChange/useEffect + `resize-none`)
- [x] 4.2 ใน `ContentDetailView.tsx` เพิ่ม auto-resize บน textarea เหตุผลเช่นเดียวกัน เพื่อความสม่ำเสมอ
- [x] 4.3 ยืนยันว่า textarea ขยายเมื่อกรอกหลายบรรทัด และหดลงเมื่อข้อความสั้นลง โดยความสูงขั้นต่ำคงเดิม

## 5. ตรวจสอบและทดสอบ (auto-resize)

- [x] 5.1 รัน `pnpm lint` และ `pnpm build` ให้ผ่าน
- [x] 5.2 ทดสอบบนเบราว์เซอร์: เปิด "ขอแก้ไขเนื้อหา" และ "ปฏิเสธเนื้อหา" ทั้งในหน้ารายการอนุมัติและหน้ารายละเอียด — กรอกหลายบรรทัดแล้วลบ ดูว่า textarea ปรับสูงขึ้น/ต่ำลงตามเนื้อหา
- [x] 5.3 ยืนยันว่าการอนุมัติ/ขอแก้ไข/ปฏิเสธ ยังทำงานเหมือนเดิม
