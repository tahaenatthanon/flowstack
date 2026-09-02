# การยืนยัน Web Search ของ Research AI

**สถานะ: ✅ ผ่าน — Phase 2–3 เริ่มได้**

| | |
|---|---|
| วันที่ยืนยัน | 2026-09-02 (Asia/Bangkok) |
| Change | `openspec/changes/spike-verify-web-search` |
| สคริปต์ | `scripts/spike-verify-web-search.php` |
| raw response | `<temp>/flowstack-spike-web-search/` (11 ไฟล์) |

---

## 1. ค่าคงที่สำหรับ Phase 2–3

ใช้ค่าเหล่านี้ได้เลย ไม่ต้องเดา ทุกค่าผ่านการยิงจริงแล้ว

| ค่า | value | หลักฐาน |
|---|---|---|
| **provider** | `provider-openrouter` | HTTP 200 (§4) |
| **base_url** | `https://openrouter.ai/api/v1` | จาก `ai_providers.api_base_url` |
| **endpoint** | `POST /chat/completions` (OpenAI-compatible) | HTTP 200 ทุกรอบ |
| **model** | `perplexity/sonar` | HTTP 200, echo ชื่อกลับตรง (§2) |
| **credential** | `ai_providers[provider-openrouter].api_key_encrypted` → `decryptApiKey()` | HTTP 200 (§4) |
| **credential fallback** | env key | HTTP 200 (§4) |
| **param บังคับ search** | **ไม่มี — ไม่ต้องส่ง** | §3 |
| **payload ขั้นต่ำ** | `{model, messages, stream:false, max_tokens}` | §3 payload A |
| **ตำแหน่ง citation** | `choices[0].message.annotations[].url_citation.url` | §5 ⚠️ |

### ⚠️ จุดที่พลาดง่ายที่สุด

OpenRouter **ไม่ได้** คืน citation ที่ top-level `citations[]` แบบ Perplexity API ตรง — ตรวจแล้วทั้ง `citations[]` และ `search_results[]` เป็น **0 ทุกรอบ** citation จริงอยู่ที่:

```
choices[0].message.annotations[] → { type: "url_citation", url_citation: { url, title, ... } }
```

adapter ของ Phase 2 ที่อ่าน `$data['citations']` จะได้ 0 แหล่งทุกครั้งทั้งที่ search ทำงานปกติ

---

## 2. Model string

ทั้งสอง string ที่โค้ดเดิมใช้ปนกันอยู่ **ใช้ได้จริงทั้งคู่ และเป็นคนละโมเดล ไม่ใช่ alias**

| model | HTTP | echoed model | prompt | completion | **web_search** |
|---|---|---|---|---|---|
| `perplexity/sonar` | 200 (3.8s) | `perplexity/sonar` | 0.000001 | 0.000001 | **0.005** |
| `perplexity/sonar-pro-search` | 200 (4.3s) | `perplexity/sonar-pro-search` | 0.000003 | 0.000015 | **0.018** |

**เลือก `perplexity/sonar`** — ค้นเว็บได้เท่ากันในการทดสอบนี้ แต่ถูกกว่า 3.6 เท่าที่ชั้น `web_search` ซึ่งเป็นต้นทุนหลักของงาน Research (คิดต่อครั้งที่ค้น ไม่ใช่ต่อ token)

> ทั้งคู่ใช้ token เท่ากันพอดี (30 prompt / 39 completion) กับ probe สั้น — **ยังไม่ได้วัดคุณภาพ** ถ้า Phase 2 พบว่า brief ตื้นไป ค่อยลอง `sonar-pro-search` แล้ววัดเทียบด้วยงานจริง

ผลพลอยได้: `api/company-lookup.php:48` ที่ hardcode `perplexity/sonar` ใช้ string ที่ถูกต้อง — ข้อกังวลเดิมตกไป

---

## 3. Param บังคับ search — ไม่มี

