-- ปิดใช้งาน publish channel "Wordpress" และ "Youtube" อีกครั้ง (is_active = 0)
--
-- ย้อนผลของ 2026_08_19_133000_reactivate_wordpress_youtube_channels.sql
-- (forward-only — เก็บไฟล์นั้นไว้เป็นประวัติ)
--
-- เหตุผล: เจ้าของระบบตัดสินใจผ่าน interactive dialog (19 ส.ค. 2026) หลังเห็นผลกระทบครบ
--   * Wordpress (351b7173): เลือก "ปิด is_active ไว้ก่อน" — ยังไม่มี endpoint_url
--     (URL เว็บปลายทาง) และ Application Password จริง (ค่าปัจจุบันยาว 7 ตัว
--     สั้นกว่าของจริง ~24-29 ตัว) → ปล่อยเปิดไว้จะสร้างแถว failed ซ้ำทุกครั้งที่มีคอนเทนต์เข้าคิว
--   * Youtube (6e77f494): เลือก "ปิด is_active" — platform = '' (ENUM ไม่มีค่า 'youtube')
--     ทางเลือกอื่นคือเพิ่ม ENUM + เขียน dispatch_youtube() ซึ่งอยู่นอก scope ของ change นี้
--
-- ครั้งนี้การปิด channel มีผลกับ cron จริง: publish-scheduler.php ถูกแก้ให้กรอง
-- `AND pc.is_active = 1` แล้ว (ก่อนหน้านี้ไม่กรอง ทำให้การปิด channel ไม่กัน cron)
-- → คิว pending 4 แถวที่ชี้ Wordpress channel จะไม่ถูกหยิบมา dispatch อีก
--
-- ไม่แตะแถว failed 23 แถวที่มีอยู่ (เก็บไว้เป็นประวัติตามที่ตกลง)
--
-- Rollback: UPDATE publish_channels SET is_active = 1 WHERE id IN
--   ('351b7173-fe57-4c0d-b7f2-60727a578476', '6e77f494-c18b-450e-91b2-1d1d7b57b73e');
--
-- See openspec/changes/phase-0-publish-dispatch-blockers/ (งาน 2, 3)
UPDATE publish_channels
SET is_active = 0, updated_at = NOW()
WHERE id IN (
    '351b7173-fe57-4c0d-b7f2-60727a578476',  -- Wordpress
    '6e77f494-c18b-450e-91b2-1d1d7b57b73e'   -- Youtube
);
