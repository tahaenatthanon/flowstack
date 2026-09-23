## ADDED Requirements

### Requirement: ยิงคลิปรายฉากไปยัง endpoint ตามตระกูล model
action `generate-clips` (`api/brand-content.php`) SHALL ยิงแต่ละฉากผ่าน adapter `api/lib/kie-video.php` โดยเลือก endpoint ตาม `features.video.api` ของ model ที่เลือกตาม capability `video-clip-generation`:
- `veo` → `POST {baseUrl}/api/v1/veo/generate`
- `market` → `POST {baseUrl}/api/v1/jobs/createTask`

โดย `baseUrl` มาจาก `ai_providers.api_base_url` (ตัด `/api/v1` ที่ต่อท้ายออกก่อน) — model ที่ไม่มี `features.video` SHALL ไม่ถูกใช้ยิง

#### Scenario: model ตระกูล veo
- **WHEN** model ของวิดีโอคือ `veo3_lite` และผู้ใช้ยืนยันสร้างคลิป 3 ฉาก
- **THEN** ระบบ SHALL ยิง `POST {baseUrl}/api/v1/veo/generate` 3 ครั้ง ครั้งละ 1 ฉาก

#### Scenario: model ตระกูล market
- **WHEN** model ของวิดีโอคือ `bytedance/seedance-1.5-pro`
- **THEN** ระบบ SHALL ยิง `POST {baseUrl}/api/v1/jobs/createTask` ต่อฉาก

### Requirement: Payload ของคลิปรายฉาก
payload ของแต่ละฉาก SHALL ใช้ภาพของฉากนั้นแบบ image-to-video เสมอ (ฉากต้องมีภาพตาม capability `video-clip-generation`), `aspect_ratio` จาก `content_items.video_aspect_ratio` (NULL หรือค่าที่ไม่รู้จัก → `9:16`), `resolution` จาก `content_items.video_resolution` (NULL หรือค่าที่ไม่รู้จัก → `720p`) — SHALL ไม่อ่านสองค่านี้จากคำขอ — URL ของภาพ SHALL เป็น absolute URL ที่ประกอบจาก `VITE_APP_URL`

prompt SHALL ประกอบจาก `video_prompt` ของฉาก: ถ้า `narration` ไม่ว่าง SHALL ต่อท้ายด้วยคำสั่งให้ผู้บรรยายพูดบทนั้นเป็นภาษาไทยโดยใส่บทพากย์ในเครื่องหมายคำพูดตรงตามที่บันทึกไว้; ถ้าว่าง SHALL ต่อท้ายด้วยคำสั่งให้มีแต่เสียงบรรยากาศ ไม่มีเสียงพูด

Payload ต่อตระกูล:
- `veo`: `{prompt, model, aspect_ratio, resolution, duration: 8, imageUrls: [absolute image_url]}`
- `market`: `{model, input: {prompt, aspect_ratio, resolution, duration, generate_audio: true}}` พร้อมภาพที่ฟิลด์ `features.video.image_field` (`input_urls` เป็น array, `first_frame_url` เป็น string)

`duration` ของ `market` SHALL เป็น 8 ถ้าอยู่ในช่วงที่ model รองรับ มิฉะนั้นใช้ค่าที่ใกล้ 8 ที่สุด — SHALL ส่ง `generate_audio: true` เสมอ

#### Scenario: Veo ฉากที่มีบทพากย์
- **WHEN** ฉากมี `video_prompt = "กล้องซูมเข้าช้าๆ"`, `narration = "คุณกำลังจ่ายค่า AI ซ้ำซ้อนอยู่หรือเปล่า?"` และ item เป็น `16:9` / `1080p`
- **THEN** payload SHALL มี `imageUrls` ของภาพฉากนั้น, `aspect_ratio: "16:9"`, `resolution: "1080p"`, `duration: 8`
- **AND** prompt SHALL มีบทพากย์ในเครื่องหมายคำพูดตรงตามต้นฉบับพร้อมคำสั่งให้พูดเป็นภาษาไทย

#### Scenario: Seedance 1.5 Pro ฉากไม่มีบทพากย์
- **WHEN** model คือ `bytedance/seedance-1.5-pro` และ `narration` ของฉากว่าง
- **THEN** `input.input_urls` SHALL เป็น array ที่มี absolute URL ของภาพ, `input.generate_audio` SHALL เป็น `true`
- **AND** prompt SHALL มีคำสั่งว่ามีแต่เสียงบรรยากาศ ไม่มีเสียงพูด

#### Scenario: Seedance 2.5
- **WHEN** model คือ `bytedance/seedance-2-5`
- **THEN** `input.first_frame_url` SHALL เป็น string absolute URL ของภาพ

### Requirement: อ่าน `taskId` ของคลิป
ระบบ SHALL อ่าน `data.taskId` จาก response (ทั้งสองตระกูลใช้ path เดียวกัน) แล้วบันทึกลง `content_video_clips.job_id` ของแถวที่จองไว้ — ถ้าไม่มี `taskId` SHALL ตั้งแถวเป็น `failed` พร้อม `error` จาก `msg` ของ response จริง

#### Scenario: สร้าง task สำเร็จ
- **WHEN** kie.ai ตอบ `{"code": 200, "data": {"taskId": "abc123"}}`
- **THEN** แถวคลิปที่จองไว้ SHALL มี `job_id = "abc123"` และ `status = "generating"`

