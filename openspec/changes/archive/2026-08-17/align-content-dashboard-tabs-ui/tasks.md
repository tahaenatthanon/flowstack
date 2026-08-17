## 1. เพิ่ม import ไอคอน

- [x] 1.1 ใน `src/pages/ContentDashboardPage.tsx` เพิ่ม `LayoutDashboard` ใน import จาก `lucide-react` (คงไอคอนเดิมไว้ รวมถึง `BarChart3`)

## 2. ปรับรูปแบบ tab bar

- [x] 2.1 เปลี่ยน `<TabsList>` เป็น `<TabsList className="flex overflow-x-auto w-full text-xs sm:text-sm sm:grid sm:grid-cols-2">`
- [x] 2.2 ปรับ `TabsTrigger` "ภาพรวม" (`value="overview"`) เป็น `className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"` เพิ่ม `<LayoutDashboard className="h-3.5 w-3.5 shrink-0" />` และห่อ label ด้วย `<span className="hidden sm:inline">ภาพรวม</span>`
- [x] 2.3 ปรับ `TabsTrigger` "วิเคราะห์" (`value="analytics"`) เป็น `className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0"` เพิ่ม `<BarChart3 className="h-3.5 w-3.5 shrink-0" />` และห่อ label ด้วย `<span className="hidden sm:inline">วิเคราะห์</span>`

## 3. ตรวจสอบ

- [x] 3.1 รัน `pnpm lint` และแก้ error/warning ที่พบ
- [x] 3.2 รัน `pnpm build` และยืนยันว่า build ผ่าน
- [ ] 3.3 ตรวจสอบด้วยตาเปล่า: บนจอ `sm` ขึ้นไป สองแท็บแสดงไอคอน + label ใน grid 2 คอลัมน์; ต่ำกว่า `sm` เหลือเฉพาะไอคอนพร้อม scroll แนวนอน; การสลับแท็บและพฤติกรรม URL `?tab=analytics` ไม่เปลี่ยนแปลง
