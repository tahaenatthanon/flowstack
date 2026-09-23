# video-clip-generation Specification

## Purpose

กำหนดการสร้างคลิปวิดีโอรายฉาก — identity ถาวรของฉาก (`scene.id`), ตาราง `content_video_clips` แบบ append-only, `input_snapshot` และการตรวจคลิปล้าสมัย, การเลือก model ของวิดีโอ, ความพร้อมของฉาก, การจองแบบ atomic, การยิงหลายฉากใน request เดียว, credit ประมาณการ/จริง และการย้ายวิดีโอเดิม — ที่มา: change `multi-clip-video`

## Requirements

### Requirement: ฉากมี `scene.id` ถาวรเป็น identity หลัก
ทุก scene ใน `article_content.scenes[]` ของคอนเทนต์วิดีโอ SHALL มี key `id` ที่ไม่ซ้ำภายใน item และไม่เปลี่ยนตลอดอายุของฉาก — คลิปและวิดีโอรวม SHALL อ้างอิงฉากด้วย `scene.id` ส่วน `scene_index` SHALL ใช้เพื่อแสดงลำดับเท่านั้น

**Active Scene** คือ scene ที่อยู่ใน `article_content.scenes[]` ปัจจุบัน — คลิปที่ `scene_id` ไม่ตรงกับ Active Scene ใดๆ SHALL ถูกซ่อน (ไม่แสดง ไม่นับ ไม่นำไปรวม) แต่ SHALL ไม่ถูกลบ

#### Scenario: เขียนสคริปต์ใหม่จากเดิม 7 ฉากเหลือ 4 ฉาก
- **WHEN** item มีคลิปของ 7 ฉากเดิม แล้วผู้ใช้เขียนสคริปต์ใหม่ได้ 4 ฉากที่มี `id` ใหม่
- **THEN** ระบบ SHALL แสดงเฉพาะ 4 ฉากใหม่ (ยังไม่มีคลิป) และ SHALL ไม่แสดงหรือนำคลิปของ 7 ฉากเดิมไปรวม
- **AND** แถวคลิปของ 7 ฉากเดิม SHALL ยังอยู่ในฐานข้อมูล

#### Scenario: ลำดับฉากเท่าเดิมแต่ id ต่างกัน
- **WHEN** ฉากที่ `scene_index = 2` ปัจจุบันมี `id` ไม่ตรงกับ `scene_id` ของคลิปที่ `scene_index = 2`
- **THEN** ระบบ SHALL ไม่ถือว่าคลิปนั้นเป็นคลิปของฉากปัจจุบัน

### Requirement: เก็บคลิปทุก generation ในตาราง `content_video_clips`
ระบบ SHALL เก็บการสร้างคลิปแต่ละครั้งเป็นแถวใหม่ใน `content_video_clips` (ไม่เขียนทับแถวเดิม) โดยมีอย่างน้อย `id`, `tenant_id`, `item_id` (FK → `content_items` ON DELETE CASCADE), `scene_id`, `scene_index`, `model_id` (FK → `ai_models` ON DELETE SET NULL), `job_id`, `status` (`generating` | `done` | `failed`), `clip_url`, `error`, `input_snapshot` (JSON), `credits_estimated`, `credits_actual`, `created_at`, `completed_at`, `updated_at`

**คลิปที่ใช้งาน** ของฉาก SHALL เป็นแถวล่าสุด (ตาม `created_at`) ที่ `status = 'done'` ของ `scene_id` นั้น — การสร้างใหม่ที่ยัง `generating` หรือ `failed` SHALL ไม่แทนคลิปที่ใช้งานอยู่

ทุกการอ่าน/เขียนตารางนี้ SHALL กรองด้วย `tenant_id` และ SHALL ไม่แก้ `article_content`

#### Scenario: สร้างคลิปฉากเดิมใหม่
- **WHEN** ฉาก A มีคลิป generation 1 ที่ `done` แล้วผู้ใช้สร้างคลิปฉาก A ใหม่
- **THEN** ระบบ SHALL เพิ่มแถว generation 2 และแถว generation 1 SHALL ยังอยู่

#### Scenario: สร้างใหม่แล้วล้มเหลว
- **WHEN** ฉาก A มีคลิป generation 1 `done` และ generation 2 `failed`
- **THEN** คลิปที่ใช้งานของฉาก A SHALL เป็น generation 1

