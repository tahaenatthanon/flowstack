## ADDED Requirements

### Requirement: ปุ่ม "AI เขียน Video Prompt" แสดงตลอดเวลา อยู่ใต้ช่อง Video Prompt
ปุ่ม "AI เขียน Video Prompt" ของแต่ละ scene SHALL แสดงเสมอไม่ว่า scene นั้นจะมี `video_prompt` อยู่แล้วหรือไม่ — SHALL ไม่ซ่อนปุ่มนี้เมื่อ `video_prompt` ไม่ว่างเปล่า เพื่อให้ผู้ใช้กดให้ AI เขียนทับ (regenerate) ค่าที่มีอยู่แล้วได้ทุกเมื่อ — ปุ่มนี้ SHALL อยู่ใต้ช่อง Video Prompt (ไม่ใช่เหนือ)

#### Scenario: Scene มี video_prompt อยู่แล้ว
- **WHEN** scene หนึ่งมี `video_prompt` ที่ไม่ว่างเปล่าอยู่แล้ว (พิมพ์เองหรือ AI เขียนไว้ก่อนหน้า)
- **THEN** ปุ่ม "AI เขียน Video Prompt" SHALL ยังคงแสดงอยู่ที่ scene การ์ดนั้น ใต้ช่อง Video Prompt

#### Scenario: กดปุ่มเขียนทับค่าที่มีอยู่แล้ว
- **WHEN** ผู้ใช้กดปุ่ม "AI เขียน Video Prompt" ของ scene ที่มี `video_prompt` อยู่แล้ว
- **THEN** ระบบ SHALL เรียก `generate-scene-video-prompt` และเขียนทับค่าเดิมด้วยผลลัพธ์ใหม่ทันทีที่สำเร็จ (persist ทันทีตามพฤติกรรมเดิม)
