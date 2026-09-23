# video-generation-provider-contract Specification

## Purpose

กำหนด request/response contract ระหว่าง `generate-video`/`video-status` (`api/brand-content.php`) กับ kie.ai ผ่าน adapter `api/lib/kie-video.php` ที่เลือก endpoint ตามตระกูลของ model (`features.video.api`): `veo` ใช้ `POST /api/v1/veo/generate` + `GET /api/v1/veo/record-info` ส่วน `market` (Seedance) ใช้ `POST /api/v1/jobs/createTask` + `GET /api/v1/jobs/recordInfo` — รองรับ 1 scene (scene แรก) ต่อคำขอ การยิงหลายคลิปเป็นงาน Phase 3

## Requirements

### Requirement: `generate-video` ยิงไปยัง endpoint จริงของ kie.ai
`generate-video` (`api/brand-content.php`) SHALL เลือก endpoint ตาม `features.video.api` ของ model ที่ตั้งไว้ใน `company_settings.ai_content_video_model_id`:
- `veo` → `POST {baseUrl}/api/v1/veo/generate`
- `market` → `POST {baseUrl}/api/v1/jobs/createTask`

โดย `baseUrl` มาจาก `ai_providers.api_base_url` (ตัด `/api/v1` ที่อาจต่อท้ายอยู่แล้วออกก่อน กัน path ซ้อนกัน) — ถ้า model ที่ตั้งไว้ไม่มี `features.video` ระบบ SHALL คืน error ภาษาไทยให้แอดมินเลือก model วิดีโอใหม่ และ SHALL ไม่ยิง API

#### Scenario: model ตระกูล veo
- **WHEN** model ที่ตั้งไว้คือ `veo3_lite` (`features.video.api = "veo"`) และผู้ใช้กด "สร้างวิดีโอ"
- **THEN** ระบบ SHALL ยิง `POST {baseUrl}/api/v1/veo/generate`

#### Scenario: model ตระกูล market
- **WHEN** model ที่ตั้งไว้คือ `bytedance/seedance-1.5-pro` (`features.video.api = "market"`)
- **THEN** ระบบ SHALL ยิง `POST {baseUrl}/api/v1/jobs/createTask`

#### Scenario: model ไม่มี features.video
- **WHEN** model ที่ตั้งไว้ไม่มี `features.video`
- **THEN** ระบบ SHALL คืน error ภาษาไทยว่าต้องเลือก model วิดีโอในหน้า AI Settings — SHALL ไม่ยิง API

### Requirement: Payload ใช้ scene แรกเท่านั้น พร้อมเลือกโหมดอัตโนมัติตามตระกูล model
`generate-video` SHALL ใช้ scene แรก (index 0) ของ `article_content.scenes` เท่านั้น `aspect_ratio` SHALL มาจาก `content_items.video_aspect_ratio` (NULL หรือค่าที่ไม่ใช่ `9:16` | `16:9` → `9:16`) และ `resolution` SHALL มาจาก `content_items.video_resolution` (NULL หรือค่าที่ไม่ใช่ `720p` | `1080p` → `720p`) — SHALL ไม่อ่าน `aspect_ratio` / `resolution` จากคำขอ โหมด image-to-video/text-to-video SHALL เลือกตาม `image_gen_status` ของ scene แรก (`failed` → ไม่ยิง API, ดู requirement "Scene แรกที่สร้างภาพล้มเหลว")

prompt SHALL ประกอบจาก `video_prompt` ของ scene แรก และถ้า `narration` ของ scene แรกไม่ว่าง SHALL ต่อท้ายด้วยคำสั่งให้ผู้บรรยายพูดบทนั้นเป็นภาษาไทย โดยใส่บทพากย์ในเครื่องหมายคำพูดตรงตามที่บันทึกไว้ (ไม่แปล ไม่ตัดทอน) — ถ้า `narration` ว่าง prompt SHALL เป็น `video_prompt` อย่างเดียวเหมือนเดิม

Payload ต่อตระกูล:
- `veo`: `{prompt, model, aspect_ratio, resolution, duration: 8}` — `done` → เพิ่ม `imageUrls: [absolute image_url]`; `none` → เพิ่ม `generationType: "TEXT_2_VIDEO"`
- `market`: `{model, input: {prompt, aspect_ratio, resolution, duration, generate_audio: true}}` — `done` → เพิ่มภาพที่ฟิลด์ `features.video.image_field` (`input_urls` เป็น array, `first_frame_url` เป็น string); `none` → ไม่ส่งฟิลด์ภาพ

