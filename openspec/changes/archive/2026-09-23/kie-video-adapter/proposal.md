## Why

`generate-video` ใน `api/brand-content.php` ยังไม่เคยสร้างวิดีโอสำเร็จเลยสักครั้ง เพราะส่ง model id ของ API ชุดเก่าของ kie.ai (`veo3`) ไปที่ endpoint ของ API ชุดใหม่ (`/api/v1/jobs/createTask`) ขณะเดียวกัน model วิดีโอที่เพิ่มเข้าระบบแล้ว (Veo 3.1 Lite/Fast/Quality, Seedance 1.5 Pro/2.0/2.5 — migration `2026_09_23_100222_update_kie_video_models.sql`) ใช้ API สองชุดที่รูปแบบ request/response ต่างกัน จึงต้องมี adapter ที่เลือกเส้นทางตาม model ก่อนเริ่มงาน Phase 3 (หลายฉาก + ต่อคลิป) ซึ่งต้องอาศัย adapter นี้เป็นฐาน

## What Changes

- แทนโค้ดยิง kie.ai ใน `generate-video` / `video-status` ด้วย adapter 3 ขั้น (submit / poll / download) ที่แยกตาม `ai_models.features.video.api`:
  - `veo` → `POST /api/v1/veo/generate` + `GET /api/v1/veo/record-info` (อ่าน `response.resultUrls` เท่านั้น ห้ามใช้ `originUrls` ซึ่งเป็นไฟล์ 720p ก่อน upscale)
  - `market` → `POST /api/v1/jobs/createTask` + `GET /api/v1/jobs/recordInfo` (อ่าน `resultJson.resultUrls`)
- เพิ่มข้อมูลรายรุ่นใน `features.video` สำหรับ model ตระกูล `market`: ชื่อฟิลด์ภาพเริ่มต้น (`input_urls` สำหรับ Seedance 1.5 Pro, `first_frame_url` สำหรับ Seedance 2.0/2.5) และส่ง `generate_audio: true` เสมอ (Seedance 1.5 Pro ปิดเสียงเป็นค่าเริ่มต้น)
- ส่ง `duration` และ `resolution` ไปกับทุกคำขอ: Veo ใช้คลิป 8 วินาทีเสมอ (kie คิดราคาต่อคลิปเท่ากันทุกความยาว), Seedance ใช้ความยาวที่ใกล้ 8 วินาทีภายในช่วงที่รุ่นนั้นรองรับ; `resolution` รับจากคำขอ (`720p` | `1080p`, ค่าเริ่มต้น `720p`) ผ่าน selector ความละเอียดใหม่ในหัวข้อ "วิดีโอ"
- **BREAKING (ข้อมูล)**: ดาวน์โหลดวิดีโอผลลัพธ์มาเก็บที่ `uploads/content/videos/` แล้วบันทึก path ภายในลง `content_items.video_url` แทน URL ชั่วคราวของ kie.ai (`tempfile.aiquickdraw.com`) ที่หมดอายุ
- บันทึก model ที่ใช้สร้างวิดีโอไว้กับ content item (`content_items.video_model_id`) เพื่อให้ `video-status` poll ด้วย adapter ที่ถูกต้องแม้แอดมินเปลี่ยน model ระหว่างรอ และเป็นฐานให้ Phase 3a ป้องกันการผสมคลิปจากต่างตระกูล
- **BREAKING**: ตัดค่า `Auto` ออกจาก `aspect_ratio` ที่ `generate-video` รับ (Seedance ไม่รองรับ `Auto`) — รับเฉพาะ `9:16` | `16:9`
- ปุ่ม "sync models" (`api/ai-providers.php`) รวม `features` เดิมเข้ากับข้อมูลใหม่แทนการเขียนทับทั้งก้อน เพื่อไม่ให้ `features.video` หาย
- dropdown เลือก model วิดีโอในหน้า AI Settings แสดงเฉพาะ model ที่มี `features.video` และสถานะ `active`
- ยังสร้างแค่คลิปเดียวจากฉากแรกเหมือนเดิม — การยิงหลายคลิปเป็นงานของ Phase 3a

## Capabilities

### New Capabilities
- `video-model-capabilities`: ข้อมูล capability ของ model วิดีโอใน `ai_models.features.video` (ตระกูล API, ความยาว, ความละเอียด, หน่วยราคา, ชื่อฟิลด์ภาพ), การกรอง model ใน AI Settings และการ sync ที่ไม่ทับข้อมูลนี้
- `video-result-local-storage`: ดาวน์โหลดวิดีโอผลลัพธ์จาก kie.ai มาเก็บในระบบ และการจัดการเมื่อดาวน์โหลดไม่สำเร็จ

### Modified Capabilities
- `video-generation-provider-contract`: เปลี่ยน contract จาก "ยิง `/jobs/createTask` เสมอ" เป็นการเลือก endpoint ตามตระกูล model (`veo` / `market`), payload ต่อตระกูล, การอ่านสถานะ (`successFlag` สำหรับ veo / `state` สำหรับ market), การส่ง `duration`/`resolution`, การตัด `Auto` ออกจาก `aspect_ratio` และการบันทึก `video_model_id`
- `content-video-ui-section`: selector สัดส่วนวิดีโอเหลือ `9:16` / `16:9` (ตัด `Auto`) และเพิ่ม selector ความละเอียด `720p` / `1080p` ที่ส่งไปกับคำขอ `generate-video` (ยังไม่ persist ลง item — A1 จะย้ายไปเก็บที่ item)

## Impact

- **Backend**: `api/brand-content.php` (`generate-video`, `video-status` และ helper ใหม่สำหรับ adapter), `api/ai-providers.php` (sync models)
- **Frontend**: หน้า AI Settings (dropdown model วิดีโอ), ตัวเลือกสัดส่วนใน `ContentCardDialog.tsx` / `ContentVideoView.tsx` (ตัด `Auto`) — shape ของ response `generate-video`/`video-status` ไม่เปลี่ยน
- **Database**: migration ใหม่เพิ่ม `content_items.video_model_id`; อัปเดต `features.video` ของ Seedance ทั้ง 3 รุ่นให้มีชื่อฟิลด์ภาพ
- **Storage**: โฟลเดอร์ใหม่ `uploads/content/videos/` — ไฟล์ Veo 1080p 8 วิ ≈ 5MB, Seedance 720p 4 วิ ≈ 6MB
- **ภายนอก**: kie.ai ใช้ credit จริงทุกครั้งที่สร้างสำเร็จ (Veo Lite 720p = 30 credit/คลิป); image-to-video บน localhost ต้องเปิด ngrok ตอนทดสอบ เพราะ kie ต้องดึงภาพจาก URL สาธารณะ
- **ไม่อยู่ในขอบเขต**: ตัวเลือกความยาว/สัดส่วน/ความละเอียดในหน้าสร้างคอนเทนต์และการเก็บค่าเหล่านี้ใน item (change A1 ที่ตามมา), หลายคลิป (Phase 3a), ต่อคลิปด้วย ffmpeg (Phase 3b), OpenRouter
