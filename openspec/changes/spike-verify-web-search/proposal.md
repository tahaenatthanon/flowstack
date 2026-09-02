## Why

ชั้น FETCH ของ Content Research จะถูกเปลี่ยนจาก DataForSEO ไปใช้ AI web search (Perplexity/Sonar) แต่โค้ดเดิมที่อ้าง web search อยู่แล้วล้วน**ไม่เคย verify** ว่าค้นเว็บจริง — `company-lookup.php` hardcode `perplexity/sonar` โดยไม่รู้ว่า gateway รับ string นี้ไหม, `company-enrich.php` ใช้ `ai_chat_model_id`, และ `leads.php` ใช้ heuristic `str_contains($model, 'sonar')` มาติด label แบบเดา Q3 ของ discussion ล็อกว่า Research ต้องใช้ **real web search** ห้ามใช้ LLM knowledge แทน — จึงต้องพิสูจน์ก่อนเริ่ม Phase 2–3

**อัปเดต 2026-09-02 — เปลี่ยน gateway เป็น OpenRouter:** รอบแรกยิงผ่าน kilo.ai แล้วได้ **HTTP 402** ทั้ง `perplexity/sonar` และ `perplexity/sonar-pro-search` (`{"title":"Low Credit Warning!","balance":-0.027868}`) ตรวจแยกสาเหตุแล้วยืนยันว่า**ไม่ใช่ปัญหา key หรือ model string** — `kilo-auto/free` ผ่าน `resolveAICreds()` ได้ HTTP 200 และ `GET /models` (365 รายการ) มีทั้งสอง string อยู่จริง ปัญหาคือเครดิตติดลบล้วน ๆ และ**ไม่มีโมเดลฟรีตัวใดบน kilo ค้นเว็บได้** (ทุกตัว `:free` มี `web_search: "0"`) จึงทำ spike ต่อบน kilo ไม่ได้ เจ้าของระบบตัดสินใจให้ **OpenRouter เป็น provider ตัวจริงของ Research AI** (ไม่ใช่แค่ทางทดสอบชั่วคราว) — `ai_providers[provider-openrouter]` มีโมเดลสาย sonar ครบ 5 ตัวและเป็น OpenAI-compatible เหมือนกัน

## What Changes

- ยืนยัน model string ที่ **OpenRouter** รับได้จริง (`perplexity/sonar` vs `perplexity/sonar-pro-search`) และบันทึก string ที่ใช้เป็นค่าคงที่ของ Research AI
- ยืนยันว่า gateway คืน **real web search** จริง (citation/URL ปัจจุบัน) ไม่ใช่ LLM ตอบจาก knowledge เดิม
- ระบุ payload/params ที่จำเป็นเพื่อบังคับให้เปิด web search (ถ้ามี)
- ยืนยัน credential path ของ **provider-openrouter** (`ai_providers` → env fallback) ใช้กับ sonar ได้จริง
- บันทึกผลเป็นข้อสรุป "ผ่าน" หรือ "ต้องเปลี่ยน gateway/provider" เพื่อเป็น gate ของ Phase 2–3
- **ไม่มีการแก้ไขโค้ด production** — เป็น spike ตรวจสอบและบันทึกข้อสรุป/ค่าคงที่เท่านั้น

## Capabilities

### New Capabilities
- `ai-research-web-search`: ข้อกำหนดว่า Research AI (ชั้น FETCH, `provider='ai'`) ต้องใช้โมเดลที่ผ่านการยืนยันว่าค้นเว็บจริง มี model string, base_url, credential resolve path และ param บังคับ search ที่ชัดเจน เพื่อเป็น contract ให้ Phase 2–3 นำไปใช้

### Modified Capabilities
<!-- ไม่มี requirement เดิมถูกเปลี่ยนใน spike นี้ -->

## Impact

- อ่าน/อ้างอิง (ไม่แก้): `api/lib/ai-creds.php` (`resolveAICreds()`), `api/company-lookup.php`, `api/company-enrich.php`, `api/leads.php`, `api/config.php` (KILO_* constants)
- เพิ่มสคริปต์ spike ชั่วคราวใน `scripts/` สำหรับยิง gateway และตรวจ citation (ลบได้หลังสรุป)
- ผลลัพธ์เป็นค่าคงที่ + ข้อสรุปที่ Phase `02-ai-research-adapter` และ `03-research-api-dispatch` จะใช้
- ไม่กระทบ schema, ไม่กระทบ endpoint production, ไม่กระทบ frontend
- **ตกไปให้ Phase 2 (นอกขอบเขต spike นี้):** `company_settings` ยังชี้ `ai_active_provider_id=provider-kilo` และ `ai_content_text_model_id=google/gemini-3.5-flash` อยู่ spike นี้ไม่แตะตามเงื่อนไข "อ่านอย่างเดียว" — Phase 2 ต้องตัดสินว่าจะสลับ setting ทั้งระบบ หรือให้ Research AI ถือ provider/model ของตัวเองแยกจาก content generation

> **หมายเหตุ (แก้ 2026-09-02):** ระหว่างทางเคยบันทึกว่า `ai_providers[provider-openrouter].api_key_encrypted` ถอดรหัสไม่ออก — **ตกไปแล้ว** หลังเจ้าของระบบบันทึกคีย์ใหม่ `decryptApiKey()` ถอดได้ปกติ (len=73, `sk-or-v1-...`) และยิง sonar ผ่าน HTTP 200 ขา DB จึงไม่ใช่ blocker ของ Phase 2

