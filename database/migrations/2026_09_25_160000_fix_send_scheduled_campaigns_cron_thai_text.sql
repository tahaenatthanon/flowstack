-- แก้ข้อความไทยที่เพี้ยนของ cron_jobs 'send-scheduled-campaigns'
--
-- สาเหตุ: 2026_09_19_193600_register_send_scheduled_campaigns_cron.sql ถูกรันโดยไม่ระบุ
--   --default-character-set=utf8mb4 ข้อความ UTF-8 จึงถูกตีความเป็น latin1 แล้วเข้ารหัสซ้ำ
--   (แสดงเป็น "เธเธธเธ 1 เธเธฒเธเธต") — ค่าที่ถูกต้องคัดจาก migration ต้นฉบับ
-- ⚠️ รันด้วย --default-character-set=utf8mb4 ไม่งั้นจะเพี้ยนซ้ำ
-- บนเครื่องที่ข้อความถูกต้องอยู่แล้ว UPDATE นี้ไม่เปลี่ยนอะไร

UPDATE cron_jobs
   SET description    = 'ส่งแคมเปญอีเมลที่ตั้งเวลาไว้เมื่อถึงกำหนด (email_campaigns.status=scheduled)',
       interval_label = 'ทุก 1 นาที'
 WHERE `key` = 'send-scheduled-campaigns';
