## Context

Workflow การอนุมัติคอนเทนต์มีสถานะ 6 สถานะ (`draft`, `revision`, `pending_approval`, `approved`, `published`, `rejected`) และคอลัมน์ `content_items.reject_reason` (TEXT NULL) ถูกเพิ่มไว้แล้วผ่าน migration `2026_08_11_114953_add_reject_reason.sql`

ปัจจุบัน:
- `ContentDetailView.tsx` (context ทั้ง `approval` และ `content`) ส่ง `reject_reason` ไปบันทึกเมื่อขอแก้ไข/ปฏิเสธ — ถูกต้องแล้ว
- แต่ `GET /content-items.php` SELECT ไม่มี `ci.reject_reason` → client ไม่ได้รับเหตุผลกลับมา
- `ContentApprovalTab.tsx` มีปุ่ม "อนุมัติ" + "ปฏิเสธ" เท่านั้น (ไม่มี "ขอแก้ไข") และ `handleReject()` ส่งแค่ `{ status: 'rejected' }` ไม่ส่ง `rejectReason` ที่กรอก
- ไม่มี component ไหนแสดง `item.reject_reason` เลย

## Goals / Non-Goals

**Goals:**
- ให้เหตุผลที่ขอแก้ไข/ปฏิเสธถูกบันทึกครบถ้วน และแสดงให้ผู้ที่เกี่ยวข้องเห็น

**Non-Goals:**
- ไม่เปลี่ยน schema (คอลัมน์ `reject_reason` มีอยู่แล้ว)
- ไม่ยุบ/รวม `ContentApprovalTab` กับ `ContentApprovalPage` (ความซ้ำซ้อนที่มีอยู่ ไม่ใช่ scope นี้)
- ไม่เพิ่ม notification/email แจ้งเหตุผล

## Decisions

### Decision 1: เพิ่ม `ci.reject_reason` ใน SELECT ของ GET (แทนการใช้ `SELECT ci.*`)

`GET /content-items.php` ใช้ explicit column list — เพิ่ม `ci.reject_reason` ต่อจาก `ci.requested_at`

**Rationale**: ตรงจุดที่สุด และ `type.ts` มี field `reject_reason` อยู่แล้ว ส่วน `PUT` ใช้ `SELECT ci.*` ซึ่งคืนค่าครบอยู่แล้ว

### Decision 2: แสดงเหตุผลที่ `ContentDetailView` (ไม่ใช่ที่ตารางรายการ)

แสดงเป็นแบนเนอร์ amber ใต้ header เมื่อ `status ∈ {revision, rejected}` และ `reject_reason` ไม่ว่าง

**Rationale**: `ContentDetailView` เป็น component กลางที่ใช้ทั้งฝั่ง approver (เปิดจากรายการอนุมัติ) และฝั่ง author (เปิดจากผลงานคอนเทนต์) — แสดงจุดเดียวครอบคลุมทั้งสองฝั่ง ไม่ต้องแก้ `ContentCardDialog` เพิ่ม

**Alternatives considered**:
- แสดงในคอลัมน์ของตารางรายการอนุมัติ → เหตุผลอาจยาว เกะกะตาราง ต้อง truncate + tooltip เพิ่มความซับซ้อน
- แสดงใน `ContentCardDialog` → author มักเปิดจาก `ContentListTab` ผ่าน dialog นี้ แต่ `ContentCardDialog` ซับซ้อนกว่าและซ้ำซ้อนกับ detail view

### Decision 3: รวม dialog "ขอแก้ไข" กับ "ปฏิเสธ" เป็น dialog เดียวแบบ parametrized

เปลี่ยน `rejectDialog` (object `{open, item}`) เป็น `reasonDialog` (`{open, item, kind: 'revision' | 'rejected'}`) เพื่อ reuse textarea + handler เดียว (`handleDecision`)

