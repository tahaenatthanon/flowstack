## ADDED Requirements

### Requirement: ข้อความ error จริงต้องถูกบันทึกเมื่อส่งอีเมลล้มเหลว
เมื่อ `sendCampaign()` ส่งอีเมลไม่สำเร็จให้ผู้รับรายใด ระบบ SHALL บันทึกข้อความ error จริงจาก mail library ลงคอลัมน์ `bounce_reason` ของ record `email_tracking` ที่เกี่ยวข้อง

#### Scenario: ส่งอีเมลล้มเหลวเพราะ SMTP exception
- **WHEN** `$mail->send()` throw `MailException` ระหว่างส่งอีเมลถึงผู้รับรายหนึ่ง
- **THEN** ระบบ SHALL อัปเดต record `email_tracking` ของผู้รับรายนั้นให้ `status = 'failed'` และ `bounce_reason` เป็นข้อความ error จริง (`$mail->ErrorInfo`) ไม่ใช่ค่าว่างหรือ null

### Requirement: ผู้ใช้ต้องเข้าถึง Log การส่งได้เมื่อมีการพยายามส่งแคมเปญ
หน้าจัดการแคมเปญอีเมล SHALL แสดงปุ่มเปิด "ประวัติการส่งอีเมล" สำหรับแคมเปญใดๆ ที่เคยมีการพยายามส่งแล้ว โดยไม่ขึ้นกับว่าสถานะปัจจุบันของแคมเปญคืออะไร

#### Scenario: แคมเปญส่งสำเร็จบางส่วนหรือทั้งหมด
- **WHEN** แคมเปญมี `status = 'sent'`
- **THEN** ปุ่ม "ดู Log" SHALL แสดงผล และเปิด dialog แสดงรายชื่อผู้รับพร้อมสถานะได้ตามปกติ

#### Scenario: แคมเปญส่งล้มเหลวทั้งหมดและสถานะยังเป็น draft
- **WHEN** แคมเปญมี `sent_at` ไม่เป็น null แต่ `status` ยังเป็น `'draft'` (เพราะทุกผู้รับล้มเหลว)
- **THEN** ปุ่ม "ดู Log" SHALL แสดงผลเช่นเดียวกัน และผู้ใช้ SHALL เห็น `bounce_reason` ของผู้รับแต่ละรายที่ล้มเหลวใน dialog นั้น

#### Scenario: แคมเปญที่ยังไม่เคยลองส่งเลย
- **WHEN** แคมเปญมี `sent_at` เป็น null (ยังไม่เคยกดส่ง)
- **THEN** ปุ่ม "ดู Log" SHALL NOT แสดงผล (ไม่มีข้อมูลให้ดู)
