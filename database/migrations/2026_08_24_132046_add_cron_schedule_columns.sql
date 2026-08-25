-- เพิ่มตารางเวลาที่เครื่องอ่านได้ให้ cron_jobs (เฟส 0: cron scheduler runner)
--
-- ทำไม: `interval_label` เป็นข้อความไทยสำหรับแสดงผลเท่านั้น ('ทุก 6 ชั่วโมง', 'ทุกวัน 07:30')
--   เครื่องอ่านไม่ได้ จึงไม่มีทางรู้ว่างานใดถึงกำหนด — api/cron/tick.php ต้องมี cron_expression
--   `interval_label` ยังคงอยู่ตามเดิม ใช้แสดงผลในหน้าแอดมิน ไม่ใช้ตัดสินใจเรื่องเวลา
--
-- ทั้งสามคอลัมน์ NULL ได้ทั้งหมด และโค้ดเดิมไม่มีจุดใดอ่าน → rollback ได้โดยไม่ต้อง DROP

ALTER TABLE `cron_jobs`
  ADD COLUMN `cron_expression` VARCHAR(100) NULL DEFAULT NULL COMMENT 'crontab 5 ฟิลด์: นาที ชั่วโมง วันที่ เดือน วันในสัปดาห์ — แหล่งความจริงของตารางเวลา' AFTER `interval_label`,
  ADD COLUMN `last_run_at`     DATETIME     NULL DEFAULT NULL COMMENT 'เวลาที่ tick สั่งรันงานนี้ครั้งล่าสุด' AFTER `cron_expression`,
  ADD COLUMN `next_run_at`     DATETIME     NULL DEFAULT NULL COMMENT 'เวลารันรอบถัดไปที่คำนวณจาก cron_expression — NULL = ยังไม่เคยตั้งรอบ tick จะ initialize ให้แต่ไม่รัน' AFTER `last_run_at`;

-- เติม cron_expression ให้ตรงกับความหมายของ interval_label เดิมทุกแถว
-- next_run_at ปล่อย NULL โดยเจตนา: tick ครั้งแรกทำหน้าที่ initialize เท่านั้น
--   ป้องกันงานที่เงียบไป ~2.5 เดือน (การรันครั้งสุดท้ายทั้งระบบคือ 2026-06-09) ยิงพร้อมกันทันที
UPDATE `cron_jobs` SET `cron_expression` = '* * * * *'    WHERE `key` = 'cron-publish';          -- ทุก 1 นาที
UPDATE `cron_jobs` SET `cron_expression` = '* * * * *'    WHERE `key` = 'publish-scheduler';     -- ทุก 1 นาที
UPDATE `cron_jobs` SET `cron_expression` = '*/15 * * * *' WHERE `key` = 'notification-dispatch'; -- ทุก 15 นาที
UPDATE `cron_jobs` SET `cron_expression` = '0 0 * * *'    WHERE `key` = 'recurring-tasks';       -- ทุกวัน เที่ยงคืน
UPDATE `cron_jobs` SET `cron_expression` = '30 7 * * *'   WHERE `key` = 'ai-digest';             -- ทุกวัน 07:30
UPDATE `cron_jobs` SET `cron_expression` = '0 9 * * *'    WHERE `key` = 'billing-reminders';     -- ทุกวัน 09:00
UPDATE `cron_jobs` SET `cron_expression` = '0 */6 * * *'  WHERE `key` = 'content-metrics-sync';  -- ทุก 6 ชั่วโมง

-- ปิดไปป์ไลน์เผยแพร่รุ่นก่อนก่อนเปิดตัวตั้งเวลา
--
-- cron-publish อ่าน content_schedules + content_plan_items ซึ่งมีทั้งหมด 2 แถว (sent 1, failed 1)
-- และ pending = 0 ขณะที่คิวที่ใช้จริงคือ content_publish_queue ผ่าน publish-scheduler
-- ถ้าเปิดไว้: ได้แถว cron_runs เปล่า 1,440 แถว/วัน และถ้าอนาคตมีแถวใน content_schedules
-- จะกลายเป็นเผยแพร่ซ้ำจากสองเส้นทางที่ไม่รู้จักกัน — ยังกดรันมือจากหน้าแอดมินได้ถ้าจำเป็น
UPDATE `cron_jobs` SET `enabled` = 0 WHERE `key` = 'cron-publish';
