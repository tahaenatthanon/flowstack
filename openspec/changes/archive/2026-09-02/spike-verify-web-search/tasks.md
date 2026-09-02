## 1. Verification Harness

- [x] 1.1 สร้าง `scripts/spike-verify-web-search.php` แบบ CLI ที่ require `api/config.php` + `api/lib/ai-creds.php` เพื่อ reuse `resolveAICreds()`
- [x] 1.2 เพิ่มฟังก์ชันยิง gateway `/chat/completions` แบบ OpenAI-compatible พร้อม timeout 60s และบันทึก raw response ทุกรอบ
- [x] 1.3 เพิ่ม helper ตรวจ citation (นับ URL, host, เช็ค HTTP HEAD ตัวอย่าง URL ต้นทาง 1–2 ตัว)

## 2. Verify Model String

> รอบแรกยิงผ่าน kilo.ai ได้ HTTP 402 ทั้งคู่ (เครดิตติดลบ) — เจ้าของระบบตัดสินใจเปลี่ยนเป็น **OpenRouter เป็น provider ตัวจริง** ผลด้านล่างคือผลบน OpenRouter

- [x] 2.1 ยิง gateway ด้วย model `perplexity/sonar` และบันทึก HTTP status + content
  - **OpenRouter: HTTP 200** (3.8s) echoed `perplexity/sonar` · content ตอบวันที่ปัจจุบันถูกต้อง "วันพุธที่ 2 กันยายน 2026" พร้อม marker `[4][6]`
  - kilo.ai (รอบแรก): HTTP 402 `{"title":"Low Credit Warning!","balance":-0.027868}` — ไม่ใช่การปฏิเสธ model string
- [x] 2.2 ยิง gateway ด้วย model `perplexity/sonar-pro-search` และบันทึก HTTP status + content
  - **OpenRouter: HTTP 200** (4.3s) echoed `perplexity/sonar-pro-search` · ตอบวันที่ถูกต้องเช่นกัน marker `[2][7]`
  - kilo.ai (รอบแรก): HTTP 402 ข้อความเดียวกัน
- [x] 2.3 เปรียบเทียบสอง string ว่า alias กันหรือคนละโมเดล (response/token/behavior ต่างไหม)
  - **คนละโมเดล ไม่ใช่ alias** — gateway echo ชื่อกลับมาคนละค่าตรงตามที่ส่งไป และ catalog คิดราคาต่างกัน:
    `perplexity/sonar` = prompt 0.000001 / completion 0.000001 / **web_search 0.005**;
    `perplexity/sonar-pro-search` = prompt 0.000003 / completion 0.000015 / **web_search 0.018** (แพงกว่า 3.6 เท่า)
  - prompt/completion token เท่ากันพอดี (30/39) กับ probe เดียวกัน — คุณภาพต่างต้องวัดด้วยงานจริง ไม่ใช่ probe สั้น
- [x] 2.4 สรุป string ที่ gateway รับได้จริงเป็นค่าคงที่ model ของ Research AI
  - **ค่าคงที่ = `perplexity/sonar`** — รับได้จริง (HTTP 200), ค้นเว็บจริง, และถูกกว่า `sonar-pro-search` 3.6 เท่าที่ชั้น web_search ซึ่งเป็นต้นทุนหลักของ Research

## 3. Verify Real Web Search

- [x] 3.1 ยิง query ผูกเวลาปัจจุบัน (`date('Y-m-d')`) เช่น "ข่าว tech ไทย 3 อันใน 24 ชม.ล่าสุด พร้อม URL ต้นทาง"
  - HTTP 200 (5.8s) — **13 URL / 6 host** จาก sanook, dailynews, thairath, bbc, line today, google news
- [x] 3.2 ตรวจ response มี citation/URL ปัจจุบันไหม และ URL ไม่ stale/ไม่ปลอม (ตามข้อ 1.3)
  - **probe HEAD ผ่าน HTTP 200 ทั้งสองตัวที่สุ่มตรวจ** (`sanook.com/hot/hitech/`, `news.google.com/topics/...`) — ไม่ใช่ URL ปลอม
  - หลักฐานเวลาที่แข็งที่สุดอยู่ที่ข้อ 4.1 payload A: ข่าวลงวันที่ **"1 กันยายน 2569 เวลา 14:17 น."** (เมื่อวาน) และ **"30 สิงหาคม 2569 เวลา 16:32 น."** — LLM knowledge ตอบแบบนี้ไม่ได้
  - **สำคัญต่อ Phase 2:** OpenRouter คืน citation ที่ **`choices[0].message.annotations[].url_citation.url`** ไม่ใช่ top-level `citations[]` (ตรวจแล้ว `citations[]` และ `search_results[]` เป็น 0 ทุกรอบ) — adapter ต้องอ่าน field นี้
- [x] 3.3 ยิง control query ที่ LLM knowledge ตอบได้โดยไม่ต้อง search เพื่อแยก "search เปิด" vs "ปิด"
  - ถาม "น้ำเดือดกี่องศา" → ยังได้ **9 URL / 8 host** (wikipedia, pantip, reddit, chemistrytalk) → **search เป็น always-on ปิดไม่ได้**
