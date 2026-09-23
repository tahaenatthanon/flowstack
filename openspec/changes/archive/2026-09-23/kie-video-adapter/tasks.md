## 1. ฐานข้อมูล

- [x] 1.1 สร้าง migration `database/migrations/YYYY_MM_DD_HHMMSS_add_video_model_id_and_image_field.sql`: เพิ่ม `content_items.video_model_id CHAR(36) NULL` + FK → `ai_models.id` `ON DELETE SET NULL` และอัปเดต `features.video.image_field` ของ `bytedance/seedance-1.5-pro` = `input_urls`, `bytedance/seedance-2` และ `bytedance/seedance-2-5` = `first_frame_url` (ใช้ `JSON_SET`, รันซ้ำได้)
- [x] 1.2 รัน migration กับ DB local สองรอบ แล้วตรวจด้วย `SHOW COLUMNS FROM content_items LIKE 'video_model_id'` และ `SELECT model_id, JSON_EXTRACT(features,'$.video.image_field') FROM ai_models WHERE model_id LIKE 'bytedance/seedance%'`

## 2. Adapter `api/lib/kie-video.php`

- [x] 2.1 สร้างไฟล์พร้อมฟังก์ชันโหลด model วิดีโอ: รับ `ai_models.id` → คืนแถว model + `features.video` ที่ decode แล้ว + provider base URL (ตัด `/api/v1` ท้าย) + API key ที่ถอดรหัสแล้ว; throw error ภาษาไทยถ้าไม่มี `features.video` หรือไม่มี key
- [x] 2.2 `kieVideoSubmit()` ตระกูล `veo`: `POST /api/v1/veo/generate` payload `{prompt, model, aspect_ratio, resolution, duration: 8}` + `imageUrls` (มีภาพ) หรือ `generationType: "TEXT_2_VIDEO"` (ไม่มีภาพ); คืน `data.taskId` หรือ throw ด้วย `msg`
- [x] 2.3 `kieVideoSubmit()` ตระกูล `market`: `POST /api/v1/jobs/createTask` payload `{model, input: {prompt, aspect_ratio, resolution, duration, generate_audio: true}}` + ภาพที่ `input[image_field]` (`input_urls` เป็น array / `first_frame_url` เป็น string); `duration` = 8 หรือค่าใกล้ที่สุดในช่วง `features.video.durations`
- [x] 2.4 `kieVideoPoll()` ตระกูล `veo`: `GET /api/v1/veo/record-info` แปลง `successFlag` 0/1/2/3 → generating/success/failed; URL จาก `response.resultUrls[0]` เท่านั้น (ไม่ใช้ `originUrls`); error จาก `errorMessage`
- [x] 2.5 `kieVideoPoll()` ตระกูล `market`: `GET /api/v1/jobs/recordInfo` แปลง `state` waiting/queuing/generating/success/fail; decode `resultJson` เพื่ออ่าน `resultUrls[0]`; error จาก `failMsg`
- [x] 2.6 `kieVideoDownload()`: สร้าง `uploads/content/videos/` ถ้ายังไม่มี, curl stream ลงไฟล์ `.part` (timeout 120 วิ), ตรวจ HTTP 2xx และขนาด > 0, `rename()` เป็น `{itemId}_{taskId}.mp4`, คืน `/uploads/content/videos/...` หรือ `null` + `error_log` ที่มี `taskId`
- [x] 2.7 เขียน `api/tests/kie-video-adapter-test.php` (รูปแบบเดียวกับ `api/tests/publish-gate-test.php`) ทดสอบฟังก์ชันสร้าง payload และแปลง response ของทั้งสองตระกูลด้วย fixture JSON จากผลทดสอบจริง (ไม่ยิง API จริง) — รวมเคส `resultUrls` vs `originUrls`, `input_urls` vs `first_frame_url`, `generate_audio: true`, `Auto` → `9:16`, duration ที่อยู่นอกช่วง
- [x] 2.8 (เพิ่มหลังทดสอบจริง) `kieVideoDownload()` กัน poll ซ้อนด้วย lock ไฟล์, คืน path ถ้าไฟล์โหลดเสร็จแล้ว, ยกเลิกเฉพาะเมื่อโหลดหยุดนิ่ง (LOW_SPEED 1KB/วิ × 60 วิ) แทน timeout 120 วิ — เทสต์ TC21–TC22

