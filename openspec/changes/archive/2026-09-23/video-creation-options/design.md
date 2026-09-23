## Context

change ก่อนหน้า `kie-video-adapter` (archived 2026-09-23) ทำให้สร้างวิดีโอคลิปเดียวจากฉากแรกได้จริง แต่ยังเลือกสัดส่วน/ความละเอียดตอนกดสร้างวิดีโอ ซึ่งมาหลังจากภาพประจำฉากถูกสร้างเป็น 1024×1024 ไปแล้ว (ตรวจไฟล์จริงแล้ว) change นี้คือ A1 ของ Phase 3

**สภาพโค้ดปัจจุบัน:**
- ความยาว: `normalizeVideoDuration` รับ 15/30/60/180/600, `videoDurationInstruction` บอก AI แค่ "เวลารวมใกล้เคียง N วินาที" — ใช้ทั้งใน `generate-plan` (~บรรทัด 1026, 1089) และ `generate-article` (~2746)
- สคริปต์วิดีโอสร้างใน `generate-article` เท่านั้น: ผลลัพธ์มี `scripts{platform}` (บทรายแพลตฟอร์มไว้โพสต์) และ `visuals[{visual, motion}]` ซึ่ง `_visualsToScenes` แปลงเป็น `scenes[{visual_prompt, video_prompt, shot, image_gen_status}]` — ฉากยังไม่มีความยาวหรือบทพากย์
- ภาพฉาก: `_generateOneSceneImage` แยกแค่ Kilo (`chat/completions`) กับที่เหลือ (`{baseUrl}/images/generations` + `size: 1024x1024`) — tenant หลักใช้ `openai/gpt-5-image-mini` ผ่าน OpenRouter ซึ่ง Image API ระบุว่ารองรับแค่ 1:1, 2:3, 3:2
- `generate-video` รับ `aspect_ratio`/`resolution` จาก request (เพิ่มใน `kie-video-adapter`)

**ข้อมูลที่วัดได้จริง:** ภาษาไทยพูดประมาณ 12.7 ตัวอักษร/วินาที (ทดสอบ Gemini TTS: 184 ตัวอักษร → 14.5 วินาที) → ฉาก 8 วินาทีรองรับบทประมาณ 100 ตัวอักษร

## Goals / Non-Goals

**Goals:**
- ผู้ใช้ตั้งความยาว/สัดส่วน/ความละเอียดครั้งเดียวตอนสร้างคอนเทนต์ แล้วทุกขั้นตอน (สคริปต์ → ภาพ → วิดีโอ) ใช้ค่าเดียวกัน
- สคริปต์มีจำนวนฉากและความยาวฉากที่ตรงกับคลิปวิดีโอจริง พร้อมบทพากย์รายฉาก
- วิดีโอที่ได้มีเสียงบรรยายภาษาไทยโดยไม่ต้องทำเสียงเอง

**Non-Goals:**
- ยิงหลายคลิป/ต่อคลิป (3a/3b) — ยังสร้างคลิปจากฉากแรกเท่านั้น
- TTS แยกหรือมิกซ์เสียง (ทางสำรองถ้า model พูดไทยไม่ดี — ไป 3b)
- สัดส่วน 1:1 (Veo ไม่รองรับ), เปลี่ยนสัดส่วน/ความละเอียดหลังสร้าง
- ส่งภาพสินค้าอ้างอิงเป็น `input_references` จริงของ Image API (ยังส่งเป็นข้อความใน prompt แบบเดิม)
- สร้างสคริปต์ใหม่อัตโนมัติให้คอนเทนต์เดิม (ผู้ใช้กด "AI เขียนให้" เองถ้าต้องการฉาก/บทพากย์แบบใหม่)

## Decisions

### 1. ทุกฉาก 8 วินาที ไม่ขึ้นกับ model
จำนวนฉาก = `round(duration_sec / 8)` ปัดลงเมื่อห่างเท่ากัน → 30→4 (32 วิ), 45→6 (48), 60→7 (56), 90→11 (88) เก็บเป็นฟังก์ชันเดียว (`videoSceneCount()`) ใช้ทั้งใน prompt และ UI
**ทำไม:** Veo คิดราคาต่อคลิป (4 วิ ราคาเท่า 8 วิ — ทดสอบแล้ว) และทุก model วิดีโอที่เปิดใช้ (Veo 3.1 ทุกรุ่น, Seedance 1.5 Pro) ทำ 8 วินาทีได้ สคริปต์จึงไม่พังเมื่อแอดมินเปลี่ยน model
**ทางเลือกที่ไม่เลือก:** ความยาวฉากตาม `features.video.durations` ของ model ปัจจุบัน — ใช้ประโยชน์คลิปยาวของ Seedance ได้ แต่สคริปต์ที่เขียนตอนใช้ Seedance (ฉาก 12 วิ) จะใช้กับ Veo ไม่ได้
**UI:** แสดง "≈56 วิ · 7 ฉาก" ด้วยฟังก์ชันเดียวกันฝั่ง TypeScript (ค่าคงที่ 8)