- [x] 3.4 สรุปว่า search เปิดจริงหรือไม่ พร้อมตัวอย่าง citation
  - **เปิดจริง** — ยืนยันด้วย 3 หลักฐานอิสระ: วันที่ปัจจุบันถูกต้อง, ข่าวลงวันที่เมื่อวานพร้อมเวลา, URL ต้นทาง probe ผ่าน 200

## 4. Verify Mandatory Search Params

- [x] 4.1 ยิง payload matrix: ไม่มี param, `web_search_options`, `search_recency_filter`, และ prompt-only instruction
  - A ไม่มี param → 200, **11 URL / 8 host** · B `web_search_options.search_context_size=medium` → 200, **16 URL / 15 host** · C `search_recency_filter=day` → **timeout 60s รอบแรก แต่ retry ผ่าน 200 ใน 7s (transient ไม่ใช่ผลของ param)** · D prompt-only → 200, **9 URL / 8 host**
- [x] 4.2 บันทึกว่า param ตัวไหนทำให้เกิด citation จริง และ payload ขั้นต่ำที่ทำให้ search ได้ผลน่าเชื่อถือ
  - **ทุก payload มี citation รวมทั้ง A ที่ไม่ส่ง param อะไรเลย** → ไม่มี param ตัวไหนเป็น "ตัวเปิด" search
  - `web_search_options.search_context_size=medium` เพิ่มแหล่งจาก 8 → 15 host (กว้างขึ้น แต่ไม่ใช่เงื่อนไขให้ search ทำงาน)
  - **payload ขั้นต่ำ = `{model, messages, stream:false, max_tokens}`** เท่านั้น
- [x] 4.3 สรุป param บังคับ search (หรือสรุปว่าไม่ต้องส่ง param พิเศษ)
  - **ไม่ต้องส่ง param บังคับ search** — ตรงกับ spec scenario "No extra parameter is required" search ผูกกับ model string ล้วน ๆ

## 5. Verify Credential Path

- [x] 5.1 ยืนยัน key จาก `ai_providers` (provider-kilo) ใช้กับ sonar สำเร็จผ่าน `resolveAICreds()`
  - **provider-openrouter: HTTP 200** — `decryptApiKey()` ถอด key ได้ (len=73, `sk-or-v1-...`) แล้วยิง `perplexity/sonar` สำเร็จ
  - provider-kilo: key ถอดได้และ gateway เข้าถึงได้ (`kilo-auto/free` → 200) แต่ sonar ติด 402 เครดิต
- [x] 5.2 ยืนยัน fallback `KILO_API_TOKEN` ใช้กับ sonar สำเร็จเมื่อไม่มี key ใน DB
  - **env fallback ผ่าน: HTTP 200** ทดสอบด้วย `SPIKE_API_KEY=<key>` → ยิง sonar สำเร็จ
  - หมายเหตุ: `KILO_API_TOKEN` เป็น fallback ของสาย kilo โดยเฉพาะ เมื่อย้ายมา OpenRouter path นี้เปลี่ยนเป็น env key ของ provider นั้น
- [x] 5.3 บันทึก path ที่ Research AI ใช้ resolve key (DB → env fallback)
  - บันทึกใน `docs/ai-research-web-search-verification.md` — ยืนยันทั้งสองขาแล้ว (DB 200 / env 200)

## 6. Conclusion & Constants

- [x] 6.1 เขียนข้อสรุป "ผ่าน / ต้องเปลี่ยน gateway-provider" พร้อมค่าคงที่ (model string + base_url + resolve path + param) ลง `docs/ai-research-web-search-verification.md`
  - **ข้อสรุป: ผ่าน** (แต่ต้องเปลี่ยน provider จาก kilo.ai → OpenRouter ตามการตัดสินใจของเจ้าของระบบ)
  - ค่าคงที่ครบใน §1 ของเอกสาร: `base_url=https://openrouter.ai/api/v1` · `model=perplexity/sonar` · resolve = `ai_providers[provider-openrouter]` → `decryptApiKey()` → env fallback · **ไม่มี param บังคับ search**
  - บันทึกกับดักสำคัญของ Phase 2 ไว้ด้วย: citation อยู่ที่ `choices[0].message.annotations[].url_citation.url` ไม่ใช่ `citations[]`
- [x] 6.2 แนบตัวอย่าง citation จริง (URL + วันที่) เป็นหลักฐาน
  - §5 ของเอกสาร — ข่าวลงวันที่ **"1 กันยายน 2569 เวลา 14:17 น."** (TH-AI Passport / ป.ป.ช.) และ **"30 สิงหาคม 2569 เวลา 16:32 น."** (AIS Transformative Infinite SMEs) จาก `dailynews.co.th`
  - probe HEAD ผ่าน **HTTP 200** ทั้ง 3 URL (`sanook.com/hot/hitech/`, `news.google.com/topics/...`, `techmovement.co.th/news`)
- [x] 6.3 ตรวจ PHP syntax ของสคริปต์ spike (`php -l`) ก่อนปิด task
  - `/c/xampp/php/php.exe -l scripts/spike-verify-web-search.php` → **No syntax errors detected**
