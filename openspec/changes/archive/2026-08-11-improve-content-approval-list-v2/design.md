## Context

หน้ารายการอนุมัติ `/content-approval` ถูกใช้งานโดยผู้อนุมัติ (approver) เพื่อตรวจสอบและจัดการสถานะ content items ก่อนเผยแพร่ ปัจจุบัน:

- `ContentApprovalPage.tsx` แสดงตารางรายการ + dialog ยืนยันอนุมัติ/ปฏิเสธ
- `ContentListTab.tsx` (ในหน้า "ผลงานคอนเทนต์") แสดงรายการทั้งหมดแต่ไม่มีปุ่ม action การอนุมัติ
- `ContentDetailView.tsx` แสดงรายละเอียดเนื้อหาเมื่อคลิกจาก Approval Page — แต่ใช้ dialog เล็ก ไม่แสดงเนื้อหาครบถ้วน
- `ImageViewer.tsx` ใช้สำหรับ zoom รูปภาพ
- API `content-items.php` รองรับ PUT เพื่ออัปเดต status
- DB `content_items.status` เป็น ENUM: `'published','draft','revision','review','rejected'`

ผู้ใช้ปัจจุบัน: เดินไปมาระหว่าง Approval Page (ดูรายการ + อนุมัติ/ปฏิเสธ) กับ Content Page (ดูรายละเอียดเต็ม) เพื่อตัดสินใจ — workflow แตกกระจาย

## Goals / Non-Goals

**Goals:**
- รวม workflow การอนุมัติไว้ในจุดเดียว: Approval Page → ดูรายละเอียดเต็ม → อนุมัติ/ขอแก้ไข/ปฏิเสธ
- เพิ่มปุ่ม action การอนุมัติใน Content List Tab เพื่อให้ผู้อนุมัติทำงานได้จากหน้าเดียว
- แก้ปัญหา Image Viewer hover container ขยายใหญ่เกินรูป
- เก็บ `reject_reason` ลงฐานข้อมูลเพื่อให้ audit trail

**Non-Goals:**
- ไม่เปลี่ยน workflow การอนุมัติใบเสนอราคา (quotations) — scope นี้เฉพาะ content items
- ไม่เพิ่ม multi-step approval workflow — ยังคงเป็น single-step approve/reject
- ไม่เปลี่ยน schema ใหญ่ — เปลี่ยนแปลงเฉพาะที่จำเป็น

## Decisions

### Decision 1: `ContentDetailView` รับ `context` prop แทนการสร้าง component ใหม่

**เลือก**: เพิ่ม `context?: 'approval' | 'content'` prop ใน `ContentDetailView`

**Alternatives considered:**
- สร้าง `ApprovalDetailView` แยก — code ซ้ำซ้อน, maintain 2 ที่
- ใช้ conditional rendering ใน parent — ทำให้ `ContentApprovalPage` ซับซ้อนเกิน

**Rationale**: `ContentDetailView` มี logic การแสดงเนื้อหาที่ซับซ้อน (article vs video, edit dialog, schedule dialog) — การแยกเป็น 2 component ทำให้ต้อง copy logic ทั้งหมด การใช้ `context` prop เพื่อ show/hide ปุ่ม action เป็นวิธีที่ clean ที่สุด

### Decision 2: ใช้ปุ่ม label "ขอแก้ไข" แทน "แก้ไข" ในบริบท approval

**เลือก**: เปลี่ยน label เป็น "ขอแก้ไข" เมื่อ `context='approval'`

**Rationale**: "ขอแก้ไข" สื่อว่าเป็น action ของผู้อนุมัติที่ขอให้ผู้สร้างแก้ไข — สอดคล้องกับ status `revision` (รอแก้ไข) "แก้ไข" อาจทำให้เข้าใจผิดว่าผู้อนุมัติจะแก้ไขเนื้อหาเอง

### Decision 3: เก็บ `reject_reason` ใน `content_items` table

**เลือก**: เพิ่ม column `reject_reason TEXT NULL` ในตาราง `content_items`

**Alternatives considered:**
- ตาราง `approval_requests` — มีอยู่แล้วแต่ซับซ้อนเกินสำหรับ single-step approval
- ตาราง `content_approval_logs` — ต้องสร้างตารางใหม่ทั้งที่ workflow ยัง simple

**Rationale**: เพิ่ม column ตรงๆ ใน `content_items` เป็นวิธีที่ง่ายและเพียงพอสำหรับ single-step approval ปัจจุบัน ไม่ต้อง join ตารางเพิ่ม

### Decision 4: ปุ่ม action ใน `ContentListTab` แสดงเฉพาะรายการ status `review`

**เลือก**: แสดงปุ่ม อนุมัติ/ขอแก้ไข/ปฏิเสธ เฉพาะเมื่อ `item.status === 'review'`

**Rationale**: รายการ status อื่น (`draft`, `published`, `revision`, `rejected`) ไม่ต้องการ action การอนุมัติ — แสดงปุ่มให้ตรงบริบท

### Decision 5: Image Viewer — ใช้ `max-h` และ `max-w` แทน `min-h`

**เลือก**: เปลี่ยนจาก `min-h-[60vh]` เป็น `max-h-[90vh] max-w-[90vw]` และให้รูป `object-contain` แทนที่จะบังคับ container ขนาดต่ำสุด

**Rationale**: `min-h-[60vh]` ทำให้ container ขยายใหญ่แม้รูปจะเล็ก — เปลี่ยนเป็น `max-w`/`max-h` และ `object-contain` รูปจะแสดงในขนาดธรรมชาติโดยไม่บังเนื้อหา

## Risks / Trade-offs

- **Risk**: การเพิ่ม `context` prop อาจต้อง refactor ทุกที่ที่เรียก `ContentDetailView` → **Mitigation**: default `context` เป็น `'content'` เพื่อ backward compatibility
- **Risk**: `ContentApprovalPage` ยังคงใช้ `ContentDetailView` ใน `<Dialog>` — ต้องเปลี่ยนเป็น full-page หรือ drawer เพื่อให้แสดงเนื้อหาครบ → **Mitigation**: ใช้ `max-w-4xl max-h-[90vh]` และเพิ่ม scroll
- **Risk**: ปุ่ม "ขอแก้ไข" ต้องเปลี่ยน status เป็น `revision` และต้องมี `reject_reason` → **Mitigation**: ใช้ status `revision` และเก็บ `reject_reason` ใน column เดียวกัน

## Open Questions

- ควรเพิ่ม `content_approve` permission ใน `role_menu_permissions` หรือใช้ permission `content` เดิม? → เสนอให้ใช้ permission `content` เดิมก่อน — เพิ่ม permission ใหม่แยกทีหลังถ้าจำเป็น