| payload | HTTP | URL | host |
|---|---|---|---|
| **A** ไม่ส่ง param อะไรเลย | 200 | 11 | 8 |
| **B** `web_search_options.search_context_size=medium` | 200 | **16** | **15** |
| **C** `search_recency_filter=day` | 200 ¹ | 8 | — |
| **D** prompt-only "You MUST search the web" | 200 | 9 | 8 |

¹ รอบแรก timeout ที่ 60s — retry ผ่านใน 7s **เป็น transient ไม่ใช่ผลของ param** (ยืนยันด้วยการยิงซ้ำทั้ง `day` และ `week`)

**ทุก payload มี citation รวมทั้ง A ที่ไม่ส่งอะไรเลย** → ไม่มี param ตัวไหนเป็นตัวเปิด search web search ผูกกับ model string ล้วน ๆ

`web_search_options.search_context_size` ไม่ใช่สวิตช์เปิด/ปิด แต่**เพิ่มความกว้างของแหล่ง** (8 → 15 host) — ถ้า Phase 2 ต้องการ brief ที่อ้างอิงกว้างขึ้น ใช้ตัวนี้ได้ แต่ต้องรู้ว่าจ่ายเพิ่ม

---

## 4. Credential path — ผ่านทั้งสองขา

```
resolveAICreds()  →  ai_providers[provider-openrouter].api_key_encrypted
                     └→ decryptApiKey()  →  sk-or-v1-… (len=73)   ✅ HTTP 200
                  →  env fallback (SPIKE_API_KEY / OPENROUTER_API_KEY)  ✅ HTTP 200
```

ตรวจ balance ล่วงหน้าได้ฟรีที่ `GET /api/v1/key` → `is_free_tier=false`, `limit=unlimited`, `usage=0` **แนะนำให้ Phase 3 เรียกก่อนยิงงานใหญ่** เพื่อไม่ให้เจอ 402 กลางคัน

---

## 5. หลักฐานว่า search ทำงานจริง

พิสูจน์ด้วยหลักฐานอิสระ 3 ชั้น — ผ่านทุกชั้น

### 5.1 รู้วันที่ปัจจุบันถูกต้อง

> "วันนี้คือ **วันพุธที่ 2 กันยายน 2026** ตามแหล่งข้อมูลบนเว็บ[4][6]"

ตรงกับวันจริง (ยืนยัน `date('l')` = Wednesday) — LLM ที่ตอบจาก knowledge บอกวันปัจจุบันไม่ได้

### 5.2 ข่าวที่มีวันที่และเวลาระดับนาที

จาก payload A (ไม่ส่ง param ใด ๆ):

> **"ปลัดดีอี" ลั่นพร้อมแจง ป.ป.ช. ปม 'TH-AI Passport' หลัง "ไอซ์ รักชนก" ยื่นสอบ**
> เผยแพร่ **1 กันยายน 2569 เวลา 14:17 น.** — https://www.dailynews.co.th/news/news_group/technology/

> **"AIS" พา "Tech SME ไทย" ทรานส์ฟอร์ม ผ่าน "Transformative Infinite SMEs 2569"**
> เผยแพร่ **30 สิงหาคม 2569 เวลา 16:32 น.** — https://www.dailynews.co.th/technology/

ข่าวแรกลงวันที่ **เมื่อวาน** ของวันที่ยืนยัน

### 5.3 URL ต้นทางเข้าถึงได้จริง ไม่ใช่ hallucination

probe ด้วย HTTP HEAD:

| URL | ผล |
|---|---|
| `https://www.sanook.com/hot/hitech/` | **200** |
| `https://news.google.com/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FuUm9HZ0pVU0NnQVAB?hl=th&ceid=TH:th` | **200** |
| `https://techmovement.co.th/news` | **200** |

