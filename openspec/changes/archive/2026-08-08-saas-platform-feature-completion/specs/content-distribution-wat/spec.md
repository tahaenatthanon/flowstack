## ADDED Requirements

### Requirement: AI Content Creation
ระบบ SHALL ให้ผู้ใช้สร้างบทความและ video script โดยใช้ AI โดยระบุ topic, tone, target audience, และ WAT channel ที่ต้องการ

#### Scenario: Generate article with AI
- **WHEN** user กรอก topic และ parameters แล้วคลิก "สร้างบทความ"
- **THEN** ระบบเรียก AI provider สร้าง article draft และแสดงใน editor ที่ edit ได้

#### Scenario: Generate video script with AI
- **WHEN** user เลือก format "Video Script" และกรอก topic
- **THEN** ระบบสร้าง script พร้อม hook, body, CTA ใน format ที่ใช้ได้กับ video production

### Requirement: WAT Framework Channel Configuration
ระบบ SHALL อนุญาตให้ admin ตั้งค่า channels ตาม WAT Framework: Owned (website, blog, email), Earned (social, PR), Paid (ads) พร้อม API credentials ต่อ channel

#### Scenario: Configure platform credentials
- **WHEN** admin บันทึก API token สำหรับ platform (เช่น Facebook Page, LINE OA, WordPress)
- **THEN** ระบบเก็บ credentials encrypted และแสดง platform เป็น available publish target

#### Scenario: View configured channels by WAT category
- **WHEN** user เปิด content distribution panel
- **THEN** ระบบแสดง channels แยกตาม Owned / Earned / Paid

### Requirement: Async Content Publishing
ระบบ SHALL ส่ง content ไปยัง platforms ที่เลือกแบบ async ผ่าน queue และแสดง publish status

#### Scenario: Queue content for publishing
- **WHEN** user เลือก platforms และคลิก "เผยแพร่"
- **THEN** ระบบเพิ่ม publish jobs ใน `content_publish_queue` และแสดง status "รอดำเนินการ"

#### Scenario: Publish status update
- **WHEN** cron job process publish job สำเร็จหรือล้มเหลว
- **THEN** ระบบอัปเดต status เป็น "สำเร็จ" หรือ "ล้มเหลว" พร้อม error message และแจ้ง user

#### Scenario: Retry failed publish
- **WHEN** publish job ล้มเหลว
- **THEN** user สามารถกด "ลองใหม่" เพื่อ re-queue job นั้น
