-- ยกเลิกคิว pending 4 แถวที่ชี้ channel WordPress (351b7173) ซึ่ง is_active = 0
--
-- เหตุผล: publish-scheduler.php กรอง `pc.is_active = 1` จึงข้าม 4 แถวนี้ทุกรอบ
-- แต่ไม่มีใครล้าง → ค้างอยู่ในรายการตารางเวลา (brand-content.php ?action=schedules)
-- ตลอดไปโดยไม่มีทางถูกส่ง ทั้งที่แถวเก่าสุด due ตั้งแต่ 22 มิ.ย. 2026
--
-- channel 351b7173 (ชื่อ "Wordpress") ถูกปิดและ endpoint_url ว่าง — การกรอก credentials
-- WordPress เป็น non-goal ของ change นี้ (รอเจ้าของระบบส่ง URL + Application Password)
-- จึงต้องล้างคิวก่อน ไม่ใช่รอให้ channel กลับมาทำงาน
--
-- ทำไมใช้ status = 'failed' ไม่ใช่ 'cancelled': ENUM ของคอลัมน์นี้มีแค่
-- ('pending','processing','sent','failed') — ไม่มีค่า 'cancelled' และ non-goal ของ
-- change นี้คือไม่แก้ schema จึงใช้ 'failed' + error_msg อธิบายเหตุผลให้ตรวจย้อนหลังได้
-- (แบบเดียวกับ 2026_08_19_151500_cancel_stale_lineoa_queue_rows.sql)
--
-- ไม่แตะ retry_count (คงเป็น 0) เพื่อให้แยกออกจากแถวที่ fail เพราะ dispatch จริง
--
-- Rollback:
--   UPDATE content_publish_queue SET status = 'pending', error_msg = NULL WHERE id IN
--     ('757a849c-512c-4170-9b88-bcb73e9b96d5','2a5a7d56-b1be-4006-aa0b-5643b7c47ec7',
--      'f2503d82-6266-432b-886c-b66067f3bdae','9c21a0e4-addb-4fa4-a6c2-af00dbd96239');
--
-- See openspec/changes/phase-0-publish-result-gaps/ (งาน 1.3)

UPDATE content_publish_queue
SET status     = 'failed',
    error_msg  = 'ยกเลิกอัตโนมัติ 24 ส.ค. 2026: channel Wordpress (351b7173) ถูกปิด (is_active=0) และไม่มี endpoint_url — scheduler ข้ามแถวนี้ทุกรอบ จึงไม่มีทางถูกส่ง',
    updated_at = NOW()
WHERE id IN (
    '757a849c-512c-4170-9b88-bcb73e9b96d5',  -- content 14be35af, 2026-06-22 09:00
    '2a5a7d56-b1be-4006-aa0b-5643b7c47ec7',  -- content d698c9f2, 2026-06-23 09:00
    'f2503d82-6266-432b-886c-b66067f3bdae',  -- content a0309d33, 2026-08-17 10:48
    '9c21a0e4-addb-4fa4-a6c2-af00dbd96239'   -- content a0309d33, 2026-08-17 10:49
)
  AND status = 'pending';
