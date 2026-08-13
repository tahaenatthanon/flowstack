## 1. ปรับขนาดปุ่ม "ขออนุมัติ" ใน ContentCardDialog

- [x] 1.1 ใน `src/components/content/ContentCardDialog.tsx` ลบ `size="sm"` ออกจากปุ่ม "ขออนุมัติ" ใน `DialogFooter` (เหลือ `variant="default"` และ `className="gap-1.5"`)
- [x] 1.2 ตรวจสอบว่าปุ่ม "ขออนุมัติ" มีความสูงเท่ากับปุ่ม "ยกเลิก", "AI เขียนให้", "บันทึก" (ขนาด default `h-10`)

## 2. การตรวจสอบ

- [x] 2.1 รัน `pnpm build` — ตรวจสอบไม่มี TypeScript errors
- [x] 2.2 รัน `pnpm lint` — ตรวจสอบไม่มี ESLint errors
- [x] 2.3 ทดสอบด้วยตนเอง: เปิดรายการ content ที่สถานะ draft/revision จากหน้าผลงานคอนเทนต์ → เห็นปุ่ม "ขออนุมัติ" ใน footer มีขนาดเท่ากับปุ่มอื่น
