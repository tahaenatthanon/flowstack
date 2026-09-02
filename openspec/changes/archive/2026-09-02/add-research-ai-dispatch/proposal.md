## Why

ชั้น FETCH ของ Content Research ยัง guard ตายตัวว่า `provider === 'dataforseo'` ใน `api/content-research.php` (action `test` และ `fetch`) ทั้งที่ Phase 2 เพิ่ม `research_fetch_ai()` / `research_test_ai()` (capability `ai-research-adapter`) ที่คืน shape กลางเดียวกันแล้ว — จึงต้องปลด guard และ dispatch ตาม provider เพื่อให้ Research ใช้ AI web search จริงได้ โดยคง DataForSEO เป็น provider เดิม

## What Changes

- `action=fetch` ใน `api/content-research.php`: dispatch ตาม `provider` — ถ้า `ai` เรียก `research_fetch_ai($db, $seed, $locationCode, $languageCode)` ถ้า `dataforseo` เรียก `research_fetch_dataforseo(...)` เดิม (ปลด guard `if ($settings['provider'] !== 'dataforseo')`)
- `action=test` ใน `api/content-research.php`: dispatch ตาม `provider` — ถ้า `ai` เรียก `research_test_ai($db)` ถ้า `dataforseo` เรียก `research_test_dataforseo($login, $password)` เดิม
- คง logic cache เดิม โดย cache key ใช้ `provider` ที่บันทึกใน job (tenant + provider + location_code + language_code + seed) — รองรับ provider `ai` ได้โดยไม่แก้ SQL
- คง flow ANALYZE เดิม (`ai_research_chat()` → `ai_content_text_model_id` Writing AI) — **ไม่เปลี่ยน**
- คง kติกาเดิม: `requireAuth()` ก่อนทุก action, ทุก query มี `tenant_id`, job ล้มเหลวเป็น `failed` พร้อมข้อความไทย, ไม่เปิดเผย credential, `force_refresh` เท่านั้นที่ bypass cache
- ไม่แตะ settings/UI (Phase 4), ไม่แตะ adapter (Phase 2), ไม่เพิ่มคอลัมน์ DB

## Capabilities

### New Capabilities

- `ai-research-dispatch`: ข้อกำหนดของชั้น dispatch ใน `content-research.php` ที่ route provider `ai` ไป `research_fetch_ai()` / `research_test_ai()` และ provider `dataforseo` ไป adapter เดิม โดยคง cache/status/tenant-safety และไม่เปิดเผย credential

### Modified Capabilities

<!-- ไม่มี requirement ของ capability เดิมถูกเปลี่ยน — content-research-api / content-research-provider ถูกเขียน provider-agnostic อยู่แล้ว และ DataForSEO adapter ยังทำงานเหมือนเดิม -->

## Impact

- แก้ไข: `api/content-research.php` (action `fetch` + `test` — ปลด guard dataforseo-only, dispatch ตาม provider)
- อ้างอิง (อ่าน ไม่แก้): `api/lib/keyword-research.php` (`research_fetch_ai` / `research_test_ai` จาก Phase 2), `api/lib/ai-research.php` (`ai_research_chat` สำหรับ analyze)
- ข้อมูลจาก AI fetch มี metric ปริมาณเป็น `null` ทั้งหมด — `research_keyword_rows()` sort `search_volume DESC` จะตกไป `keyword ASC` โดยอัตโนมัติ (ตรวจว่าไม่ crash)
- ไม่กระทบ schema, ไม่กระทบ frontend, DataForSEO path ไม่ถอยหลัง
