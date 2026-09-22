# content-style-ai-default Specification

## Purpose

เพิ่มตัวเลือก "AI เลือกให้" เข้า สไตล์การเขียน (article tone) และ รูปแบบสคริปต์ (video script style) ที่มีอยู่แล้ว พร้อมเปลี่ยนค่าเริ่มต้นจากค่าคงที่เดิมเป็น "AI เลือกให้" เพื่อความสอดคล้องกับ image-style-selection ที่ AI เป็นค่าเริ่มต้นเช่นกัน

## Requirements

### Requirement: ตัวเลือก "AI เลือกให้" ใน สไตล์การเขียน (article tone)
`ARTICLE_TONE_OPTIONS` SHALL มีตัวเลือก "🤖 AI เลือกให้" เพิ่มจาก 4 ตัวเลือกเดิม (กันเอง/ทางการ/ให้ความรู้/เล่าเรื่อง) และตัวเลือกนี้ SHALL เป็นค่าเริ่มต้นของ state `tone` ใน `QuickCreateDialog` และของแต่ละ topic row ใน `BatchGenerateDialog`

#### Scenario: สร้าง article ใหม่โดยไม่เลือกโทนเอง
- **WHEN** ผู้ใช้เปิด QuickCreateDialog เลือก content type เป็น article แล้ว generate โดยไม่แตะตัวเลือก "สไตล์การเขียน"
- **THEN** ระบบ SHALL ส่ง `tone: "ai"` และไม่ฝัง instruction เรื่องโทนการเขียนใน system prompt ปล่อยให้ AI เลือกเอง

#### Scenario: ผู้ใช้ยังเลือกโทนคงที่เองได้เหมือนเดิม
- **WHEN** ผู้ใช้เลือกตัวเลือก "ทางการ" เอง
- **THEN** ระบบ SHALL ฝัง instruction ของโทน "ทางการ" เหมือนพฤติกรรมเดิมทุกประการ (ไม่เปลี่ยน)

### Requirement: ตัวเลือก "AI เลือกให้" ใน รูปแบบสคริปต์ (video script style)
`VIDEO_SCRIPT_STYLE_OPTIONS` SHALL มีตัวเลือก "🤖 AI เลือกให้" เพิ่มจาก 4 ตัวเลือกเดิม (ฮุก-เรื่อง-CTA/ให้ความรู้/เล่าเรื่อง/VSL) และตัวเลือกนี้ SHALL เป็นค่าเริ่มต้นของ state `scriptStyle` ใน `QuickCreateDialog` และของแต่ละ topic row ใน `BatchGenerateDialog`

#### Scenario: สร้าง video ใหม่โดยไม่เลือกรูปแบบสคริปต์เอง
- **WHEN** ผู้ใช้เปิด QuickCreateDialog เลือก content type เป็น video แล้ว generate โดยไม่แตะตัวเลือก "รูปแบบสคริปต์"
- **THEN** ระบบ SHALL ส่ง `script_style: "ai"` และไม่ฝัง instruction เรื่องรูปแบบสคริปต์ใน system prompt ปล่อยให้ AI เลือกเอง

#### Scenario: ผู้ใช้ยังเลือกรูปแบบคงที่เองได้เหมือนเดิม
- **WHEN** ผู้ใช้เลือกตัวเลือก "VSL (ขายตรง)" เอง
- **THEN** ระบบ SHALL ฝัง instruction ของรูปแบบ VSL เหมือนพฤติกรรมเดิมทุกประการ (ไม่เปลี่ยน)
