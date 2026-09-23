## MODIFIED Requirements

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
