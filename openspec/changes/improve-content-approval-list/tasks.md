## 1. Database Migration — เพิ่ม rejected ใน ENUM

- [x] 1.1 สร้าง migration file `database/migrations/YYYY_MM_DD_HHMMSS_add_rejected_status.sql`
- [x] 1.2 Execute migration: `mysql -u root flowstack < database/migrations/<filename>.sql`
- [x] 1.3 Verify: `DESCRIBE content_items` — ตรวจสอบว่า `status` มี `'rejected'` ใน ENUM

## 2. เพิ่มสถานะ rejected ใน types

- [x] 2.1 เพิ่ม `rejected: { label: 'ปฏิเสธ', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' }` ใน `STATUS_MAP` ที่ `src/components/content/types.ts`

## 3. ปรับปรุงหน้ารายการอนุมัติ — State และ Logic

- [x] 3.1 เพิ่ม `useState` สำหรับ `activeTab` (ค่าเริ่มต้น `'all'`), `sortOrder` (ค่าเริ่มต้น `'newest'`), และ `typeFilter` (ค่าเริ่มต้น `'all'`) ใน `ContentApprovalPage`
- [x] 3.2 ปรับ logic การกรอง: แสดงทุกรายการ (ไม่จำกัดเฉพาะ `review`) โดยกรองตาม `activeTab`, `typeFilter`, `searchQuery`, และเรียงตาม `sortOrder`
- [x] 3.3 คำนวณ stat counts สำหรับแต่ละสถานะ (`review`, `published`, `revision`, `rejected`) จากข้อมูลทั้งหมด
- [x] 3.4 คำนวณจำนวนรายการสำหรับแต่ละ Tab

## 4. เพิ่ม Stat Cards (แบบ `stat-card card-hover` สไตล์ Projects)

- [x] 4.1 สร้าง Stat Cards 4 ใบใน grid layout (`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4`) ด้านบน toolbar โดยใช้ CSS class `stat-card card-hover`
- [x] 4.2 แต่ละ Card ใช้โครงสร้างเดียวกับ `StatCards` component ในหน้า Projects: icon container แบบ `p-1.5 sm:p-2 rounded-lg bg-{color}/10` ด้านบน, ค่าตัวเลขแสดงด้วย `text-xl sm:text-2xl font-bold font-heading`, และ label ใต้ค่าด้วย `text-xs sm:text-sm text-muted-foreground`
- [x] 4.3 ใช้ semantic color tokens: `text-warning` (รออนุมัติ), `text-success` (อนุมัติแล้ว), `text-info` (ขอแก้ไข), `text-destructive` (ปฏิเสธ)
- [x] 4.4 ใช้ icon จาก lucide-react: `Clock` (รออนุมัติ), `CheckCircle2` (อนุมัติแล้ว), `AlertTriangle` (ขอแก้ไข), `XCircle` (ปฏิเสธ)

## 5. เพิ่ม Tab Navigation (รูปแบบเดียวกับ Status Filter ในหน้าผลงานคอนเทนต์)

- [x] 5.1 นำเข้า `Tabs`, `TabsList`, `TabsTrigger` จาก `@/components/ui/tabs` และ icon `Layers, Clock, CheckCircle2, AlertTriangle, XCircle` จาก `lucide-react`
- [x] 5.2 สร้าง Tab 5 อัน: ทั้งหมด, รออนุมัติ, อนุมัติแล้ว, ขอแก้ไข, ปฏิเสธ — ใช้รูปแบบเดียวกับ Status Filter ใน `ContentListTab.tsx`
- [x] 5.3 TabsList ใช้ className `h-auto p-1 flex flex-wrap gap-0.5` (Tab เรียงต่อกัน wrap ตามธรรมชาติ)
- [x] 5.4 TabsTrigger แต่ละตัวใช้ className `gap-1.5 text-xs sm:text-sm`
- [x] 5.5 แต่ละ Tab แสดง Icon จาก lucide-react ขนาด `h-3.5 w-3.5` วางก่อนข้อความ label
- [x] 5.6 Tab Icons: ทั้งหมด → `Layers`, รออนุมัติ → `Clock`, อนุมัติแล้ว → `CheckCircle2`, ขอแก้ไข → `AlertTriangle`, ปฏิเสธ → `XCircle`
- [x] 5.7 จำนวนรายการแสดงใน `<span className="ml-1 text-[10px] px-1.5 py-0 rounded-full bg-muted font-semibold">{count}</span>` วางหลังข้อความ label
- [x] 5.8 ตั้ง Tab "ทั้งหมด" เป็นค่าเริ่มต้นเมื่อเข้าเพจ