## 3. เชื่อม endpoint ใน `api/brand-content.php`

- [x] 3.1 `generate-video`: require `lib/kie-video.php`, อ่าน model จาก `company_settings.ai_content_video_model_id`, รับ `aspect_ratio` (`9:16`|`16:9`, อื่นๆ → `9:16`) และ `resolution` (`720p`|`1080p`, อื่นๆ → `720p`), คง validation เดิม (`video_prompt` ว่าง / ภาพฉากแรก `failed`), เรียก `kieVideoSubmit()` แล้วบันทึก `video_job_id`, `video_model_id`, `video_gen_status='generating'` — ลบ fallback kilo gateway / `resolveAICreds`
- [x] 3.2 `video-status`: โหลด model จาก `content_items.video_model_id` (NULL → ใช้ adapter `market` กับ model ปัจจุบัน), เรียก `kieVideoPoll()`; เมื่อ success เรียก `kieVideoDownload()` — สำเร็จบันทึก `video_url` + `done`, ดาวน์โหลดไม่สำเร็จคงสถานะ `generating`; เมื่อ failed บันทึก `failed` พร้อม error
- [x] 3.3 ตรวจว่า shape ของ response ทั้งสอง action ยังเป็น `{status, video_job_id}` / `{status, video_url, error}` เหมือนเดิม
- [x] 3.4 (เพิ่มหลังทดสอบจริง) `api/content-items.php` (list) ส่ง `video_gen_status`, `video_job_id`, `video_url` กลับด้วย — เดิมไม่ส่ง dialog จึงไม่เคยรู้สถานะวิดีโอ

## 4. Sync models และหน้า AI Settings

- [x] 4.1 `api/ai-providers.php` (sync models ~บรรทัด 414–450): อ่าน `features` เดิมมา merge กับของใหม่โดยคง `features.video`, และไม่ตั้ง `status = "active"` ให้แถวที่มี `features.video`
- [x] 4.2 ให้ API ที่หน้า AI Settings ใช้ดึงรายชื่อ model ส่ง `features` มาด้วย (ถ้ายังไม่ส่ง) แล้วกรอง dropdown `ai_content_video_model_id` ใน `AISettingsPanel.tsx` และ `AIFeatureSettings.tsx` ให้แสดงเฉพาะ model ที่มี `features.video` และ `status = 'active'`
- [x] 4.3 แสดงคำเตือนภาษาไทยเมื่อ model วิดีโอที่ตั้งไว้ไม่มี `features.video`
- [x] 4.4 เปลี่ยนคำอธิบายรายการ "คอนเทนท์วิดีโอ" ในทั้งสองไฟล์เป็น "โมเดลสำหรับสร้างวิดีโอ (Veo / Seedance)"

## 5. Frontend หัวข้อ "วิดีโอ"

- [x] 5.1 `src/components/content/types.ts`: ตัด `Auto` ออกจาก `VIDEO_ASPECT_RATIO_OPTIONS` และเพิ่ม `VIDEO_RESOLUTION_OPTIONS` (`720p`, `1080p`) พร้อม label ภาษาไทย
- [x] 5.2 `ContentCardDialog.tsx` และ `ContentVideoView.tsx`: เพิ่ม selector ความละเอียด (ค่าเริ่มต้น `720p`) ข้าง selector สัดส่วน และส่ง `resolution` ไปกับคำขอ `generate-video`
- [x] 5.3 อัปเดต/เพิ่ม test ใน `src/__tests__/content/ContentVideoView.test.tsx` (และ test ของ `ContentCardDialog` ที่เกี่ยวข้อง): ไม่มีตัวเลือก `Auto`, คำขอมี `aspect_ratio` และ `resolution` ตามที่เลือก
- [x] 5.4 (เพิ่มหลังทดสอบจริง) เพิ่ม `video_gen_status` / `video_url` / `video_job_id` ใน type `PlanItem` และตัวแปลงใน `ContentListTab.asPlanItem()` / `ContentDetailView` — เดิมตัดฟิลด์เหล่านี้ทิ้ง player ใน dialog จึงไม่เคยแสดง
- [x] 5.5 (เพิ่มหลังทดสอบจริง) เพิ่มการ poll `video-status` ใน `ContentCardDialog` ทุก 5 วิ ระหว่าง `generating` หยุดเมื่อ done/failed + toast — เทสต์ `ContentCardDialogVideoPoll.test.tsx` 4 เคส (เดิม: `ContentCardDialog` ไม่มีการ poll `video-status` เลย (มีแค่ `ContentVideoView`) กดสร้างจาก dialog แล้วต้องรีเฟรชเอง)

