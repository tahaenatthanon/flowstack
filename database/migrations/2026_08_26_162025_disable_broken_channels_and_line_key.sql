-- ปิดช่องทางที่พิสูจน์แล้วว่าส่งไม่ได้ + เตรียม settings key ของ ops alert
-- change: add-ops-alerting-and-token-expiry
--
-- หลักฐานของแต่ละช่องทาง (จากโค้ดและคิวจริง — ทั้งสามช่องทางมี 0 แถวในคิว = ไม่เคยส่งสำเร็จเลย):
--   instagram — creds ถอดรหัสได้เป็น JSON ที่ไม่มี key ใด ๆ → "Missing ig_user_id or access_token"
--   tiktok    — publish-dispatch.php ส่ง source_info = ['source' => 'PULL_FROM_URL'] โดยไม่มี video_url
--   linkedin  — publish-dispatch.php ส่ง path ในเครื่องเป็น originalUrl แทน URL สาธารณะ
-- ไม่แตะ twitter/wix: ไม่มีหลักฐานทั้งทางบวกและทางลบ การปิดโดยไม่มีหลักฐานคือการเดา
-- ไม่แตะ lineoa: 2 แถวที่ล้มเป็นการยกเลิกด้วยมือของเจ้าของระบบ ไม่ใช่ความล้มเหลวทางเทคนิค
--
-- publish-scheduler.php:31 กรอง pc.is_active = 1 อยู่แล้ว การปิดจึงกัน cron ได้จริงโดยไม่ต้องลบเส้นทางโค้ด
--
-- สถานะก่อนรัน (ทั้ง 10 แถวอยู่ใน tenant-default):
--   is_active=1: wix, facebook, lineoa, instagram, tiktok, linkedin, twitter, lotusdomino
--   is_active=0: Youtube (platform ว่าง), wordpress
--
-- rollback:
--   UPDATE publish_channels SET is_active = 1 WHERE platform IN ('instagram','tiktok','linkedin');
--   DELETE FROM settings WHERE `key` = 'ops_alert_line_targets';

UPDATE publish_channels
   SET is_active = 0
 WHERE platform IN ('instagram', 'tiktok', 'linkedin');

-- ปลายทาง LINE ของ ops alert — ค่าว่างแปลว่าไม่ส่ง LINE เลย
-- ไม่ใช้ key line_targets เดิม เพราะปลายทางในนั้นเป็นกลุ่มที่ยังไม่ยืนยันว่าเป็นกลุ่มภายใน
-- และข้อความแจ้งเตือนมีเนื้อ error ดิบจาก API ที่ถอนคืนไม่ได้เมื่อส่งไปแล้ว
INSERT INTO settings (`key`, `value`, tenant_id)
VALUES ('ops_alert_line_targets', '', NULL)
ON DUPLICATE KEY UPDATE `value` = `value`;
