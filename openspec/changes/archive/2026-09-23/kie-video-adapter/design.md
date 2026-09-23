## Context

`generate-video` / `video-status` (`api/brand-content.php` ~บรรทัด 3692–3896) ยิง `POST /api/v1/jobs/createTask` เสมอ แต่ model ที่ตั้งไว้คือ `veo3` ซึ่งเป็นชื่อของ API ชุดเก่า (`/api/v1/veo/generate`) — ใน DB local ยังไม่มี content item ไหนเคยได้ `video_url` เลย โค้ดยังมี fallback ไป `https://api.kilo.ai/api/gateway` และ `resolveAICreds()` เมื่อหา model ไม่เจอ ซึ่งไม่เคยใช้สร้างวิดีโอได้จริง

model วิดีโอของ kie.ai ถูกอัปเดตแล้วด้วย migration `2026_09_23_100222_update_kie_video_models.sql` (Veo 3.1 Lite/Fast/Quality ตระกูล `veo`, Seedance 1.5 Pro/2.0/2.5 ตระกูล `market`, ปิด `seedance-2-fast`) พร้อม `features.video`

**ผลทดสอบจริงกับ kie.ai (2026-09-23, ผ่านสคริปต์ใน scratchpad):**

| ทดสอบ | request | ผล |
|---|---|---|
| `veo3_lite` 4 วิ 720p 9:16 | `POST /api/v1/veo/generate` `{prompt, model, aspect_ratio, duration, resolution, generationType}` | สำเร็จ ~50 วิ, **30 credit** (เท่าราคาคลิป 8 วิ), 720×1280 H.264 24fps + AAC 48kHz |
| `veo3_lite` 8 วิ 1080p | เหมือนข้างบน | สำเร็จ ~96 วิ, 35 credit, `response.resultUrls` = 1080×1920, `response.originUrls` = 720p ต้นฉบับ — **ไม่ต้องเรียก endpoint 1080 แยก** |
| `bytedance/seedance-1.5-pro` 4 วิ 720p | `POST /api/v1/jobs/createTask` `{model, input:{prompt, aspect_ratio, resolution, duration, generate_audio}}` | สำเร็จ ~45 วิ, 28 credit (`creditsConsumed` อยู่ใน response), 720×1280 H.264 + AAC **44.1kHz**, `state` = `waiting` → `success` |

ไฟล์ทุกไฟล์มี `moov` อยู่ท้ายไฟล์ และเสียงยาวกว่าภาพ ~0.03–0.04 วิ (ไม่กระทบ change นี้ เพราะยังเป็นคลิปเดียว — บันทึกไว้ให้ Phase 3b)

## Goals / Non-Goals

**Goals:**
- สร้างวิดีโอคลิปเดียว (ฉากแรก) ได้จริงกับ model วิดีโอทั้ง 6 รุ่น ทั้ง 720p และ 1080p ทั้ง image-to-video และ text-to-video
- เก็บไฟล์วิดีโอไว้ในระบบ ไม่พึ่ง URL ชั่วคราว
- โครงสร้าง adapter ที่ Phase 3a นำไปยิงหลายคลิปต่อได้โดยไม่ต้องรื้อ

**Non-Goals:**
- ตัวเลือกความยาว/สัดส่วน/ความละเอียดในหน้าสร้างคอนเทนต์ และการเก็บค่าเหล่านี้ใน item (A1)
- ยิงหลายคลิป, สถานะรายฉาก (3a) / ต่อคลิป, แก้เสียงคลาด, faststart (3b)
- OpenRouter หรือ provider อื่น
- เก็บต้นทุน credit ต่อวิดีโอ (`creditsConsumed` มีเฉพาะตระกูล market — ค่อยพิจารณาพร้อม 3a)

## Decisions

### 1. Adapter เป็นฟังก์ชัน PHP ในไฟล์ใหม่ `api/lib/kie-video.php`
ฟังก์ชัน 3 ตัวที่รับ `$model` (แถว `ai_models` + `features` ที่ decode แล้ว) และ provider credentials:
- `kieVideoSubmit(array $model, array $creds, array $req): string` → คืน `taskId` หรือ throw พร้อม `msg` ของ kie
- `kieVideoPoll(array $model, array $creds, string $taskId): array` → `['status' => 'generating'|'success'|'failed', 'url' => ?, 'error' => ?]`
- `kieVideoDownload(string $url, string $itemId, string $taskId): ?string` → path ภายใน หรือ `null` ถ้าดาวน์โหลดไม่สำเร็จ

ภายในแยก `match ($features['video']['api'])` เป็น `veo` / `market` — `$req` คือ `{prompt, aspect_ratio, resolution, duration, image_url?}` ที่เป็นกลางไม่ขึ้นกับตระกูล

**ทำไม:** `brand-content.php` ยาว 4,100 บรรทัดแล้ว และ Phase 3a จะเรียก submit/poll ต่อฉากจากหลายจุด (endpoint + cron `tick.php`) การแยกไฟล์ทำให้ require ได้จากทั้งสองที่ — ใช้รูปแบบเดียวกับ `api/lib/ai-research.php`, `api/lib/publish-dispatch.php` ที่มีอยู่แล้ว
**ทางเลือกที่ไม่เลือก:** class + interface ต่อ provider — เกินความจำเป็นเมื่อมี provider เดียว 2 ตระกูล

