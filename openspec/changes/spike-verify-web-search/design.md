## Context

ชั้น FETCH ของ Content Research จะเปลี่ยนเป็น `provider='ai'` (Perplexity/Sonar ผ่าน gateway ที่ OpenAI-compatible, endpoint `/chat/completions`) Q3 ล็อกว่า Research ต้องใช้ **real web search** ห้าม LLM เดาแทน search

**Gateway ปัจจุบัน: OpenRouter** (`https://openrouter.ai/api/v1`) — เปลี่ยนจาก kilo.ai เมื่อ 2026-09-02 หลังพบว่า kilo.ai ตอบ HTTP 402 (เครดิตติดลบ) กับทุกโมเดลสาย sonar และไม่มีโมเดลฟรีตัวใดค้นเว็บได้ ดูหลักฐานใน D5

โค้ดเดิมที่มี web search อยู่แล้วล้วนไม่ verify:

| ไฟล์ | ปัญหา |
|---|---|
| `company-lookup.php` | hardcode `perplexity/sonar` — ไม่รู้ว่า gateway รับ string นี้ไหม |
| `company-enrich.php` | ใช้ `ai_chat_model_id` / `kilo-auto/free` — ไม่รู้ว่าค้นจริงไหม |
| `leads.php` | `str_contains($model, 'sonar')` มาติด label — เดา ไม่ใช่หลักฐาน |
| `api/lib/ai-creds.php` | `resolveAICreds()` default model `openai/gpt-4o-mini` — ไม่ใช่ search model |

ใน `ai_models` มีสาย sonar ใต้ `provider-openrouter` ครบ 5 ตัว (`sonar`, `sonar-pro`, `sonar-pro-search`, `sonar-reasoning-pro`, `sonar-deep-research`) ส่วนใต้ `provider-kilo` มี 5 ตัวเช่นกัน — ทั้งสอง provider จึงรองรับ string ชุดเดียวกัน

## Goals / Non-Goals

**Goals:**
- ยืนยันว่า gateway รับ model string ตัวใดได้จริง (`perplexity/sonar` vs `perplexity/sonar-pro-search`) และ response ต่างกันไหม
- ยืนยันว่า response มีหลักฐาน real web search (citation/URL ปัจจุบัน ผูกกับเวลาปัจจุบัน) ไม่ใช่ LLM ตอบจาก knowledge
- ระบุ param ที่จำเป็นเพื่อบังคับ web search (ถ้ามี)
- ยืนยัน credential resolve path เดิมใช้กับ sonar ได้จริง
- ผลิตค่าคงที่ + ข้อสรุป "ผ่าน/ไม่ผ่าน" เป็น gate ของ Phase 2–3

**Non-Goals:**
- ไม่แก้ไข production code (adapter/dispatch/settings อยู่ใน Phase 2–4)
- ไม่สร้าง schema, ไม่แตะ frontend
- ไม่ประเมินคุณภาพ SEO brief — แค่ยืนยัน "search จริง"

## Decisions

### D1: ใช้สคริปต์ spike แยก (ไม่แตะ endpoint)
เขียน `scripts/spike-verify-web-search.php` แบบ CLI ที่ require `api/config.php` + `api/lib/ai-creds.php` เพื่อ reuse `resolveAICreds()` แล้วยิง gateway โดยตรง 3 รอบ: (a) `perplexity/sonar`, (b) `perplexity/sonar-pro-search`, (c) env token fallback path
- **Alternative**: ยิงผ่าน `curl` ด้วยมือ — ตัด แต่ reproduce ยาก, ต้อง resolve key เองซ้ำ
- **Rationale**: reuse logic เดิมที่ Phase 2 จะใช้จริง ลดความเสี่ยง "spike ผ่าน แต่ production พัง"
- **เพิ่มระหว่างทาง**: flag `--provider=<id>` ให้อ่าน `base_url` จาก `ai_providers` แถวนั้นตรง ๆ ได้ — จำเป็นตอนสลับมา OpenRouter เพราะ `resolveAICreds()` เลือก provider จาก `company_settings` และ spike ห้ามเขียน DB