### 2. บทพากย์อยู่ใน `visuals`/`scenes` ไม่ใช่ใน `scripts`
schema ของ `visuals` ใน prompt `generate-article` เปลี่ยนเป็น `{visual, motion, narration, duration_sec}` และบังคับจำนวนฉากตามข้อ 1 — `scripts{platform}` คงไว้เป็นบทสำหรับโพสต์ตามเดิม
**ทำไม:** `visuals`/`scenes` คือรายการคลิปที่ใช้สร้างภาพและวิดีโออยู่แล้ว ผูกบทพากย์ไว้ต่อฉากทำให้ 3a ยิงหลายคลิปได้ตรงๆ ส่วน `scripts` มีหลาย platform และจำนวนฉากไม่คงที่
**ข้อกำหนดใน prompt:** ≤ 100 ตัวอักษรต่อฉาก, บทต่อกันเป็นเรื่องเดียว, ฉากสุดท้ายเป็น CTA, ภาษาไทย

### 3. ให้ Veo/Seedance พูดบทพากย์เองผ่าน prompt
`generate-video` ประกอบ prompt = `video_prompt` + (ถ้ามี `narration`) คำสั่งภาษาอังกฤษว่าให้ผู้บรรยายพูดภาษาไทย ตามด้วยบทในเครื่องหมายคำพูดตรงตัว เช่น
`{video_prompt}. A Thai narrator speaks in Thai, clearly and naturally: "{narration}"`
ใช้ฟังก์ชัน `kieVideoComposePrompt(video_prompt, narration)` ใน `api/lib/kie-video.php` เพื่อให้ 3a ใช้ต่อได้ และทดสอบได้ด้วย fixture
**ทำไม:** ผู้ใช้ต้องการเสียงพากย์โดยไม่ต้องทำเสียงเอง และไม่มีขั้นตอน/ค่าใช้จ่ายเพิ่ม ไม่ต้องใช้ ffmpeg
**ทางเลือกที่ไม่เลือกตอนนี้:** Gemini TTS + มิกซ์ด้วย ffmpeg — เสียงเดียวตลอดเรื่อง แต่ต้องมี ffmpeg (3b)
**ต้องยืนยัน:** Veo พูดภาษาไทยได้ชัดพอหรือไม่ (งานทดสอบข้อแรก)

### 4. สัดส่วน/ความละเอียดเป็นคอลัมน์ของ content item และล็อก
คอลัมน์ `video_aspect_ratio VARCHAR(8) NULL`, `video_resolution VARCHAR(8) NULL` — บันทึกใน `generate-plan` ตอน INSERT, ไม่รับใน PUT ของ `content-items.php`, ส่งกลับใน list/detail และเพิ่มใน type `ContentItem`/`PlanItem` + ตัวแปลง `asPlanItem` / `ContentDetailView`
**ทำไม VARCHAR ไม่ใช่ ENUM:** เพิ่มค่าใหม่ (เช่น 1:1 ใน 3b) ได้โดยไม่ต้อง ALTER ENUM — validate ที่ PHP ด้วย `kieVideoNormalizeAspect/Resolution` ที่มีอยู่แล้ว
**ทำไมล็อก:** ภาพประจำฉากและองค์ประกอบในสคริปต์ขึ้นกับสัดส่วน เปลี่ยนทีหลังทำให้ข้อมูลไม่สอดคล้อง (ตามที่ผู้ใช้ตัดสินใจ)

### 5. ภาพฉาก: OpenRouter ใช้ Image API, Kilo บอกใน prompt
แยก 3 ทางใน `_generateOneSceneImage` โดยดูจาก `baseUrl`:
- มี `openrouter` → `POST {baseUrl}/images` `{model, prompt, aspect_ratio, n: 1}` อ่าน `data[0].b64_json` → `data:` URI → `_saveImageUrl()` เดิม (รองรับ base64 อยู่แล้ว)
- มี `kilo` → `chat/completions` เดิม + เติม "vertical 9:16 portrait composition" / "horizontal 16:9 landscape composition" ใน prompt
- อื่นๆ → `/images/generations` เดิม ส่ง `size` ตามสัดส่วน (`1024x1536` / `1536x1024`)
ส่ง `$aspectRatio` เป็นพารามิเตอร์ใหม่ของ `_generateOneSceneImage` จาก `generate-scene-images` และ `generate-scene-image`
**ทำไม Image API:** เป็น endpoint มาตรฐานของ OpenRouter ที่รับ `aspect_ratio` เหมือนกันทุก model — เปลี่ยน model ภาพในหน้าตั้งค่าได้โดยไม่แก้โค้ด
**model ที่แนะนำ:** `google/gemini-2.5-flash-image` (Nano Banana, ~$0.04/ภาพ) มีในตาราง `ai_models` อยู่แล้ว — การเปลี่ยน model เป็นการตั้งค่าของแอดมิน ไม่อยู่ใน migration
**ไม่ครอป:** ครอปภาพจัตุรัสเป็น 9:16 เสียภาพเกือบครึ่ง ถ้า model คืนภาพผิดสัดส่วน Veo ปรับเองได้ (ทดสอบแล้วใน `kie-video-adapter`)

