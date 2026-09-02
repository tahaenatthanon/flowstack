# Design: AI Research Adapter (Phase 2)

## Context

ชั้น FETCH ของ Content Research ปัจจุบันมี adapter เดียวคือ DataForSEO ใน `api/lib/keyword-research.php` (`research_fetch_dataforseo()` / `research_test_dataforseo()`) และ `content-research.php` guard `provider !== 'dataforseo'` ใน action `test`/`fetch` อยู่

Spike (`openspec/changes/spike-verify-web-search`, synced เป็น `openspec/specs/ai-research-web-search`) ยืนยันแล้วว่า Research AI ค้นเว็บจริงด้วยค่าคงที่:

| ค่า | value |
|---|---|
| provider | `provider-openrouter` |
| base_url | `https://openrouter.ai/api/v1` |
| model | `perplexity/sonar` |
| payload ขั้นต่ำ | `{model, messages, stream:false, max_tokens}` |
| param บังคับ search | ไม่มี |
| citation อยู่ที่ | `choices[0].message.annotations[].url_citation.url` |

Change นี้สร้าง adapter AI คู่ขนานกับ DataForSEO โดยไม่แตะ endpoint (`content-research.php`) — dispatch เป็น Phase 3

## Goals / Non-Goals

**Goals:**
- เพิ่ม `research_fetch_ai()` และ `research_test_ai()` ใน `api/lib/keyword-research.php` คืน shape กลางเดียวกันกับ DataForSEO adapter
- normalize keyword โดย metric ปริมาณ (`search_volume`/`competition`/`cpc`/`difficulty`) เป็น `null` เสมอ, `intent` จาก AI, `source='ai_search'`, seed keyword อยู่ในผลด้วย `source:'seed'`
- เก็บ raw response ทั้งหมดเพื่อตรวจสอบย้อนหลัง
- ผ่าน PHP syntax check + unit test ที่มีอยู่ไม่พัง

**Non-Goals:**
- ไม่แก้ `content-research.php` (dispatch — Phase 3)
- ไม่แก้ settings/UI/frontend (Phase 4)
- ไม่เพิ่มคอลัมน์ `ai_research_model_id` ใน DB
- ไม่ลบ/แก้ DataForSEO adapter
- ไม่ประเมินคุณภาพ brief — แค่ adapter fetch + normalize

## Decisions

### D1: เพิ่มฟังก์ชันใน `keyword-research.php` เดิม (ไม่สร้างไฟล์ใหม่)
เขียน `research_fetch_ai()` / `research_test_ai()` / `research_normalize_ai()` ลงใน `api/lib/keyword-research.php` คู่กับ DataForSEO adapter และ reuse helper เดิม `research_merge_keywords()` (merge + seed source) 
- **Alternative**: สร้าง `api/lib/ai-research-adapter.php` แยก — ตัด เพราะ shape/helper กลาง (merge, normalize serp) อยู่รวมในไฟล์เดียวแล้ว และแยกไฟล์เพิ่ม require + กระจาย logic
- **Rationale**: adapter ทั้งสองแชร์ shape กลางเดียวกัน การอยู่ไฟล์เดียวทำให้เห็น contract ร่วม และ Phase 3 dispatch ได้จากที่เดียว

### D2: hardcode model + base_url เป็นค่าคงที่ (ไม่แตะ DB)
ประกาศ `const RESEARCH_AI_MODEL = 'perplexity/sonar'` และ `const RESEARCH_AI_BASE_URL = 'https://openrouter.ai/api/v1'` ใน adapter แล้วใช้ใน `research_fetch_ai()` / `research_test_ai()`
- **Alternative**: เพิ่มคอลัมน์ `ai_research_model_id` แล้วให้ `resolveAICreds()` whitelist — ตัด (M2 ล็อกว่าขยายเมื่อต้องสลับโมเดล; ไม่อยู่ใน phase นี้)
- **Rationale**: spike พิสูจน์ string นี้รับได้จริง การ hardcode ตัวเดียวทำให้สลับโมเดลภายหลังแก้จุดเดียว

### D3: resolve credential จาก `ai_providers` แถว `provider-openrouter` ตรง ๆ + env fallback
เพิ่ม `research_resolve_ai_creds(PDO $db): array` ที่:
1. `SELECT api_base_url, api_key_encrypted FROM ai_providers WHERE id='provider-openrouter'` → `decryptApiKey()`
2. fallback env `OPENROUTER_API_KEY` (และ `KILO_API_TOKEN`? — ไม่ ใช้เฉพาะ provider นี้)
- **Alternative A**: reuse `resolveAICreds($db, ...)` — ตัด เพราะ `resolveAICreds()` join `company_settings` และ `COALESCE(am_c.provider_id, am_d.provider_id, cs.ai_active_provider_id)` — ยังชี้ `provider-kilo` / writing model อยู่ การใช้มันจะได้ base_url/key ผิด provider
- **Alternative B**: ใช้ `ai_active_provider_id` — ตัด เพราะ spike ชี้ว่า `company_settings.ai_active_provider_id=provider-kilo` ยังไม่สลับ
- **Rationale**: Research AI เป็น provider เฉพาะของตัวเอง (OpenRouter) แยกขาดจาก writing AI (M3/M5) — resolve โดยตรงไม่พึ่ง setting ที่ยังไม่สลับ

