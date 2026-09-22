## MODIFIED Requirements

### Requirement: Payload ของ `createTask` ใช้ scene แรกเท่านั้น พร้อมเลือกโหมดอัตโนมัติ
`generate-video` SHALL ส่ง payload รูปแบบ `{model, callBackUrl: null, input: {prompt, image_urls?, generation_type?, aspect_ratio}}` โดยใช้ scene แรก (index 0) ของ `article_content.scenes` เท่านั้น — SHALL ไม่ส่ง scene อื่นแม้ content item จะมีหลาย scene `input.prompt` SHALL มาจาก `video_prompt` ของ scene แรก (ไม่ใช่ `visual_prompt`) `input.aspect_ratio` SHALL มาจากค่าที่ผู้ใช้เลือกในคำขอ (`9:16`/`16:9`/`Auto`) แทนค่า fix `9:16` เดิม โหมด image-to-video/text-to-video SHALL ถูกเลือกอัตโนมัติตาม `image_gen_status` ของ scene แรก:
- `done` → ส่ง `input.image_urls: [absolute image_url]` (แปลง relative path เป็น absolute เหมือนเดิม), ไม่ส่ง `generation_type`
- `none` → ไม่ส่ง `input.image_urls`, ส่ง `input.generation_type: "TEXT_2_VIDEO"`
- `failed` → SHALL ไม่ยิง API เลย คืน error ทันที (ดู requirement ถัดไป)

#### Scenario: Scene แรกมีภาพสำเร็จ (image-to-video)
- **WHEN** scene แรกมี `image_gen_status: "done"` และ `image_url`
- **THEN** `input.image_urls` SHALL มี `image_url` ของ scene แรก (แปลงเป็น absolute URL)
- **AND** `input.prompt` SHALL มาจาก `video_prompt` ของ scene แรก
- **AND** `input` SHALL ไม่มี key `generation_type`

#### Scenario: Scene แรกยังไม่เคยสร้างภาพ (text-to-video)
- **WHEN** scene แรกมี `image_gen_status: "none"`
- **THEN** `input` SHALL ไม่มี key `image_urls`
- **AND** `input.generation_type` SHALL เป็น `"TEXT_2_VIDEO"`
- **AND** `input.prompt` SHALL มาจาก `video_prompt` ของ scene แรก

#### Scenario: ผู้ใช้เลือกสัดส่วนวิดีโอ
- **WHEN** ผู้ใช้เลือกสัดส่วน `"16:9"` ก่อนกด "สร้างวิดีโอ"
- **THEN** `input.aspect_ratio` SHALL เป็น `"16:9"` ไม่ใช่ `"9:16"` ตายตัวแบบเดิม

## REMOVED Requirements

### Requirement: ยังคง validation เดิมว่าทุก scene ต้องมีภาพก่อน
**Reason**: ระบบใช้จริงแค่ scene แรก การบังคับทุก scene มีภาพก่อนไม่มีเหตุผลอีกต่อไป — แทนที่ด้วย validation ใหม่ที่เช็คแค่ scene แรกต้องมี `video_prompt` (ดู requirement ใหม่ด้านล่าง)
**Migration**: ไม่มีการ migrate ข้อมูล เป็นการเปลี่ยน validation logic เท่านั้น content item ที่เคย block เพราะ scene อื่นไม่มีภาพจะสร้างวิดีโอได้ทันทีถ้า scene แรกพร้อม

## ADDED Requirements

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
