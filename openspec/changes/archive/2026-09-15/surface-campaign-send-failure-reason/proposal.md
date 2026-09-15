## Why

ตรวจสอบแคมเปญ "ทดสอบการส่งแคมเปญ" ที่ผู้ใช้รายงานว่าส่งแล้วล้มเหลว พบว่า `sendCampaign()` จับข้อความ error จริงจาก PHPMailer ได้ (`$mail->ErrorInfo`) แต่ไม่เคยบันทึกลงคอลัมน์ `bounce_reason` ที่มีอยู่แล้วในตาราง `email_tracking` เลย — ข้อความ error หายไปทันทีหลัง toast แจ้งเตือนตอนกดส่งหายไป ทำให้ไม่มีทางย้อนกลับมาดูสาเหตุได้อีก นอกจากนี้ปุ่ม "ดู Log" (ที่แสดง `bounce_reason` อยู่แล้วทั้งในตารางมือถือและเดสก์ท็อป) ถูกจำกัดให้แสดงเฉพาะแคมเปญสถานะ `sent` เท่านั้น — แคมเปญที่ส่งล้มเหลวทั้งหมด (ทุกผู้รับ failed) จะค้างสถานะ `draft` ต่อไป ทำให้ผู้ใช้ไม่มีทางเปิดดู log เพื่อหาสาเหตุได้เลยแม้จะมีข้อมูลบันทึกไว้แล้วก็ตาม

## What Changes

- `api/email-campaigns.php` — บันทึก `$mail->ErrorInfo` ลงคอลัมน์ `bounce_reason` ของ `email_tracking` ทุกครั้งที่ catch `MailException` ระหว่างส่ง (คอลัมน์มีอยู่แล้ว ไม่ต้อง migration)
- `src/pages/CampaignsPage.tsx` — เปลี่ยนเงื่อนไขการแสดงปุ่ม "ดู Log" จาก `campaign.status === 'sent'` เป็น `campaign.sent_at` (มีอยู่จริง ไม่ว่า status จะเป็น draft/sent) เพื่อให้ผู้ใช้เปิดดูสาเหตุความล้มเหลวได้แม้แคมเปญจะค้างสถานะ draft
- **ไม่รวม**: การเพิ่ม status `'failed'` แยกจาก `'draft'` ใน `email_campaigns` (ต้อง schema migration — ตัดสินใจแล้วว่าไม่ทำในรอบนี้ เพราะ `sendCampaign()` อนุญาตให้ retry จากสถานะ `draft` อยู่แล้ว ดีไซน์นี้ไม่จำเป็นต้องมี status แยก)
- **ไม่รวม**: การแก้ปัญหา SMTP จริง (เช่น sender domain authorization ที่ SMTP2GO) — เป็นการตั้งค่านอกระบบโค้ด ต้องรอดูข้อความ error จริงหลัง deploy การเปลี่ยนแปลงนี้ก่อนถึงจะวินิจฉัยต่อได้

## Capabilities

### New Capabilities
- `email-campaign-send-failure-visibility`: ผู้ใช้ต้องสามารถดูสาเหตุที่แท้จริงของอีเมลที่ส่งไม่สำเร็จในแคมเปญได้ ไม่ว่าแคมเปญนั้นจะสำเร็จบางส่วนหรือล้มเหลวทั้งหมด

### Modified Capabilities
(ไม่มี — ไม่มี spec เดิมที่ครอบคลุมเรื่องนี้)

## Impact

- `api/email-campaigns.php` — แก้ catch block ใน `sendCampaign()` เท่านั้น
- `src/pages/CampaignsPage.tsx` — แก้เงื่อนไข conditional render ของปุ่มเดียว
- ไม่มี DB migration, ไม่กระทบ endpoint อื่น, ไม่กระทบแคมเปญที่เคยส่งสำเร็จแล้วในอดีต (retroactive — แคมเปญเก่าที่ล้มเหลวไปแล้วก่อนหน้านี้จะยังไม่มี bounce_reason เพราะข้อมูลเก่าหายไปแล้วจริงๆ)