`duration` ของ `market` SHALL เป็น 8 ถ้าอยู่ในช่วงที่ model รองรับ มิฉะนั้นใช้ค่าที่ใกล้ 8 ที่สุดในช่วงนั้น — ระบบ SHALL ส่ง `generate_audio: true` เสมอ ไม่พึ่งค่าเริ่มต้นของ kie.ai

#### Scenario: Veo image-to-video
- **WHEN** model เป็นตระกูล `veo` และ scene แรกมี `image_gen_status: "done"`
- **THEN** payload SHALL มี `imageUrls` เป็น array ที่มี absolute URL ของภาพ scene แรก
- **AND** SHALL มี `duration: 8` และไม่มี `generationType`

#### Scenario: Veo text-to-video
- **WHEN** model เป็นตระกูล `veo` และ scene แรกมี `image_gen_status: "none"`
- **THEN** payload SHALL มี `generationType: "TEXT_2_VIDEO"` และไม่มี `imageUrls`

#### Scenario: Seedance 1.5 Pro image-to-video
- **WHEN** model คือ `bytedance/seedance-1.5-pro` และ scene แรกมีภาพสำเร็จ
- **THEN** `input.input_urls` SHALL เป็น array ที่มี absolute URL ของภาพ
- **AND** `input.generate_audio` SHALL เป็น `true`

#### Scenario: Seedance 2.5 image-to-video
- **WHEN** model คือ `bytedance/seedance-2-5` และ scene แรกมีภาพสำเร็จ
- **THEN** `input.first_frame_url` SHALL เป็น string absolute URL ของภาพ

#### Scenario: สัดส่วนและความละเอียดมาจาก content item
- **WHEN** content item มี `video_aspect_ratio = '16:9'`, `video_resolution = '1080p'` และคำขอส่ง `aspect_ratio: "9:16"`, `resolution: "720p"` มาด้วย
- **THEN** payload SHALL ใช้ `16:9` และ `1080p` ตาม content item

#### Scenario: คอนเทนต์เก่าที่ยังไม่มีค่า
- **WHEN** content item มี `video_aspect_ratio` และ `video_resolution` เป็น NULL
- **THEN** payload SHALL ใช้ `9:16` และ `720p`

#### Scenario: ฉากแรกมีบทพากย์
- **WHEN** scene แรกมี `video_prompt = "กล้องซูมเข้าช้าๆ"` และ `narration = "คุณกำลังจ่ายค่า AI ซ้ำซ้อนอยู่หรือเปล่า?"`
- **THEN** prompt ที่ส่ง SHALL มีทั้ง "กล้องซูมเข้าช้าๆ" และบทพากย์ในเครื่องหมายคำพูดตรงตามต้นฉบับ พร้อมคำสั่งให้พูดเป็นภาษาไทย

#### Scenario: ฉากแรกไม่มีบทพากย์
- **WHEN** scene แรกมี `narration` ว่างหรือไม่มี key นี้
- **THEN** prompt ที่ส่ง SHALL เป็น `video_prompt` ของ scene แรกอย่างเดียว

### Requirement: Validation ใหม่ — scene แรกต้องมี video_prompt
`generate-video` SHALL คืน error ถ้า scene แรกไม่มี `video_prompt` (ว่างเปล่าหรือไม่มี key) — SHALL ไม่ยิง API ไปหา kie.ai ด้วย prompt ว่างเปล่า

#### Scenario: Scene แรกไม่มี video_prompt
- **WHEN** scene แรกมี `video_prompt` ว่างเปล่าหรือไม่มี key นี้เลย
- **THEN** ระบบ SHALL คืน error แนะนำให้เขียนหรือใช้ปุ่ม "AI เขียน Video Prompt" ก่อน — SHALL ไม่ยิง `createTask`

### Requirement: Scene แรกที่สร้างภาพล้มเหลว ไม่ fallback ไป text-to-video
เมื่อ scene แรกมี `image_gen_status: "failed"` ระบบ SHALL คืน error ที่มีเหตุผลจาก `image_gen_error` ของ scene นั้น — SHALL ไม่ยิง API เป็น text-to-video แทนแบบเงียบๆ

#### Scenario: Scene แรกสร้างภาพล้มเหลว
- **WHEN** scene แรกมี `image_gen_status: "failed"` และ `image_gen_error: "provider timeout"`
- **THEN** ระบบ SHALL คืน error ที่มีข้อความ "provider timeout" หรือใกล้เคียง — SHALL ไม่ยิง `createTask` เป็น text-to-video แทน

### Requirement: อ่าน `taskId` จาก response และบันทึก model ที่ใช้
`generate-video` SHALL อ่าน `data.taskId` จาก response (ทั้งสองตระกูลใช้ path เดียวกัน) บันทึกลง `content_items.video_job_id` และ SHALL บันทึก `ai_models.id` ของ model ที่ใช้ลง `content_items.video_model_id`

