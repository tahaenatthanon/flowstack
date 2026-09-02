## 0. Writing Model Switch (precondition)

- [x] 0.1 ตรวจ `ai_providers[provider-openrouter]` มี key ที่ถอดรหัสได้ (ยืนยันแล้ว: len=73, sk-or-v1-...)
- [x] 0.2 สลับ `company_settings.ai_content_text_model_id` ไป model ใต้ `provider-openrouter` (แนะนำ `google/gemini-2.5-flash` id `4d017aa5-fdd9-4c74-bf79-f0ba23abf150`)
- [x] 0.3 บันทึก SQL เป็น note ใต้ `database/migrations/` (data update ไม่ใช่ schema) เพื่อ trace ได้
- [x] 0.4 verify: ยิง `action=analyze` + `generate-article` ผ่าน OpenRouter สำเร็จ (หายจาก error "Add credits")

## 1. Orchestrator Hook

- [x] 1.1 เพิ่ม `useResearchRun` ใน `src/hooks/useContent.ts` (หรือไฟล์ใหม่) — รับ { topic, itemId, enabled } คืน { run, status, error }
- [x] 1.2 state machine: idle → fetching → analyzing → generating → done/failed
- [x] 1.3 `run()` ไล่: fetch(seed=topic) → poll status=done → analyze(job_id) → poll → generate-article(item_id, research_job_id)
- [x] 1.4 error ภาษาไทยแยกขั้น (fetch ล้ม / analyze ล้ม / generate ล้ม)

## 2. UI Toggle + Progress

- [x] 2.1 เพิ่ม toggle "ใช้ AI Research" ใน QuickCreateDialog + ContentCardDialog + ContentPlannerPage
- [x] 2.2 แสดง progress 3 ขั้น (ค้นข้อมูล / วิเคราะห์ / เขียนบทความ) ระหว่างรัน
- [x] 2.3 เมื่อปิด toggle → ส่ง generate-article โดยไม่มี research_job_id (พฤติกรรมเดิม)

## 3. Wire Into Call Sites

- [x] 3.1 QuickCreateDialog: เปิด research → ใช้ useResearchRun แทน generate-article ตรง
- [x] 3.2 ContentPlannerPage handleRequestAI: รองรับ toggle + useResearchRun
- [x] 3.3 ContentCardDialog handleAI: รองรับ toggle + useResearchRun
- [x] 3.4 batch generate (handleGenerate) ยัง generate ตรง ไม่ research อัตโนมัติ (scope เดิม)

## 4. Tests

- [x] 4.1 test useResearchRun: order ถูก (fetch→analyze→generate) + error แยกขั้น
- [x] 4.2 test toggle ปิด → ไม่เรียก research endpoint
- [x] 4.3 รัน pnpm lint + pnpm test — ไม่มี regression