### 6. Migration แปลงค่าเดิม
ไฟล์เดียว: `ADD COLUMN` สองคอลัมน์ (idempotent ผ่าน `information_schema`), `UPDATE duration_sec` 15→30, 180/600→90 (เฉพาะ `type='video'`), ตั้ง `9:16`/`720p` ให้วิดีโอเดิมที่เป็น NULL

## Risks / Trade-offs

- [Veo/Seedance พูดภาษาไทยไม่ชัดหรือพูดเป็นภาษาอื่น] → ทดสอบเป็นงานข้อแรก (Veo Lite 720p ≈ 30 credit) ถ้าไม่ผ่าน: ยังเก็บ `narration` ไว้ (มีประโยชน์เป็นบทพูด) ปิดการเติมบทใน prompt ด้วยการแก้ `kieVideoComposePrompt` และย้ายไปใช้ TTS ใน 3b
- [เสียงผู้บรรยายเปลี่ยนไปทุกคลิปใน 3a] → ไม่กระทบ A1 (คลิปเดียว) บันทึกไว้เป็นข้อพิจารณาของ 3a
- [AI เขียนบทพากย์ยาวเกิน 100 ตัวอักษร / จำนวนฉากไม่ตรง] → ไม่ตัดข้อความ แสดงคำเตือนใน scene card; ถ้าจำนวนฉากไม่ตรงให้ใช้ตามที่ได้ (ไม่ retry อัตโนมัติ) และ log ไว้
- [model ภาพเดิม `gpt-5-image-mini` ไม่รองรับ 9:16 บน Image API → สร้างภาพล้มเหลวทุกฉาก] → spec กำหนดให้ error อ่านรู้เรื่อง, อัปเดตคำแนะนำในหน้าตั้งค่า และแจ้งแอดมินให้เปลี่ยนเป็น Nano Banana ก่อน deploy
- [Image API ของ OpenRouter คืนภาพ base64 ขนาดใหญ่] → `_saveImageUrl` ย่อเหลือกว้าง 1200px อยู่แล้ว
- [คอนเทนต์เดิมไม่มี `narration`] → ได้ `''` วิดีโอไม่มีบทพากย์เหมือนเดิม จนกว่าผู้ใช้จะให้ AI เขียนใหม่หรือพิมพ์เอง

## Migration Plan

1. สร้างและรัน `database/migrations/YYYY_MM_DD_HHMMSS_add_video_aspect_resolution.sql` กับ DB local สองรอบ ตรวจด้วย `SHOW COLUMNS` และนับแถวที่ `duration_sec` นอก 30/45/60/90 (ต้องเป็น 0)
2. deploy production: รันหลัง migration ของ `kie-video-adapter` ทั้ง 3 ไฟล์ แล้วให้แอดมินเปลี่ยน model ภาพเป็น `google/gemini-2.5-flash-image` ถ้าใช้ OpenRouter
3. rollback: revert โค้ด — คอลัมน์ใหม่เป็น nullable โค้ดเดิมไม่อ่าน; ค่า `duration_sec` ที่แปลงไปแล้ว (180→90) โค้ดเดิม normalize 90 เป็น 60 ซึ่งยอมรับได้

## ผลทดสอบก่อนเริ่ม (2026-09-23)

- **1.2 OpenRouter Image API ✅** `POST /api/v1/images` + `google/gemini-2.5-flash-image` + `aspect_ratio: "9:16"` → HTTP 200, `data[0].b64_json` + `media_type: image/png`, ภาพ 768×1344 (0.571), `usage.cost` = $0.0387 — `openai/gpt-5-image-mini` + `9:16` → HTTP 400 `"aspect_ratio: not supported. Accepted: 1:1, 3:2, 2:3, auto"` (ข้อความ error ใช้ใส่ `image_gen_error` ได้ตรงๆ)
- **1.1 Veo Lite พูดไทย** ยิง text-to-video 720p 9:16 ด้วย prompt `{video_prompt}. A Thai narrator speaks in Thai, clearly and naturally: "{narration}"` (บท 79 ตัวอักษร) สำเร็จ ~50 วิ 30 credit — **ผู้ใช้ฟังแล้ว: เสียงโอเค** ใช้แนวทางให้ model พูดบทพากย์ผ่าน prompt ต่อ

## Open Questions

- Veo พูดภาษาไทยได้ดีพอหรือไม่ — ตอบด้วยงานทดสอบข้อแรก (ต้องเติม credit kie ก่อน)
- `google/gemini-2.5-flash-image` บน OpenRouter Image API คืนภาพ 9:16 จริงและคุณภาพพอใช้หรือไม่ — ตอบด้วยงานทดสอบภาพ