#### Scenario: ผู้ใช้บันทึก dialog ระหว่างคลิปกำลังเสร็จ
- **WHEN** ผู้ใช้เปิด dialog ค้างไว้ คลิปฉากหนึ่งเสร็จระหว่างนั้น แล้วผู้ใช้กด "บันทึก"
- **THEN** สถานะและไฟล์ของคลิปนั้น SHALL ไม่หายไป เพราะไม่ได้เก็บใน `article_content`

### Requirement: `input_snapshot` บันทึกข้อมูลที่ใช้สร้างคลิปจริง
ตอนยิงคลิป ระบบ SHALL บันทึก `input_snapshot` เป็น JSON ที่มี `image_url`, `video_prompt`, `narration`, `model_id`, `duration_sec`, `aspect_ratio`, `resolution` ที่ใช้ยิงจริง — SHALL ไม่ใช้ hash แทน snapshot และ SHALL ไม่เก็บ credit ไว้ใน snapshot

#### Scenario: fallback model
- **WHEN** ระบบต้อง fallback ไปใช้ model ปัจจุบันของระบบเพราะ model ของวิดีโอถูกปิด
- **THEN** `input_snapshot.model_id` SHALL เป็น model ที่ใช้ยิงจริง

### Requirement: ตรวจคลิปล้าสมัยจาก snapshot
คลิปที่ใช้งานของฉาก SHALL ถือว่า **ล้าสมัย** เมื่อค่าใดค่าหนึ่งใน `input_snapshot` ต่างจากค่าปัจจุบันที่บันทึกแล้ว — ภาพ (`image_url`), `video_prompt`, `narration` (ของ scene), `model_id` (model ของวิดีโอตาม requirement "เลือก model ของวิดีโอ"), `duration_sec`, `aspect_ratio`, `resolution` (ของ item) โดยข้อความ SHALL ถูกตัดช่องว่างหัวท้ายก่อนเทียบ

ระบบ SHALL คำนวณความล้าสมัยทุกครั้งที่อ่าน (SHALL ไม่เก็บ flag ล้าสมัยในฐานข้อมูล) และ SHALL ส่งรายการเหตุผลเป็นภาษาไทยว่าค่าใดเปลี่ยน — คลิปที่ล้าสมัย SHALL ยังเปิดดูได้

#### Scenario: แก้บทพากย์หลังสร้างคลิป
- **WHEN** คลิปของฉาก 4 สร้างด้วย `narration = "ก"` แล้วผู้ใช้บันทึก `narration = "ข"`
- **THEN** คลิปของฉาก 4 SHALL ล้าสมัยพร้อมเหตุผล "บทพากย์เปลี่ยน"

#### Scenario: แก้กลับเป็นค่าเดิม
- **WHEN** ผู้ใช้บันทึก `narration` กลับเป็น `"ก"` ตามเดิม
- **THEN** คลิปของฉาก 4 SHALL ไม่ล้าสมัย

#### Scenario: ช่องว่างหัวท้าย
- **WHEN** ค่าปัจจุบันต่างจาก snapshot แค่ช่องว่างหรือขึ้นบรรทัดที่หัวหรือท้าย
- **THEN** คลิป SHALL ไม่ล้าสมัย

#### Scenario: สร้างภาพฉากใหม่
- **WHEN** ผู้ใช้สร้างภาพของฉากใหม่ ทำให้ `image_url` เป็นไฟล์ใหม่
- **THEN** คลิปของฉากนั้น SHALL ล้าสมัยพร้อมเหตุผล "ภาพฉากเปลี่ยน"

### Requirement: เลือก model ของวิดีโอ
model ที่ใช้ยิงคลิป SHALL เป็น `content_items.video_model_id` ถ้า model นั้นยังเปิดใช้และมี `features.video` — ถ้าเป็น NULL, ถูกปิด หรือไม่มี `features.video` SHALL ใช้ `company_settings.ai_content_video_model_id` แล้วบันทึกลง `content_items.video_model_id` — ถ้าทั้งสองใช้ไม่ได้ SHALL คืน error ภาษาไทยให้แอดมินเลือก model วิดีโอ และ SHALL ไม่ยิง API

