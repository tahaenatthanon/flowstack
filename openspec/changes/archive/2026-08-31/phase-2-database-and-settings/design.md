## Context

Phase 1 ล็อก contract แล้วว่า Research ต้องแยกข้อมูลตาม tenant, เก็บ metric ที่ไม่ทราบเป็น `NULL`, ไม่เปิดเผย secret และเก็บผล Research เป็น cache ที่ตรวจสอบย้อนหลังได้ ปัจจุบันฐานข้อมูลยังไม่มี Research tables และ settings API ยังไม่มี DataForSEO fields

## Goals / Non-Goals

**Goals:**

- เพิ่ม schema สำหรับ Research job และ normalized keywords
- เพิ่ม per-tenant DataForSEO settings โดยใช้ encryption helper เดิม
- ทำให้ settings API และฟอร์ม frontend อ่าน/บันทึกค่าได้โดยไม่ส่ง secret กลับ
- รันและ verify migration กับฐานข้อมูลจริง

**Non-Goals:**

- ยังไม่เรียก DataForSEO จริง
- ยังไม่สร้าง Research fetch/analyze endpoint
- ยังไม่ทำ `/content-pipeline`
- ไม่เปลี่ยน SEO gate, publish flow หรือ AI generation

## Decisions

### 1. แยก Research เป็นสองตาราง

ใช้ `content_research_jobs` เก็บ request/raw/analysis/status และ `content_research_keywords` เก็บ keyword metrics แยกแถว เพื่อให้ sort/filter และ query analytics ได้ง่ายกว่าเก็บ JSON อย่างเดียว

ทางเลือกที่ไม่เลือก: เก็บ Research ทั้งหมดใน `content_items.article_content` เพราะค้น query ยากและทำลาย traceability ของงานที่ถูกลบหรือ research ซ้ำ

### 2. ใช้ `ON DELETE SET NULL` กับ content item

`content_item_id` ของ job nullable เพราะ job ทำหน้าที่เป็น cache ที่มีต้นทุนภายนอก การลบ content ไม่ควรลบผล Research ที่ยัง reuse ได้ ส่วน keyword ใช้ `ON DELETE CASCADE` ตาม job

ทางเลือกที่ไม่เลือก: `CASCADE` กับ content item เพราะจะทิ้งข้อมูลที่จ่ายเงินซื้อมาและลดประโยชน์ของ cache

### 3. เก็บ provider credential ใน content settings

ใช้ `content_global_settings` ซึ่งมี `tenant_id` และ pattern ของ encrypted API key อยู่แล้ว DataForSEO ต้องใช้ login กับ password จึงไม่เหมาะกับ `ai_providers` ที่เป็น global

ทางเลือกที่ไม่เลือก: เพิ่ม provider ใน `ai_providers` เพราะขอบเขตและ credential model ต่างจาก AI provider

### 4. ใช้ migration ที่ทำซ้ำได้

ใช้ `CREATE TABLE IF NOT EXISTS` และ `ADD COLUMN IF NOT EXISTS` ตามไฟล์ migration ที่มีอยู่ แล้วตรวจ schema หลังรันด้วย `SHOW COLUMNS`/`DESCRIBE` เพื่อรองรับฐานข้อมูลที่มีบางส่วนแล้ว

### 5. Secret handling

บันทึก DataForSEO password ด้วย `encryptValue()` และ GET คืนเฉพาะ `has_research_key` ไม่คืนค่าที่เข้ารหัสหรือ plaintext login/password ที่ไม่จำเป็นต่อ frontend

## Risks / Trade-offs

- [Migration เดิมถูกรันบางส่วนแล้ว] → ใช้คำสั่งแบบ idempotent และตรวจโครงสร้างก่อน/หลังรัน
- [encrypted key ใช้ encryption key ผิดชุด] → ใช้ helper และ format เดียวกับ `image_gen_api_key_encrypted`
- [tenant settings ถูกอ่านข้าม tenant] → ทุก SELECT/UPDATE ใช้ tenant id จาก auth และทดสอบกรณี tenant อื่น
- [cache job ถูกลบตาม content โดยไม่ตั้งใจ] → verify FK เป็น `ON DELETE SET NULL`
- [frontend ทำให้ secret ถูกส่งกลับใน state] → response schema ไม่มี secret field และใช้ flag `has_research_key`

## Migration Plan

1. ตรวจ schema ปัจจุบัน
2. รัน migration สร้าง Research tables
3. รัน migration เพิ่ม Research settings
4. ตรวจ `DESCRIBE content_research_jobs`, `DESCRIBE content_research_keywords` และ `SHOW COLUMNS FROM content_global_settings LIKE 'research%'`
5. ทดสอบ insert/delete ใน transaction หรือ fixture เฉพาะถ้าทำได้โดยไม่กระทบข้อมูลจริง
6. หาก migration ล้มเหลว แก้ไฟล์ migration แล้วรันซ้ำจนผ่าน ห้ามข้ามการ verify

ไม่มี rollback อัตโนมัติใน phase นี้ การลบ schema ต้องทำผ่าน migration แยกและได้รับอนุมัติชัดเจน

## Open Questions

ไม่มีสำหรับ phase นี้ ค่า default และรูปแบบ FK ถูกยืนยันจาก Phase 1 แล้ว
