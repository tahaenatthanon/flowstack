# Design: Research API Dispatch (Phase 3)

## Context

`api/content-research.php` ปัจจุบันมี adapter ครบทั้งสองแล้ว (Phase 2 เพิ่ม `research_fetch_ai()` / `research_test_ai()` ใน `api/lib/keyword-research.php`) แต่ endpoint ยัง guard ตายตัว:

- `action=test`: `if ($provider !== 'dataforseo') jsonError('ยังไม่ได้ตั้งค่า DataForSEO', 400);`
- `action=fetch`: `if ($settings['provider'] !== 'dataforseo') jsonError('ยังไม่ได้ตั้งค่า DataForSEO', 400);`

`research_settings()` คืน `provider` อยู่แล้ว (`research_provider` จาก `content_global_settings`) — จึงไม่ต้องแก้ตัวนี้ใน Phase 3 (whitelist `ai` เป็น Phase 4)

## Goals / Non-Goals

**Goals:**
- dispatch `provider='ai'` → `research_fetch_ai()` / `research_test_ai()`, `provider='dataforseo'` → adapter เดิม
- คง cache / status / tenant-safety / ไม่เปิดเผย credential
- DataForSEO path ไม่ถอยหลัง

**Non-Goals:**
- ไม่เพิ่มตัวเลือก `ai` ใน settings UI (Phase 4)
- ไม่เพิ่ม whitelist `research_provider` ใน `brand-content.php` (Phase 4)
- ไม่เพิ่มคอลัมน์ `ai_research_model_id`
- ไม่แตะ ANALYZE (คง `ai_research_chat()` → Writing AI เดิม)

## Decisions

### D1: dispatch inline ด้วย if/else บน `$provider` (ไม่ refactor เป็น class/strategy)
ใน `fetch` และ `test` ใช้ `if ($provider === 'ai') {...} elseif ($provider === 'dataforseo') {...} else jsonError(...)` โดยตรง
- **Alternative**: สร้าง provider registry/strategy — ตัด provider มีแค่ 2 ตัว + ขอบเขตเล็ก การ refactor เพิ่ม indirection ไม่คุ้ม
- **Rationale**: ชัดเจน traceable ตรงหลัก "NO MAGIC" และง่ายต่อการเพิ่ม provider ที่ 3 ภายหลัง

### D2: แยก mapping ของ `raw` ตาม provider (AI มีแค่ `serp`)
`raw` ของ DataForSEO เป็น `['serp'=>..., 'suggestions'=>..., 'volume'=>...]` แต่ AI เป็น `['serp'=>...]` เท่านั้น (ดู design Phase 2) — endpoint ต้องเขียน `raw_serp` / `raw_keywords` แยกตาม shape:
- `raw_serp` = `json_encode(['normalized'=>$result['serp'], 'provider'=>$result['raw']['serp']])` — เหมือนเดิมทั้งสอง provider
- `raw_keywords` = DataForSEO: `['provider'=>['suggestions'=>..., 'volume'=>...]]`; AI: `['provider'=>['ai'=> $result['raw']['serp']]]` หรือ store เดียวกับ raw_serp (ไม่มี suggestion/volume แยก)
- **Rationale**: คง contract "เก็บ raw ครบเพื่อตรวจสอบย้อนหลัง" โดยไม่พยายามปลอม field ที่ AI ไม่มี

### D3: คง INSERT job รูปเดิม (field `location_code` ยังเก็บค่า settings)
AI fetch รับ `locationCode`/`languageCode` เป็น param แต่ location ไม่มีความหมายกับ AI — endpoint ยังส่ง `$settings['location_code']` ลง job และ cache key เหมือนเดิม (คง field ไว้ ไม่เพิ่ม/ไม่ลบ schema)
- **Alternative**: ยัด `0`/`NULL` ลง location_code ของ AI — ตัด เพราะ cache key SQL (`provider=? AND location_code=? ...`) ต้องตรงกับค่าที่บันทึกไว้ใน job และ DataForSEO ยังใช้ location จริง
- **Rationale**: ใช้ค่าจาก settings เดิม ทำให้ cache key สม่ำเสมอทั้งสอง provider โดยไม่แตะ SQL

### D4: test action สำหรับ AI ไม่ต้องใช้ login/password
`action=test` ของ AI เรียก `research_test_ai($db)` (ซึ่ง resolve credential จาก `provider-openrouter` เอง) — ไม่เช็ค `$login`/`$password` เพราะ AI ไม่ใช้ field เหล่านั้น (ต่างจาก dataforseo ที่เช็ค)
- **Rationale**: credential ของ AI อยู่ที่ `ai_providers`/env ไม่ใช่ settings login/password (M5)

### D5: keyword sort ไม่แก้ (ปล่อยให้ตกไป keyword ASC)
`research_keyword_rows()` sort `is_selected DESC, search_volume DESC, keyword ASC` — เมื่อ volume null ทั้งหมด จะตกไป `keyword ASC` เอง ซึ่งสมเหตุสมผล (seed กับ ai_search keyword เรียงตามตัวอักษร) ไม่ crash
- **Rationale**: ไม่แตะ SEO/sort logic ตาม "SCOPE DRIFT" — ถ้าต้องการให้ seed มาก่อน ค่อยแก้ใน task แยกถ้าจำเป็น

## Risks / Trade-offs

- [AI fetch ช้ากว่า DataForSEO / timeout 90s] → `research_ai_chat()` มี timeout 90s แล้ว; job เป็น `failed` เมื่อเกิน ไม่ hang
- [AI คืน JSON ไม่ครบ field] → adapter ใช้ default ว่าง (Phase 2) ทำให้ job ยัง `done` ได้
- [raw_keywords ของ AI ไม่มี suggestion/volume] → design D2 แยก mapping ชัดเจน ไม่ปลอม field
- [provider ยังเป็น `none`/ค่าอื่น] → `else jsonError('ยังไม่ได้ตั้งค่า provider', 400)` กัน crash และเป็น gate เดิมที่ Phase 4 จะเปิดตัวเลือก `ai` ให้ผู้ใช้

## Migration Plan

- ไม่มี schema change — แก้ `api/content-research.php` ไฟล์เดียว
- Deploy: แก้ไฟล์แล้วรัน `php -l` + ทดสอบ `test`/`fetch` ทั้งสอง provider
- Rollback: revert ไฟล์ — ไม่มีผลข้างเคียง DB

## Open Questions

- ไม่มี — ค่า `source='ai_search'` / model / base_url ล็อกจาก Phase 1–2 แล้ว