ทุกฉากในคำขอเดียว SHALL ใช้ model เดียวกันที่เลือกครั้งเดียวตอนเริ่มคำขอ — การเปลี่ยน default model ของระบบ SHALL ไม่เปลี่ยน model ของวิดีโอที่มี `video_model_id` ใช้งานได้อยู่ และจึง SHALL ไม่ทำให้คลิปเดิมล้าสมัย

#### Scenario: แอดมินเปลี่ยน default model
- **WHEN** วิดีโอมี `video_model_id = veo3_lite` (เปิดใช้) และแอดมินเปลี่ยน default เป็น `veo3_fast`
- **THEN** คลิปใหม่ของวิดีโอนี้ SHALL ใช้ `veo3_lite` และคลิปเดิม SHALL ไม่ล้าสมัย

#### Scenario: model ของวิดีโอถูกปิด
- **WHEN** `video_model_id = veo3_lite` ถูกปิด และ default เป็น `veo3_fast`
- **THEN** คลิปใหม่ SHALL ใช้ `veo3_fast`, `content_items.video_model_id` SHALL เปลี่ยนเป็น `veo3_fast`
- **AND** คลิปเดิมที่สร้างด้วย `veo3_lite` SHALL ล้าสมัยพร้อมเหตุผล "model เปลี่ยน"

### Requirement: เงื่อนไขความพร้อมของฉากก่อนสร้างคลิป
ฉากจะสร้างคลิปได้ SHALL มี `image_gen_status = 'done'` พร้อม `image_url` และ `video_prompt` ที่ไม่ว่าง — ระบบ SHALL ไม่สร้างคลิปแบบ text-to-video แทนฉากที่ไม่มีภาพ และ SHALL ส่งเหตุผลเป็นภาษาไทยของทุกฉากที่ไม่พร้อม (เช่น "ฉาก 3 ยังไม่มีภาพ", "ฉาก 6 ยังไม่มี Video Prompt")

ระบบ SHALL ไม่ยิง API เมื่อ URL สาธารณะของระบบ (`VITE_APP_URL`) เป็น `localhost`, `127.0.0.1` หรือ IP ภายใน (kie.ai ดึงภาพไม่ได้) และ SHALL คืนเหตุผลภาษาไทย

บทพากย์ที่ยาวเกิน 100 ตัวอักษร SHALL ไม่บล็อกการสร้าง (ส่งเป็นคำเตือน) และบทพากย์ว่าง SHALL เป็นเรื่องปกติ

#### Scenario: สถานะความพร้อมเมื่อบางฉากไม่พร้อม
- **WHEN** ฉาก 3 ยังไม่มีภาพ และฉาก 6 ยังไม่มี Video Prompt
- **THEN** สถานะวิดีโอ (`video-state`) SHALL ระบุว่าสร้างคลิปทุกฉากไม่ได้ พร้อมเหตุผลของฉาก 3 และฉาก 6

#### Scenario: URL ภายใน
- **WHEN** `VITE_APP_URL = http://localhost:8080`
- **THEN** ระบบ SHALL ไม่ยิง API และ SHALL คืนเหตุผลว่า kie.ai เข้าถึงภาพไม่ได้

### Requirement: ยิงหลายฉากใน request เดียวเฉพาะฉากที่ผู้ใช้ยืนยัน
action `generate-clips` SHALL รับ `item_id` และ `scene_ids` (รายการฉากที่ผู้ใช้ยืนยันใน dialog) แล้วยิงทีละฉากตามลำดับใน request เดียว — ระบบ SHALL ยิงเฉพาะฉากใน `scene_ids` ที่ยังเป็น Active Scene และยังต้องสร้าง (ไม่มีคลิปที่ใช้งาน, generation ล่าสุด `failed`, หรือคลิปที่ใช้งานล้าสมัย) และ SHALL ไม่ยิงเกินรายการนั้น — ฉากที่ไม่พร้อมแล้วหรือกำลัง `generating` SHALL ถูกข้ามพร้อมเหตุผล

ระบบ SHALL ตรวจความพร้อมของทุกฉากใน `scene_ids` ซ้ำที่ backend ก่อนยิง — ฉากที่ไม่ผ่านเงื่อนไขความพร้อมแล้ว SHALL ถูกข้ามพร้อมเหตุผล (ไม่ยิง)

