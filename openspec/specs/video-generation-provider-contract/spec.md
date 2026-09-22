# video-generation-provider-contract Specification

## Purpose

กำหนด request/response contract ที่แท้จริงระหว่าง `generate-video`/`video-status` (`api/brand-content.php`) กับ kie.ai (`POST /api/v1/jobs/createTask` สร้าง task, `GET /api/v1/jobs/recordInfo` poll ผล) แทน contract ที่สมมติขึ้นเองเดิม (`/video/generations`) ที่ไม่มีอยู่จริง รวมถึงขอบเขตว่ารองรับแค่ 1 scene ต่อคำขอ (kie.ai ไม่รองรับ multi-scene stitching ในคำขอเดียว)

## Requirements

### Requirement: `generate-video` ยิงไปยัง endpoint จริงของ kie.ai
`generate-video` (`api/brand-content.php`) SHALL ยิง `POST {baseUrl}/api/v1/jobs/createTask` แทน `POST {baseUrl}/video/generations` เดิม โดย `baseUrl` มาจากค่าที่ตั้งไว้ใน `company_settings.ai_content_video_model_id → ai_models → ai_providers.api_base_url` เหมือนเดิม (ตัด `/api/v1` ที่อาจต่อท้ายอยู่แล้วใน DB ออกก่อน กัน path ซ้อนกัน)

#### Scenario: เรียก endpoint ที่ถูกต้อง
- **WHEN** ผู้ใช้กด "สร้างวิดีโอ" สำหรับ content item ที่มีอย่างน้อย 1 scene พร้อม `image_url`
- **THEN** ระบบ SHALL ยิง HTTP request ไปที่ `{baseUrl}/api/v1/jobs/createTask` ไม่ใช่ `{baseUrl}/video/generations`

### Requirement: Payload ของ `createTask` ใช้ scene แรกที่มีภาพเท่านั้น
`generate-video` SHALL ส่ง payload รูปแบบ `{model, callBackUrl: null, input: {prompt, image_urls, aspect_ratio}}` โดยใช้ scene แรก (index 0) ของ `article_content.scenes` ที่ผ่าน validation ว่ามี `image_url` แล้วเท่านั้น — SHALL ไม่ส่ง scene อื่นแม้ content item จะมีหลาย scene — SHALL แปลง `image_url` เป็น absolute URL ก่อนส่ง (ถ้าเป็น relative path)

#### Scenario: Content item มีหลาย scene
- **WHEN** content item มี 3 scenes ที่มี `image_url` ครบทุกตัว
- **THEN** `input.image_urls` SHALL มีแค่ `image_url` ของ scene แรก (index 0) เท่านั้น
- **AND** `input.prompt` SHALL มาจาก `visual_prompt` ของ scene แรกเท่านั้น

#### Scenario: ยังคง validation เดิมว่าทุก scene ต้องมีภาพก่อน
- **WHEN** content item มี scene ที่ยังไม่มี `image_url`
- **THEN** ระบบ SHALL แสดง error "กรุณากด 'สร้างภาพทุกฉาก' ให้ครบก่อน" เหมือนพฤติกรรมเดิมทุกประการ ก่อนจะพยายามยิง API

### Requirement: อ่าน `taskId` จาก response ของ `createTask`
`generate-video` SHALL อ่าน `data.taskId` จาก response ของ `createTask` และเก็บไว้ในคอลัมน์ `content_items.video_job_id` เดิม (ไม่เพิ่มคอลัมน์ใหม่) — SHALL ไม่อ่าน `job_id`/`id`/`video_url` ที่ระดับบนสุดของ response แบบเดิม

#### Scenario: สร้าง task สำเร็จ
- **WHEN** kie.ai ตอบกลับ `{"code": 200, "msg": "success", "data": {"taskId": "veo_task_abc123"}}`
- **THEN** ระบบ SHALL บันทึก `video_job_id = "veo_task_abc123"` และ `video_gen_status = "generating"`
- **AND** ระบบ SHALL ตอบ frontend เป็น `{"status": "generating", "video_job_id": "veo_task_abc123"}` (contract เดิมที่ frontend รู้จัก)

#### Scenario: response ไม่มี taskId
- **WHEN** kie.ai ตอบกลับโดยไม่มี `data.taskId` (เช่น validation error หรือ credit ไม่พอ)
- **THEN** ระบบ SHALL คืน error ที่มีข้อความจาก `msg` ของ response จริง ไม่ใช่ error message ทั่วไปที่ไม่มีบริบท

### Requirement: `video-status` poll endpoint จริงและ decode ผลลัพธ์ซ้อน 2 ชั้น
`video-status` SHALL ยิง `GET {baseUrl}/api/v1/jobs/recordInfo?taskId={video_job_id}` แทน `GET {baseUrl}/video/generations/{jobId}` เดิม และ SHALL แปลง `data.state` เป็นสถานะที่ frontend รู้จัก (`generating`/`done`/`failed`) — เมื่อ `state === 'success'` SHALL `json_decode` ค่าใน `data.resultJson` (เป็น JSON string ซ้อนอีกชั้น) เพื่ออ่าน `resultUrls[0]` เป็น `video_url`

#### Scenario: งานยังไม่เสร็จ
- **WHEN** kie.ai ตอบ `data.state` เป็น `waiting`, `queuing`, หรือ `generating`
- **THEN** ระบบ SHALL ตอบ frontend เป็น `{"status": "generating", "video_job_id": ...}` เหมือนพฤติกรรมเดิม

#### Scenario: งานเสร็จสำเร็จ
- **WHEN** kie.ai ตอบ `data.state === "success"` พร้อม `data.resultJson = "{\"resultUrls\":[\"https://.../video.mp4\"]}"`
- **THEN** ระบบ SHALL decode `resultJson` แล้วอ่าน `resultUrls[0]` เป็น `video_url`
- **AND** SHALL บันทึก `video_gen_status = "done"`, `video_url = "https://.../video.mp4"`
- **AND** SHALL ตอบ frontend เป็น `{"status": "done", "video_url": "https://.../video.mp4"}`

> **หมายเหตุ**: scenario นี้ยืนยันจากเอกสารทางการของ kie.ai เท่านั้น ยังไม่เคยทดสอบกับ response จริงตอนสำเร็จ (บัญชีทดสอบเครดิตไม่พอ) — ดู task ติดตามผล "Verify kie.ai video-status polling after credit top-up"

#### Scenario: งานล้มเหลว
- **WHEN** kie.ai ตอบ `data.state === "fail"` พร้อม `data.failMsg`
- **THEN** ระบบ SHALL บันทึก `video_gen_status = "failed"`
- **AND** SHALL ตอบ frontend เป็น `{"status": "failed", "error": <ค่าจาก data.failMsg>}`

### Requirement: Response contract ที่ frontend เห็นไม่เปลี่ยนแปลง
การเปลี่ยนแปลงนี้ SHALL ไม่แก้ shape ของ response ที่ `generate-video`/`video-status` ส่งกลับให้ frontend (`{status, video_job_id}` และ `{status, video_url, error}`) — SHALL ไม่ต้องแก้ `ContentVideoView.tsx` หรือ `ContentCardDialog.tsx` เลย

#### Scenario: Frontend ทำงานได้โดยไม่ต้องแก้โค้ด
- **WHEN** deploy การเปลี่ยนแปลงนี้แล้ว
- **THEN** `ContentVideoView.tsx` และ `ContentCardDialog.tsx` SHALL ทำงานถูกต้องโดยไม่ต้องแก้ไขไฟล์เหล่านี้เลย
