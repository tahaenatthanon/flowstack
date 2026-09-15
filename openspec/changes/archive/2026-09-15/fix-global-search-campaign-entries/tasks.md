## 1. แก้ GlobalSearch NAV_ITEMS

- [x] 1.1 ใน `src/components/GlobalSearch.tsx` แก้บรรทัด 34: `{ title: 'การตลาด', href: '/marketing', icon: Megaphone }` → `{ title: 'แคมเปญอีเมล', href: '/campaigns', icon: Megaphone }`
- [x] 1.2 ลบบรรทัด 35 เดิม `{ title: 'แคมเปญ', href: '/campaigns', icon: Megaphone }` ออก (ซ้ำซ้อนกับ 1.1)
- [x] 1.3 เพิ่มรายการใหม่ `{ title: 'วิเคราะห์แคมเปญ', href: '/campaign-analytics', icon: BarChart3 }` ต่อจากรายการแคมเปญอีเมล (ใช้ icon `BarChart3` ที่ import ไว้แล้วในไฟล์)

## 2. ตรวจสอบ

- [x] 2.1 รัน `pnpm lint` — ต้องไม่มี error ใหม่เพิ่มขึ้น
- [x] 2.2 รัน `pnpm build` — ต้องผ่าน
- [x] 2.3 รัน `pnpm test` — ต้องผ่าน
- [x] 2.4 เปิดแอปจริง กด Cmd+K พิมพ์ "แคมเปญ" — ยืนยันเจอรายการ "แคมเปญอีเมล" รายการเดียว ไม่ซ้ำ และคลิกแล้วไปหน้าจัดการแคมเปญอีเมลถูกต้อง
- [x] 2.5 กด Cmd+K พิมพ์ "วิเคราะห์" — ยืนยันเจอรายการ "วิเคราะห์แคมเปญ" และคลิกแล้วไปหน้า `/campaign-analytics` ถูกต้อง
