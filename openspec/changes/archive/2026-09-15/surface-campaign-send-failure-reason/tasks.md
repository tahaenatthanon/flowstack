## 1. Backend — บันทึก bounce_reason จริง

- [x] 1.1 ใน `api/email-campaigns.php` แก้ `catch (MailException $e)` ใน `sendCampaign()` (บรรทัด ~701-706): เพิ่ม `bounce_reason = ?` เข้า UPDATE query และส่ง `$err` (`$mail->ErrorInfo`) เป็น parameter เพิ่ม

## 2. Frontend — เปิดปุ่ม "ดู Log" ตาม sent_at

- [x] 2.1 ใน `src/pages/CampaignsPage.tsx` แก้เงื่อนไข (บรรทัด ~784) จาก `campaign.status === 'sent'` เป็น `campaign.sent_at` สำหรับปุ่ม "ดู Log"

## 3. ตรวจสอบ

- [x] 3.1 รัน `php -l api/email-campaigns.php` — ต้องไม่มี syntax error
- [x] 3.2 รัน `pnpm lint` — ต้องไม่มี error ใหม่เพิ่มขึ้น
- [x] 3.3 รัน `pnpm build` — ต้องผ่าน
- [x] 3.4 รัน `pnpm test` — ต้องผ่าน
- [x] 3.5 เปิดแอปจริง ไปที่ `/campaigns` — ยืนยันว่าแคมเปญ "ทดสอบการส่งแคมเปญ" (สถานะ draft, มี sent_at) ตอนนี้แสดงปุ่ม "ดู Log" แล้ว (เดิมไม่แสดง)
- [x] 3.6 คลิก "ดู Log" ของแคมเปญนั้น — ยืนยันว่า dialog เปิดได้และแสดงรายชื่อผู้รับ 2 คนที่มีสถานะ "ล้มเหลว" ถูกต้อง (bounce_reason ของข้อมูลเก่าจะยังเป็นค่าว่าง เพราะเป็นข้อมูลก่อน deploy — เป็นเรื่องที่รู้และยอมรับแล้ว)
- [x] 3.7 ยืนยันว่าแคมเปญที่ status = 'sent' อื่นๆ ยังแสดงปุ่ม "ดู Log" ได้ตามปกติ ไม่มี regression
- [x] 3.8 ยืนยันว่าแคมเปญ draft ที่ไม่เคยส่งเลย (sent_at เป็น null) ไม่มีปุ่ม "ดู Log" โผล่ขึ้นมา (ไม่มีข้อมูลให้ดู)
