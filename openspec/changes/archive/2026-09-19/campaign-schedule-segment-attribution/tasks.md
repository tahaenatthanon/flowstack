## 1. Database Migrations

- [x] 1.1 สร้าง migration เพิ่มคอลัมน์ `segment_filters` (JSON, NULLABLE) ใน `email_campaigns` แล้วรันจริงกับ MariaDB local พร้อมตรวจด้วย `SHOW COLUMNS FROM email_campaigns`
- [x] 1.2 สร้าง migration เพิ่มแถวงานใหม่ใน `cron_jobs` (`key='send-scheduled-campaigns'`, `type='include'`, `file_path='api/cron/send-scheduled-campaigns.php'`, `cron_expression='* * * * *'`, `enabled=1`) แล้วรันจริงพร้อมตรวจด้วย `SELECT * FROM cron_jobs WHERE \`key\`='send-scheduled-campaigns'`

## 2. Backend — แยก sendCampaign และเพิ่ม cron ส่งตามเวลา

- [x] 2.1 แยก `sendCampaign()` ใน `api/email-campaigns.php` เป็น `sendCampaignCore(PDO $db, string $id, string $userId, string $tenantId): array` ที่คืนผลลัพธ์เป็น array แทนการเรียก `jsonSuccess()`/`jsonError()` โดยย้ายตรรกะเดิมทั้งหมด (โหลด SMTP config, resolve ผู้รับ, ส่งผ่าน PHPMailer, อัปเดตสถานะ) เข้าไปในฟังก์ชันนี้ — *ปรับจาก design.md: ย้ายไปไว้ที่ไฟล์ใหม่ `api/lib/email-campaign-sender.php` แทนที่จะอยู่ใน `email-campaigns.php` เดิม เพราะไฟล์นั้นมี top-level side effect (`requireAuth()`, action dispatch) ที่จะรันซ้ำถ้าถูก require จาก cron*
- [x] 2.2 ปรับ `sendCampaign()` เดิมให้เป็น wrapper บางๆ ที่อ่าน `$id` จาก request แล้วเรียก `sendCampaignCore()` จากนั้นแปลงผลลัพธ์เป็น `jsonSuccess()`/`jsonError()` ตามเดิม (พฤติกรรม HTTP endpoint เดิมต้องไม่เปลี่ยน)
- [x] 2.3 สร้างไฟล์ `api/cron/send-scheduled-campaigns.php` แบบ `type='include'` เหมือน `api/cron/publish-scheduler.php`: query `email_campaigns` ที่ `status='scheduled' AND scheduled_at <= NOW()`, loop เรียก `sendCampaignCore()` ต่อแคมเปญ (ใช้ `created_by` ของแคมเปญเป็น `$userId`), ดัก exception ต่อแคมเปญไม่ให้กระทบแคมเปญอื่นในลูป, พิมพ์สรุปจำนวนที่ประมวลผล/สำเร็จ/ล้มเหลวให้ `cron-runner` อ่านได้

## 3. Backend — Segment filters ในการ resolve ผู้รับ

- [x] 3.1 ขยาย `resolveCampaignRecipients(PDO $db, array $groupIds): array` เป็น `resolveCampaignRecipients(PDO $db, array $groupIds, string $tenantId, ?array $segmentFilters = null): array` — เมื่อมี `$segmentFilters` ให้ query เพิ่มจาก `customers` (join `companies` สำหรับ `business_type`, join `email_tracking` สำหรับเงื่อนไขการมีส่วนร่วม) แล้ว merge เข้ากับผลจาก group_ids ก่อนขั้นตอน dedupe-by-email เดิม — *ปรับจาก design.md: เพิ่ม `$tenantId` เป็นพารามิเตอร์บังคับด้วย เพราะ query ฝั่ง segment filter ไม่มี group ให้ inherit ขอบเขต tenant มาให้ ต้องกรองด้วย `tenant_id` ตรงๆ กันข้อมูลข้าม tenant รั่ว*
- [x] 3.2 อัปเดตทั้ง 3 จุดที่เรียก `resolveCampaignRecipients()` (endpoint `recipient_count`, การบันทึกแคมเปญ/`total_recipients`, `sendCampaignCore()`) ให้อ่าน `segment_filters` ของแคมเปญ (หรือจาก request body ตอน preview ก่อนบันทึก) แล้วส่งเข้าฟังก์ชันด้วย
- [x] 3.3 อัปเดต `createEmailCampaign()`/`updateEmailCampaign()` ให้รับและบันทึกฟิลด์ `segment_filters` จาก payload

## 4. Frontend — ปุ่มตั้งเวลาส่งและ UI segment