#### Scenario: สร้าง task สำเร็จ
- **WHEN** kie.ai ตอบกลับ `{"code": 200, "msg": "success", "data": {"taskId": "abc123"}}`
- **THEN** ระบบ SHALL บันทึก `video_job_id = "abc123"`, `video_model_id` = id ของ model ที่ใช้ และ `video_gen_status = "generating"`
- **AND** SHALL ตอบ frontend เป็น `{"status": "generating", "video_job_id": "abc123"}`

#### Scenario: response ไม่มี taskId
- **WHEN** kie.ai ตอบกลับโดยไม่มี `data.taskId` (เช่น credit ไม่พอ)
- **THEN** ระบบ SHALL คืน error ที่มีข้อความจาก `msg` ของ response จริง
- **AND** SHALL ไม่เปลี่ยน `video_job_id` / `video_model_id` เดิม

### Requirement: `video-status` poll ตามตระกูล model ที่บันทึกไว้
`video-status` SHALL เลือก adapter จาก `features.video.api` ของ `content_items.video_model_id` (ไม่ใช่ model ที่ตั้งไว้ปัจจุบัน) เพื่อให้ poll ถูกต้องแม้แอดมินเปลี่ยน model ระหว่างรอ แล้วแปลงสถานะเป็น `generating` / `done` / `failed`:
- `veo`: `GET /api/v1/veo/record-info?taskId=...` — `data.successFlag` `0` → generating, `1` → สำเร็จ (อ่าน URL จาก `data.response.resultUrls[0]` เท่านั้น SHALL ไม่ใช้ `originUrls`), `2` หรือ `3` → failed (ข้อความจาก `data.errorMessage`)
- `market`: `GET /api/v1/jobs/recordInfo?taskId=...` — `data.state` `waiting`/`queuing`/`generating` → generating, `success` → สำเร็จ (decode `data.resultJson` แล้วอ่าน `resultUrls[0]`), `fail` → failed (ข้อความจาก `data.failMsg`)

เมื่อสำเร็จ SHALL ดาวน์โหลดไฟล์ตาม capability `video-result-local-storage` ก่อนตั้ง `done` ถ้า `video_model_id` เป็น NULL (งานที่เริ่มก่อน change นี้) SHALL ใช้ adapter `market`

#### Scenario: Veo สร้างเสร็จที่ 1080p
- **WHEN** poll งาน Veo ได้ `successFlag: 1` พร้อม `response.resultUrls` (1080p) และ `response.originUrls` (720p)
- **THEN** ระบบ SHALL ดาวน์โหลดไฟล์จาก `resultUrls[0]` ไม่ใช่ `originUrls[0]`

#### Scenario: Seedance ยังไม่เสร็จ
- **WHEN** poll งาน Seedance ได้ `state: "waiting"`
- **THEN** ระบบ SHALL ตอบ `{"status": "generating", "video_job_id": ...}`

#### Scenario: งานล้มเหลว
- **WHEN** poll ได้ `successFlag: 2` (veo) หรือ `state: "fail"` (market)
- **THEN** ระบบ SHALL บันทึก `video_gen_status = "failed"` และตอบ `{"status": "failed", "error": <ข้อความจาก kie.ai>}`

#### Scenario: แอดมินเปลี่ยน model ระหว่างรอ
- **WHEN** งานเริ่มด้วย `veo3_lite` แล้วแอดมินเปลี่ยน model เป็น Seedance ระหว่างรอ
- **THEN** `video-status` SHALL ยัง poll ด้วย adapter `veo` ตาม `video_model_id` ของ item

### Requirement: Response contract ที่ frontend เห็นไม่เปลี่ยนแปลง
การเปลี่ยนแปลงนี้ SHALL ไม่แก้ shape ของ response ที่ `generate-video`/`video-status` ส่งกลับให้ frontend (`{status, video_job_id}` และ `{status, video_url, error}`) — ค่า `video_url` เปลี่ยนจาก URL ภายนอกเป็น path ภายใน `/uploads/content/videos/...` ซึ่ง `<video src>` เล่นได้แบบเดียวกับภาพ `/uploads/content/...` ที่ใช้อยู่

#### Scenario: Frontend เล่นวิดีโอจาก path ภายใน
- **WHEN** `video-status` ตอบ `{"status": "done", "video_url": "/uploads/content/videos/x.mp4"}`
- **THEN** video player ใน `ContentCardDialog.tsx` และ `ContentVideoView.tsx` SHALL เล่นไฟล์ได้โดยไม่ต้องแก้ logic การแสดงผล
