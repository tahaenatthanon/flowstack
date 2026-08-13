## 1. การ Migration ฐานข้อมูล

- [x] 1.1 สร้างไฟล์ migration `database/migrations/YYYY_MM_DD_HHMMSS_add_content_requested_at.sql`
- [x] 1.2 SQL: `ALTER TABLE content_items ADD COLUMN requested_at DATETIME NULL AFTER reject_reason`
- [x] 1.3 รัน migration กับ MariaDB เครื่อง local
- [x] 1.4 ตรวจสอบ: `SHOW COLUMNS FROM content_items LIKE 'requested_at'` แสดงคอลัมน์ใหม่

## 2. Backend — บันทึก requested_at

- [x] 2.1 เพิ่ม `ci.requested_at` ใน SELECT ของ `GET /content-items.php`
- [x] 2.2 ใน `PUT /content-items.php` เมื่อ `body['status'] === 'pending_approval'` ให้ set `requested_at = NOW()` โดยอัตโนมัติ (เพิ่มก่อน execute UPDATE)

## 3. Frontend — Types

- [x] 3.1 เพิ่ม field `requested_at?: string | null` ใน `interface ContentItem` (`src/components/content/types.ts`)

## 4. ContentListTab — ลบปุ่มอนุมัติ

- [x] 4.1 ลบ JSX ปุ่ม อนุมัติ/ขอแก้ไข/ปฏิเสธ ใน hover actions (ส่วน `{item.status === 'pending_approval' && (<>...)}`)
- [x] 4.2 ลบ state `approveConfirm`, `reasonDialog`, `reason`, `savingDecision`
- [x] 4.3 ลบ handler `applyDecision`, `handleApprove`, `handleRequestRevision`, `handleReject`
- [x] 4.4 ลบ dialog ยืนยันการอนุมัติ และ dialog เหตุผล (ขอแก้ไข/ปฏิเสธ) ที่เหลือจาก ContentListTab
- [x] 4.5 ลบ import ที่ไม่ใช้ (`Check`, `X`, `Pencil`) ถ้าไม่ถูกใช้ที่อื่นในไฟล์

## 5. ContentApprovalPage — สลับลำดับและ sort

- [x] 5.1 สลับลำดับใน TABS constant: `approved` มาก่อน `pending_approval`
- [x] 5.2 สลับลำดับใน `statCards` array: `approved` มาก่อน `pending_approval`
- [x] 5.3 เปลี่ยน type `sortOrder` จาก `'newest' | 'oldest'` เป็น `'requested_desc' | 'requested_asc'`
- [x] 5.4 อัปเดต sort dropdown options: "ขออนุมัติล่าสุด → เก่าสุด" (`requested_desc`), "ขออนุมัติเก่าสุด → ล่าสุด" (`requested_asc`)
- [x] 5.5 อัปเดต logic sort ใน `visibleItems` ให้ใช้ `COALESCE(requested_at, updated_at)` แทน `created_at`

## 6. การทดสอบ

- [x] 6.1 อัปเดต `src/__tests__/content/ContentApprovalPage.test.tsx` — fixture เพิ่ม `requested_at` และอัปเดต assertions ตามลำดับ/sort ใหม่

## 7. การตรวจสอบและบูรณาการ

- [x] 7.1 รัน `pnpm build` — ตรวจสอบไม่มี TypeScript errors
- [x] 7.2 รัน `pnpm lint` — ตรวจสอบไม่มี ESLint errors
- [ ] 7.3 ทดสอบด้วยตนเอง: หน้าผลงานคอนเทนต์ไม่แสดงปุ่ม อนุมัติ/ขอแก้ไข/ปฏิเสธ
- [ ] 7.4 ทดสอบด้วยตนเอง: หน้ารายการอนุมัติแสดง "อนุมัติแล้ว" ก่อน "รออนุมัติ" ทั้ง Card และ Tab
- [ ] 7.5 ทดสอบด้วยตนเอง: sort "ขออนุมัติล่าสุด → เก่าสุด" เรียงถูกต้อง
- [ ] 7.6 ทดสอบด้วยตนเอง: sort "ขออนุมัติเก่าสุด → ล่าสุด" เรียงถูกต้อง
- [ ] 7.7 ทดสอบด้วยตนเอง: ส่งขออนุมัติรายการใหม่ → `requested_at` ถูกบันทึก
