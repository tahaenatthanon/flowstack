## 1. Precondition

- [x] 1.1 ตรวจ `content_global_settings.research_provider` ตั้งเป็น `ai` และ `ai_providers[provider-openrouter]` มี key ที่ `decryptApiKey()` ถอดได้ (หรือ env `OPENROUTER_API_KEY`) — ✅ ผ่าน (provider=ai, key decrypt len=73)
- [x] 1.2 ถ้า precondition ไม่พร้อม บันทึกผลเป็น "blocked by precondition" และแจ้งผู้ใช้ ไม่นับเป็น fail — precondition พร้อม ไม่ต้องใช้

## 2. Backend Verification (API จริง)

- [x] 2.1 `action=test` provider `ai` → คืน `ok: true` โดยไม่มี credential หลุด — ✅ HTTP 200 ok=true, response มีแค่ key `ok`
- [x] 2.2 `action=test` กรณี credential ไม่พร้อม → คืน error ภาษาไทย (จำลองได้ถ้าทำได้) — ✅ ตรวจโดย code inspection (`research_test_ai` คืน ok:false + ข้อความไทยเมื่อ exception)
- [x] 2.3 `action=fetch` seed ภาษาไทย provider `ai` → job `done` พร้อม `raw_serp`/`raw_keywords` มีข้อมูล — ✅ job done, 12 keywords, serp.organic=5
- [x] 2.4 keyword rows มี `keyword`, `intent`, `source` และ metric ปริมาณ (`search_volume`/`competition`/`cpc`/`difficulty`) เป็น `NULL` ทุกตัว — ✅ ผ่าน (แก้ enum bug ให้ source=ai_search)
- [x] 2.5 fetch seed เดิมภายใน cache window → `cached=true` ไม่สร้าง job ใหม่ — ✅ cached=true, job_id เดิม
- [x] 2.6 `force_refresh=true` → สร้าง fetch ใหม่ (ไม่ใช้ cache) — ✅ job_id ใหม่, cached=false
- [x] 2.7 `action=analyze` job ของ provider `ai` → brief JSON ครบ schema, primary keyword มาจาก keyword ที่ fetch มา — ⚠️ blocked (Writing AI หมดเครดิต — ดู §4 ของ report)
- [x] 2.8 ยืนยัน analyze ใช้ `ai_research_chat()` (Writing AI `ai_content_text_model_id`) ไม่ใช่ research model — ✅ ยืนยัน (error มาจาก provider-kilo ไม่ใช่ OpenRouter)
- [x] 2.9 tenant isolation: job/analyze/fetch/keyword-select ด้วย id ของ tenant อื่น → ถูกปฏิเสธ — ✅ bogus id → 404
- [x] 2.10 AI error/timeout → job `failed` + `error_msg` ไทย (ไม่ใช่ 500 ไร้รายละเอียด) — ✅ ยืนยัน (job failed + error_msg จากการ analyze ล้มเหลว)

## 3. Content Flow + SEO (ไม่แตะ logic)

- [x] 3.1 generate-article ส่ง `research_job_id` → ทำงานไม่ crash — ⚠️ blocked (ต้องผ่าน analyze ที่ติด Writing AI หมดเครดิต)
- [x] 3.2 `meta_keywords` มาจาก research keywords (volume null ไม่ทำให้พัง) — ⚠️ blocked (เหตุผลเดียวกันกับ 3.1)
- [x] 3.3 กรณีไม่ส่ง Research → `meta_keywords` ว่าง (พฤติกรรมเดิม) — ✅ ตรวจ code path เดิมไม่ถูกแตะ
- [x] 3.4 SEO gate / checklist / `seo_evaluate()` ยังทำงานเหมือนเดิม — ยืนยันไม่ถอยหลัง — ✅ ไม่แตะ (out of scope)

## 4. UI + Code Quality

- [x] 4.1 provider `ai` ใน settings: แสดง/ซ่อนฟิลด์ถูกต้อง, ปุ่มทดสอบ active ถูกต้อง, ข้อความไทยครบ — ✅ ผ่าน `ResearchProviderForm.test.tsx` (6 tests)
- [x] 4.2 รัน `pnpm lint` — ไม่มี error — ✅
- [x] 4.3 รัน `pnpm build` — ผ่าน — ✅ (warning circular chunk เดิม)
- [x] 4.4 รัน `pnpm test` — ผ่าน (รวม `ResearchProviderForm.test.tsx`) — ✅ 85/85
- [x] 4.5 ตรวจ PHP syntax ทุกไฟล์ที่แก้ (`api/content-research.php`, `api/lib/keyword-research.php`, `api/brand-content.php`) — ✅

## 5. Report

- [x] 5.1 บันทึกผล "ผ่าน / ไม่ผ่าน / blocked" พร้อมหลักฐาน (HTTP status, raw log) ลง `docs/ai-research-end-to-end-verification.md` — ✅ เขียนแล้ว
- [x] 5.2 สรุปเกณฑ์จบ: ผ่าน spike + endpoint/tenant/cache + metric NULL + analyze/generate/publish ไม่ถอยหลัง + lint/build/test ผ่าน + ไม่มี secret หลุด — ✅ สรุปแล้ว (FETCH พร้อม, ANALYZE รอ Writing AI เครดิต)
