## บริบท

Workflow คอนเทนต์ปัจจุบัน: `draft` → `review` → `published` (หรือ `revision`/`rejected`) สถานะ `review` มีความหมายกำกวม — เป็นทั้ง "รออนุมัติ" (จากมุมผู้สร้าง) และ "รอเผยแพร่" (จากมุมผู้อนุมัติ) การออกแบบนี้แบ่ง workflow เป็น 6 สถานะที่ชัดเจน

## เป้าหมาย / ไม่ใช่เป้าหมาย

**เป้าหมาย:**
- เปลี่ยน `review` → `pending_approval` เพื่อความชัดเจน — สถานะนี้หมายถึง "ส่งขออนุมัติ" เสมอ
- เพิ่ม `approved` เป็นสถานะแยกระหว่างอนุมัติแล้วกับเผยแพร่แล้ว
- อัปเดต label, tab, badge, และ logic ปุ่มทั้งหมดให้สอดคล้องกัน
- หน้าผลงานคอนเทนต์แสดงรายการ `approved` ใน tab "รอเผยแพร่"
- หน้ารายการอนุมัติไม่รวม `draft` และ `published` จาก tab "ทั้งหมด"
- เพิ่มปุ่มเผยแพร่สำหรับ `approved` → `published`

**ไม่ใช่เป้าหมาย:**
- ไม่เปลี่ยนกลไกการปฏิเสธ/ขอแก้ไข
- ไม่เพิ่ม multi-step approval
- ไม่เปลี่ยน API endpoint นอกจากชื่อค่า ENUM
- ไม่เปลี่ยน logic ของ plan/schedule/publish channel

## การตัดสินใจ

### ข้อที่ 1: เปลี่ยน `review` → `pending_approval` ใน DB ผ่าน MODIFY COLUMN

**เลือก**: `ALTER TABLE content_items MODIFY COLUMN status ENUM('published','draft','revision','pending_approval','rejected','approved')`

**ทางเลือกที่พิจารณา:**
- เก็บ `review` ไว้แล้วเปลี่ยนแค่ label — ยังคงความกำกวม
- เพิ่ม `pending_approval` เป็น alias — เพิ่มความซับซ้อนเป็นสองเท่า

**เหตุผล**: MariaDB ENUM เก็บบนตำแหน่ง integer ภายใน MODIFY COLUMN รักษาข้อมูลเดิมโดยจับคู่ค่าที่แต่ละตำแหน่ง — เปลี่ยนแค่ string literal

### ข้อที่ 2: วาง `approved` ไว้ท้ายสุดของ ENUM

**เลือก**: เพิ่ม `approved` เป็นค่า ENUM สุดท้าย

**เหตุผล**: การเพิ่มท้ายสุดไม่กระทบตำแหน่งของค่าอื่น — `published` อยู่ตำแหน่ง 1, `draft` ตำแหน่ง 2 ต่อไป — ลดความเสี่ยงกับข้อมูลเดิม

### ข้อที่ 3: Tab "รอเผยแพร่" ในหน้าผลงานคอนเทนต์กรองด้วย `approved`

**เลือก**: Tab label "รอเผยแพร่" กับ `statusFilter === 'approved'`

**ทางเลือกที่พิจารณา:**
- Tab label "อนุมัติแล้ว" — ขัดแย้งกับความหมายในหน้ารายการอนุมัติ ผู้สร้างเห็นเป็น "รอเผยแพร่" ไม่ใช่ "อนุมัติแล้ว"
- รวม `approved` + `published` ใน tab เดียวกัน — ขัดกับวัตถุประสงค์การแยกสถานะ

**เหตุผล**: ค่าฐานข้อมูลเดียวกัน label ต่างกันตามบริบท — สะท้อนว่าเป็น "อนุมัติแล้วรอเผยแพร่" สำหรับผู้สร้าง vs "อนุมัติแล้ว" สำหรับผู้อนุมัติ

### ข้อที่ 4: หน้ารายการอนุมัติ "ทั้งหมด" ไม่รวม `draft` และ `published`

**เลือก**: `const approvalItems = items.filter(i => !['draft','published'].includes(i.status))`

**เหตุผล**: `draft` ยังไม่เคยเข้า workflow การอนุมัติ `published` ผ่าน workflow ไปแล้ว — เฉพาะ `pending_approval`, `approved`, `revision`, `rejected` ที่เกี่ยวข้องกับหน้ารายการอนุมัติ

### ข้อที่ 5: เพิ่มปุ่ม "เผยแพร่" ใน action bar ของ ContentDetailView

**เลือก**: แสดงปุ่ม "เผยแพร่" (Send icon, variant="default", สีเขียว) เมื่อ `context='content'` และ `item.status === 'approved'`

**ตำแหน่ง**: ใน action bar เคียงข้างปุ่มอื่นของ content context

**ทางเลือกที่พิจารณา:**
- เพิ่มใน hover actions ของ ContentListTab — มองเห็นยากกว่าสำหรับ action เผยแพร่
- เผยแพร่อัตโนมัติเมื่ออนุมัติ — ตัดสิทธิ์ผู้สร้างในการเลือกจังหวะเผยแพร่

### ข้อที่ 6: ใช้ไฟล์ migration ไฟล์เดียวสำหรับทั้งสองการเปลี่ยนแปลง

**เลือก**: ไฟล์ migration ไฟล์เดียวที่ทำทั้งสอง `MODIFY COLUMN` operations (เปลี่ยน review → pending_approval, เพิ่ม approved)

**เหตุผล**: ทั้งสองการเปลี่ยนแปลงเป็น atomic สำหรับฟีเจอร์นี้ — การแยกไฟล์ไม่ได้เพิ่มคุณค่าและเสี่ยงต่อ partial state

## ความเสี่ยง / ข้อแลกเปลี่ยน

- **ความเสี่ยง**: รายการ `review` เดิมใน DB จะแสดงเป็น `pending_approval` หลัง migration → **การลดความเสี่ยง**: เป็นความตั้งใจ — รายการที่เคย "in review" ทั้งหมดจะกลายเป็น "pending approval"
- **ความเสี่ยง**: string `'review'` ที่ hardcode ในไฟล์ที่ไม่ใช่ TS อาจตกหล่น → **การลดความเสี่ยง**: grep ตรวจสอบครอบคลุม `src/`, `api/`, `database/`, `e2e/`
- **ความเสี่ยง**: Stat cards ในหน้ารายการอนุมัติอ้างอิง key เดิม → **การลดความเสี่ยง**: อัปเดต keys ของ `statusCounts` จาก `review`/`published` เป็น `pending_approval`/`approved`

## แผนการ Migration

1. สร้างไฟล์ migration `YYYY_MM_DD_HHMMSS_refactor_content_status_enum.sql`
2. รันกับ MariaDB เครื่อง local
3. Deploy โค้ด (frontend อ้างอิง key ใหม่)
4. ตรวจสอบ: หน้ารายการอนุมัติแสดงข้อมูลเดิมภายใต้ tab ที่ถูกต้อง

**Rollback**: MODIFY COLUMN กลับเป็น ENUM เดิม — ข้อมูลยังอยู่เพราะตำแหน่งไม่เปลี่ยน

## คำถามที่ยังไม่ได้ข้อสรุป

- ควรให้รายการ `published` ปรากฏในหน้ารายการอนุมัติหรือไม่? ปัจจุบันไม่รวม — หากต้องการภายหลัง เพิ่มเป็น tab แบบอ่านอย่างเดียว