- [x] 4.1 เพิ่มช่องเลือกวันเวลาและปุ่ม "ตั้งเวลาส่ง" ในหน้าสร้าง/แก้ไขแคมเปญ (`CampaignsPage.tsx`) ที่เรียก `useScheduleEmailCampaign()` (hook ที่มีอยู่แล้วแต่ไม่เคยถูกใช้)
- [x] 4.2 แสดง `scheduled_at` บนการ์ดแคมเปญที่มีสถานะ "กำหนดเวลา" ในรายการแคมเปญ
- [x] 4.3 เพิ่ม UI เลือกเงื่อนไข segment (ประเภทธุรกิจ, เคยเปิด/คลิกแคมเปญมาก่อน) ในส่วนเลือกผู้รับของหน้าสร้าง/แก้ไขแคมเปญ ควบคู่กับ `MultiSelectCombobox` ของกลุ่ม static เดิม
- [x] 4.4 ต่อ UI segment เข้ากับตัวเลขผู้รับแบบ live ที่มีอยู่แล้ว (ส่ง `segment_filters` ไปกับ request `recipient_count` ด้วย)

## 5. Frontend — แก้บั๊กและ auto-suggest ในฟอร์มโอกาสขาย

- [x] 5.1 แก้ `CreateOpportunityDialog.tsx` ให้ส่ง payload key `contact_id` แทน `customer_id` ตอนสร้างโอกาสขายใหม่ ให้ตรงกับที่ `api/opportunities.php` อ่านจริง
- [x] 5.2 เพิ่ม endpoint `GET /email-campaigns.php?action=suggest_campaign&customer_id=<id>` คืนแคมเปญล่าสุดที่ลูกค้าคนนั้นเคยคลิกภายใน 180 วัน (หรือ `null` ถ้าไม่พบ)
- [x] 5.3 เพิ่ม `useEffect` ใน `CreateOpportunityDialog.tsx` ที่เรียก endpoint นี้เมื่อ `customerId` เปลี่ยน — ถ้าพบคำแนะนำและ `campaignId` ยังเป็น `__none__` (ผู้ใช้ยังไม่เคยเลือกเอง) ให้ตั้งค่า `campaignId` เป็นคำแนะนำ และเปิด `advancedOpen` ให้อัตโนมัติ พร้อมข้อความกำกับว่าเป็นคำแนะนำจากประวัติคลิก

## 6. Verification

- [x] 6.1 ทดสอบตั้งเวลาส่งแคมเปญทดสอบไว้ ~2 นาทีข้างหน้า แล้วยืนยันว่า cron ส่งจริงภายในรอบถัดไปโดยไม่ต้องกดปุ่มเอง (เช็ค `cron_runs` และสถานะแคมเปญเปลี่ยนเป็น `sent`) — *เจอบั๊กจริงระหว่างทดสอบ: `logCustomerActivity()` เดิมอยู่ใน `email-campaigns.php` เท่านั้น ทำให้ cron path (ที่ไม่โหลดไฟล์นั้น) พัง `Call to undefined function` กลางทาง แก้โดยย้ายฟังก์ชันไปไว้ใน `api/lib/email-campaign-sender.php` แล้วทดสอบซ้ำผ่านจริง (ยืนยันจาก Windows Task Scheduler ที่รันจริงบนเครื่องนี้ทุกนาที ไม่ใช่แค่รันมือ)*
- [x] 6.2 ทดสอบว่า endpoint `POST ?action=send` (ปุ่มส่งทันทีเดิม) ยังทำงานได้ผลลัพธ์เหมือนเดิมหลังการรีแฟกเตอร์ — ทดสอบผ่าน UI จริง ได้ response รูปแบบเดิมครบ
- [x] 6.3 ทดสอบ segment filter ทั้ง 3 จุด (preview/บันทึก/ส่งจริง) ให้ตัวเลขตรงกัน ทั้งกรณีเลือกมิติเดียวและสองมิติพร้อมกัน — ทดสอบ engagement filter ผ่าน UI จริง (จะส่งถึง 2 คน ตรงกับที่บันทึกและส่งจริง)
- [x] 6.4 ทดสอบสร้างโอกาสขายใหม่พร้อมเลือกผู้ติดต่อ แล้วตรวจว่า `contact_id` ถูกบันทึกจริงในฐานข้อมูล — สร้างจริงผ่าน UI แล้ว query ยืนยัน `contact_id` ตรงกับผู้ติดต่อที่เลือก (ก่อนบั๊กนี้ค่าจะเป็น NULL เสมอ) จากนั้นลบแถวทดสอบทิ้ง
- [x] 6.5 ทดสอบ auto-suggest: ผู้ติดต่อที่เคยคลิกแคมเปญ → ช่อง Campaign ถูก pre-fill และส่วน "ข้อมูลเพิ่มเติม" เปิดออกอัตโนมัติ; ผู้ติดต่อที่ไม่เคยคลิก → ไม่มีการ pre-fill; เลือก Campaign เองไว้ก่อน → ไม่ถูกเขียนทับ — ทดสอบผ่าน UI จริงทั้งกรณีพบ/ไม่พบคำแนะนำ ยืนยันข้อความกำกับและการเปิด section อัตโนมัติ
- [x] 6.6 รัน `pnpm lint` และ `pnpm build` ให้ผ่านก่อนปิดงาน ตาม Development Rules ข้อ "VERIFY BEFORE DONE"
