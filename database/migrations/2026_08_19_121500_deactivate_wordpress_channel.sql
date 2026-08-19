-- ปิดใช้งาน publish channel "Wordpress" (351b7173-fe57-4c0d-b7f2-60727a578476)
--
-- Root cause: channel มี credentials ครบ key (`username`, `app_password`) แต่
--   1. `endpoint_url` เป็นค่าว่าง — `dispatch_wordpress()` ต้องใช้เป็น site root URL
--   2. `app_password` ยาวเพียง 7 ตัวอักษร ซึ่งสั้นกว่า WordPress Application Password
--      ปกติ (~24-29 ตัวรวมช่องว่าง) → น่าจะไม่ใช่ Application Password จริง
-- ทั้งสองข้อทำให้ dispatch คืน "Missing WordPress endpoint_url, username, or app_password"
-- (failed 7 แถวใน content_publish_queue ทั้งหมดมาจากสาเหตุนี้)
--
-- เหตุผลที่เลือกปิด is_active แทนการกรอกข้อมูล: เจ้าของระบบยังไม่มี URL เว็บปลายทาง
-- และ Application Password จริง — ปล่อยให้ channel active ไว้จะสร้าง failed ซ้ำทุกครั้ง
-- ที่มีคอนเทนต์เข้าคิว ปิดไว้ก่อนแล้วเปิดใหม่เมื่อกรอกข้อมูลครบ
--
-- ไม่แตะแถว failed 7 แถวที่มีอยู่ (เก็บไว้เป็นประวัติตามที่ตกลง)
--
-- Rollback: UPDATE publish_channels SET is_active = 1 WHERE id = '351b7173-fe57-4c0d-b7f2-60727a578476';
--
-- See openspec/changes/phase-0-publish-dispatch-blockers/ (งาน 2)
UPDATE publish_channels
SET is_active = 0, updated_at = NOW()
WHERE id = '351b7173-fe57-4c0d-b7f2-60727a578476';