### 2. ตระกูล API และชื่อฟิลด์ภาพมาจาก `features.video` ไม่ hardcode ตาม model id
`market` ใส่ภาพที่ `input[<image_field>]` — `input_urls` ส่งเป็น array, `first_frame_url` ส่งเป็น string migration ใหม่เติม `image_field` ให้ Seedance ทั้ง 3 รุ่น (1.5 Pro = `input_urls` ทดสอบจริงแล้ว, 2.0/2.5 = `first_frame_url` ตาม docs)
**ทำไม:** เพิ่ม model ใหม่ในตระกูลเดิมได้ด้วย migration อย่างเดียว ไม่ต้องแก้โค้ด (สอดคล้องกฎ NO MAGIC — พฤติกรรมอ่านได้จากข้อมูล)

### 3. ค่าที่ส่งเสมอแม้ kie มีค่าเริ่มต้น
- `generate_audio: true` สำหรับ `market` — Seedance 1.5 Pro ค่าเริ่มต้นคือไม่มีเสียง
- `duration` ทุกตระกูล — Veo ใช้ 8 เสมอ (ทดสอบแล้วว่า 4 วิ ราคาเท่า 8 วิ) / market ใช้ 8 ถ้าอยู่ในช่วง ไม่งั้นค่าใกล้ที่สุด (Seedance ทุกรุ่นรองรับ 8)
- `resolution` ทุกตระกูล — ค่าเริ่มต้นของ kie คือ 720p อยู่แล้ว แต่ส่งให้ชัด
- `aspect_ratio` — Seedance ค่าเริ่มต้นคือ `adaptive`/`1:1` ซึ่งไม่ใช่สิ่งที่ผู้ใช้เลือก

**ทำไม:** ค่าเริ่มต้นของ kie ต่างกันรายรุ่นและเปลี่ยนได้โดยไม่แจ้ง การส่งทุกค่าทำให้ผลลัพธ์คาดเดาได้

### 4. บันทึก `video_model_id` ตอน submit และ poll ตามค่านั้น
เพิ่มคอลัมน์ `content_items.video_model_id CHAR(36) NULL` (FK → `ai_models.id` `ON DELETE SET NULL`) `video-status` อ่าน model จากคอลัมน์นี้ ไม่ใช่จาก `company_settings` — ถ้าเป็น NULL (งานเก่า) ใช้ `market` ตามพฤติกรรมเดิม
**ทำไม:** ถ้าแอดมินเปลี่ยนจาก Veo เป็น Seedance ระหว่างรอ การ poll ด้วย model ปัจจุบันจะยิงผิด endpoint และงานค้างตลอดไป — และ Phase 3a ต้องใช้คอลัมน์นี้ล็อก model ไม่ให้ผสมคลิป (Veo 48kHz vs Seedance 44.1kHz)

### 5. ดาวน์โหลดตอน poll แบบ synchronous และถ้าล้มเหลวให้คงสถานะ `generating`
ใช้ curl stream ลงไฟล์ชั่วคราวแล้ว `rename()` เป็น `uploads/content/videos/{itemId}_{taskId}.mp4` (กันไฟล์ครึ่งๆ กลางๆ) ตรวจ HTTP 2xx และขนาด > 0 ไม่ลบไฟล์เก่าของ item (ปล่อยไว้ — การลบเป็นเรื่องแยก และกฎ BACKUP BEFORE DELETE)

**ปรับหลังทดสอบจริง (2026-09-23):** เดิมใช้ timeout รวม 120 วิ แต่ CDN ของ kie (`tempfile.aiquickdraw.com`) วัดได้ช้าเพียง ~10–50KB/วิ ในบางช่วง ไฟล์ 2.5MB ถูกตัดที่ 120 วิ (ตรงกับ `max_execution_time=120` ของ XAMPP) และ frontend poll ทุก 5 วิ ทำให้หลาย request เขียน `.part` เดียวกันทับกัน จึงเปลี่ยนเป็น:
- lock ไฟล์ `{final}.lock` ด้วย `flock(LOCK_EX|LOCK_NB)` — request ที่ lock ไม่ได้ตอบ `generating` ทันที ไม่เริ่มโหลดซ้อน
- ถ้าไฟล์ปลายทางมีอยู่แล้ว คืน path ทันที (idempotent)
- `set_time_limit(0)` + `ignore_user_abort(true)` และใช้ `CURLOPT_LOW_SPEED_LIMIT` 1KB/วิ นาน 60 วิ แทน timeout รวม — ยกเลิกเฉพาะเมื่อโหลดหยุดนิ่ง
**ทำไม:** ไฟล์ขนาด 1–6MB ดาวน์โหลดทันภายใน request ของการ poll; การตั้ง `failed` เมื่อดาวน์โหลดพลาดจะชวนผู้ใช้กดสร้างใหม่และเสีย credit ซ้ำ ทั้งที่ไฟล์ยังรออยู่บน kie
**ทางเลือกที่ไม่เลือก:** ดาวน์โหลดใน cron — ต้องมีสถานะใหม่ (`downloading`) และ frontend ต้องรู้จัก ซึ่งเกินขอบเขต A2

