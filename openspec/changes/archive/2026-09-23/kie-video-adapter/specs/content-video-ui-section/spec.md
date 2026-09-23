## MODIFIED Requirements

### Requirement: เลือกสัดส่วนวิดีโอก่อนสร้าง
หัวข้อ "วิดีโอ" SHALL มี selector สัดส่วนวิดีโอ (`9:16` / `16:9`) และ selector ความละเอียด (`720p` / `1080p`) ก่อนกดปุ่ม "สร้างวิดีโอด้วย AI" — ค่าที่เลือก SHALL ถูกส่งไปกับคำขอ `generate-video` เป็น `aspect_ratio` และ `resolution` — SHALL ไม่มีตัวเลือก `Auto` — SHALL ไม่ persist ค่าเหล่านี้ลงฐานข้อมูลใน change นี้ (change A1 จะย้ายไปเก็บที่ content item)

#### Scenario: เลือกสัดส่วนและความละเอียดแล้วกดสร้าง
- **WHEN** ผู้ใช้เลือก "16:9" และ "1080p" แล้วกด "สร้างวิดีโอด้วย AI"
- **THEN** คำขอที่ส่งไป backend SHALL มี `aspect_ratio: "16:9"` และ `resolution: "1080p"`

#### Scenario: ค่าเริ่มต้นของ selector
- **WHEN** ผู้ใช้เปิดหัวข้อ "วิดีโอ" ครั้งแรกโดยยังไม่เคยเลือก
- **THEN** selector สัดส่วน SHALL แสดง `9:16` และ selector ความละเอียด SHALL แสดง `720p`

#### Scenario: ไม่มีตัวเลือก Auto
- **WHEN** ผู้ใช้เปิด selector สัดส่วน
- **THEN** SHALL มีแค่ `9:16` และ `16:9`

## ADDED Requirements

### Requirement: Dialog แก้ไขคอนเทนต์ติดตามสถานะวิดีโอจนเสร็จ
`ContentCardDialog` SHALL poll `video-status` ทุก 5 วินาทีเมื่อ content item มี `video_gen_status = 'generating'` และมี `video_job_id` — เมื่อได้ `done` หรือ `failed` SHALL หยุด poll, invalidate รายการคอนเทนต์ให้ dialog แสดงสถานะใหม่ และแจ้งผลด้วย toast ภาษาไทย — SHALL ไม่ poll เมื่อไม่ได้กำลังสร้าง ข้อมูลที่ส่งเข้า dialog (`PlanItem`) SHALL มี `video_gen_status`, `video_url`, `video_job_id` และ API รายการคอนเทนต์ (`content-items.php`) SHALL ส่งฟิลด์เหล่านี้กลับมา

#### Scenario: สร้างเสร็จระหว่างเปิด dialog
- **WHEN** ผู้ใช้กด "สร้างวิดีโอด้วย AI" ใน dialog แล้วรอ
- **THEN** dialog SHALL poll `video-status` จนได้ `done` แล้วแสดง video player และ toast "สร้างวิดีโอสำเร็จ!" โดยผู้ใช้ไม่ต้องรีเฟรชเอง

#### Scenario: สร้างล้มเหลว
- **WHEN** `video-status` ตอบ `{"status": "failed", "error": "..."}`
- **THEN** dialog SHALL หยุด poll และแสดง toast "สร้างวิดีโอไม่สำเร็จ" พร้อมข้อความ error

#### Scenario: ไม่ได้กำลังสร้าง
- **WHEN** content item มี `video_gen_status` เป็น `done`, `failed` หรือ `none`
- **THEN** dialog SHALL ไม่เรียก `video-status`
