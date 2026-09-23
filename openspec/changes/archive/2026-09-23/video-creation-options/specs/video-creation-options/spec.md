## ADDED Requirements

### Requirement: เลือกความยาววิดีโอจาก 4 ค่า
เมื่อสร้างคอนเทนต์ประเภทวิดีโอผ่าน QuickCreate หรือ BatchGenerate (ตั้งค่าแยกต่อหัวข้อ) ผู้ใช้ SHALL เลือกความยาวได้จาก `30s`, `45s`, `60s`, `90s` เท่านั้น (ค่าเริ่มต้น `60s`) — backend (`normalizeVideoDuration`) SHALL รับเฉพาะ 30, 45, 60, 90 วินาที ค่าอื่นใช้ 60 — UI SHALL แสดงจำนวนฉากและความยาวจริงประกอบค่าที่เลือก เพราะวิดีโอถูกสร้างเป็นฉากละ 8 วินาที

#### Scenario: ตัวเลือกความยาว
- **WHEN** ผู้ใช้เปิด QuickCreate แล้วเลือกประเภทวิดีโอ
- **THEN** ตัวเลือกความยาว SHALL มีแค่ 30s, 45s, 60s, 90s — SHALL ไม่มี 15s, 3min, 10min+

#### Scenario: แสดงความยาวจริง
- **WHEN** ผู้ใช้เลือก `60s`
- **THEN** UI SHALL แสดงข้อความประกอบว่าได้ประมาณ 56 วินาที 7 ฉาก

#### Scenario: backend ได้ค่าที่ไม่รองรับ
- **WHEN** คำขอ `generate-plan` ส่ง `duration: 180`
- **THEN** ระบบ SHALL ใช้ 60 วินาที

### Requirement: เลือกสัดส่วนและความละเอียดตอนสร้างคอนเทนต์
เมื่อสร้างคอนเทนต์ประเภทวิดีโอผ่าน QuickCreate หรือ BatchGenerate (ต่อหัวข้อ) ผู้ใช้ SHALL เลือก "อัตราส่วนวิดีโอ" `9:16` | `16:9` (ค่าเริ่มต้น `9:16`) และ "ความละเอียดวิดีโอ" `720p` | `1080p` (ค่าเริ่มต้น `720p`) — ชื่อที่แสดงบนหน้าจอ SHALL เป็น "ความยาววิดีโอ", "อัตราส่วนวิดีโอ" และ "ความละเอียดวิดีโอ" เพื่อให้ชัดว่าเป็นการตั้งค่าของวิดีโอ (ไม่ใช่ของภาพหน้าปกหรือบทความ) และตัวเลือกอัตราส่วน SHALL แสดงเป็นกล่องที่มีรูปสี่เหลี่ยมวาดตามอัตราส่วนจริง (กรอบเส้นขอบขนาดสัดส่วน 16:9 หรือ 9:16) คู่กับข้อความอัตราส่วน เช่น `▭ 16:9` / `▯ 9:16` และมี tooltip "แนวนอน" / "แนวตั้ง" — กล่องที่เลือกอยู่ SHALL เน้นด้วยสี primary — `generate-plan` SHALL รับ `aspect_ratio` และ `resolution` แล้วบันทึกลง `content_items.video_aspect_ratio` และ `content_items.video_resolution` ค่าอื่นที่ไม่รองรับ SHALL ใช้ค่าเริ่มต้น — คอนเทนต์ประเภทอื่นที่ไม่ใช่วิดีโอ SHALL เก็บค่าเป็น NULL

#### Scenario: ชื่อตัวเลือกบนหน้าจอ
- **WHEN** ผู้ใช้เลือกประเภทวิดีโอใน QuickCreate
- **THEN** SHALL เห็นหัวข้อ "ความยาววิดีโอ", "อัตราส่วนวิดีโอ" และ "ความละเอียดวิดีโอ"

#### Scenario: กล่องอัตราส่วนแสดงรูปทรงจริง
- **WHEN** ผู้ใช้ดูตัวเลือก "อัตราส่วนวิดีโอ"
- **THEN** กล่อง `16:9` SHALL มีรูปสี่เหลี่ยมแนวนอนสัดส่วน 16:9 และกล่อง `9:16` SHALL มีรูปสี่เหลี่ยมแนวตั้งสัดส่วน 9:16 อยู่หน้าข้อความ

