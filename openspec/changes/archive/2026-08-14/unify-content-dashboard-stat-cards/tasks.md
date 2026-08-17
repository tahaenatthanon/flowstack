## 1. ปรับข้อมูล statCards array

- [x] 1.1 ใน `ContentDashboardPage.tsx` เปลี่ยน `color` field จาก `text-{c} bg-{c} dark:bg-...` เป็น `text-{c}` ล้วน (text-blue-600, text-green-600, text-amber-600, text-gray-600, text-cyan-600, text-pink-600)
- [x] 1.2 ลบ field `border` ออกจากทุกรายการใน `statCards` array

## 2. ปรับ markup ของ Stat Cards

- [x] 2.1 เปลี่ยน grid จาก `gap-4` เป็น `gap-3`
- [x] 2.2 แทนที่ `<Card className="border {border} shadow-sm">` + `<CardContent>` แนวนอน (กล่องสีไอคอนซ้าย + จำนวน/ชื่อขวา) ด้วย KpiCard pattern: `<Card>` → `<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">` (หัวข้อ `text-sm font-medium` + ไอคอน `h-4 w-4 {color}`) → `<CardContent>` (จำนวน `text-2xl font-bold`)

## 3. ตรวจสอบและทดสอบ

- [x] 3.1 รัน `pnpm lint` และ `pnpm build` ให้ผ่าน
- [x] 3.2 ทดสอบบนเบราว์เซอร์: เปิดแดชบอร์ดคอนเทนต์ — Stat Cards ทั้ง 6 ใบแสดงหัวข้อบนซ้าย, ไอคอนขวา, จำนวนล่าง ตรงกับหน้ารายการอนุมัติ
- [x] 3.3 ยืนยันว่าจำนวน/label/สีของแต่ละ card คงเดิม และ count ยังอัปเดตถูกต้อง