## 6. ตรวจสอบก่อนปิดงาน

- [x] 6.1 รัน `php api/tests/kie-video-adapter-test.php`, `pnpm lint`, `pnpm test`, `pnpm build` ให้ผ่านทั้งหมด — ผ่าน ยกเว้น 8 tests ที่ fail อยู่แล้วบน HEAD (BatchGenerateDialog, PullFromContentDialog, QuickCreateDialog.directMode — ไม่เกี่ยวกับ change นี้ แยกเป็นงานต่างหาก)
- [x] 6.2 งบทดสอบ 80 credit: เปิด ngrok ตั้ง `VITE_APP_URL` ชั่วคราวให้ kie ดึงภาพฉากจากเครื่อง local ได้ (สำหรับ 6.3) — ใช้ server แยก (php -S port 8099) ที่มีแค่ภาพฉากแรก + ngrok ที่ผู้ใช้เปิดเอง ไม่เปิด htdocs ทั้งหมด
- [x] 6.3 ทดสอบผ่านหน้าเว็บจริง: `veo3_lite` 720p image-to-video — ได้ไฟล์ใน `uploads/content/videos/` และเล่นใน dialog ได้ — ผ่าน: kie ดึงภาพผ่าน ngrok, บันทึก video_model_id=veo3_lite, ดาวน์โหลดไฟล์ 720×1280 8 วิ, player ใน dialog เล่นได้ (readyState 4), ใช้ 30 credit
- [x] 6.4 `veo3_lite` 1080p — ยืนยันด้วยสคริปต์ก่อนเริ่ม change (`resultUrls` = 1080×1920, `originUrls` = 720p) + TC10 ใน adapter test; ไม่ยิงซ้ำผ่านหน้าเว็บเพื่อประหยัด credit
- [x] 6.5 `bytedance/seedance-1.5-pro` image-to-video — ยิงผ่านฟังก์ชันจริงของ adapter (submit → poll → download) ด้วยภาพสาธารณะ ความยาว 4 วิ (28 credit): ส่ง `input_urls` + `generate_audio: true` สำเร็จ ได้ไฟล์ 720×1280 มีเสียง AAC 44.1kHz ดาวน์โหลดลงดิสก์ได้
- [x] 6.6 (เลื่อนไป Phase 3a — credit ไม่พอ ขั้นต่ำ ~112 credit) ทดสอบ `bytedance/seedance-2` / `bytedance/seedance-2-5` image-to-video เพื่อยืนยัน `first_frame_url` — ระหว่างนี้ปิดสองรุ่นไว้ด้วย migration `2026_09_23_115542_deactivate_untested_seedance_models.sql` (รันกับ DB local สองรอบแล้ว) เปิดใช้เมื่อทดสอบผ่าน
- [x] 6.7 ปิด ngrok และคืนค่า `VITE_APP_URL` / API key ของ kie ที่เปลี่ยนเพื่อทดสอบ — คืน `.env` และปิด server 8099 แล้ว, ผู้ใช้ปิด ngrok แล้ว (ยืนยันไม่มี process), API key ของ kie คืนเป็น key หลัก (ขึ้นต้น 038, เหลือ 26 credit — ต้องเติมก่อนใช้งานจริง)
