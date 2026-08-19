-- ปิดใช้งาน publish channel "Youtube" ที่ platform เป็นค่าว่าง ('')
--
-- Root cause: publish_channels.platform เป็น ENUM ที่ไม่มีค่า 'youtube'
-- ใน MariaDB non-strict mode การเขียนค่าที่ไม่อยู่ใน ENUM จะถูกบีบเป็น index 0
-- (empty string) แทนที่จะ error → channel นี้จึงมี platform = ''
--
-- ผลกระทบ: dispatch_content('') คืน "Unknown platform: " ทันทีที่มีคอนเทนต์เข้าคิว
--
-- เหตุผลที่เลือกปิด is_active แทนการตั้ง platform:
--   1. roadmap/design ระบุ non-goal ว่าไม่แก้ ENUM ให้มี 'youtube'
--   2. ไม่มี platform อื่นใน ENUM ที่ตรงกับ YouTube จริง — ตั้งค่าอื่นจะเผยแพร่ผิดที่
--   3. channel นี้ยังไม่มีการใช้งานเลย (0 แถวใน content_publish_queue, 0 แถวใน content_schedules)
--
-- Rollback: UPDATE publish_channels SET is_active = 1 WHERE id = '6e77f494-c18b-450e-91b2-1d1d7b57b73e';
--
-- See openspec/changes/phase-0-publish-dispatch-blockers/ (งาน 3)
UPDATE publish_channels
SET is_active = 0, updated_at = NOW()
WHERE id = '6e77f494-c18b-450e-91b2-1d1d7b57b73e'
  AND platform = '';