### D4: single chat call → structured JSON → normalize ใหม่
`research_fetch_ai()` ยิง `/chat/completions` 1 ครั้ง (payload ขั้นต่ำ + `max_tokens`) สั่งให้คืน JSON object ที่มี `organic[]` (title/url/description), `people_also_ask[]`, `related_searches[]`, `keywords[]` (keyword + intent) แล้ว normalize ด้วย `research_normalize_ai()` เป็น shape กลาง
- `serp.organic[]` = `{position, title, description, url}` (position นับลำดับจาก AI)
- `serp.people_also_ask[]` = `{question, url}`, `serp.related_searches[]` = string
- `keywords[]` = `{keyword, search_volume:null, competition:null, cpc:null, difficulty:null, intent, source:'ai_search'}` + seed (`source:'seed'`)
- **Rationale**: 1 call ต่อ fetch (AI ไม่แยก SERP/suggestion/volume แบบ DataForSEO) — ต้นทุนและ latency ต่ำสุด ตรง shape ที่ `analyze` (Phase 3) ใช้

### D5: parse JSON อย่างปลอดภัย (กัน markdown fence / คำนำ)
ใช้ pattern เดียวกับ `ai_research_parse_json()` — strip code fence แล้ว regex หา `{...}` block; ถ้า parse ไม่ได้ throw `RuntimeException` ภาษาไทย
- **Rationale**: AI มักห่อ JSON ด้วย ```json — กัน fail ค้างคืน `failed` ปลอม

### D6: raw response เก็บเต็ม (ไม่ตัด citation)
`raw` คืน `['serp' => <raw gateway response array>]` — เก็บ field `annotations[].url_citation` ไว้ครบ เพื่อให้ Phase 3/ตรวจย้อนหลังดึง citation ได้โดยไม่ re-fetch
- **Rationale**: spike พบ citation อยู่ที่ field เฉพาะ — ถ้าตัด raw ทิ้งจะเสียหลักฐาน web search

### D7: metric ปริมาณห้ามแตะ — null เสมอ
`research_normalize_ai()` บังคับ `search_volume`/`competition`/`cpc`/`difficulty` = `null` ไม่ว่าว่า AI จะคืนค่าอะไรมา (ละทิ้ง) — ตรง contract "Research metrics are source-bound" และ Q1/M4

## Risks / Trade-offs

- [AI คืน URL ปลอม/hallucination] → เราไม่กรอง URL ที่ระดับ adapter (เกินขอบเขต) แต่ raw เก็บครบให้ตรวจย้อนหลังได้; spec บังคับแค่ไม่แต่ง metric ตัวเลข
- [AI คืน JSON ไม่ครบ field] → `research_normalize_ai()` ใช้ default ว่าง (`organic`/`paa`/`related`/`keywords` = `[]`) แล้ว merge seed เข้า ทำให้ job ยัง `done` ได้โดยไม่ crash
- [model string เปลี่ยนในอนาคต] → รวมที่ค่าคงที่ `RESEARCH_AI_MODEL` จุดเดียว สลับง่ายเมื่อเพิ่มคอลัมน์ DB ภายหลัง
- [key provider-openrouter ไม่มีใน DB / env] → `research_test_ai()` คืนล้มเหลวชัด, `research_fetch_ai()` throw ภาษาไทย; ไม่ส่ง key หลุดใน response
- [phase 3 ต้องรู้ว่า `raw` ของ AI มีแค่ `serp` (ไม่มี `suggestions`/`volume`)] → บันทึก contract ไว้ใน design นี้ ให้ Phase 3 dispatch แยก mapping ตาม provider

## Migration Plan

- ไม่มี schema change — เพิ่มฟังก์ชันอย่างเดียว (non-breaking) DataForSEO path เดิมไม่ถูกแตะ
- Deploy: แก้ `api/lib/keyword-research.php` ไฟล์เดียว
- Rollback: revert ไฟล์ — ไม่มีผลข้างเคียง DB

## Open Questions

- ค่า string ของ `source` — ล็อกเป็น `ai_search` (แยกจาก `suggestion`/`seed`/`related`/`paa` ของ DataForSEO) ถ้า Phase 3/UI ต้องการ label อื่นค่อยเปลี่ยนตอน dispatch
