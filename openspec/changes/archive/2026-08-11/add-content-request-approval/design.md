## Context

ปัจจุบัน Content Workflow มี 5 สถานะ: `draft` → `review` → `published` (หรือ `revision`/`rejected`)

- ผู้สร้างคอนเทนต์สร้างเนื้อหาในสถานะ `draft` หรือ `revision`
- ผู้อนุมัติเปลี่ยนสถานะจาก `review` → `published`/`revision`/`rejected` ผ่านหน้ารายการอนุมัติ (`/content-approval`) หรือปุ่ม hover ใน `ContentListTab`
- **ช่องว่าง**: ไม่มีทางให้ผู้สร้างส่งเนื้อหาจาก `draft`/`revision` → `review` จาก UI โดยตรง

การเปลี่ยนแปลงนี้เติมเต็มช่องว่างในฝั่งผู้สร้าง — เพิ่มปุ่ม "ขออนุมัติ" ในหน้ารายละเอียดเนื้อหา และเพิ่มการแสดงสถานะในรายการ

## Goals / Non-Goals

**Goals:**
- เพิ่มปุ่ม "ขออนุมัติ" ใน `ContentDetailView` (context='content') สำหรับรายการ `draft` หรือ `revision`
- เพิ่มปุ่ม "ขออนุมัติ" ใน `ContentCardDialog` footer สำหรับรายการ `draft` หรือ `revision` ที่มี `existingItem`
- เปลี่ยนสถานะเป็น `review` เมื่อกด พร้อม toast แจ้งเตือน
- เพิ่ม Status badge ใน `ContentListTab` แสดงหลังชื่อบทความ ด้วยสีที่แตกต่างตามสถานะ
- สีของ badge สอดคล้องกับ Status Filter tabs

**Non-Goals:**
- ไม่เปลี่ยน workflow ของผู้อนุมัติ (approval page, approval dialog)
- ไม่เพิ่ม multi-step approval
- ไม่เปลี่ยน API หรือ database schema
- ไม่แสดง status badge ซ้ำเมื่ออยู่ใน tab ที่กรองด้วยสถานะนั้นแล้ว

## Decisions

### Decision 1: ปุ่ม "ขออนุมัติ" อยู่ใน `ContentDetailView` action bar และ `ContentCardDialog` footer

**เลือก**: เพิ่มปุ่มใน 2 ตำแหน่ง:
- `ContentDetailView` action bar (context='content') — ต่อจากปุ่ม "ตั้งเวลาโพสต์"
- `ContentCardDialog` footer — ขวาสุดต่อจากปุ่ม "บันทึก"

**Alternatives considered:**
- มีแค่ `ContentDetailView` อย่างเดียว — user ต้องกดบันทึกก่อน แล้วค่อยไปขออนุมัติอีกหน้า
- มีแค่ `ContentCardDialog` อย่างเดียว — user ที่ดูจาก `ContentDetailView` ไม่เห็นปุ่ม

**Rationale**: ทั้งสองจุดเสริมกัน — `ContentCardDialog` ให้ขออนุมัติทันทีหลังแก้ไข, `ContentDetailView` ให้ขออนุมัติเมื่อตรวจสอบเนื้อหาครบถ้วน

### Decision 2: ใช้ `apiFetch` โดยตรง ไม่สร้าง hook ใหม่

**เลือก**: เรียก `apiFetch('/content-items.php?id={id}', { method: 'PUT', body: JSON.stringify({ status: 'review' }) })` โดยตรงใน `ContentDetailView`

**Alternatives considered:**
- สร้าง `useRequestApproval` mutation hook — เพิ่มความซับซ้อนโดยไม่จำเป็นสำหรับ 1 action

**Rationale**: ปุ่มอนุมัติ/ขอแก้ไข/ปฏิเสธ ใน `ContentDetailView` และ `ContentListTab` ใช้ pattern เดียวกัน — ใช้ `apiFetch` + `queryClient.invalidateQueries` โดยตรงเพื่อ consistency

### Decision 3: Status badge ใน `ContentListTab` ต่อท้าย title — ใช้สีตัวอักษรเท่านั้น ไม่มีพื้นหลัง

