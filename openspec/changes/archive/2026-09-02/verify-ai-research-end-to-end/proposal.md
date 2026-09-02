## Why

Provider `ai` (Research AI web search) ต่อครบทั้ง 4 เฟสแล้ว (spike → adapter → dispatch → settings UI) แต่ยังไม่มีรอบตรวจ end-to-end ที่ยืนยันว่า flow จริงทำงานต่อกันได้ — capability เดิม `ai-research-end-to-end-verification` เขียนเกณฑ์ไว้เฉพาะ DataForSEO จึงต้องขยายเกณฑ์ให้ครอบคลุม provider `ai` และยืนยันว่า metric ปริมาณเป็น `NULL`, cache, tenant isolation, analyze และ SEO ไม่ถอยหลัง

## What Changes

- ตรวจระดับ backend: `action=test` provider `ai` คืน `ok`, fetch seed ไทย → job `done` พร้อม `raw_serp`/`raw_keywords`, keyword rows มี metric ปริมาณเป็น `NULL` ทุกตัว, cache (`cached=true`) และ `force_refresh`, analyze ใช้ Writing AI (`ai_content_text_model_id`) ไม่ใช่ research model, tenant isolation, AI error/timeout → job `failed` + ข้อความไทย
- ตรวจ content flow: generate-article ส่ง `research_job_id` ไม่ crash, `meta_keywords` มาจาก research keywords, กรณีไม่ส่ง Research → `meta_keywords` ว่าง, SEO gate/checklist/`seo_evaluate()` ไม่ถอยหลัง
- ตรวจ UI: provider `ai` แสดง/ซ่อนฟิลด์ถูกต้อง, ข้อความไทยครบ
- ตรวจคุณภาพโค้ด: `pnpm lint`, `pnpm build`, `pnpm test` (รวม `ResearchProviderForm.test.tsx`), PHP syntax ทุกไฟล์ที่แก้
- ยืนยัน DataForSEO (provider เดิม) ยังทำงานได้เมื่อเลือกไว้
- ไม่มีการแก้ไขโค้ด production (เป็นรอบตรวจ + บันทึกผล); ไม่สร้าง route/menu/permission ใหม่

## Capabilities

### New Capabilities

<!-- ไม่มี capability ใหม่ — ใช้ capability เดิม ai-research-end-to-end-verification ขยายให้ครอบคลุม provider ai -->

### Modified Capabilities

- `ai-research-end-to-end-verification`: ขยายเกณฑ์ตรวจ end-to-end จาก DataForSEO-only เป็นครอบคลุม provider `ai` (metric ปริมาณเป็น `NULL`, test/fetch/analyze ของ AI, cache/tenant/failure) และคงเกณฑ์ SEO/publish/legacy เดิม

## Impact

- อ่าน/ตรวจสอบ (ไม่แก้ production): `api/content-research.php`, `api/lib/keyword-research.php`, `api/lib/ai-research.php`, `api/brand-content.php`, `src/components/brand/ResearchProviderForm.tsx`
- ผลลัพธ์เป็นรายงานตรวจ "ผ่าน/ไม่ผ่าน" ลง docs (ต่อจาก `docs/ai-research-web-search-verification.md`)
- ไม่กระทบ schema, ไม่กระทบ endpoint production, ไม่กระทบ frontend logic