### D2: ตรวจจับ real web search ด้วย query ผูกเวลาปัจจุบัน + ตรวจ citation
ใช้ prompt ที่ผูกกับ `date('Y-m-d')` เช่น "ข่าว tech ไทย 3 อันใน 24 ชม.ล่าสุด พร้อม URL ต้นทางของแต่ละข่าว" แล้วตรวจ response ว่า
- มี `citation` / URL จริงไหม (นับจำนวน URL, ตรวจ host ว่าไม่ใช่ hallucination)
- URL ชี้ไปหน้าปัจจุบัน (ไม่ stale หลายเดือน)
- เปรียบเทียบกับ control: ถามเรื่องที่ LLM knowledge ตอบได้โดยไม่ต้อง search แล้วดูว่ายังมี citation ไหม (แยก "search เปิด" vs "ปิด")
- **Rationale**: citation/URL ปัจจุบันคือสัญญาณที่ falsifiable ได้ ต่างจาก `str_contains($model,'sonar')`

### D3: ทดสอบ param บังคับ search แบบ matrix
ยิงหลาย payload เทียบผล: ไม่มี param ใดเลย, `web_search_options` / `search_recency_filter`, และ prompt-only instruction ("search the web") แล้วบันทึกว่า param ไหนทำให้เกิด citation จริง
- **Rationale**: gateway บางตัวเปิด search ตาม model string หรือตาม param เงื่อนไขเดียว — ต้องแยกให้ออกว่าตัวแปรไหนเป็นตัวเปิด

### D4: บันทึกผลเป็นไฟล์ข้อสรุป (ไม่ใช่แค่ stdout)
เขียนข้อสรุปลง `docs/ai-research-web-search-verification.md` พร้อมตัวอย่าง citation จริง (URL + วันที่) และค่าคงที่ที่ Phase 2–3 จะใช้ (model string + base_url + resolve path + param)
- **Rationale**: Phase 2–3 อ้างค่าคงที่จากไฟล์เดียว ไม่ต้องกลับมาอ่าน log

### D5: เปลี่ยน gateway จาก kilo.ai → OpenRouter (ตัดสินใจ 2026-09-02)
kilo.ai คืน **HTTP 402** (`{"title":"Low Credit Warning!","balance":-0.027868}`) กับทั้ง `perplexity/sonar` และ `perplexity/sonar-pro-search` แยกสาเหตุแล้วยืนยันว่าไม่ใช่ปัญหา key หรือ model string — `kilo-auto/free` ผ่าน `resolveAICreds()` ได้ 200 และ `GET /models` (365 รายการ) มีทั้งสอง string อยู่จริง เป็นเครดิตติดลบล้วน ๆ

- **Alternative A: เติมเครดิต kilo แล้วทำ spike ต่อ** — ตัด เจ้าของระบบเลือกย้าย provider
- **Alternative B: ใช้โมเดลฟรีของ kilo ทำ spike** — **ทำไม่ได้** ทุกโมเดล `:free` มี `web_search: "0"` คือไม่ค้นเว็บ จึงพิสูจน์ web search ไม่ได้เลย
- **Decision**: OpenRouter (`https://openrouter.ai/api/v1`) เป็น **provider ตัวจริงของ Research AI** ไม่ใช่ทางทดสอบชั่วคราว — OpenAI-compatible เหมือนกัน และมีสาย sonar ครบ 5 ตัวใต้ `provider-openrouter` อยู่แล้ว
- **ผลต่อ spike**: ผลทั้งหมดในส่วน 2–5 ของ `tasks.md` คือผลบน OpenRouter ส่วนผล 402 ของ kilo เก็บไว้เป็นหลักฐานว่าทำไมถึงเปลี่ยน

### D6: อ่าน citation จาก `annotations[]` ไม่ใช่ `citations[]` (ค้นพบระหว่าง spike)
OpenRouter คืน citation ที่ `choices[0].message.annotations[].url_citation.url` ส่วน top-level `citations[]` และ `search_results[]` เป็น **array ว่างทุกรอบ** ต่างจาก Perplexity API ตรงที่ใช้ `citations[]`
- **Rationale**: ถ้า adapter ของ Phase 2 อ่าน `$data['citations']` ตามสัญชาตญาณ จะได้ 0 แหล่งทุกครั้งทั้งที่ search ทำงานปกติ — เป็น false negative ที่ debug ยากมากเพราะ HTTP ยัง 200 และ content ยังมีเนื้อหาถูกต้อง
- **ข้อควรระวัง**: field นี้ผูกกับ gateway ไม่ใช่ model — ถ้าอนาคตเปลี่ยน provider อีก ต้องตรวจซ้ำ

