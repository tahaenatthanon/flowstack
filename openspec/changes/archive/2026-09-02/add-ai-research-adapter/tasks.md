## 1. ค่าคงที่ + Credential Resolution

- [x] 1.1 ประกาศค่าคงที่ `RESEARCH_AI_MODEL = 'perplexity/sonar'` และ `RESEARCH_AI_BASE_URL = 'https://openrouter.ai/api/v1'` ใน `api/lib/keyword-research.php`
- [x] 1.2 เพิ่ม `research_resolve_ai_creds(PDO $db): array` — `SELECT api_base_url, api_key_encrypted FROM ai_providers WHERE id='provider-openrouter'` → `decryptApiKey()` แล้ว fallback env `OPENROUTER_API_KEY`; คืน `['api_key'=>..., 'base_url'=>...]` โดยไม่เปิดเผย key ในผลลัพธ์
- [x] 1.3 เมื่อไม่มี key ทั้ง DB และ env ให้ throw `RuntimeException` ภาษาไทย (ไม่คืนข้อมูลบางส่วน)

## 2. Gateway Call + Normalize

- [x] 2.1 เพิ่ม `research_ai_chat(string $baseUrl, string $apiKey, string $model, array $messages, int $maxTokens): array` ยิง `/chat/completions` แบบ OpenAI-compatible (payload ขั้นต่ำ `{model, messages, stream:false, max_tokens}`) พร้อม timeout และตรวจ HTTP status / `error` ใน response แล้ว throw ภาษาไทยเมื่อล้มเหลว
- [x] 2.2 เพิ่ม `research_parse_ai_json(string $raw): array` — strip markdown fence + regex หา `{...}` block เหมือน `ai_research_parse_json()`; parse ไม่ได้ throw ภาษาไทย
- [x] 2.3 เพิ่ม `research_normalize_ai(array $decoded, string $seed): array` — คืน `serp` (`organic[]` position/title/description/url, `people_also_ask[]` question/url, `related_searches[]` string), `keywords[]` (metric ปริมาณ `null` เสมอ, `intent` จาก AI หรือ `null`, `source='ai_search'`), `raw` (`['serp' => $decoded]`) โดยใช้ default ว่างเมื่อ field ขาด

## 3. Adapter Fetch

- [x] 3.1 เพิ่ม `research_fetch_ai(PDO $db, string $seed, int $locationCode, string $languageCode): array` — สร้าง system prompt (นักวิเคราะห์ SEO/AEO ภาษาไทย, JSON เท่านั้น, ค้นจาก web จริง) + user prompt (seed keyword, คืน organic/paa/related ที่มี URL จริง, ห้ามใส่ metric ตัวเลข)
- [x] 3.2 เรียก `research_resolve_ai_creds()` + `research_ai_chat()` + `research_parse_ai_json()` + `research_normalize_ai()` แล้วคืน `['ok'=>true, 'error'=>null, 'cost_usd'=>null, 'serp'=>..., 'keywords'=>research_merge_keywords($seed, ..., [], $serp), 'raw'=>...]` ใน shape เดียวกับ `research_fetch_dataforseo()`
- [x] 3.3 ยืนยัน seed keyword อยู่ใน `keywords` ด้วย `source: 'seed'` และ keyword อื่นเป็น `source: 'ai_search'`

## 4. Adapter Test

- [x] 4.1 เพิ่ม `research_test_ai(PDO $db): array` — ยิง probe สั้นด้วย credential + model ที่ยืนยันแล้ว และคืน `['ok'=>true]` เมื่อสำเร็จ / `['ok'=>false, 'message'=>...]` เมื่อล้มเหลวโดยไม่เปิดเผย credential

## 5. Verification

- [x] 5.1 รัน `php -l api/lib/keyword-research.php` — ไม่มี syntax error
- [x] 5.2 รัน `php api/tests/keyword-research-test.php` — normalize/merge เดิมไม่พัง
- [x] 5.3 รัน `pnpm lint` และ `pnpm test` — ไม่มี regression (ไม่ควรกระทบ frontend แต่ยืนยัน build ไม่พัง)
