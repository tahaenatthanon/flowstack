## 1. Dispatch `action=test`

- [x] 1.1 ปลด guard `if ($provider !== 'dataforseo') jsonError(...)` ใน `action=test` แล้ว dispatch: `ai` → `research_test_ai($db)` คืน `{ok, message}` (ไม่มี balance), `dataforseo` → path เดิม, อื่น → `jsonError('ยังไม่ได้ตั้งค่า provider', 400)`
- [x] 1.2 AI test response ไม่เปิดเผย credential (ไม่ส่ง key/encrypted key)

## 2. Dispatch `action=fetch`

- [x] 2.1 ปลด guard `if ($settings['provider'] !== 'dataforseo') jsonError(...)` แล้ว dispatch ตาม `$settings['provider']`
- [x] 2.2 provider `ai` เรียก `research_fetch_ai($db, $seed, $settings['location_code'], $settings['language_code'])` และเขียน `raw_serp` (shape `['normalized'=>..., 'provider'=>...]`) + `raw_keywords` สำหรับ AI (ไม่มี suggestion/volume แยก — ตาม design D2)
- [x] 2.3 provider `dataforseo` คง path เดิม (`research_fetch_dataforseo(...)` + `raw_keywords` suggestions/volume) โดยไม่ถอยหลัง
- [x] 2.4 คง INSERT job รูปเดิม (`provider`, `location_code`, `language_code`, `status='fetching'`, `created_by`) และ `cost_usd` = `null` สำหรับ AI

## 3. Cache + Keyword Sort

- [x] 3.1 คง logic cache เดิม (cache key ใช้ `provider` ที่บันทึกใน job) — รองรับ provider `ai` โดยไม่แก้ SQL
- [x] 3.2 ตรวจ `research_keyword_rows()` sort ด้วย `is_selected DESC, search_volume DESC, keyword ASC` ไม่ crash เมื่อ volume เป็น `null` ทั้งหมด (เรียงตกไป keyword ASC เอง)

## 4. Verification

- [x] 4.1 รัน `php -l api/content-research.php` — ไม่มี syntax error
- [x] 4.2 รัน `php api/tests/keyword-research-test.php` — adapter เดิมไม่พัง
- [x] 4.3 รัน `pnpm lint` และ `pnpm test` — ไม่มี regression