## 6. เพิ่ม Type Filter และจัดกลุ่ม Toolbar

- [x] 6.1 เพิ่ม `Select` Dropdown สำหรับ Type Filter: "ทั้งหมด", "บทความ" (`article`), "วีดีโอ" (`video`) — อ้างอิงจาก `TYPE_MAP` และกรองเฉพาะ types ที่มีรายการอยู่จริง
- [x] 6.2 วางช่องค้นหาไว้ด้านหน้าสุดของ toolbar ตามลำดับ: Search → Type → Platform → Sort
- [x] 6.3 เพิ่ม `Select` Dropdown สำหรับเรียงลำดับ: "ใหม่ → เก่า" (`newest`) และ "เก่า → ใหม่" (`oldest`)
- [x] 6.4 จัดกลุ่ม Tab Navigation (แถวบน), ช่องค้นหา, Type Filter, Platform Filter, และ Sort Dropdown (แถวล่าง) ใน toolbar เดียวกัน
- [x] 6.5 เปลี่ยนไอคอนช่องค้นหาจาก `FileText` เป็น `Search` (แว่นขยาย) จาก lucide-react ขนาด `h-4 w-4`
- [x] 6.6 ปรับ responsive layout: Tab อยู่แถวบน (ใช้ `flex-wrap` แบบ Status Filter ใน ContentListTab), Search + Type + Platform + Sort อยู่แถวล่าง

## 7. ปรับปรุงปุ่มอนุมัติ/ปฏิเสธ และสถานะ

- [x] 7.1 เปลี่ยน `handleReject` ให้เปลี่ยน status เป็น `'rejected'` แทน `'draft'`
- [x] 7.2 แสดงปุ่ม "อนุมัติ" และ "ปฏิเสธ" เฉพาะรายการที่อยู่ในสถานะ `review` (ซ่อนสำหรับสถานะอื่น)
- [x] 7.3 แสดงข้อความสถานะคงที่ (Badge) สำหรับรายการที่ไม่อยู่ใน `review` โดยไม่มีปุ่มดำเนินการ

## 8. ปรับข้อความ Empty State

- [x] 8.1 ปรับ empty state message ให้เปลี่ยนตาม Tab ที่เลือก (เช่น "ไม่มีรายการรออนุมัติ", "ไม่มีรายการที่อนุมัติแล้ว")
- [x] 8.2 ใช้ icon และข้อความที่เหมาะสมกับแต่ละสถานะ

## 9. ตรวจสอบความเรียบร้อย

- [x] 9.1 ตรวจสอบว่า `pnpm build` ผ่านไม่มี TypeScript error
- [x] 9.2 ตรวจสอบว่า UI responsive บน mobile, tablet, desktop
- [x] 9.3 ตรวจสอบว่า Tab, Search, Type Filter, Platform Filter, Sort ทำงานร่วมกันได้ถูกต้อง (filter สะสม)
- [x] 9.4 ตรวจสอบว่า Stat Cards อัปเดตเมื่อมีการ approve/reject และใช้ Visual Style `stat-card card-hover` ถูกต้อง
- [x] 9.5 ตรวจสอบว่า Tab ใช้รูปแบบ `h-auto p-1 flex flex-wrap gap-0.5` (Status Filter pattern จาก ContentListTab) และ Icon/count badge แสดงถูกต้องทุก Tab
- [x] 9.6 ตรวจสอบว่า UI อื่นที่ไม่เกี่ยวข้อง (ContentDashboardPage, other pages) ไม่ได้รับผลกระทบจากการเพิ่ม `rejected` ใน `STATUS_MAP`
