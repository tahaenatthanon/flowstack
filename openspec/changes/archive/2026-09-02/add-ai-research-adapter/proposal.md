## Why

ชั้น FETCH ของ Content Research ปัจจุบันผูกกับ DataForSEO เพียง provider เดียว (`api/lib/keyword-research.php` มีแค่ `research_fetch_dataforseo()` / `research_test_dataforseo()` และ `content-research.php` guard `provider !== 'dataforseo'`) — ยังไม่มี adapter ของ Research AI ที่ผ่านการยืนยัน web search แล้วจาก spike (`openspec/specs/ai-research-web-search`) พร้อมใช้ Phase 3 ต้องมี adapter คู่ขนานที่คืน shape กลางเดียวกันก่อน จึง dispatch `provider='ai'` ได้

## What Changes

- เพิ่ม `research_fetch_ai()` ใน `api/lib/keyword-research.php` — ยิง chat completion 1 ครั้งด้วย Research AI (model `perplexity/sonar`, `base_url=https://openrouter.ai/api/v1`) สั่งให้คืน structured JSON แล้ว normalize เป็น `serp` / `keywords` / `raw` ใน shape เดียวกับ DataForSEO adapter
- เพิ่ม `research_test_ai()` — ยืนยัน credential + model พร้อมใช้ (ยิง probe สั้น) ไม่จำเป็นต้องเช็ค balance แบบ DataForSEO
- normalize keyword: `search_volume` / `competition` / `cpc` / `difficulty` เป็น `null` **เสมอ** (`intent` มาจาก AI ได้, `source` = `ai_search`)
- บังคับให้ seed keyword อยู่ในผลลัพธ์ด้วย `source: 'seed'` เพื่อให้ `analyze` (Phase 3) ตรวจ primary keyword ผ่าน
- เก็บ raw response ทั้งหมดลง `raw` (shape `['serp' => <raw>]`) เพื่อตรวจสอบย้อนหลังได้เท่า DataForSEO
- `cost_usd` คืน `null` (AI fetch ไม่มี cost จาก provider ใน shape นี้)
- ไม่แตะ DataForSEO adapter เดิม ไม่แตะ `content-research.php` (เป็น Phase 3) ไม่แตะ frontend/settings (เป็น Phase 4)

## Capabilities

### New Capabilities

- `ai-research-adapter`: ข้อกำหนดของ adapter AI fetch สำหรับ Content Research — `research_fetch_ai()` / `research_test_ai()` ใช้ model/base_url/credential resolve path ที่ยืนยันแล้วจาก `ai-research-web-search` คืน shape กลางเดียวกันกับ DataForSEO adapter โดย metric ปริมาณเป็น `null` เสมอและมี raw response ให้ตรวจสอบย้อนหลัง

### Modified Capabilities

<!-- ไม่มี requirement ของ capability เดิมถูกเปลี่ยนใน change นี้ — การ dispatch provider='ai' ใน content-research.php เป็น Phase 3 -->

## Impact

- แก้ไข: `api/lib/keyword-research.php` (เพิ่ม `research_fetch_ai()` / `research_test_ai()` + normalize helper)
- อ้างอิง (อ่าน ไม่แก้): `api/lib/ai-creds.php` (`resolveAICreds()`), `api/lib/ai-research.php` (`ai_research_chat()` เป็นแม่แบบการยิง), `docs/ai-research-web-search-verification.md` (ค่าคงที่ model/base_url/param)
- model string เริ่มจาก hardcode `perplexity/sonar` + `base_url=https://openrouter.ai/api/v1` ตามผล spike — ไม่แตะ DB (คอลัมน์ `ai_research_model_id` ไม่อยู่ใน change นี้)
- ไม่กระทบ schema, ไม่กระทบ endpoint production, ไม่กระทบ frontend
