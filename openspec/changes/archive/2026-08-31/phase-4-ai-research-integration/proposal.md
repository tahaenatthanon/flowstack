## Why

ระบบมี DataForSEO Research backend แล้ว แต่ผล Research ยังไม่ถูกวิเคราะห์โดย AI และยังไม่ถูกส่งเข้า `generate-article` อย่างเป็นระบบ ทำให้ content ที่สร้างยังไม่มี research brief ที่ตรวจสอบย้อนกลับได้ และ SEO metadata อาจมาจากการคาดเดาของโมเดล

Phase นี้จะเชื่อม Research job ที่เสร็จแล้วเข้ากับ AI content model โดยคงความเข้ากันได้กับการสร้าง content แบบเดิมที่ไม่ได้ใช้ Research

## What Changes

- เพิ่ม action `analyze` ใน Research API เพื่อสร้าง Research brief จากข้อมูล job ที่มีสถานะ `done`
- กำหนด JSON contract ของ Research brief ให้มี primary keyword, secondary keywords, search intent, PAA, content gaps, competitor angles, outline, word count และ AEO notes
- บังคับให้ AI ใช้เฉพาะ search metrics ที่มีอยู่จริง และห้ามแต่ง search volume หรือ difficulty ที่ไม่มีใน provider response
- เพิ่มการส่ง `research_job_id` แบบ optional ให้ `generate-article` และตรวจ ownership/status ของ job ก่อนนำข้อมูลเข้า prompt
- ส่ง provider, location, language และเวลาที่ fetch สำเร็จเข้า prompt เพื่อให้ผลลัพธ์ traceable
- ใช้ primary keyword จาก Research กับ SEO title, slug, meta description, ย่อหน้าแรก และ headings
- บันทึก `content_item_id` กลับไปยัง Research job หลังสร้าง content สำเร็จ
- รองรับ `brand_context_ids` จาก module ใหม่ และแยก credential/model helper ที่ใช้ร่วมกันออกเป็น library
- เมื่อไม่มี Research ให้สร้าง content ต่อได้ และปล่อย `meta_keywords` ว่างตามข้อกำหนดเดิม

## Capabilities

### New Capabilities
- `ai-research-analysis`: การวิเคราะห์ Research job ด้วย AI และ Research brief ที่มี schema และข้อมูลอ้างอิงชัดเจน

### Modified Capabilities
- `content-research-api`: เพิ่มการวิเคราะห์ job ที่เสร็จแล้วและคืน Research brief ที่ตรวจสอบได้

## Impact

- Backend: `api/content-research.php`, `api/brand-content.php` และ library credential/AI ที่ใช้ร่วมกัน
- Contract: Research API จะมี action `analyze`; `generate-article` จะรับ `research_job_id` และ `brand_context_ids` แบบ optional
- Database: อัปเดตข้อมูล `analysis` ของ Research job และเชื่อม `content_item_id` หลังสร้าง content สำเร็จ โดยไม่เพิ่มตารางใหม่
- AI provider: ใช้ content model และ credential resolution เดิมของ tenant
- ไม่มีการเปลี่ยน route หรือสร้างหน้า frontend ใน change นี้; wizard `/content-pipeline` อยู่ใน Phase 5
- ไม่มีการเรียก DataForSEO เพิ่มใน change นี้; ใช้ข้อมูลที่ถูกเก็บโดย Phase 3
