## Why

กลุ่ม B ของแผนปรับปรุงโมดูลแคมเปญยังมี 3 ช่องว่างที่ทำให้ทีมขายและการตลาดต้องทำงานมือ: (1) ระบบมี backend/hook สำหรับ "ตั้งเวลาส่งล่วงหน้า" อยู่แล้วแต่ไม่มีปุ่มใน UI และไม่มีตัวจับเวลาที่จะส่งจริงเมื่อถึงกำหนด ทำให้แคมเปญที่ตั้งเวลาไว้จะค้างสถานะตลอดไป (2) กลุ่มผู้รับแคมเปญเป็น static group ที่ต้องเพิ่ม/ลบสมาชิกเอง ทั้งที่ระบบมีข้อมูลประเภทธุรกิจและประวัติการมีส่วนร่วม (เปิด/คลิก) ของลูกค้าอยู่แล้ว (3) เมื่อฝ่ายขายสร้างโอกาสขายจากลูกค้าที่เคยคลิกแคมเปญมาก่อน ต้องจำเองว่ามาจากแคมเปญไหนแล้วเลือกมือ ทำให้ข้อมูล ROI ต่อแคมเปญขาดหายเมื่อลืมเลือก

## What Changes

- เปิดใช้งานปุ่ม "ตั้งเวลาส่งล่วงหน้า" ในหน้าสร้าง/แก้ไขแคมเปญ (ต่อ hook `useScheduleEmailCampaign` ที่มีอยู่แล้วแต่ไม่เคยถูกเรียก)
- **BREAKING (internal):** แยกฟังก์ชัน `sendCampaign()` ใน `api/email-campaigns.php` ออกเป็นแกนหลัก (`sendCampaignCore()` ที่คืนค่าผลลัพธ์แทนการ `exit`) กับส่วนห่อ HTTP response เดิม เพื่อให้เรียกซ้ำได้หลายแคมเปญต่อรอบจากตัวจับเวลา โดยพฤติกรรมของ endpoint `POST ?action=send` เดิมไม่เปลี่ยน
- เพิ่มงาน cron ใหม่ `send-scheduled-campaigns` ที่สแกน `email_campaigns` ที่ `status='scheduled' AND scheduled_at <= NOW()` แล้วส่งจริงทุก 1 นาที โดยใช้ระบบตัวจับเวลาที่มีอยู่แล้ว (`cron_jobs` + `api/cron/tick.php`) ไม่สร้างระบบ cron ใหม่
- เพิ่มความสามารถกรองผู้รับแบบไดนามิก ("Segment") ในหน้าสร้างแคมเปญ นอกเหนือจากกลุ่ม static เดิม โดยคำนวณรายชื่อสดทุกครั้งที่กดบันทึก/ส่ง (ไม่ snapshot ไว้ล่วงหน้า) เงื่อนไขรอบแรก 2 มิติ: ประเภทธุรกิจของบริษัท (`company_business_type`) และเคยเปิด/คลิกอีเมลแคมเปญใดก็ได้มาก่อน
- เมื่อฝ่ายขายเลือก "ผู้ติดต่อ" ในฟอร์มสร้างโอกาสขาย ระบบจะค้นหาแคมเปญล่าสุดที่ผู้ติดต่อคนนั้นเคยคลิก (ภายใน 180 วัน) แล้ว pre-fill ช่อง Campaign ให้อัตโนมัติ พร้อมเปิดส่วน "ข้อมูลเพิ่มเติม" ให้เห็นทันทีเพื่อให้ยืนยัน/แก้ไขเองก่อนบันทึก (ไม่ auto-set แบบไม่ให้เห็น)
- **แก้บั๊กที่พบระหว่างทาง (จำเป็นสำหรับข้อข้างต้น):** ฟอร์มสร้างโอกาสขาย (`CreateOpportunityDialog.tsx`) ส่งค่าผู้ติดต่อเป็น key `customer_id` แต่ `api/opportunities.php` ตอนสร้างอ่านจาก `contact_id` ทำให้ผู้ติดต่อที่เลือกไว้ไม่เคยถูกบันทึกจริงเวลาสร้างโอกาสขายใหม่ (ใช้ได้เฉพาะตอนแก้ไขภายหลัง) — ต้องแก้ก่อน ไม่งั้นจะไม่มี `contact_id` ให้ผูกกับประวัติคลิกแคมเปญเลย

## Capabilities

### New Capabilities
- `email-campaign-scheduled-send`: การตั้งเวลาส่งแคมเปญล่วงหน้าและตัวจับเวลาที่ส่งจริงเมื่อถึงกำหนด
- `opportunity-campaign-suggestion`: การแนะนำ/pre-fill แคมเปญต้นทางให้โอกาสขายใหม่จากประวัติคลิกของผู้ติดต่อ (รวมการแก้บั๊กบันทึก `contact_id`)

### Modified Capabilities
- `email-campaign-recipient-resolution`: เพิ่ม requirement ให้ `resolveCampaignRecipients()` รับเงื่อนไข segment แบบไดนามิก (ประเภทธุรกิจ, ประวัติเปิด/คลิก) เพิ่มเติมจาก group_ids เดิม โดยยังคงกติกา dedupe ตามอีเมลและใช้ฟังก์ชันจุดเดียวเหมือนเดิมสำหรับทั้ง 3 จุด (preview/บันทึก/ส่งจริง)

## Impact

- Backend: `api/email-campaigns.php` (แยก `sendCampaignCore()`, เพิ่ม endpoint schedule ที่ใช้อยู่แล้วให้ทำงานจริง, ขยาย `resolveCampaignRecipients()`), `api/opportunities.php` (ไม่ต้องแก้ — บั๊กอยู่ฝั่ง frontend), ไฟล์ใหม่ `api/cron/send-scheduled-campaigns.php`
- Frontend: `src/pages/CampaignsPage.tsx` (ปุ่มตั้งเวลาส่ง + UI เลือกเงื่อนไข segment), `src/components/CreateOpportunityDialog.tsx` (แก้ payload key, เพิ่ม auto-suggest + auto-expand)
- Database: migration ใหม่ 2 ไฟล์ — (1) เพิ่มแถวงานใน `cron_jobs` สำหรับ `send-scheduled-campaigns`, (2) เพิ่มคอลัมน์ `segment_filters` (JSON, NULLABLE) ใน `email_campaigns`
- ใช้ระบบ cron ที่มีอยู่แล้วทั้งหมด (`cron_jobs`, `api/cron/tick.php`, `api/lib/cron-runner.php`) ไม่สร้างกลไกจับเวลาใหม่ซ้ำซ้อน
