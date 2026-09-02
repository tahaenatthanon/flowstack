# ai-research-end-to-end-verification Specification

## Purpose

กำหนดเกณฑ์ตรวจสอบ end-to-end ของ Research ตั้งแต่การตั้งค่า provider ไปจนถึงการสร้างและเผยแพร่เนื้อหา โดยใช้ flow เดิมของระบบ — ขยายให้ครอบคลุม provider `ai` (Research AI web search) ควบคู่กับ DataForSEO

## MODIFIED Requirements

### Requirement: AI Research is verified from settings through generation
ระบบ SHALL มีรอบตรวจ end-to-end ที่ยืนยันว่า Research settings, provider connection, fetch, cache, analyze และ content generation ทำงานต่อกันได้ใน flow คอนเทนต์เดิม สำหรับทั้ง provider `dataforseo` และ `ai`

#### Scenario: Research flow succeeds with the AI provider
- **WHEN** tenant เลือก provider `ai` และผู้ใช้ fetch seed keyword ภาษาไทย
- **THEN** Research job เป็น `done`, มี normalized keywords, มี SERP/PAA data, keyword มี metric ปริมาณเป็น `NULL` ทุกตัว และสามารถ analyze ต่อเป็น brief ได้

#### Scenario: Research flow succeeds with DataForSEO
- **WHEN** tenant มี DataForSEO settings ที่ถูกต้องและผู้ใช้ fetch seed keyword ภาษาไทย
- **THEN** Research job เป็น `done`, มี normalized keywords, มี SERP/PAA data, มี `cost_usd` และสามารถ analyze ต่อเป็น brief ได้

#### Scenario: Generated content uses analyzed research
- **WHEN** ผู้ใช้สร้าง content โดยส่ง `research_job_id` ของ job ที่ analyze สำเร็จ
- **THEN** content generation ใช้ brief นั้น, เขียน SEO metadata จาก keyword จริง และบันทึก linkage กลับไปยัง Research job

### Requirement: Research verification covers tenant safety and failure states
รอบตรวจ SHALL ครอบคลุม tenant isolation, invalid job, provider timeout/error และ cache behavior เพื่อยืนยันว่าไม่มีข้อมูลข้าม tenant และไม่มีผลสำเร็จปลอม สำหรับทั้ง provider `dataforseo` และ `ai`

#### Scenario: Cross-tenant research access is rejected
- **WHEN** ผู้ใช้เรียก job, analyze, fetch หรือ keyword-select ด้วย id ที่ไม่ใช่ของ tenant ตนเอง
- **THEN** API ปฏิเสธ request และไม่คืนข้อมูล Research ของ tenant อื่น

#### Scenario: AI provider failure creates failed job
- **WHEN** Research AI timeout หรือคืน error ระหว่าง fetch
- **THEN** job ถูกบันทึกเป็น `failed` พร้อม `error_msg` ภาษาไทย และ API คืน error ภาษาไทยที่เหมาะสม

#### Scenario: Provider failure creates failed job
- **WHEN** DataForSEO timeout หรือคืน error ระหว่าง fetch
- **THEN** job ถูกบันทึกเป็น `failed` พร้อม `error_msg` และ API คืน error ภาษาไทยที่เหมาะสม

#### Scenario: Cache prevents duplicate provider calls
- **WHEN** ผู้ใช้ fetch seed เดิมภายใน cache window โดยไม่ส่ง `force_refresh`
- **THEN** API คืน job เดิมพร้อม `cached: true` และไม่สร้าง provider call ใหม่

## ADDED Requirements

### Requirement: AI provider test endpoint is verified
ระบบ SHALL ยืนยันว่า `action=test` ด้วย provider `ai` คืน `ok: true` เมื่อ credential + model พร้อมใช้ และคืน error ภาษาไทยเมื่อ credential ไม่พร้อม โดยไม่เปิดเผย credential

#### Scenario: AI test succeeds
- **WHEN** credential + model ของ Research AI พร้อมใช้และผู้ใช้เรียก `test` ด้วย provider `ai`
- **THEN** API คืน `ok: true` โดยไม่มี credential หลุด

#### Scenario: AI test fails when credential is missing
- **WHEN** credential ของ Research AI ไม่พร้อม
- **THEN** API คืนผลล้มเหลวพร้อมข้อความภาษาไทยโดยไม่เปิดเผย key

### Requirement: AI analyze uses the writing AI model
ระบบ SHALL ยืนยันว่า action `analyze` ยังใช้ `ai_content_text_model_id` (Writing AI เดิม) ไม่ใช่ research model และไม่ถอยหลัง

#### Scenario: Analyze uses the writing model
- **WHEN** ผู้ใช้ analyze job ที่ fetch สำเร็จด้วย provider `ai`
- **THEN** analysis ใช้ Writing AI (`ai_research_chat`) และคืน brief JSON ครบ schema โดย primary keyword มาจาก keyword ที่ fetch มา

### Requirement: AI provider does not regress legacy content generation
ระบบ SHALL ยืนยันว่า flow สร้างคอนเทนต์เดิมยังทำงานได้เมื่อไม่ใช้ Research และ SEO gate / checklist / `seo_evaluate()` ยังทำงานเหมือนเดิมเมื่อใช้ provider `ai`

#### Scenario: Content generation without research still works
- **WHEN** ผู้ใช้สร้าง content โดยไม่ส่ง `research_job_id`
- **THEN** ระบบสร้าง content ได้ตามปกติ และ `meta_keywords` เป็นค่าว่างเมื่อไม่มี Research source

#### Scenario: SEO behavior is unchanged for AI provider
- **WHEN** content ถูกสร้างจาก Research (provider `ai`) แล้วผู้ใช้เรียก SEO checklist / gate
- **THEN** ผล SEO แสดงตามจริง ไม่ crash และ approval/publish flow เดิมไม่ถอยหลัง
