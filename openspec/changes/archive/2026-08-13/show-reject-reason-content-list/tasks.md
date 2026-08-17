## 1. Type — PlanItem รองรับ reject_reason

- [x] 1.1 ใน `src/components/content/types.ts` เพิ่ม field `reject_reason?: string | null` ใน `interface PlanItem`

## 2. ContentListTab — map reject_reason

- [x] 2.1 ใน `src/components/content/tabs/ContentListTab.tsx` เพิ่ม `reject_reason: item.reject_reason || null` ใน `asPlanItem`

## 3. ContentCardDialog — แสดงแบนเนอร์เหตุผล

- [x] 3.1 ใน `src/components/content/ContentCardDialog.tsx` เพิ่มแบนเนอร์ amber ใน scrollable body (เหนือ section "เนื้อหาบทความ") เมื่อ `contentStatus ∈ {revision, rejected}` และ `existingItem.reject_reason` ไม่ว่าง

## 4. ContentListTab — แสดงเหตุผลในแถวรายการโดยตรง

- [x] 4.1 ใน `src/components/content/tabs/ContentListTab.tsx` เพิ่มข้อความเหตุผลใต้ชื่อรายการ (เมื่อ `status ∈ {revision, rejected}` และ `reject_reason` ไม่ว่าง) พร้อม `line-clamp-2` และ title attribute

## 5. การตรวจสอบ

- [x] 5.1 รัน `pnpm build` — ตรวจสอบไม่มี TypeScript errors
- [x] 5.2 รัน `pnpm lint` — ตรวจสอบไม่มี ESLint errors
- [x] 5.3 ทดสอบด้วยตนเอง: กด "ขอแก้ไข" พร้อมเหตุผลในหน้ารายการอนุมัติ → เปิด Tab "ผลงานทั้งหมด" → เห็นเหตุผลในกล่องแก้ไข
- [x] 5.4 ทดสอบด้วยตนเอง: กด "ปฏิเสธ" พร้อมเหตุผล → เห็นเหตุผลในกล่องแก้ไขของ Tab "ผลงานทั้งหมด"
- [x] 5.5 ทดสอบด้วยตนเอง: เห็นเหตุผลใต้ชื่อรายการโดยตรงใน Tab "ผลงานทั้งหมด" โดยไม่ต้องคลิกเปิดกล่อง

## 6. Database — ยืนยัน migration คอลัมน์ reject_reason

- [x] 6.1 ตรวจสอบว่า `content_items.reject_reason` มีอยู่ในฐานข้อมูล `flowstack_dev` หรือไม่: `mysql -u root flowstack_dev -e "SHOW COLUMNS FROM content_items LIKE 'reject_reason';"`
- [x] 6.2 ถ้ายังไม่มีคอลัมน์ รัน `mysql -u root flowstack_dev < database/migrations/2026_08_11_114953_add_reject_reason.sql` และ `mysql -u root flowstack_dev < database/migrations/2026_08_13_150000_add_content_requested_at.sql`
- [x] 6.3 ตรวจสอบว่า `content_items.status` enum มีค่า `pending_approval`, `approved`, `revision`, `rejected` — ถ้ายังไม่ครบ รัน migration 2026_08_10_111012 / 2026_08_10_143231 / 2026_08_11_171224 ตามลำดับ
- [x] 6.4 ทดสอบซ้ำ: กด "ขอแก้ไข" พร้อมเหตุผล → เหตุผลแสดงใน Tab "ผลงานทั้งหมด"
