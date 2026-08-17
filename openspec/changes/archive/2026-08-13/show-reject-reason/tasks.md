## 1. Backend — ส่ง reject_reason กลับมาจาก API

- [x] 1.1 ใน `api/content-items.php` (GET) เพิ่ม `ci.reject_reason` ใน SELECT (ต่อจาก `ci.requested_at`)

## 2. ContentApprovalTab — เพิ่มปุ่มขอแก้ไข + บันทึกเหตุผล

- [x] 2.1 เปลี่ยน state `rejectDialog` เป็น `reasonDialog` รองรับ `kind: 'revision' | 'rejected'`
- [x] 2.2 เพิ่ม handler `handleDecision` — PUT `{ status: kind, reject_reason }`, toast, invalidate queries (แทน `handleReject` เดิม)
- [x] 2.3 เพิ่มปุ่ม "ขอแก้ไข" ในคอลัมน์ "จัดการ" ระหว่าง อนุมัติ กับ ปฏิเสธ (import `Pencil` จาก lucide-react)
- [x] 2.4 ปรับ dialog เหตุผลเดิมให้แสดงตาม `kind` (title/label/variant/ปุ่มยืนยัน)

## 3. ContentDetailView — แสดงเหตุผล reject_reason

- [x] 3.1 เพิ่มแบนเนอร์ amber แสดง `reject_reason` เมื่อ `status ∈ {revision, rejected}` และ `reject_reason` ไม่ว่าง

## 4. STATUS_MAP — ปรับสีสถานะให้สอดคล้อง Status Card

- [x] 4.1 ใน `src/components/content/types.ts` เปลี่ยนสี `approved` จาก `blue` เป็น `green` (success) ใน `STATUS_MAP`
- [x] 4.2 ใน `src/components/content/types.ts` เปลี่ยนสี `revision` จาก `orange` เป็น `blue` (info) ใน `STATUS_MAP`

## 5. ContentApprovalTab — ล็อกความกว้างคอลัมน์ "จัดการ"

- [x] 5.1 ใน `src/components/content/tabs/ContentApprovalTab.tsx` เพิ่ม `w-[240px]` ให้ `<TableHead>` ของคอลัมน์ "จัดการ"
- [x] 5.2 เพิ่ม `whitespace-nowrap` ให้เนื้อหาใน `<TableCell>` ของคอลัมน์ "จัดการ" (ทั้ง 3 ปุ่ม และข้อความ "ดำเนินการแล้ว")

## 6. การตรวจสอบ

- [x] 6.1 รัน `pnpm build` — ตรวจสอบไม่มี TypeScript errors
- [x] 6.2 รัน `pnpm lint` — ตรวจสอบไม่มี ESLint errors
- [x] 6.3 ทดสอบด้วยตนเอง: กด "ขอแก้ไข" พร้อมเหตุผล → สถานะเป็น revision, เหตุผลถูกบันทึกและแสดง
- [x] 6.4 ทดสอบด้วยตนเอง: กด "ปฏิเสธ" พร้อมเหตุผล → เหตุผลถูกบันทึกและแสดง
- [x] 6.5 ทดสอบด้วยตนเอง: สี status badge ใน Tab "รายการอนุมัติ" และ "ผลงานทั้งหมด" สอดคล้องกับสี Icon ใน Status Card (approved=เขียว, revision=น้ำเงิน)
- [x] 6.6 ทดสอบด้วยตนเอง: ความกว้างคอลัมน์ "ชื่อคอนเทนต์" คงที่ ไม่ขยับเมื่อสลับ filter ที่มี/ไม่มีปุ่ม "จัดการ"