### 6. ตัด fallback ไป kilo gateway / `resolveAICreds`
ถ้า `ai_content_video_model_id` ไม่ชี้ไปที่ model ที่มี `features.video` และ provider มี key ให้คืน error ภาษาไทยทันที
**ทำไม:** fallback เดิมไม่เคยสร้างวิดีโอได้ และซ่อนปัญหาการตั้งค่าไว้ (ขัดกฎ NO MAGIC)

### 7. frontend: selector ความละเอียดใหม่ + ตัด `Auto` แต่ยังไม่ persist
เพิ่ม `VIDEO_RESOLUTION_OPTIONS` ข้าง `VIDEO_ASPECT_RATIO_OPTIONS` เดิม ใช้ใน `ContentCardDialog.tsx` และ `ContentVideoView.tsx` ส่ง `resolution` ไปกับ `generate-video` — A1 จะย้ายทั้งสองค่าไปเก็บใน item และเปลี่ยน selector เป็น badge/แก้ไขตามที่ตกลงไว้
**ทำไม:** ให้ทดสอบ 1080p ผ่านหน้าเว็บจริงได้ใน A2 โดยไม่ต้องรอ A1

### 8. Sync models: merge `features` และไม่แตะ `status` ของ model วิดีโอ
ใน `api/ai-providers.php` อ่าน `features` เดิมมา `array_merge` กับของใหม่ (ของเดิมที่ key `video` ชนะ) และถ้ามี `features.video` ให้ตัด `status = "active"` ออกจาก UPDATE

## Risks / Trade-offs

- [Seedance 2.0 / 2.5 ยังไม่ได้ยิงจริง — ชื่อฟิลด์ `first_frame_url` มาจาก docs] → ใส่ใน task ทดสอบสุดท้าย ถ้าผิดแก้แค่ `image_field` ใน migration ไม่ต้องแก้โค้ด
- [image-to-video บน localhost: kie ดึงภาพจาก `VITE_APP_URL` (`http://localhost:8080`) ไม่ได้] → ทดสอบด้วย ngrok (ตั้ง `VITE_APP_URL` ชั่วคราว) ถ้าไม่ใช้ ngrok ทดสอบได้แค่ text-to-video
- [ดาวน์โหลดใน request poll ทำให้ request นั้นช้าได้ถึง ~2 นาทีถ้าเน็ตช้า] → frontend poll ด้วย `setInterval` อยู่แล้ว request ที่ช้าไม่ทำให้พัง; ถ้าเป็นปัญหาจริงย้ายไป cron ใน 3a
- [พื้นที่ดิสก์: ไม่ลบไฟล์เก่าเมื่อสร้างใหม่] → ยอมรับใน A2 (ไฟล์ละ 1–6MB) — จดเป็นงานเก็บกวาดแยก
- [งานที่ค้างสถานะ `generating` ก่อน deploy: `video_model_id` เป็น NULL และ `video_job_id` มาจาก request ที่ยิงผิด endpoint] → ใช้ `market` ตามเดิม ถ้า kie ตอบว่าไม่พบ task ให้ตั้ง `failed` พร้อมข้อความ (ใน local ไม่มีงานแบบนี้)
- [ทดสอบต้องใช้ credit จริง] → key ปัจจุบันเหลือ 17 credit ต้องเติมก่อนทำ task ทดสอบ (ประมาณ 150 credit เผื่อยิงซ้ำ)

## Migration Plan

1. migration `YYYY_MM_DD_HHMMSS_add_video_model_id_and_image_field.sql`: `ALTER TABLE content_items ADD COLUMN video_model_id CHAR(36) NULL` + FK + อัปเดต `features.video.image_field` ของ Seedance 3 รุ่น (idempotent) — รันกับ DB local และตรวจด้วย `SHOW COLUMNS`
2. deploy production: รันตามลำดับ `2026_09_23_100222_update_kie_video_models.sql` → `2026_09_23_104518_add_video_model_id_and_image_field.sql` → `2026_09_23_115542_deactivate_untested_seedance_models.sql` (ปิด Seedance 2.0/2.5 จนกว่าจะทดสอบ `first_frame_url` จริงใน Phase 3a) และสร้างโฟลเดอร์ `uploads/content/videos/` ให้ Apache เขียนได้
3. rollback: revert โค้ด — คอลัมน์ `video_model_id` ปล่อยไว้ได้ (nullable ไม่มีโค้ดเดิมอ่าน); `features.video` ไม่กระทบโค้ดเดิม

## Open Questions

- ไม่มีที่บล็อกการเริ่มงาน — ข้อสมมติเรื่อง Seedance 2.0/2.5 จะยืนยันใน task ทดสอบสุดท้าย
