## ADDED Requirements

### Requirement: Video section appears below image section in content editor
ใน `ContentCardDialog` และ `ContentDetailView` SHALL มีหัวข้อ "วิดีโอ" ใต้หัวข้อ "ภาพประกอบ" ในคอลัมน์ด้านขวา — แสดงเฉพาะข้อมูลที่เกี่ยวข้องกับวิดีโอ ไม่แสดงส่วนบทความ

#### Scenario: Video section renders after image section
- **WHEN** ผู้ใช้เปิด dialog แก้ไข content item
- **THEN** เห็นหัวข้อ "วิดีโอ" ใต้ "ภาพประกอบ" พร้อมข้อมูลสถานะวิดีโอ (ยังไม่มี, กำลังสร้าง, พร้อมเล่น) — icon เป็น `Clapperboard`

### Requirement: Video section has AI generation button with slate icon
หัวข้อ "วิดีโอ" SHALL มีปุ่ม "สร้างวิดีโอด้วย AI" ที่ใช้ไอคอน `Clapperboard` และเรียกใช้ endpoint `/brand-content.php?action=generate-video`

#### Scenario: Click generate video button
- **WHEN** ผู้ใช้คลิก "สร้างวิดีโอด้วย AI"
- **THEN** ระบบส่งคำขอสร้างวิดีโอไปยัง backend และแสดง loading state จนกว่าจะเสร็จ

### Requirement: Video section displays video status with helpful description
หัวข้อ "วิดีโอ" SHALL แสดงสถานะปัจจุบันของวิดีโอ: ยังไม่มีวิดีโอ → แสดงข้อความ "ต้องมี scene ที่สร้างภาพแล้วอย่างน้อย 1 ฉากก่อนสร้างวิดีโอ" และปุ่มสร้าง, กำลังสร้าง → แสดง loader, พร้อมเล่น → แสดง video player

#### Scenario: No video yet shows guidance
- **WHEN** content item ยังไม่มี `video_url` และไม่ได้กำลังสร้าง
- **THEN** ระบบแสดงข้อความ "ต้องมี scene ที่สร้างภาพแล้วอย่างน้อย 1 ฉากก่อนสร้างวิดีโอ" แทน "ยังไม่มีวิดีโอ"

#### Scenario: Video ready to play
- **WHEN** content item มี `video_url` และ `video_gen_status === 'done'`
- **THEN** ระบบแสดง video player แบบ inline

### Requirement: Video section does not display article content
Video section SHALL แสดงเฉพาะข้อมูลและองค์ประกอบที่เกี่ยวข้องกับวิดีโอเท่านั้น — ไม่แสดงส่วนบทความ (Article)

#### Scenario: Article content hidden in video context
- **WHEN** ผู้ใช้เปิด dialog แก้ไข content item แบบวิดีโอ
- **THEN** video section ไม่แสดง article body, excerpts, หรือส่วนประกอบบทความใดๆ

### Requirement: Video icon on content detail page header
หน้ารายละเอียด Content (`ContentDetailView`) SHALL แสดงไอคอนประเภทวิดีโอ (`Play`) ที่มุมซ้ายบนของ header — ใช้ไอคอนเดียวกับหน้า "ผลงานทั้งหมด" (`ContentListTab`)

#### Scenario: Video icon visible on detail header
- **WHEN** ผู้ใช้เปิดดูรายละเอียด content item ที่เป็นประเภทวิดีโอ (`type === 'video'`)
- **THEN** ระบบแสดงไอคอน `Play` และข้อความ "วิดีโอ" ที่มุมซ้ายบนของ header
- **AND** ใช้รูปแบบเดียวกับ `ContentListTab` ที่ใช้ `🎬 วิดีโอ` ในรายการเนื้อหา
