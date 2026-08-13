## 1. Stat Cards — ยอดวิวรวมและยอดไลก์รวม

- [x] 1.1 นำเข้าไอคอน `Eye` และ `ThumbsUp` จาก `lucide-react` ใน `src/pages/ContentDashboardPage.tsx`
- [x] 1.2 คำนวณ `totalViews = items.reduce((s, i) => s + (Number(i.views) || 0), 0)` และ `totalLikes` ในทำนองเดียวกัน
- [x] 1.3 เพิ่ม 2 การ์ดใหม่เข้า `statCards` array ("ยอดวิวรวม" → `Eye`, "ยอดไลก์รวม" → `ThumbsUp`) ด้วยสไตล์เดียวกับการ์ดเดิม (icon container + ค่าตัวเลข + label)
- [x] 1.4 เปลี่ยน grid จาก `lg:grid-cols-4` เป็น `lg:grid-cols-6` (หรือ `xl:grid-cols-6`) เพื่อรองรับ 6 การ์ด

## 2. Work Progress — ความคืบหน้าการผลิต

- [x] 2.1 คำนวณจำนวนรายการต่อสถานะจาก `items` โดยใช้ key ใน `STATUS_MAP` (`published`, `pending_approval`, `approved`, `revision`, `draft`)
- [x] 2.2 สร้าง widget "ความคืบหน้าการผลิต" แสดงแถบ progress bar แต่ละสถานะ พร้อมจำนวนชิ้นและเปอร์เซ็นต์
- [x] 2.3 คำนวณเปอร์เซ็นต์จาก `count / totalItems * 100` และใช้ `bg-muted` เป็นพื้นหลังแถบ
- [x] 2.4 แสดงยอดรวม (`totalItems`) ที่ท้าย widget

## 3. Top Content — เนื้อหายอดนิยม

- [x] 3.1 คำนวณ `topContent` = items เรียงตาม `views` descending แล้ว slice 5 รายการแรก
- [x] 3.2 สร้าง widget "เนื้อหายอดนิยม" แสดง title, type badge (`TYPE_MAP`), platform badge (`PLATFORM_MAP`) และจำนวนวิวของแต่ละรายการ
- [x] 3.3 แสดง empty state "ไม่มีเนื้อหา" เมื่อไม่มีข้อมูล

## 4. คิวรออนุมัติ — Pending Approval

- [x] 4.1 คำนวณ `pendingItems` = items ที่ `status === 'pending_approval'` เรียงตาม `requested_at` ascending (null ไว้ท้าย)
- [x] 4.2 สร้าง widget "คิวรออนุมัติ" แสดงรายการรออนุมัติ พร้อมปุ่ม/ลิงก์ไป `/content-approval`
- [x] 4.3 แสดง empty state "ไม่มีรายการรออนุมัติ" เมื่อไม่มีข้อมูล

## 5. กำหนดการโพสต์ถัดไป + สถานะช่องทาง

- [x] 5.1 เรียกใช้ `useAllSchedules()` และ `usePublishChannels()` ที่มีอยู่แล้วใน `src/hooks/useContent.ts`
- [x] 5.2 สร้าง widget "กำหนดการโพสต์ถัดไป" filter เฉพาะ `scheduled_at` อยู่ในอนาคต เรียง ascending แสดง topic/title, platform/channel และวันเวลา
- [x] 5.3 สร้าง widget "สถานะช่องทาง" แสดงแต่ละ channel พร้อม indicator active/inactive จาก `is_active`
- [x] 5.4 แสดง empty state ในทั้งสอง widget เมื่อไม่มีข้อมูล

## 6. จัด Layout ใหม่

- [x] 6.1 จัดเรียง widget ตาม design: Stat Cards (บน) → แจ้งเตือนเกินกำหนด → Work Progress (full width) → Top Content + คิวรออนุมัติ (2 คอลัมน์) → กำหนดการโพสต์ถัดไป + สถานะช่องทาง (2 คอลัมน์)
- [x] 6.2 คงสถานะ loading (`isLoading`) และ `PageShell` breadcrumbs/title เดิมไว้

## 7. ตรวจสอบและเทสต์

- [x] 7.1 รัน `pnpm lint` เพื่อตรวจสอบ TypeScript/ESLint
- [x] 7.2 รัน `pnpm test` (Vitest) และตรวจสอบว่า test เดิมไม่พัง
- [x] 7.3 รัน `pnpm build` เพื่อยืนยัน production build ผ่าน
- [x] 7.4 ตรวจสอบ UI บนเบราว์เซอร์: จำนวนการ์ด, แถบ %, top content, คิวรออนุมัติ, กำหนดการ, สถานะช่องทาง และ empty state

## 8. Design System Consistency

- [x] 8.1 ใช้ shadcn-ui primitives ที่มีอยู่แล้ว (`Card`, `CardHeader`, `CardTitle`, `CardContent`, `Badge`, `Table`, `Button`, `Progress`) — ห้ามสร้าง component UI ใหม่
- [x] 8.2 ใช้ `STATUS_MAP`/`TYPE_MAP`/`PLATFORM_MAP` จาก `src/components/content/types.ts` สำหรับ badge สี/ข้อความทั้งหมด
- [x] 8.3 ใช้ Tailwind tokens + `cn()` จาก `@/lib/utils.ts` สำหรับสี/typography/spacing ให้สอดคล้องกับหน้าเดิม
- [x] 8.4 ตรวจสอบว่า widget ใหม่ทั้งหมดใช้ visual style เดียวกับหน้าดั้งเดิม (การ์ดสถิติเดิม, ตารางเนื้อหาล่าสุดเดิม)
