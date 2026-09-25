-- บันทึกชนิดของ id ที่ได้จากการเผยแพร่ (change: fix-facebook-video-metrics-sync)
--
-- ทำไมต้องมี: Facebook /videos คืน video id เปล่า ซึ่งเรียก /{id}/insights ไม่ได้
--   (error 100 "Tried accessing nonexisting field (insights)") ต้องใช้ /{id}/video_insights แทน
--   cron content-metrics-sync จึงต้องรู้ชนิดของ id — บันทึกตอน dispatch ตรง ๆ ไม่เดาจากรูปแบบ id
--
-- ค่า: 'post' | 'video' — NULL = แถวที่ยังไม่มี platform_post_id (โค้ดถือเป็น 'post')

ALTER TABLE content_publish_queue
  ADD COLUMN IF NOT EXISTS platform_post_type VARCHAR(20) NULL AFTER platform_post_id;

-- Backfill ครั้งเดียว: ก่อน change นี้ Facebook /feed และ /photos เก็บ id แบบผสม
-- {page_id}_{post_id} เสมอ (ดู dispatch_facebook()) — แถว Facebook ที่ id ไม่มี '_' จึงมาจาก /videos
-- กฎรูปแบบ id นี้ใช้ที่นี่ที่เดียว โค้ดหลังจากนี้อ่านค่าจากคอลัมน์เท่านั้น
UPDATE content_publish_queue q
  JOIN publish_channels pc ON pc.id = q.channel_id
   SET q.platform_post_type = 'video'
 WHERE pc.platform = 'facebook'
   AND q.status = 'sent'
   AND q.platform_post_id IS NOT NULL AND q.platform_post_id <> ''
   AND q.platform_post_id NOT LIKE '%\_%'
   AND q.platform_post_type IS NULL;

UPDATE content_publish_queue
   SET platform_post_type = 'post'
 WHERE platform_post_id IS NOT NULL AND platform_post_id <> ''
   AND platform_post_type IS NULL;