#### Scenario: credit ไม่พอ
- **WHEN** kie.ai ตอบโดยไม่มี `taskId` พร้อม `msg` ว่า credit ไม่พอ
- **THEN** แถวคลิป SHALL เป็น `failed` ที่ `error` มีข้อความจาก `msg`

### Requirement: poll คลิปตามตระกูล model ของคลิป
action `clip-status` และ cron `video-clips-sync` SHALL poll คลิปด้วย adapter จาก `features.video.api` ของ `content_video_clips.model_id` (ไม่ใช่ model ปัจจุบัน) แล้วแปลงสถานะ:
- `veo`: `GET /api/v1/veo/record-info?taskId=...` — `successFlag` `0` → generating, `1` → สำเร็จ (URL จาก `response.resultUrls[0]` เท่านั้น SHALL ไม่ใช้ `originUrls`), `2`/`3` → failed (ข้อความจาก `errorMessage`)
- `market`: `GET /api/v1/jobs/recordInfo?taskId=...` — `waiting`/`queuing`/`generating` → generating, `success` → สำเร็จ (decode `resultJson` แล้วอ่าน `resultUrls[0]`, และอ่าน `creditsConsumed` ถ้ามี), `fail` → failed (ข้อความจาก `failMsg`)

เมื่อสำเร็จ SHALL ดาวน์โหลดไฟล์ตาม capability `video-result-local-storage` ก่อนตั้ง `done` — `clip-status` SHALL poll เฉพาะคลิป `generating` ของ Active Scene ของ item ที่ขอ

#### Scenario: Veo สร้างเสร็จที่ 1080p
- **WHEN** poll คลิป Veo ได้ `successFlag: 1` พร้อม `resultUrls` (1080p) และ `originUrls` (720p)
- **THEN** ระบบ SHALL ดาวน์โหลดจาก `resultUrls[0]`

#### Scenario: Seedance ส่งยอด credit จริง
- **WHEN** poll คลิป Seedance ได้ `state: "success"` พร้อม `creditsConsumed: 56`
- **THEN** `credits_actual` ของคลิป SHALL เป็น 56

#### Scenario: แอดมินเปลี่ยน model ระหว่างรอ
- **WHEN** คลิปเริ่มด้วย `veo3_lite` แล้วแอดมินเปลี่ยน model เป็น Seedance
- **THEN** ระบบ SHALL poll คลิปนั้นด้วย adapter `veo` ตาม `model_id` ของคลิป

## REMOVED Requirements

### Requirement: `generate-video` ยิงไปยัง endpoint จริงของ kie.ai
**Reason**: `generate-video` ที่ยิงแค่ฉากแรกถูกแทนด้วย `generate-clips` ที่ยิงรายฉาก
**Migration**: ใช้ requirement "ยิงคลิปรายฉากไปยัง endpoint ตามตระกูล model" — frontend เรียก `generate-clips` พร้อม `scene_ids`

### Requirement: Payload ใช้ scene แรกเท่านั้น พร้อมเลือกโหมดอัตโนมัติตามตระกูล model
**Reason**: ยิงทุกฉากแบบ image-to-video เสมอ ไม่มีโหมด text-to-video ของฉากแรกอีกต่อไป
**Migration**: ใช้ requirement "Payload ของคลิปรายฉาก"

### Requirement: Validation ใหม่ — scene แรกต้องมี video_prompt
**Reason**: เงื่อนไขความพร้อมใช้กับทุกฉาก ไม่ใช่เฉพาะฉากแรก
**Migration**: ดู requirement "เงื่อนไขความพร้อมของฉากก่อนสร้างคลิป" ใน capability `video-clip-generation`

### Requirement: Scene แรกที่สร้างภาพล้มเหลว ไม่ fallback ไป text-to-video
**Reason**: ทุกฉากต้องมีภาพ `done` ก่อนสร้างคลิป จึงไม่มี fallback ไป text-to-video ในทุกกรณี
**Migration**: ดู requirement "เงื่อนไขความพร้อมของฉากก่อนสร้างคลิป" ใน capability `video-clip-generation`

### Requirement: อ่าน `taskId` จาก response และบันทึก model ที่ใช้
**Reason**: `taskId` และ model บันทึกต่อคลิปใน `content_video_clips` แทน `content_items.video_job_id`
**Migration**: ใช้ requirement "อ่าน `taskId` ของคลิป" — `content_items.video_job_id` ไม่ถูกใช้แล้ว

### Requirement: `video-status` poll ตามตระกูล model ที่บันทึกไว้
**Reason**: `video-status` ถูกแทนด้วย `clip-status` และ cron `video-clips-sync` ที่ poll รายคลิป
**Migration**: ใช้ requirement "poll คลิปตามตระกูล model ของคลิป"

### Requirement: Response contract ที่ frontend เห็นไม่เปลี่ยนแปลง
**Reason**: frontend เปลี่ยนไปใช้ `video-state` / `generate-clips` / `clip-status` / `combine-video` ซึ่งมี response ใหม่
**Migration**: ดู capability `video-clips-ui` — player ของคลิปและวิดีโอรวมยังเล่นไฟล์จาก path ภายใน `/uploads/content/videos/...`
