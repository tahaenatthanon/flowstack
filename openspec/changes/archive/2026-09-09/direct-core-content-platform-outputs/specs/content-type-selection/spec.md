## MODIFIED Requirements

### Requirement: generate-article ใช้ type ที่บันทึกจริงเลือก AI prompt flow
`generate-article` SHALL อ่าน `content_items.type` ที่บันทึกจริง และ SHALL เลือก prompt flow วิดีโอ (scene-by-scene framing) เมื่อ `type='video'` หรือ prompt flow บทความ (SEO/AEO HTML) เมื่อเป็นค่าอื่น โดยทั้งสอง prompt flow SHALL ขอเนื้อหา Core Article (body ที่แปลงเป็น HTML ได้) จาก AI เสมอ — Content Type มีผลต่อโทน/โครงสร้างของเนื้อหาเท่านั้น ไม่ใช่ต่อการมีอยู่ของเนื้อหา Core Article

#### Scenario: type=video ใช้ video prompt
- **WHEN** คอนเทนต์มี `type='video'` และเรียก `generate-article`
- **THEN** ระบบใช้ prompt กำหนดโครงสร้างวิดีโอ (scripts สำหรับ platform ที่เลือก, visuals)
- **AND** ระบบยังคงขอเนื้อหา Core Article (เช่น `full_html` หรือ field ที่แปลงเป็น HTML ได้) จาก AI เสมอ ไม่ปล่อยว่างให้ Core Article ไม่มีเนื้อหา
- **AND** `script_sections` ถูกขอเฉพาะเมื่อ platform ที่เลือกมี TikTok หรือ YouTube เท่านั้น (ดู capability `core-content-platform-output-shape`)

#### Scenario: type=article ใช้ article prompt
- **WHEN** คอนเทนต์มี `type='article'` และเรียก `generate-article`
- **THEN** ระบบใช้ prompt บทความพร้อม SEO/AEO และสร้าง `full_html`