**Rationale**: สอง action ใช้ dialog โครงสร้างเดียวกัน (textarea เหตุผล + ปุ่มยืนยัน) ต่างแค่ title/variant/label — parametrize ลดความซ้ำซ้อน

### Decision 4: ปรับสี `STATUS_MAP` ให้ตรง semantic tokens ของ Stat Card

Status Card ในหน้ารายการอนุมัติใช้ semantic color tokens: `text-success` (approved, hue 160 = เขียว), `text-warning` (pending_approval, hue 38 = amber), `text-info` (revision, hue 210 = น้ำเงิน), `text-destructive` (rejected, hue 0 = แดง) — ดู `src/index.css` (`--success`, `--warning`, `--info`, `--destructive`)

แต่ `STATUS_MAP` ใน `src/components/content/types.ts` ใช้ hardcoded tailwind colors ที่ไม่ตรงกัน 2 สถานะ:
- `approved`: `blue` → ควรเป็น `green` (success)
- `revision`: `orange` → ควรเป็น `blue` (info)

ส่วน `pending_approval` (amber) และ `rejected` (red) ตรงอยู่แล้ว — ไม่ต้องแก้

**Rationale**: ให้สีสถานะใน Tab "รายการอนุมัติ" และ "ผลงานทั้งหมด" (ทั้งสองใช้ `STATUS_MAP`) สอดคล้องกับสี Icon ใน Status Card ตาม requirement "ปรับสีของ Status ให้ใช้สีเดียวกับ Icon ใน Status Card"

**Trade-off**: `approved` (green) จะซ้ำกับ `published` (green) — ยอมรับได้เพราะ `published` ไม่อยู่ใน approval workflow และ Status Card ไม่มีสถานะ `published`

### Decision 5: ล็อกความกว้างคอลัมน์ "จัดการ" ให้คงที่ (ไม่ใช้ table-fixed ทั้งตาราง)

ตารางรายการอนุมัติใช้ `<Table>` ของ shadcn ซึ่งเป็น `<table className="w-full">` แบบ `table-auto` — ความกว้างคอลัมน์ถูกกำหนดจากเนื้อหาที่กว้างที่สุดในคอลัมน์นั้น เมื่อคอลัมน์ "จัดการ" มีแถว `pending_approval` (3 ปุ่ม) ผสมกับแถวอื่น (ข้อความ "ดำเนินการแล้ว" สั้น) ความกว้างจะผันผวน และดันให้คอลัมน์อื่น (เช่น "ชื่อคอนเทนต์") ขยับตาม

**เลือก**: ล็อกความกว้างเฉพาะคอลัมน์ "จัดการ" ด้วย `w-[240px]` บน `<TableHead>` และ `whitespace-nowrap` บนเนื้อหาใน `<TableCell>` (ทั้งกรณีมีปุ่ม และข้อความ "ดำเนินการแล้ว")

**Rationale**: แก้ตรงสาเหตุ (คอลัมน์เดียวที่เป็นตัวการ) ขอบเขตน้อย ไม่กระทบคอลัมน์อื่น และไม่ยุ่งกับ responsive (`hidden md:table-cell`/`hidden sm:table-cell`)

**Alternatives considered**:
- `table-fixed` + กำหนด `w-*` ครบทุกคอลัมน์ → สม่ำเสมอที่สุด แต่ต้องกะสัดส่วน 6 คอลัมน์ และต้องคิดใหม่เมื่อคอลัมน์ถูกซ่อนตาม breakpoint (`%` จะเพี้ยน) — over-engineer สำหรับ use case นี้

## Risks / Trade-offs

- [แบนเนอร์เหตุผลอาจรกถ้าเหตุผลยาวมาก] → ใช้ `whitespace-pre-wrap` ให้ขึ้นบรรทัด และ `break-words`
- [ต้อง import `Pencil` icon เพิ่มใน `ContentApprovalTab`] → เป็น icon ที่ lucide-react มีอยู่แล้ว ไม่มี dependency ใหม่
