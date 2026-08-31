## Context

Phase 3 มี `content_research_jobs` และ DataForSEO adapter ที่เก็บ raw response กับ normalized keywords แล้ว แต่ Research ยังไม่มีการสรุปด้วย AI และ `generate-article` ยังรับเฉพาะ context เดิม ระบบใช้ AI credential และ content model ผ่าน helper ที่อยู่ใน `brand-content.php` ทำให้การนำไปใช้ร่วมกับ Research API ยังไม่แยกขอบเขตชัดเจน

การเปลี่ยนแปลงนี้ต้องรักษา tenant isolation, ไม่เปิดเผย credential, รองรับ content generation เดิม และทำให้ Research brief ตรวจสอบย้อนกลับได้

## Goals / Non-Goals

**Goals:**

- เพิ่มการวิเคราะห์ Research job ที่เป็นของ tenant เดียวกันและมีสถานะ `done`
- กำหนด JSON brief ที่ validate ได้และเก็บกลับใน job
- ส่ง brief และ metadata ของแหล่งข้อมูลเข้า `generate-article` อย่าง traceable
- ใช้ keyword ที่เลือกหรือ primary keyword จาก Research เป็นแหล่งหลักของ SEO metadata
- รองรับ `brand_context_ids` จาก request โดยยังรักษา fallback ของ content เดิม

**Non-Goals:**

- ไม่เรียก DataForSEO เพิ่มจาก change นี้
- ไม่สร้าง frontend wizard หรือ route `/content-pipeline`
- ไม่เพิ่ม GSC, rank tracking, feedback loop หรือ n8n AEO
- ไม่เปลี่ยน SEO gate และ publish flow ที่เป็น baseline จาก phase ก่อนหน้า

## Decisions

### แยก credential และ AI parameter helper

ย้าย `resolveAICreds()` และ `getAIContentParams()` ไป `api/lib/ai-creds.php` โดยคง signature และผลลัพธ์เดิม แล้วให้ `brand-content.php` และ `content-research.php` require library เดียวกัน การคง signature ลดผลกระทบต่อ caller เดิมและหลีกเลี่ยงการมี logic ถอดรหัสซ้ำ

ทางเลือกที่ไม่เลือก: ให้ Research API include `brand-content.php` เพราะจะผูก endpoint กับ side effects และ action routing ของไฟล์ใหญ่เกินจำเป็น

### ใช้ job เดิมเป็น source of truth

`analyze` จะอ่าน `raw_serp`, `raw_keywords`, normalized keyword rows และข้อมูล job จาก `content_research_jobs` โดยกรอง `tenant_id` และ `status='done'` จากนั้นบันทึก JSON brief ลง `analysis` พร้อม `analyzed_at` การวิเคราะห์ซ้ำสามารถเขียนทับผลเดิมได้เมื่อผู้ใช้ร้องขออย่างชัดเจน

ทางเลือกที่ไม่เลือก: สร้างตาราง brief ใหม่ เพราะ job มีช่อง `analysis` และ lifecycle อยู่แล้ว

### บังคับ schema และแยกข้อมูลจริงจาก inference

AI ต้องคืน JSON object ตาม schema ที่มี primary keyword, secondary keywords, intent, PAA, content gaps, competitor angles, outline, word count และ AEO notes prompt จะระบุว่า search volume/difficulty ใช้ได้เฉพาะค่าที่มีใน Research และค่าที่หายต้องเป็น `null` หรือไม่ระบุ ห้ามสร้างตัวเลขขึ้นเอง หลัง parse ต้อง validate ชนิดข้อมูลและ required keys ก่อนบันทึก

ทางเลือกที่ไม่เลือก: รับข้อความอิสระแล้วค่อย parse แบบ best effort เพราะทำให้ traceability และการนำไปสร้าง content ไม่แน่นอน

### ส่ง Research เข้า generate-article แบบ optional

เมื่อมี `research_job_id`, endpoint จะโหลด job ของ tenant เดียวกันที่ `done` เท่านั้น และส่ง brief, selected keywords และ source metadata ได้แก่ provider, location, language, fetched time เข้า prompt เมื่อไม่มีหรือไม่ส่ง id ให้ใช้ flow เดิม โดยไม่สร้าง keyword metrics ปลอม และเขียน `meta_keywords` ว่างตาม requirement

### ผูก content กลับไปยัง job หลังสำเร็จ

หลัง insert/update content สำเร็จ ให้ update `content_research_jobs.content_item_id` ด้วย predicate ของ tenant และ job id การผูกนี้เป็น metadata สำหรับ traceability และไม่ทำให้การสร้าง content ล้มเหลวหาก update linkage ไม่สำเร็จจนกว่าจะมีการตัดสินใจเพิ่มเติมใน implementation review

## Risks / Trade-offs

- [AI คืน JSON ไม่ตรง schema] -> ตรวจ parse และ required fields; ปฏิเสธผลลัพธ์พร้อมข้อความภาษาไทยและไม่บันทึก brief ที่ไม่สมบูรณ์
- [AI แต่ง metric ที่ provider ไม่มี] -> ใส่ข้อกำหนดใน system/user prompt และตรวจค่าตัวเลขเทียบกับ source ก่อนบันทึก
- [job มี raw payload ขนาดใหญ่] -> จำกัดขนาดข้อมูลที่ใส่ prompt และส่งเฉพาะ normalized fields ที่จำเป็น พร้อมเก็บ raw ไว้ใน DB
- [การย้าย helper กระทบ caller เดิม] -> คง function signature, รัน PHP syntax และ regression tests ของ generate-plan/generate-article
- [Research job ต่าง tenant ถูกอ้างผ่าน request] -> ใช้ tenant จาก auth ใน SQL ทุกครั้งและไม่ใช้ tenant id จาก body

## Migration Plan

ไม่ต้องเพิ่ม migration ใหม่ ใช้คอลัมน์ `analysis`, `analyzed_at` และ `content_item_id` ที่มีจาก Phase 2/3

ลำดับ deploy:

1. เพิ่มและตรวจ `api/lib/ai-creds.php` พร้อมปรับ caller เดิม
2. เพิ่ม `analyze` และ schema validation ใน Research API
3. เพิ่ม optional research input และ linkage ใน `generate-article`
4. รัน syntax check, unit tests, lint, build และ test suite

Rollback: revert code change นี้ได้โดยไม่ต้อง rollback schema เพราะใช้เฉพาะคอลัมน์ที่มีอยู่แล้ว

## Open Questions

- ควรกำหนดเพดาน token ของ raw SERP และ brief ตาม model setting ใดใน implementation หรือไม่
- หาก linkage `content_item_id` ล้มเหลวหลังสร้าง content สำเร็จ ควรแจ้งเตือนระดับใดโดยไม่ rollback content
