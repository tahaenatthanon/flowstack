## ADDED Requirements

### Requirement: Frontend ส่ง type ที่ผู้ใช้เลือกไปยัง backend
หน้าสร้างคอนเทนต์ SHALL ส่งค่า `type` (ค่า `article` หรือ `video`) ที่ผู้ใช้เลือกในคำขอ `generate-plan` และ `plan-items` เพื่อให้ backend บันทึกประเภทที่แท้จริง

#### Scenario: เลือกวิดีโอส่ง type=video
- **WHEN** ผู้ใช้เลือกประเภท "วิดีโอ" แล้วกดสร้าง
- **THEN** คำขอ `generate-plan` มี `type: 'video'`

#### Scenario: เลือกบทความส่ง type=article
- **WHEN** ผู้ใช้เลือกประเภท "บทความ" แล้วกดสร้าง
- **THEN** คำขอ `generate-plan` มี `type: 'article'`

### Requirement: Backend บันทึก type จากค่าที่ได้รับแทนการ hardcode article
Backend SHALL บันทึกคอลัมน์ `content_items.type` จากค่า `type` ที่ได้รับ (ผ่านการตรวจว่าเป็น `article` หรือ `video`) และ SHALL fallback เป็น `article` เมื่อไม่ได้ส่งค่า โดยไม่กำหนดค่า hardcode ในทุกจุด INSERT

#### Scenario: บันทึก type=video ที่ได้รับ
- **WHEN** คำขอสร้างคอนเทนต์ส่ง `type: 'video'`
- **THEN** `content_items.type` ถูกบันทึกเป็น `video`

#### Scenario: fallback เป็น article เมื่อไม่ส่ง type
- **WHEN** คำขอสร้างคอนเทนต์ไม่ส่ง `type`
- **THEN** `content_items.type` ถูกบันทึกเป็น `article`

#### Scenario: ปฏิเสธ type ที่ไม่รู้จัก
- **WHEN** คำขอส่ง `type` ที่ไม่ใช่ `article` หรือ `video`
- **THEN** ระบบใช้ `article` หรือคืน error 400 ตามข้อกำหนดของ endpoint

### Requirement: generate-article ใช้ type ที่บันทึกจริงเลือก AI prompt flow
`generate-article` SHALL อ่าน `content_items.type` ที่บันทึกจริง และ SHALL เลือก prompt flow วิดีโอ (scene-by-scene script) เมื่อ `type='video'` หรือ prompt flow บทความ (SEO/AEO HTML) เมื่อเป็นค่าอื่น

#### Scenario: type=video ใช้ video prompt
- **WHEN** คอนเทนต์มี `type='video'` และเรียก `generate-article`
- **THEN** ระบบใช้ prompt กำหนดโครงสร้างวิดีโอ (scripts, script_sections, visuals) และไม่สร้าง `full_html` แบบบทความ

#### Scenario: type=article ใช้ article prompt
- **WHEN** คอนเทนต์มี `type='article'` และเรียก `generate-article`
- **THEN** ระบบใช้ prompt บทความพร้อม SEO/AEO และสร้าง `full_html`
