## Why

ชั้น FETCH → ANALYZE → generate-article ของ AI Research ต่อครบทั้ง 5 phase แล้ว (spike → adapter → dispatch → settings → verify) แต่ frontend ยังไม่เคยเรียกใช้จริง — ทั้ง `src/` เรียก `content-research.php` แค่จุดเดียวคือปุ่ม "ทดสอบการเชื่อมต่อ" (`action=test`) ทำให้ผู้ใช้กดสร้างคอนเทนต์แล้วไม่เกิด Research เลย ทั้งที่ backend พร้อมครบและ `generate-article` รองรับ `research_job_id` อยู่แล้ว

## What Changes

- เพิ่ม **AI Research workflow** ใน flow สร้างคอนเทนต์: ผู้ใช้เปิด/ปิด Research ต่อชิ้นงานได้ (optional)
- เมื่อเปิด Research: ระบบไล่ **Fetch → Analyze → Generate Article** โดยใช้ endpoint ที่มีอยู่แล้ว (`action=fetch` → `action=analyze` → `generate-article` + `research_job_id`)
- แสดง **progress 3 ขั้นตอน** (ค้นข้อมูล → วิเคราะห์ → เขียนบทความ)
- ใช้ **topic** เป็นจุดตั้งต้น แล้ว **derive seed keyword** ก่อน research
- เชื่อม Research job เข้ากับ Content item อัตโนมัติ (ผ่าน `content_item_id` ที่ schema รองรับแล้ว)
- **Precondition**: สลับ `ai_content_text_model_id` ไป model ใต้ `provider-openrouter` เพื่อปลดล็อก analyze/generate (ปัจจุบันชี้ `google/gemini-3.5-flash` บน provider-kilo ที่หมดเครดิต)
- **ไม่แตะ** backend logic — เป็น frontend orchestration ล้วน; ไม่ทำ async orchestration (Option A/C) เพราะ endpoint ครบแล้วและเพิ่ม scope โดยไม่จำเป็น

## Capabilities

### New Capabilities

- `ai-research-content-workflow`: ข้อกำหนดของ orchestration ฝั่ง frontend ที่ต่อ Fetch → Analyze → Generate เข้า flow สร้างคอนเทนต์ พร้อม toggle เปิด/ปิดต่อชิ้นงาน, progress 3 ขั้น, derive seed keyword จาก topic, link research job กับ content item และ precondition สลับ writing model ไป OpenRouter

### Modified Capabilities

<!-- ไม่มี requirement เดิมถูกเปลี่ยน — backend endpoint และ generate-article ใช้เหมือนเดิม -->

## Impact

- แก้ไข (frontend): `src/components/content/dialogs/QuickCreateDialog.tsx`, `src/pages/ContentPlannerPage.tsx`, `src/components/content/ContentCardDialog.tsx`
- เพิ่ม: hook/orchestrator ใหม่ใน `src/hooks/` (เช่น `useResearchRun`)
- แก้ไข (ข้อมูล): `company_settings.ai_content_text_model_id` → model ใต้ `provider-openrouter` (บันทึกเป็น note/migration ให้ trace ได้)
- อ้างอิง (ไม่แก้): `api/content-research.php` (`fetch`/`analyze`), `api/brand-content.php` (`generate-article` + `research_job_id`), `api/lib/ai-research.php` (`ai_research_chat`)
- ไม่กระทบ schema, ไม่กระทบ backend logic, ไม่กระทบ DataForSEO path, ไม่กระทบ SEO logic