host ที่พบทั้งหมดเป็นสำนักข่าวไทย/สากลจริง: `dailynews.co.th`, `thairath.co.th`, `thaipbs.or.th`, `bbc.com`, `nationthailand.com`, `techsauce.co`, `sanook.com`, `thethaiger.com`

### 5.4 Search ปิดไม่ได้ (always-on)

control query "น้ำบริสุทธิ์เดือดที่กี่องศาเซลเซียส" — คำถามที่ LLM ตอบได้เองไม่ต้องค้น — **ยังคืน 9 URL / 8 host** (wikipedia, pantip, reddit, chemistrytalk)

**ผลต่อ Phase 2–3:** ทุก call ไป `perplexity/sonar` จ่ายค่า `web_search` $0.005 เสมอ แม้เป็นงานที่ไม่ต้องค้น → **อย่าใช้ sonar เป็นโมเดลอเนกประสงค์** ใช้เฉพาะชั้น FETCH ส่วนชั้น ANALYZE/GENERATE ให้ใช้โมเดลปกติที่ไม่มีค่า search

---

## 6. ทำไมถึงเปลี่ยนจาก kilo.ai มา OpenRouter

kilo.ai ยิง sonar ไม่ได้เลย:

```json
HTTP 402  {"title":"Low Credit Warning!","message":"Add credits to continue, or switch to a free model","balance":-0.027868}
```

แยกสาเหตุแล้วยืนยันว่า **ไม่ใช่ปัญหา key และไม่ใช่ปัญหา model string**:

- `kilo-auto/free` ผ่าน `resolveAICreds()` → **HTTP 200** (key len=268 ใช้ได้, base_url ถูก)
- `GET /models` → **HTTP 200**, 365 รายการ, **มีทั้ง** `perplexity/sonar` และ `perplexity/sonar-pro-search`
- เป็นเครดิตติดลบล้วน ๆ

และ**ทำ spike แบบไม่เสียเงินบน kilo ไม่ได้** — โมเดล `:free` ทุกตัวมี `web_search: "0"` คือไม่ค้นเว็บ

เจ้าของระบบตัดสินใจ (2026-09-02) ให้ **OpenRouter เป็น provider ตัวจริงของ Research AI** ไม่ใช่ทางทดสอบชั่วคราว

---

## 7. เรื่องที่ตกไปให้ Phase 2 (นอกขอบเขต spike นี้)

1. **โมเดล sonar ใต้ `provider-openrouter` ใน `ai_models`** — มีครบ 5 ตัว (`sonar`, `sonar-pro`, `sonar-pro-search`, `sonar-reasoning-pro`, `sonar-deep-research`) ไม่ต้อง seed เพิ่ม
2. **`company_settings` ยังชี้ไป kilo อยู่** — `ai_active_provider_id=provider-kilo`, `ai_content_text_model_id=google/gemini-3.5-flash` spike นี้**ไม่แตะ** ตามเงื่อนไข "อ่านอย่างเดียว" Phase 2 ต้องตัดสินว่าจะสลับ setting หรือให้ Research มี provider/model ของตัวเองแยกจาก content generation
3. **เครดิต kilo ติดลบ** ยังค้างอยู่ กระทบฟีเจอร์อื่นที่ยังใช้ kilo (`company-lookup.php`, `company-enrich.php`, AI chat) — คนละเรื่องกับ change นี้ แต่ต้องรู้
4. **ยังไม่ได้วัดคุณภาพ brief** — spike นี้ยืนยันแค่ "search จริง" ตาม Non-Goals

---

## 8. ทำซ้ำผลนี้

```bash
/c/xampp/php/php.exe scripts/spike-verify-web-search.php all --provider=provider-openrouter
```

รันทีละส่วนได้: `1` preflight · `2` model string · `3` real web search · `4` param matrix · `5` credential path

ต้องใช้ PHP ของ XAMPP (`/c/xampp/php/php.exe`) — PHP ใน PATH (8.5.9) ไม่มี `pdo_mysql`
