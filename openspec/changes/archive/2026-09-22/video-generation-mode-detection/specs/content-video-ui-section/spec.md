## MODIFIED Requirements

### Requirement: Video section displays video status with helpful description
หัวข้อ "วิดีโอ" SHALL แสดงสถานะปัจจุบันของวิดีโอ: ยังไม่มีวิดีโอ → แสดงข้อความแนะนำให้เขียนหรือ AI เขียน Video Prompt ของ scene แรกก่อน (ไม่ใช่ข้อความเดิมที่บอกให้สร้างภาพก่อน เพราะไม่บังคับต้องมีภาพอีกต่อไป) และปุ่มสร้าง, กำลังสร้าง → แสดง loader, พร้อมเล่น → แสดง video player

#### Scenario: ยังไม่มี video_prompt ของ scene แรก
- **WHEN** content item ยังไม่มี `video_url`, ไม่ได้กำลังสร้าง, และ `scenes[0].video_prompt` ว่างเปล่า
- **THEN** ระบบแสดงข้อความแนะนำให้เขียนหรือกด "AI เขียน Video Prompt" ของ scene แรกก่อน — SHALL ไม่แสดงข้อความเดิม "ต้องมี scene ที่สร้างภาพแล้วอย่างน้อย 1 ฉากก่อนสร้างวิดีโอ" อีกต่อไป

#### Scenario: พร้อมเล่น
- **WHEN** content item มี `video_url` และ `video_gen_status === 'done'`
- **THEN** ระบบแสดง video player แบบ inline (ไม่เปลี่ยนจากพฤติกรรมเดิม)

## ADDED Requirements

### Requirement: เลือกสัดส่วนวิดีโอก่อนสร้าง
หัวข้อ "วิดีโอ" SHALL มี selector ให้เลือกสัดส่วนวิดีโอ (`9:16` / `16:9` / `Auto`) ก่อนกดปุ่ม "สร้างวิดีโอด้วย AI" — ค่าที่เลือก SHALL ถูกส่งไปกับคำขอ `generate-video` เป็น `aspect_ratio` — SHALL ไม่ persist ค่านี้ลงฐานข้อมูล (เลือกใหม่ได้ทุกครั้งที่สร้าง ไม่ผูกกับ content item ถาวร)

#### Scenario: เลือกสัดส่วนแล้วกดสร้าง
- **WHEN** ผู้ใช้เลือก "16:9" แล้วกด "สร้างวิดีโอด้วย AI"
- **THEN** คำขอที่ส่งไป backend SHALL มี `aspect_ratio: "16:9"`

#### Scenario: ค่าเริ่มต้นของ selector
- **WHEN** ผู้ใช้เปิดหัวข้อ "วิดีโอ" ครั้งแรกโดยยังไม่เคยเลือกสัดส่วน
- **THEN** selector SHALL แสดงค่าเริ่มต้นเป็น `9:16` (ตรงกับพฤติกรรมเดิมก่อน change นี้)

### Requirement: ปุ่ม "AI เขียน Video Prompt" ต่อ scene ที่ยังว่าง
แต่ละ scene card ที่ `video_prompt` ว่างเปล่า SHALL มีปุ่ม "AI เขียน Video Prompt" ที่เรียก action `generate-scene-video-prompt` — ปุ่มนี้ SHALL แสดงในทุก scene (ไม่จำกัดแค่ scene แรก) เพื่อความสอดคล้องกับ scene card อื่นที่ใช้ component เดียวกัน

#### Scenario: กด "AI เขียน Video Prompt" สำเร็จ
- **WHEN** ผู้ใช้กดปุ่ม "AI เขียน Video Prompt" ของ scene ที่ `video_prompt` ว่าง
- **THEN** ระบบเรียก AI เขียนคำสั่งการเคลื่อนไหวจาก `visual_prompt` ของ scene นั้น แล้วเติมลงช่อง Video Prompt ทันทีเมื่อสำเร็จ (บันทึกลง DB แล้ว ไม่ต้องกด "บันทึก Video Prompt" ซ้ำ)

#### Scenario: กด "AI เขียน Video Prompt" ไม่สำเร็จ
- **WHEN** การเรียก AI ล้มเหลว (เช่น provider error)
- **THEN** ระบบ SHALL แสดง toast แจ้ง error — SHALL ไม่ persist ข้อความ error นี้ลง scene (ต่างจาก `image_gen_error` ที่ persist)
