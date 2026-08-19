-- เปิดใช้งาน publish channel "Wordpress" และ "Youtube" กลับ (is_active = 1)
--
-- ย้อนผลของ:
--   2026_08_19_120000_deactivate_youtube_channel.sql
--   2026_08_19_121500_deactivate_wordpress_channel.sql
-- (เก็บสองไฟล์นั้นไว้เป็นประวัติ — migration ชุดนี้เป็น forward-only)
--
-- เหตุผล: เจ้าของระบบสั่งเปิดกลับ (19 ส.ค. 2026) การปิด channel เป็นเพียง
-- mitigation ที่ design เสนอไว้ ไม่ใช่ข้อกำหนดของ requirement
--
-- ผลกระทบที่ทราบและยอมรับแล้ว — ทั้งสอง channel ยังเผยแพร่จริงไม่ได้:
--   * Wordpress (351b7173): `endpoint_url` ว่าง → dispatch_wordpress() คืน
--     "Missing WordPress endpoint_url, username, or app_password" ก่อนยิง cURL
--     คิว pending 4 แถวที่ชี้ channel นี้จะถูกหยิบเมื่อรัน scheduler แล้ว fail
--     (retry 3 รอบตามกลไกเดิม) — ไม่มีการโพสต์ออกไปภายนอก
--   * Youtube (6e77f494): `platform = ''` → dispatch_content() คืน
--     "Unknown platform: " ทันที และไม่มีแถวใดใน content_publish_queue /
--     content_schedules ชี้มาที่ channel นี้
--
-- See openspec/changes/phase-0-publish-dispatch-blockers/ (งาน 2, 3)
UPDATE publish_channels
SET is_active = 1, updated_at = NOW()
WHERE id IN (
    '351b7173-fe57-4c0d-b7f2-60727a578476',  -- Wordpress
    '6e77f494-c18b-450e-91b2-1d1d7b57b73e'   -- Youtube
);
