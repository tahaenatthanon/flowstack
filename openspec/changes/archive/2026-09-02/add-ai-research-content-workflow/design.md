# Design: AI Research Content Workflow (Option B)

## Context

backend พร้อมครบแล้ว: `action=fetch` (รับ `seed_keyword` + `content_item_id`), `action=analyze` (รับ `job_id`), `generate-article` (รับ `research_job_id` + link job→content_item อัตโนมัติ) — verify ผ่านแล้วใน `verify-ai-research-end-to-end`

สิ่งที่ขาดคือ **ชั้น orchestration ฝั่ง frontend** ที่ไล่ขั้นตอนและส่ง `research_job_id` เข้ากับ `generate-article`

Provider/model map (ยืนยันจากโค้ด):

| ขั้น | ฟังก์ชัน | provider | model |
|---|---|---|---|
| FETCH (research) | `research_fetch_ai()` | provider-openrouter | `perplexity/sonar` (hardcode) |
| ANALYZE (analyst) | `ai_research_chat()` | provider-kilo ⚠️ | `google/gemini-3.5-flash` (`ai_content_text_model_id`) |
| GENERATE (writing) | `resolveAICreds()` ใน brand-content | provider-kilo ⚠️ | `google/gemini-3.5-flash` (ตัวเดียวกับ analyze) |

## Goals / Non-Goals

**Goals:**
- toggle เปิด/ปิด Research ต่อชิ้นงาน
- ไล่ fetch → analyze → generate ด้วย endpoint เดิม
- progress 3 ขั้น + derive seed จาก topic + link job อัตโนมัติ
- ปลดล็อก analyze/generate โดยสลับ writing model ไป OpenRouter

**Non-Goals:**
- ไม่ทำ Option A (รวม backend คำขอเดียว) / Option C (async job) — เพิ่ม scope โดยไม่จำเป็น
- ไม่แตะ backend logic, ไม่แตะ SEO logic, ไม่แตะ DataForSEO path
- ไม่แยก research model (`ai_research_model_id`) — analyze ใช้ writing model ร่วมตาม M3

## Decisions

### D0: สลับ writing model ไป OpenRouter ก่อน orchestrate (precondition)
`ai_content_text_model_id` ปัจจุบันชี้ `google/gemini-3.5-flash` บน kilo หมดเครดิต → เปลี่ยนเป็น `google/gemini-2.5-flash` (id `4d017aa5-fdd9-4c74-bf79-f0ba23abf150`) ใต้ provider-openrouter
- **Alternative**: เติมเครดิต kilo — ตัด (เจ้าของระบบย้าย provider แล้วตาม spike)
- **Rationale**: ปลดล็อก analyze + generate; research/fetch อยู่ OpenRouter อยู่แล้ว → ครบวงจร
- **หมายเหตุ**: เป็น data update (UPDATE ไม่ใช่ schema) — บันทึกเป็น note ใต้ `database/migrations/` ให้ trace ได้

### D1: Frontend orchestrate 3 ขั้นด้วย endpoint เดิม (Option B)
ใช้ `action=fetch` → poll `status=done` → `action=analyze` → poll → `generate-article`
- **Alternative**: Option A/C — ตัด เพราะ endpoint ครบแล้ว + async เพิ่มความซับซ้อนโดยไม่จำเป็น
- **Rationale**: เร็วสุด, ขอบเขตเล็ก, แสดง progress แยกขั้นได้

### D2: Research เป็น optional ต่อชิ้นงาน (toggle)
เพิ่ม state `researchEnabled` ต่อชิ้นงาน; ปิด = ข้าม research ไป generate ตรง (พฤติกรรมเดิม)
- **Rationale**: คอนเทนต์บางชิ้น (ประกาศภายใน) ไม่ควรเสียเงินค้นเว็บ — ตรงแผนเดิม "Research ข้ามได้"

### D3: derive seed keyword จาก topic
`seed_keyword = topic.trim()` เป็นจุดตั้งต้น (AI adapter รองรับ query ภาษาไทย/ยาวอยู่แล้ว)
- **Alternative**: แยก field ให้ผู้ใช้กรอง seed เอง — ตัด (ซับซ้อนเกินรอบนี้, topic ตรงพอ)
- **Rationale**: topic คือความตั้งใจของผู้ใช้ชัดสุด

### D4: orchestrator แยกเป็น hook `useResearchRun` (reuse หลายหน้าจอ)
รวม fetch→analyze→generate + progress state ไว้ที่เดียว ให้ 3 จุดเรียกใช้ร่วมกัน (QuickCreate / Planner / CardDialog)
- **Rationale**: ไม่ copy logic ซ้ำ 3 จุด

### D5: progress 3 ขั้นด้วย state machine
`idle → fetching → analyzing → generating → done | failed`
- **Rationale**: ผู้ใช้เห็นว่าถึงขั้นไหน + จัดการ error แยกขั้น

## Risks / Trade-offs

- [รวม 3 ขั้นใช้เวลา ~60-120s] → แสดง progress + timeout ฝั่ง backend มีแล้ว (fetch 90s)
- [Writing AI หมดเครดิต kilo] → D0 สลับไป OpenRouter ก่อนรันจริง
- [batch generate หลายชิ้น + research = ค่าใช้จ่ายคูณ] → รอบนี้ทำ toggle ต่อ single item; batch (handleGenerate) ยัง generate ตรง ไม่ research อัตโนมัติ
- [topic ยาว/กำกวมเป็น seed] → adapter + prompt รองรับ query ภาษาไทย; ถ้าคุณภาพต่ำค่อยเพิ่ม seed field แยกในภายหลัง

## Migration Plan

- ไม่มี schema change — แก้ frontend 3 จุด + hook ใหม่ + 1 data update (writing model)
- Deploy: แก้ไฟล์ → `pnpm lint` + `pnpm test` + `pnpm build`
- Rollback: revert ไฟล์ + revert `ai_content_text_model_id` กลับค่าเดิม

## Open Questions

- ไม่มี — ค่า model/provider/endpoint ล็อกจากการ verify แล้ว