## Risks / Trade-offs

> ผลจริงหลังรัน spike (2026-09-02) กำกับไว้ท้ายแต่ละข้อ

- **[Gateway รับ `perplexity/sonar` ไม่ได้หรือ search ไม่เปิด]** → ลอง `perplexity/sonar-pro-search`; ถ้ายังไม่มี citation ให้สรุป "ต้องเปลี่ยน gateway/provider" และหยุด Phase 2 ก่อนเขียนโค้ด
  - **เกิดขึ้นจริงกับ kilo.ai** (402 ทั้งคู่) → ใช้ทางออกที่วางไว้จริง คือเปลี่ยน provider ดู D5
- **[Citation เป็น hallucination (URL ปลอม)]** → ตรวจ host + พยายาม HTTP HEAD ที่ URL ต้นทาง 1–2 ตัว; ถ้า 404 ให้ถือว่าไม่ผ่าน
  - **ไม่เกิด** — probe ผ่าน 200 ทั้ง 3 URL ที่สุ่มตรวจ
- **[LLM ตอบ stale จาก knowledge แต่แต่ง URL ขึ้นมา]** → query ผูกเวลาปัจจุบันบังคับ; ถ้าเนื้อหาขัดกับเวลาปัจจุบัน = ไม่ผ่าน
  - **ไม่เกิด** — ตอบวันที่ปัจจุบันถูก และอ้างข่าวลงวันที่เมื่อวานพร้อมเวลาระดับนาที
- **[env token หมด/ไม่มีใน .env ของเครื่อง dev]** → script ต้อง fallback ไป `ai_providers` ใน DB และรายงานทั้งสอง path อย่างชัดเจน
  - **ผ่านทั้งสองขา** (DB 200 / env 200)
- **[Rate limit / timeout ตอนยิง matrix]** → ใช้ timeout 60s ต่อ call, หน่วงระหว่าง call, บันทึก raw response ทุกรอบเพื่อ debug
  - **เกิดจริง 1 ครั้ง** — payload C timeout ที่ 60s แล้ว retry ผ่านใน 7s ถ้าไม่มี raw log จะสรุปผิดว่า `search_recency_filter` พัง
- **[ค่า `web_search` เก็บทุก call แม้ไม่ต้องค้น]** (พบระหว่าง spike ไม่ได้คาดไว้) → sonar ปิด search ไม่ได้ ทุก call จ่าย $0.005 → Phase 2 ต้องใช้ sonar เฉพาะชั้น FETCH ห้ามใช้เป็นโมเดลอเนกประสงค์

## Migration Plan

ไม่มีการ deploy / rollback — spike อ่านอย่างเดียว + เพิ่มสคริปต์ชั่วคราวใน `scripts/` หลังสรุปแล้วจะเก็บสคริปต์ไว้เป็นหลักฐานหรือลบทิ้งตามข้อสรุป (Phase 2 จะย้ายค่าคงที่เข้า production ต่างหาก)

## Open Questions

> ตอบครบแล้วจาก spike (2026-09-02) — รายละเอียดใน `docs/ai-research-web-search-verification.md`

- ~~gateway ใช้ param ชื่ออะไรในการบังคับ search~~ → **ไม่ต้องใช้ param เลย** search ผูกกับ model string ล้วน ๆ payload ที่ไม่ส่ง param อะไรเลยก็ได้ citation 11 URL / 8 host
- ~~`perplexity/sonar-pro-search` กับ `perplexity/sonar` เป็น alias กันหรือคนละโมเดล~~ → **คนละโมเดล** gateway echo ชื่อกลับคนละค่า และคิดราคา `web_search` ต่างกัน 3.6 เท่า (0.005 vs 0.018)

**คำถามใหม่ที่ตกไปให้ Phase 2:**
- `company_settings` ยังชี้ `ai_active_provider_id=provider-kilo` อยู่ — Research AI จะสลับ setting ทั้งระบบ หรือถือ provider/model ของตัวเองแยกจาก content generation?
- `sonar-pro-search` ให้ brief ดีกว่าคุ้มค่าราคา 3.6 เท่าไหม — ต้องวัดด้วยงานจริง spike นี้ไม่ตอบ (อยู่ใน Non-Goals)