ระบบ SHALL เรียก `ignore_user_abort(true)` เพื่อให้ยิงและบันทึกผลครบแม้ผู้ใช้ปิดแท็บ และ SHALL ตอบผลรายฉาก `submitted` / `skipped` / `failed` พร้อมเหตุผล

#### Scenario: ยืนยัน 3 ฉาก แต่ฉากหนึ่งเสร็จไปแล้วระหว่างนั้น
- **WHEN** ผู้ใช้ยืนยันฉาก 2, 5, 6 แต่ก่อนคำขอถึง backend คลิปฉาก 5 เปลี่ยนเป็น `done` และไม่ล้าสมัย
- **THEN** ระบบ SHALL ยิงเฉพาะฉาก 2 และ 6 และคืนฉาก 5 เป็น `skipped` พร้อมเหตุผล

#### Scenario: คำขอมีฉากที่ไม่ใช่ Active Scene
- **WHEN** `scene_ids` มี id ที่ไม่อยู่ใน `article_content.scenes[]` ปัจจุบัน
- **THEN** ระบบ SHALL ไม่ยิงฉากนั้นและคืน `skipped` พร้อมเหตุผล

### Requirement: จองฉากแบบ atomic ก่อนยิง kie.ai
ก่อนยิงแต่ละฉาก ระบบ SHALL จองฉากใน transaction เดียว: ล็อกแถว `content_items` ของ item (`SELECT ... FOR UPDATE`), ตรวจว่า generation ล่าสุดของฉากไม่ได้ `generating`, แล้ว INSERT แถวใหม่ `status = 'generating'`, `job_id = NULL` แล้ว COMMIT — จากนั้นจึงยิง kie.ai นอก transaction แล้วอัปเดต `job_id` — ฉากที่จองไม่ได้ SHALL ถูกข้ามพร้อมเหตุผล "ฉากนี้กำลังสร้างอยู่"

#### Scenario: สองแท็บกดยืนยันพร้อมกัน
- **WHEN** สองคำขอพยายามสร้างคลิปฉาก A พร้อมกัน
- **THEN** SHALL มีเพียงคำขอเดียวที่ยิง kie.ai สำหรับฉาก A และอีกคำขอ SHALL คืน `skipped` "ฉากนี้กำลังสร้างอยู่"

### Requirement: แยก error ระดับฉากและระดับบัญชี
ถ้า kie.ai ปฏิเสธงานด้วยเหตุระดับฉาก (เช่น prompt ไม่ผ่าน) ระบบ SHALL บันทึกแถวนั้นเป็น `failed` พร้อม `error` แล้วยิงฉากถัดไปต่อ — ถ้าเป็นเหตุระดับบัญชี (credit ไม่พอ, key ไม่ถูกต้อง, ถูกจำกัดจำนวนงาน / HTTP 401, 402, 429) ระบบ SHALL บันทึกฉากปัจจุบันเป็น `failed`, SHALL หยุดยิงฉากที่เหลือ (ไม่จองและไม่สร้างแถว) และ SHALL คืนฉากที่เหลือเป็น `skipped` พร้อมเหตุผล

#### Scenario: credit หมดกลางทาง
- **WHEN** ยิงฉาก 2 สำเร็จ แล้ว kie.ai ตอบฉาก 5 ว่า credit ไม่พอ
- **THEN** ฉาก 5 SHALL เป็น `failed` และฉาก 6 SHALL เป็น `skipped` "credit ไม่พอ" โดยไม่ยิง API

### Requirement: บันทึก credit ประมาณการและ credit จริง
ตอนยิง ระบบ SHALL บันทึก `credits_estimated` จาก `features.video` ของ model ที่ใช้ (`price_usd` ตามความละเอียด × 1 คลิปสำหรับ `per_clip` หรือ × `duration` สำหรับ `per_second`, แปลงเป็น credit ของ kie.ai) — ถ้าไม่มีข้อมูลราคา SHALL เป็น NULL — ถ้า kie.ai ส่งยอดจริงกลับมา (เช่น `creditsConsumed`) SHALL บันทึก `credits_actual` มิฉะนั้น `credits_actual` SHALL เป็น NULL — ถ้ายิงไม่ผ่านตั้งแต่แรก (ไม่ได้ `taskId`) SHALL บันทึก `credits_estimated = 0` และ `credits_actual = 0`

