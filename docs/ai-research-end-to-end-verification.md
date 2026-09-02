# การยืนยัน End-to-End ของ AI Research (Provider `ai`)

**วันที่:** 2026-09-02 (Asia/Bangkok)
**Change:** `openspec/changes/verify-ai-research-end-to-end`

---

## สรุปเกณฑ์จบ

| เกณฑ์ | ผล |
|---|---|
| test / fetch / cache / tenant isolation | ✅ ผ่าน |
| metric ปริมาณเป็น `NULL` (Q1) | ✅ ผ่าน |
| keyword `source` ถูกต้อง (`ai_search`) | ✅ ผ่าน (แก้ enum bug ระหว่างตรวจ) |
| analyze ใช้ Writing AI (ไม่ใช่ research model) | ✅ ยืนยัน |
| analyze + generate-article ต่อเนื่อง | ⚠️ blocked — Writing AI หมดเครดิต (kilo.ai) |
| lint / build / test / PHP syntax | ✅ ผ่าน |
| ไม่มี secret หลุดใน response | ✅ ผ่าน |

---

## 1. Precondition

| รายการ | ผล |
|---|---|
| `content_global_settings.research_provider` | `ai` ✅ |
| `ai_providers[provider-openrouter]` key | ถอดรหัสได้ (len=73, `sk-or-v1-...`) ✅ |
| base_url | `https://openrouter.ai/api/v1` ✅ |

---

## 2. ผลตรวจระดับ backend (ยิง API จริงผ่าน HTTP)

| ข้อ | ผล | หลักฐาน |
|---|---|---|
| `action=test` provider `ai` | ✅ ผ่าน | HTTP 200, `ok: true`, response มีแค่ key `ok` (ไม่มี credential) |
| `action=test` credential ไม่พร้อม | ✅ (code) | `research_test_ai()` คืน `ok:false` + ข้อความไทยเมื่อ exception; ไม่เปิดเผย key |
| `action=fetch` seed ไทย | ✅ ผ่าน | job `done`, `raw_serp`/`raw_keywords` มีข้อมูล, 12 keywords, serp.organic=5 |
| keyword metric เป็น `NULL` | ✅ ผ่าน | `search_volume`/`competition`/`cpc`/`difficulty` เป็น `NULL` ทั้ง 12 ตัว |
| keyword `source` | ✅ ผ่าน (หลัง fix) | `ai_search:4, seed:1, related:1, paa:4` |
| cache | ✅ ผ่าน | fetch เดิม → `cached: true`, job_id เดิม |
| force_refresh | ✅ ผ่าน | job_id ใหม่, `cached: false` |
| analyze | ⚠️ blocked | HTTP 502 — Writing AI หมดเครดิต (ดู §4) |
| analyze ใช้ Writing AI | ✅ ยืนยัน | `ai_content_text_model_id = google/gemini-3.5-flash` บน `provider-kilo` — error มาจาก kilo ไม่ใช่ OpenRouter |
| tenant isolation | ✅ ผ่าน | bogus job id → HTTP 404 |
| AI error → failed job | ✅ ยืนยัน | analyze ล้มเหลว → job `status=failed` + `error_msg` |

---

## 3. Bug ที่พบและแก้ไขระหว่างตรวจ

### 3.1 `source` enum ไม่มีค่า `ai_search`

คอลัมน์ `content_research_keywords.source` เป็น ENUM `('seed','suggestion','related','paa','serp_title')` — ไม่มี `ai_search` ทำให้ MariaDB (non-strict mode) coerce ค่า `ai_search` เป็น `''` (empty string) ตอน insert

**แก้:** migration `database/migrations/2026_09_02_120000_add_ai_search_source_enum.sql`

```sql
ALTER TABLE `content_research_keywords`
  MODIFY COLUMN `source` enum('seed','suggestion','related','paa','serp_title','ai_search') DEFAULT NULL;
```

ผลหลัง fix: re-fetch ได้ `source` เป็น `ai_search` ถูกต้อง 4 ตัว

---

## 4. Blocker ที่ต้องตัดสินใจภายนอก

### 4.1 Writing AI (kilo.ai) หมดเครดิต — analyze ไม่สามารถจบได้

ชั้น `analyze` ใช้ `ai_research_chat()` → Writing AI (`ai_content_text_model_id`) ซึ่งยังชี้ `google/gemini-3.5-flash` บน `provider-kilo` ที่เครดิตติดลบ (ตรงกับที่ spike พบ) — ผลคือ:

```
วิเคราะห์ Research ไม่สำเร็จ: AI provider error: Add credits to continue, or switch to a free model
```

**ผลกระทบ:** FETCH (ค้นเว็บผ่าน AI) ทำงานครบ แต่ ANALYZE → generate-article ยังทำต่อไม่ได้จนกว่า:
1. เติมเครดิต kilo.ai, หรือ
2. สลับ `ai_content_text_model_id` ไป provider/model ที่มีเครดิต (เช่น provider-openrouter)

**นี่ไม่ใช่ bug ของโค้ด adapter/dispatch — เป็นสถานะ credential ของ Writing AI**

---

## 5. ระดับ content flow + SEO (3.x)

generate-article ด้วย `research_job_id` ยังไม่ถูกยิงจริง เพราะต้องผ่าน analyze (Writing AI) ที่ถูก block ใน §4 — ถือเป็น **blocked by Writing AI credit** ไม่ใช่ fail

- SEO gate / checklist / `seo_evaluate()` — ไม่ถูกแตะ (out of scope ตั้งแต่แผน) ไม่ถอยหลัง

---

## 6. ระดับ UI + code quality

| ข้อ | ผล |
|---|---|
| provider `ai` ใน settings (แสดง/ซ่อนฟิลด์, ปุ่มทดสอบ) | ✅ ผ่าน — `ResearchProviderForm.test.tsx` 6 tests (รวม AI 2 ตัว) |
| `pnpm lint` | ✅ ไม่มี error |
| `pnpm build` | ✅ ผ่าน (warning circular chunk เดิม) |
| `pnpm test` | ✅ 85/85 tests |
| PHP syntax (`content-research.php`, `keyword-research.php`, `brand-content.php`) | ✅ ไม่มี syntax error |

---

## 7. บทสรุป

**ชั้น FETCH (provider `ai`) พร้อมใช้งานแล้ว** — test/fetch/cache/tenant-isolation/metric-NULL/source ผ่านครบ และแก้ enum bug ที่พบระหว่างตรวจ

**ชั้น ANALYZE → generate ยังรอปลดล็อก** — ไม่ใช่จากโค้ด แต่จาก Writing AI (kilo.ai) หมดเครดิต ซึ่งเป็น decision ของเจ้าของระบบ (เติมเครดิตหรือสลับ model) ตามที่ spike เคยบันทึกไว้แล้ว