#### Scenario: สร้างคอนเทนต์วิดีโอ 16:9 1080p
- **WHEN** ผู้ใช้เลือก `16:9` และ `1080p` แล้วกดสร้างคอนเทนต์วิดีโอ
- **THEN** content item ที่ได้ SHALL มี `video_aspect_ratio = '16:9'` และ `video_resolution = '1080p'`

#### Scenario: BatchGenerate หลายหัวข้อคนละค่า
- **WHEN** หัวข้อแรกเลือก `9:16`/`720p` และหัวข้อที่สองเลือก `16:9`/`1080p`
- **THEN** content item ของแต่ละหัวข้อ SHALL เก็บค่าตามหัวข้อนั้น ไม่ปนกัน

#### Scenario: คอนเทนต์บทความ
- **WHEN** ผู้ใช้สร้างคอนเทนต์ประเภทบทความ
- **THEN** `video_aspect_ratio` และ `video_resolution` SHALL เป็น NULL และ UI SHALL ไม่แสดงตัวเลือกทั้งสอง

### Requirement: สัดส่วนและความละเอียดถูกล็อกหลังสร้าง
หลังสร้างคอนเทนต์แล้ว ระบบ SHALL ไม่มีช่องทางแก้ไข `video_aspect_ratio` / `video_resolution` ผ่าน UI หรือ API — API แก้ไขคอนเทนต์ (`content-items.php` PUT) SHALL ไม่รับสองฟิลด์นี้ — `generate-video`, `generate-scene-images` และ `generate-scene-image` SHALL อ่านค่าจาก content item เท่านั้น

#### Scenario: พยายามแก้ผ่าน API
- **WHEN** คำขอ PUT ของ `content-items.php` ส่ง `video_resolution: '1080p'` มากับคอนเทนต์ที่เป็น `720p`
- **THEN** `video_resolution` SHALL ยังเป็น `720p`

#### Scenario: API รายการคอนเทนต์ส่งค่ากลับ
- **WHEN** frontend ดึงรายการหรือรายละเอียดคอนเทนต์
- **THEN** response SHALL มี `video_aspect_ratio` และ `video_resolution`

### Requirement: แปลงข้อมูลคอนเทนต์วิดีโอเดิม
migration SHALL แปลง `content_items.duration_sec` ที่ไม่อยู่ใน 30/45/60/90 เป็นค่าที่ใกล้ที่สุด (15 → 30, 180 และ 600 → 90) และตั้ง `video_aspect_ratio = '9:16'`, `video_resolution = '720p'` ให้คอนเทนต์ประเภทวิดีโอเดิมที่ยังเป็น NULL — migration SHALL รันซ้ำได้โดยผลเหมือนเดิม

#### Scenario: คอนเทนต์เดิมเลือก 3 นาที
- **WHEN** คอนเทนต์วิดีโอเดิมมี `duration_sec = 180`
- **THEN** หลัง migration SHALL เป็น 90 และมี `video_aspect_ratio = '9:16'`, `video_resolution = '720p'`

### Requirement: แคปชั่นของคอนเทนต์วิดีโอไม่มีสคริปต์ปน
ขั้น `generate-plan` (สร้าง topic / caption / image_brief) ของคอนเทนต์วิดีโอ SHALL สั่ง AI ว่า `caption` คือแคปชั่นสำหรับโพสต์โซเชียลเท่านั้น SHALL ไม่ใส่สคริปต์, รายการฉาก, "Visual", "Voiceover" หรือบทพากย์ เพราะสคริปต์และฉากถูกสร้างในขั้น `generate-article` — ขั้น `generate-plan` SHALL ไม่ส่งข้อกำหนดจำนวนฉาก/บทพากย์ (`videoDurationInstruction`) ให้ AI (ขั้น `generate-article` อ่าน `duration_sec` จาก content item เอง) แต่ยังส่งรูปแบบสคริปต์และความยาวเป้าหมายเป็นข้อมูลประกอบโทนของแคปชั่นได้

#### Scenario: สร้างคอนเทนต์วิดีโอใหม่
- **WHEN** ผู้ใช้สร้างคอนเทนต์วิดีโอ 30 วินาทีผ่าน QuickCreate
- **THEN** system prompt ของ `generate-plan` SHALL มีกฎห้ามใส่สคริปต์/ฉาก/Voiceover ใน caption และ SHALL ไม่มีข้อความ "visuals ต้องมี EXACTLY"