#### Scenario: Veo Lite 720p
- **WHEN** ยิงคลิปด้วย `veo3_lite` ที่ 720p (`price_usd.720p = 0.15`, `per_clip`)
- **THEN** `credits_estimated` SHALL เป็น 30

#### Scenario: ยิงไม่ผ่าน
- **WHEN** kie.ai ตอบโดยไม่มี `taskId`
- **THEN** แถวคลิป SHALL เป็น `failed` พร้อม `credits_estimated = 0` และ `credits_actual = 0`

### Requirement: prompt ของฉากที่ไม่มีบทพากย์ขอเสียงบรรยากาศ
ถ้า `narration` ของฉากว่าง prompt ที่ส่ง kie.ai SHALL เป็น `video_prompt` ต่อท้ายด้วยคำสั่งให้มีแต่เสียงบรรยากาศ/เสียงประกอบ ไม่มีเสียงพูดหรือผู้บรรยาย — ถ้า `narration` ไม่ว่าง SHALL ใช้คำสั่งพูดบทพากย์ภาษาไทยแบบเดิม

#### Scenario: ฉากโชว์สินค้า
- **WHEN** ฉากมี `video_prompt = "slow pan over the product"` และ `narration = ""`
- **THEN** prompt SHALL มี "slow pan over the product" และคำสั่งว่าไม่มีเสียงพูด มีแต่เสียงบรรยากาศ

### Requirement: นับการล้มซ้ำด้วย input เดิม
เมื่อ generation ล่าสุด 2 ครั้งติดกันของฉากเป็น `failed` และมี `input_snapshot` เท่ากันและเท่ากับค่าปัจจุบัน ระบบ SHALL ส่งคำแนะนำภาษาไทยให้แก้ Video Prompt หรือบทพากย์ก่อนลองใหม่ (ไม่บล็อก) — ถ้าผู้ใช้แก้ข้อมูลจน snapshot ต่างไป การนับ SHALL เริ่มใหม่

#### Scenario: ล้มสองครั้งด้วยข้อมูลเดิม
- **WHEN** ฉาก A ล้ม 2 ครั้งติดกันด้วย snapshot เดิม
- **THEN** ระบบ SHALL แนบคำแนะนำให้แก้ข้อมูลก่อนลองใหม่

#### Scenario: แก้ข้อมูลแล้วล้มอีกครั้ง
- **WHEN** ผู้ใช้แก้ Video Prompt แล้วล้มอีก 1 ครั้ง
- **THEN** ระบบ SHALL ไม่แนบคำแนะนำ เพราะการนับเริ่มใหม่

### Requirement: ย้ายวิดีโอเดิมเป็นคลิปของฉาก 1
ก่อนเปิดใช้ระบบ SHALL รันการย้ายข้อมูลครั้งเดียวตามลำดับ: (1) แจก `scene.id` ให้ทุกฉากของคอนเทนต์ที่ยังไม่มี (2) item ที่มี `video_url` หรือ `video_job_id` จากระบบเดิม SHALL ได้แถว `content_video_clips` ของฉาก index 0 — `done` + `clip_url = video_url` หรือ `generating` + `job_id = video_job_id` — โดย `input_snapshot` มาจากค่าปัจจุบันของฉาก 1 พร้อม `migrated: true`, `credits_estimated` และ `credits_actual` เป็น NULL (3) ล้าง `video_url`, `video_job_id` และตั้ง `video_gen_status = 'none'` บน item โดยคง `video_model_id` — SHALL ไม่ย้ายหรือเปลี่ยนชื่อไฟล์วิดีโอ และการรันซ้ำ SHALL ไม่สร้างแถวซ้ำ

#### Scenario: item ทดสอบ A1
- **WHEN** item มี `video_url = /uploads/content/videos/x.mp4` และ `video_gen_status = 'done'`
- **THEN** หลังย้าย SHALL มีคลิปฉาก 1 `done` ที่ `clip_url` เป็นไฟล์เดิม และ `input_snapshot.migrated = true`
- **AND** item SHALL มี `video_url = NULL`, `video_gen_status = 'none'`

#### Scenario: รันซ้ำ
- **WHEN** รันการย้ายข้อมูลครั้งที่สอง
- **THEN** SHALL ไม่มีแถวคลิปหรือ `scene.id` ใหม่เกิดขึ้น