**เลือก**: แสดง status badge หลัง `item.title` ในรูปแบบ `<span>` — ใช้สีตัวอักษรจาก `STATUS_MAP[item.status].color` (เฉพาะ text color classes เช่น `text-green-700 dark:text-green-300`) โดยไม่มีพื้นหลัง

**รูปแบบ**: `ชื่อบทความ (ร่าง)` — ข้อความในวงเล็บใช้สีตามสถานะ โดยไม่มี bg pill

**Alternatives considered:**
- แสดงเป็น badge แยกใน metadata row — อาจดูซ้ำซ้อนกับ filter tabs
- ไม่แสดง — ทำให้ผู้ใช้แยกสถานะไม่ออก

**Rationale**: การแสดง status ใน title row ทำให้เห็นสถานะได้ทันทีโดยไม่ต้องอาศัย filter — สอดคล้องกับ User Story "Duckkit AI Portal: แพลตฟอร์ม AI ระดับองค์กรที่ปลอดภัย 100% ควบคุมงบประมาณได้จริง | KTNBS (ฉบับร่าง)"

### Decision 4: ซ่อน status badge เมื่ออยู่ใน tab ที่กรองด้วยสถานะนั้น

**เลือก**: เมื่อ `statusFilter === item.status` (เช่นอยู่ใน tab "ฉบับร่าง" และ item เป็น `draft`) — ไม่แสดง status badge

**Alternatives considered:**
- แสดงตลอดเวลา — ซ้ำซ้อนเพราะ tab name บอกอยู่แล้ว
- แสดงเฉพาะ tab "ทั้งหมด" — user ไม่เห็น status เมื่อกรองด้วย type หรือ platform

**Rationale**: ใน tab ที่กรองด้วยสถานะ ทุกแถวมีสถานะเดียวกัน — ไม่ต้องแสดง badge ซ้ำ ลด noise

### Decision 5: ContentCardDialog รับ prop `contentStatus` เพื่อแสดงปุ่มขออนุมัติ

**เลือก**: เพิ่ม optional prop `contentStatus?: string` ใน `ContentCardDialog` interface — แสดงปุ่ม "ขออนุมัติ" เมื่อ `existingItem` มีอยู่ และ `contentStatus` เป็น `draft` หรือ `revision`

**ตำแหน่ง**: ขวาสุดใน `DialogFooter` ต่อจากปุ่ม "บันทึก" — ใช้ `variant="default"`, `Send` icon, สี primary เพื่อเด่นกว่า "บันทึก"

**ผู้เรียกที่ต้องอัปเดต**:
- `ContentListTab` — ส่ง `contentStatus={editItemLatest?.status}`
- `ContentDetailView` (ผ่าน `ContentCardDialog`) — ส่ง `contentStatus={item.status}`

**Alternatives considered:**
- ใช้ callback `onRequestApproval` — เพิ่ม prop complexity โดยไม่จำเป็น แค่ PUT status ก็พอ
- รวมกับปุ่ม "บันทึก" เป็น "บันทึกและขออนุมัติ" — user ต้องการปุ่มแยกเพื่อแยก concern

**Rationale**: แยกปุ่มชัดเจน — "บันทึก" = save draft, "ขออนุมัติ" = save + change status to review → user เลือกได้เอง

## Risks / Trade-offs

- **Risk**: ปุ่ม "ขออนุมัติ" อาจถูกกดโดยไม่ได้ตั้งใจ → **Mitigation**: ใช้ Confirm Dialog ก่อนเปลี่ยนสถานะ
- **Risk**: Status badge อาจทำให้ title area ดูรก → **Mitigation**: ใช้ `text-[11px]` ขนาดเล็ก และ `truncate` ให้ title ยาวไม่ดัน badge หลุด
- **Risk**: `contentStatus` prop เป็น optional — ถ้าไม่ส่ง ปุ่มจะไม่โผล่ → **Mitigation**: ทุกที่ที่เรียก `ContentCardDialog` ใน `ContentListTab` และ `ContentDetailView` ต้องส่ง prop นี้
