## Context

Workflow คอนเทนต์เพิ่ง refactor สถานะเป็น 6 สถานะ (`draft`, `revision`, `pending_approval`, `approved`, `published`, `rejected`) เรียบร้อย ปุ่ม อนุมัติ/ขอแก้ไข/ปฏิเสธ ถูกเพิ่มไว้ 2 ที่: hover actions ใน `ContentListTab` (หน้าผลงานคอนเทนต์) และตารางของ `ContentApprovalPage` (หน้ารายการอนุมัติ) สถานะในตาราง `content_items` มีแค่ `created_at`, `updated_at` และ `reject_reason` — ยังไม่มีคอลัมน์บันทึกเวลาที่รายการถูกส่งขออนุมัติ

## Goals / Non-Goals

**Goals:**
- จำกัดปุ่ม อนุมัติ/ขอแก้ไข/ปฏิเสธ ให้อยู่เฉพาะหน้ารายการอนุมัติ — ลบออกจากหน้าผลงานคอนเทนต์
- สลับลำดับ Status Card/Tab: "อนุมัติแล้ว" ก่อน "รออนุมัติ"
- เพิ่มคอลัมน์ `requested_at` บันทึกวันที่ขออนุมัติ
- เพิ่มตัวเลือก sort ตามวันที่ขออนุมัติ (ใหม่สุด/เก่าสุด) ในหน้ารายการอนุมัติ

**Non-Goals:**
- ไม่เปลี่ยนกลไกขอแก้ไข/ปฏิเสธ/เผยแพร่
- ไม่เปลี่ยนปุ่ม "ขออนุมัติ" (author-side) ในหน้าผลงานคอนเทนต์
- ไม่เปลี่ยน API endpoint (แค่เพิ่ม field และ auto-set ใน PUT เดิม)
- ไม่เพิ่ม multi-step approval

## Decisions

### ข้อที่ 1: ลบปุ่มอนุมัติออกจาก ContentListTab ทั้งหมด (รวม state/dialog)

**เลือก**: ลบ JSX ปุ่ม 3 ปุ่มใน hover actions + ลบ state `approveConfirm`, `reasonDialog`, `reason`, `savingDecision` และ handler `applyDecision`, `handleApprove`, `handleRequestRevision`, `handleReject` พร้อม dialog ยืนยัน/เหตุผล ที่เหลือใน `ContentListTab` ออกทั้งหมด

**ทางเลือกที่พิจารณา:**
- ซ่อนปุ่มด้วย permission flag — ซับซ้อนเกินสำหรับ scope นี้ และ state ที่ไม่ถูกใช้จะค้างอยู่
- คงปุ่มไว้แต่ disabled — ยังแสดง UI ที่ไม่ควรมี

**เหตุผล**: ปุ่มอนุมัติเป็นความรับผิดชอบของหน้ารายการอนุมัติโดยเฉพาะ การลบออกทั้งหมดทำให้โค้ดสะอาด และ icon import (`Check`, `X`, `Pencil`) ที่เหลือใช้ตัวอื่นได้

### ข้อที่ 2: เพิ่มคอลัมน์ `requested_at` และ auto-set ฝั่ง backend

**เลือก**: migration `ALTER TABLE content_items ADD COLUMN requested_at DATETIME NULL AFTER reject_reason` และใน `api/content-items.php` PUT เมื่อ `body['status'] === 'pending_approval'` ให้ set `requested_at = NOW()` เพิ่มโดยอัตโนมัติ (ไม่ต้องให้ client ส่ง)

**ทางเลือกที่พิจารณา:**
- ให้ client ส่ง `requested_at` มาเอง — client clock ไม่น่าเชื่อถือ และเพิ่มจุดแก้ไขหลายที่
- ใช้ `updated_at` แทน — ถูกเขียนทับทุก transition ไม่ใช่เวลาขออนุมัติจริง

**เหตุผล**: auto-set ที่ server จุดเดียว (transition เข้า `pending_approval`) รับประกันความถูกต้อง และ `updated_at` ถูกเปลี่ยนทุกครั้งที่ update จึงใช้แทนไม่ได้

### ข้อที่ 3: ข้อมูลเดิม (รายการ pending_approval ที่มีอยู่แล้ว)

**เลือก**: sort ใช้ `COALESCE(requested_at, updated_at)` — รายการเดิมที่ยังไม่มี `requested_at` จะใช้ `updated_at` เป็น fallback

**เหตุผล**: ไม่ต้อง backfill ข้อมูลเดิม และยังเรียงได้สมเหตุสมผล

### ข้อที่ 4: Sort เปลี่ยนจาก created_at เป็น requested_at

**เลือก**: แทนที่ sort `newest/oldest` (เดิมใช้ `created_at`) ด้วย sort ตามวันที่ขออนุมัติ 2 ค่า: `requested_desc` ("ขออนุมัติล่าสุด → เก่าสุด") และ `requested_asc` ("ขออนุมัติเก่าสุด → ล่าสุด")

**ทางเลือกที่พิจารณา:**
- เพิ่ม sort ใหม่โดยเก็บ sort เดิมไว้ — มี sort หลายมิติที่ผู้ใช้สับสน
- เรียงแบบ client-side ต่อจาก API ที่เรียง created_at — ต้อง sort ใหม่ใน client อยู่แล้ว

**เหตุผล**: หน้ารายการอนุมัติควรเรียงตามคิวการขออนุมัติเป็นหลัก การแทนที่ช่วยลดความซับซ้อน

## Risks / Trade-offs

- **ความเสี่ยง**: รายการ `pending_approval` เดิมมี `requested_at` เป็น NULL → **การลดความเสี่ยง**: ใช้ `COALESCE(requested_at, updated_at)` ในการ sort
- **ความเสี่ยง**: string `'review'` หรือ logic ปุ่มอนุมัติค้างในไฟล์อื่น → **การลดความเสี่ยง**: grep ตรวจ `pending_approval` และปุ่ม approve ใน `src/`
- **ความเสี่ยง**: การลบ state ใน ContentListTab แล้วเหลือ import icon ที่ไม่ใช้ → **การลดความเสี่ยง**: ลบ import `Check`, `X`, `Pencil` ถ้าไม่ถูกใช้ต่อ; รัน `pnpm lint` + `pnpm build`

## Migration Plan

1. สร้างไฟล์ migration `YYYY_MM_DD_HHMMSS_add_content_requested_at.sql`
2. รันกับ MariaDB เครื่อง local; ตรวจ `SHOW COLUMNS FROM content_items LIKE 'requested_at'`
3. Deploy โค้ด (backend auto-set + frontend sort)
4. ตรวจสอบ: ส่งขออนุมัติใหม่ → `requested_at` ถูก set; sort เรียงตามคิวถูกต้อง

**Rollback**: `ALTER TABLE content_items DROP COLUMN requested_at` (ข้อมูล sort กลับไปใช้ created_at)

## Open Questions

- ควรเก็บ sort เดิม "ใหม่ → เก่า / เก่า → ใหม่" (ตาม created_at) ไว้เป็นตัวเลือกเพิ่มเติมหรือไม่? ตอนนี้แทนที่ด้วย sort ตามวันที่ขออนุมัติ — หากต้องการภายหลัง เพิ่มกลับเป็นตัวเลือกได้
