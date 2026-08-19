-- ยกเลิกคิว pending 2 แถวของ Line OA ที่ scheduled_at เก่าเกินไป (22-23 มิ.ย. 2026)
--
-- เหตุผล: เจ้าของระบบเลือก "ตั้งเป็น failed" ผ่าน interactive dialog (19 ส.ค. 2026)
-- สองแถวนี้ due แล้วและชี้ channel Line OA (7aaad167) ที่ is_active = 1 และมี credentials
-- ครบ → ถ้ารัน publish-scheduler.php จะ broadcast คอนเทนต์อายุ ~2 เดือนให้ผู้ติดตาม
-- LINE OA ทุกคนและย้อนกลับไม่ได้ ซึ่งไม่เกี่ยวกับ DoD ของ change นี้เลย
--
-- ทำไมใช้ status = 'failed' ไม่ใช่ 'cancelled': ENUM ของคอลัมน์นี้มีแค่
-- ('pending','processing','sent','failed') — ไม่มีค่า 'cancelled' และ non-goal ของ
-- change นี้คือไม่แก้ ENUM จึงใช้ 'failed' + error_msg อธิบายเหตุผลไว้ให้ตรวจย้อนหลังได้
--
-- ไม่แตะ retry_count (คงเป็น 0) เพื่อให้แยกออกจากแถวที่ fail เพราะ dispatch จริงได้
--
-- Rollback: UPDATE content_publish_queue SET status = 'pending', error_msg = NULL
--   WHERE id IN ('fb943d02-058c-4545-b9ff-782d36198d1d', 'e883d364-0f96-4aca-83be-9d40ce8248d1');
--
-- See openspec/changes/phase-0-publish-dispatch-blockers/ (งาน 5.2)
UPDATE content_publish_queue
SET status     = 'failed',
    error_msg  = 'ยกเลิกโดยเจ้าของระบบ 19 ส.ค. 2026: คอนเทนต์เก่าเกินไป (scheduled_at มิ.ย.) ไม่ต้องการ broadcast ย้อนหลังไป LINE OA',
    updated_at = NOW()
WHERE id IN (
    'fb943d02-058c-4545-b9ff-782d36198d1d',  -- content 14be35af → Line OA, 2026-06-22 09:00
    'e883d364-0f96-4aca-83be-9d40ce8248d1'   -- content d698c9f2 → Line OA, 2026-06-23 09:00
)
  AND status = 'pending';
