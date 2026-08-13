## Context

Migration เดิม `database/migrations/2026_08_11_171224_refactor_content_status_enum.sql` ใช้หลักการ rename ตามตำแหน่ง ordinal (`review` ตำแหน่ง 4 → `pending_approval` ตำแหน่ง 4) ซึ่งจะถูกต้องก็ต่อเมื่อ DB อยู่ที่ state `('published','draft','revision','review','rejected')` อยู่แล้วเท่านั้น ถ้า DB ยังอยู่ state เก่ากว่า (เช่น `('published','draft','review')`) การ apply โดยตรงจะทำให้แถว `review` เดิมถูกตีความผิดตำแหน่งเป็น `revision` ได้

นอกจากนี้ `api/content-items.php` (method PUT) ไม่มีการ validate ค่า `status` — ส่งค่าอะไรไปก็ถูกส่งต่อให้ PDO โดยตรง ทำให้ MariaDB ตัดค่า ENUM ที่ไม่รองรับเป็น empty string อย่างเงียบ ๆ (non-strict mode) หรือ throw error (strict mode) ซึ่งเป็นสาเหตุที่หน้ารายการอนุมัติแสดงรายการแต่ไม่มีปุ่ม action

## Goals / Non-Goals

**Goals:**
- ทำให้ `content_items.status` ENUM อยู่ใน state ปลายทาง 6 ค่าอย่างปลอดภัย โดยไม่ทำลายข้อมูลเดิมไม่ว่า DB จะเริ่มจาก state ใด
- ป้องกันการเขียนค่า status ที่ไม่ถูกต้องลง DB ฝั่ง server อย่างถาวร
- แก้ข้อมูลค้าง (empty string, `review`) ให้กลับเป็นค่าที่ถูกต้อง

**Non-Goals:**
- ไม่แตะโค้ด frontend (ใช้ `pending_approval` ถูกต้องอยู่แล้ว)
- ไม่เปลี่ยน workflow/requirement ของการอนุมัติ (spec ปัจจุบันถูกต้องแล้ว)
- ไม่เพิ่ม multi-step approval

## Decisions

### Decision 1: Migration แบบ self-correcting (อ่าน state ปัจจุบันก่อน)

**เลือก**: migration ใหม่ที่ตรวจ state ENUM ปัจจุบันจาก `information_schema.COLUMNS` แล้วตัดสินใจ rename / เพิ่มค่า / no-op ตามสภาพจริง

**ทางเลือกที่พิจารณา**:
- (A) ใช้ ALTER แบบ fixed-state ซ้ำเหมือนเดิม → เสี่ยงซ้ำรอยเดิมถ้า DB ไม่ได้อยู่ใน state ที่คาด
- (B) self-correcting migration → รองรับ state ต้นทางได้ทุกรูปแบบ ✅

**Rationale**: ปัญหาเดิมเกิดจากการ assume state ที่ไม่เป็นจริง การอ่าน state จริงก่อนทำจึงปลอดภัยที่สุด

**วิธี implement**: ใช้ `ALTER TABLE ... MODIFY COLUMN status ENUM(...)` ต่อท้ายเสมอ แต่ก่อน ALTER ให้ตรวจ `information_schema.COLUMNS.COLUMN_TYPE` ว่ายังมี `review` อยู่หรือไม่
- ถ้ามี `review` → ทำ data migration ก่อน: `UPDATE content_items SET status='pending_approval' WHERE status='review'` แล้วค่อย ALTER (ไม่ต้องพึ่ง ordinal)
- จากนั้น ALTER ให้ได้ 6 ค่า แล้ว `UPDATE ... SET status='draft' WHERE status=''`

### Decision 2: Server-side status whitelist validation

**เลือก**: เพิ่ม whitelist ค่า status ใน `api/content-items.php` (PUT) — reject ค่าที่นอก `['draft','revision','pending_approval','approved','rejected','published']` ด้วย `jsonError('สถานะไม่ถูกต้อง', 400)`

**ทางเลือกที่พิจารณา**:
- (A) ปล่อยให้ MariaDB/PDO จัดการตามเดิม → เกิด empty string เงียบ ๆ ✅ ไม่เลือก
- (B) validate ใน frontend อย่างเดียว → ไม่กันกรณีเรียก API ตรง ๆ
- (C) validate ฝั่ง server whitelist ✅

**Rationale**: server เป็นจุดเดียวที่รับประกันความถูกต้องของข้อมูล ไม่ว่า client จะเป็น frontend หรือเครื่องมืออื่น

### Decision 3: ไฟล์ migration แยกจาก migration เดิม

**เลือก**: สร้าง migration ใหม่ (`YYYY_MM_DD_HHMMSS_fix_content_status_enum.sql`) แทนการแก้ migration เดิม

**Rationale**: migration เก่าถูก archive ไปแล้วใน openspec และอาจถูก apply บางส่วนแล้ว การสร้าง migration ใหม่ที่ self-correcting จะซ่อม state ให้ถูกต้องเสมอ ไม่ว่าจะอยู่ในสถานะไหน

## Risks / Trade-offs

- [Migration เงื่อนไขซับซ้อนกว่าปกติ] → Mitigation: แยกเป็น step ชัดเจน + verify ด้วย `SHOW COLUMNS` และ `SELECT status, COUNT(*)` ก่อน/หลังรัน
- [ข้อมูล `review` เดิมอาจถูกตีความผิดถ้าเคย apply migration เก่าแล้ว] → Mitigation: ตรวจ `COLUMN_TYPE` จริงก่อน และใช้ `UPDATE ... WHERE status='review'` แทนการพึ่ง ordinal
- [DB strict mode ทำให้ `UPDATE` status ที่เคย work ตอนนี้ throw] → Mitigation: validation ฝั่ง server จะ reject ตั้งแต่ต้นด้วย 400 ที่ชัดเจน แทน error คลุมเครือ

## Migration Plan

1. วินิจฉัย: `SHOW COLUMNS FROM content_items LIKE 'status'` + `SELECT status, COUNT(*) FROM content_items GROUP BY status`
2. สร้าง migration `database/migrations/YYYY_MM_DD_HHMMSS_fix_content_status_enum.sql`
3. รันกับ MariaDB local: `mysql -u root flowstack < database/migrations/<file>.sql`
4. Verify: `SHOW COLUMNS` แสดง 6 ค่า + `SELECT status, COUNT(*)` ไม่มี `''` หรือ `review`
5. Rollback: ไม่มีข้อมูลถูกทำลาย (เฉพาะ rename/append enum + normalize ค่า) — ถ้าต้องย้อน ให้ ALTER กลับเป็น state ก่อนหน้า

## Open Questions

- ยังไม่ทราบ state ENUM ปัจจุบันของ DB จริง — ต้องรันวินิจฉัยก่อนเลือก SQL ใน migration (task 1.x)
