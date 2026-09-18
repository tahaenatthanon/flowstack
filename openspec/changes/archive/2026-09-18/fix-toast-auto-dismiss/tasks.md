## 1. เพิ่ม guaranteed auto-dismiss timer

- [x] 1.1 เพิ่มค่าคงที่ `TOAST_AUTO_DISMISS_DELAY = 5000` ใน `src/hooks/use-toast.ts`
- [x] 1.2 ในฟังก์ชัน `toast()` เพิ่ม `setTimeout(() => dismiss(), TOAST_AUTO_DISMISS_DELAY)` ทันทีหลัง dispatch `ADD_TOAST` — เรียก `dismiss()` ตรงๆ ไม่ผ่านกลไก pause ของ Radix
- [x] 1.3 ลดค่า `TOAST_REMOVE_DELAY` จาก `1000000` เป็น `1000`

## 2. ตรวจสอบด้วยเบราว์เซอร์

- [x] 2.1 เปิดหน้าต่าง "ดึงคอนเทนท์" เลือกคอนเทนต์ ("เลือกคอนเทนต์นี้") ให้ dialog "สร้างแคมเปญใหม่" เปิดทับ แล้วขยับเมาส์ผ่านโซนมุมขวาล่าง (ตำแหน่ง toast viewport) ซ้ำๆ ต่อเนื่อง — ยืนยันว่า toast "นำเข้าบทความแล้ว" ยังหายไปภายใน ~5 วินาที ไม่ค้าง (ทดสอบด้วย MutationObserver + จำลอง pointermove ต่อเนื่องบน viewport 700ms x 8 ครั้ง toast หายจาก DOM สมบูรณ์)
- [x] 2.2 ทดสอบ toast อีกจุดหนึ่ง (การเปิด dialog "ดึงคอนเทนท์" ครั้งแรกโดยไม่มีการโต้ตอบใดๆ กับ viewport) — ยืนยันว่ายังหายไปตามปกติภายในไม่กี่วินาที ไม่เร็ว/ช้าผิดปกติ
- [x] 2.3 ยืนยันผ่าน DOM (`document.querySelectorAll('[role="status"]').length === 0`) ว่า toast element ถูกลบออกจาก DOM จริง ไม่ใช่แค่ซ่อนด้วย CSS ค้างอยู่

## 3. Build & Lint

- [x] 3.1 รัน `pnpm lint` (ผ่าน ไม่มี error ในไฟล์ที่แก้)
- [x] 3.2 รัน `pnpm build` (ผ่าน)
