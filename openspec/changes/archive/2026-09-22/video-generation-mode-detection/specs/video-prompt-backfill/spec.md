## ADDED Requirements

### Requirement: API สร้าง video_prompt ย้อนหลังสำหรับ scene เดียว
ระบบ SHALL มี API action `generate-scene-video-prompt` (รับ `item_id` + `scene_index`) ที่ใช้ AI เขียนคำสั่งการเคลื่อนไหว (`video_prompt`) จาก `visual_prompt` ของ scene นั้น พร้อมบริบทหัวข้อ (title) และสไตล์ภาพที่เลือกไว้ (`image_style`) — SHALL ใช้ text model (`ai_content_text_model_id`) ไม่ใช่ image model — SHALL เขียนผลลัพธ์ลง `scenes[scene_index].video_prompt` ทันทีเมื่อสำเร็จ (persist ลง DB โดยไม่ต้องให้ผู้ใช้กดบันทึกซ้ำ)

#### Scenario: เขียน video_prompt ย้อนหลังสำเร็จ
- **WHEN** เรียก `generate-scene-video-prompt` สำหรับ scene ที่มี `visual_prompt: "ภาพพนักงานออฟฟิศกำลังทำงาน"` และ `image_style: "photorealistic"`
- **THEN** ระบบ SHALL เรียก text model เขียนคำสั่งการเคลื่อนไหวที่สอดคล้องกับคำบรรยายภาพและสไตล์นั้น แล้วบันทึกลง `scenes[idx].video_prompt`

#### Scenario: Scene ไม่มี visual_prompt
- **WHEN** เรียก `generate-scene-video-prompt` สำหรับ scene ที่ `visual_prompt` ว่างเปล่า
- **THEN** ระบบ SHALL คืน error ทันที — SHALL ไม่เรียก AI (ไม่มีข้อมูลตั้งต้นให้เขียนจาก)

#### Scenario: scene_index อยู่นอกขอบเขต
- **WHEN** `scene_index` ที่ส่งมาไม่ตรงกับ scene ใดใน `article_content.scenes`
- **THEN** ระบบ SHALL คืน error "scene_index อยู่นอกขอบเขตของ scenes" (รูปแบบเดียวกับ action อื่นที่มีอยู่แล้ว เช่น `update-scene`, `generate-scene-image`)

### Requirement: ไม่เรียก AI ซ้ำโดยไม่จำเป็นระหว่างกำลังเขียน
ปุ่ม "AI เขียน Video Prompt" ของ scene ที่กำลังเรียก AI อยู่ SHALL แสดง loading state และถูก disable เฉพาะ scene card นั้น (ไม่ล็อก scene อื่น) เพื่อป้องกันผู้ใช้กดซ้ำเสีย credit เกินจำเป็น

#### Scenario: กดปุ่มระหว่างกำลังประมวลผล
- **WHEN** ผู้ใช้กดปุ่ม "AI เขียน Video Prompt" ของ scene หนึ่งแล้วยังไม่ตอบกลับ
- **THEN** ปุ่มของ scene นั้น SHALL แสดง loading และกดซ้ำไม่ได้ — ปุ่มของ scene อื่น SHALL ยังกดได้ปกติ
