## 1. Implementation

- [x] 1.1 ลบ `actions={...}` prop ทั้งหมดของ `PageShell` ใน `src/pages/ContentDashboardPage.tsx` (ปุ่ม "ดูเนื้อหาทั้งหมด" และ "สร้างคอนเทนต์")
- [x] 1.2 ลบ `Plus` ออกจาก import lucide-react ใน `src/pages/ContentDashboardPage.tsx`

## 2. Verification

- [x] 2.1 รัน `pnpm lint` และ `pnpm build` ให้ผ่านโดยไม่มี error
- [x] 2.2 ตรวจบนเบราว์เซอร์ว่าส่วนหัวของแดชบอร์ดคอนเทนต์ไม่มีปุ่ม "ดูเนื้อหาทั้งหมด" และ "สร้างคอนเทนต์"
