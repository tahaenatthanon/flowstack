-- เพิ่ม Comment / Share ระดับโพสต์ สำหรับนิยาม Engagement ใหม่ (change: content-overview-bi-summary, D9)
-- Engagement = Reaction (likes) + Comment + Share + Click
--
-- NULL = ปลายทางไม่รายงานค่านี้ / แถวที่เก็บก่อนมีคอลัมน์ (ต่างจาก 0 = รายงานว่าเป็นศูนย์)
--   comments ← post_activity_by_action_type.comment  (Facebook, ค่าสะสมตลอดชีวิตโพสต์)
--   shares   ← post_activity_by_action_type.share
-- แถวเก่าไม่ต้อง backfill: รายงานอ่านแถวล่าสุดต่อโพสต์ และ cron รอบถัดไปเขียนค่า lifetime ให้เอง

ALTER TABLE content_post_metrics
  ADD COLUMN IF NOT EXISTS comments INT NULL AFTER clicks,
  ADD COLUMN IF NOT EXISTS shares   INT NULL AFTER comments;
