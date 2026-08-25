-- 2026_08_24_171500_disable_outbound_cron_jobs.sql
--
-- ปิด 3 งานที่ส่งผลออกภายนอกไว้ก่อน ก่อนลงทะเบียน Windows Task ที่เรียก
-- api/cron/tick.php ทุกนาที (ข้อ 5.2 ของ change phase-0-cron-scheduler-runner
-- — Open Question ใน design.md ที่เจ้าของระบบตัดสินแล้วเมื่อ 2026-08-24)
--
-- เหตุผล: ทั้งสามงานเงียบมา 2.5 เดือน (ไม่มีแถวใน cron_runs เลยนอกจาก
-- notification-dispatch ที่รันครั้งสุดท้าย 2026-06-09) การเปิดตัวตั้งเวลา
-- พร้อมกับปล่อยงานเหล่านี้ไว้ enabled=1 จะทำให้ระบบส่งของออกไปหาลูกค้าและ
-- ทีมจริงทันทีโดยยังไม่มีใครตรวจเนื้อหาที่ค้างอยู่:
--   notification-dispatch (*/15 * * * *)  → ส่ง LINE/Telegram ภายใน 15 นาที
--   billing-reminders     (0 9 * * *)     → ส่งอีเมลแจ้งหนี้ 2026-08-25 09:00
--   recurring-tasks       (0 0 * * *)     → สร้าง task ชุดใหม่ 2026-08-25 00:00
--
-- คงเปิดไว้เฉพาะสองงานที่ไม่ส่งอะไรออกภายนอก:
--   publish-scheduler    (* * * * *)   → ปลดล็อกเฟส 0 DoD (ข)
--   content-metrics-sync (0 */6 * * *) → ปลดล็อกเฟส 2
--
-- การเปิดกลับ: UPDATE cron_jobs SET enabled=1 WHERE `key` IN (...) หรือกดสวิตช์
-- ในหน้า Admin > Cron Jobs — ควรเปิดทีละงานแล้วตรวจผลก่อนเปิดงานถัดไป
-- ปุ่ม "รันเดี๋ยวนี้" ยังใช้ได้ตามปกติแม้ enabled=0 (มี dialog ยืนยันก่อน)

UPDATE cron_jobs
SET enabled = 0
WHERE `key` IN ('notification-dispatch', 'billing-reminders', 'recurring-tasks');

-- next_run_at ของงานที่ปิดไม่ถูกใช้อีก แต่ปล่อยค่าเดิมไว้เพื่อไม่ให้เสียร่องรอย
-- ว่ารอบถัดไปเคยถูกตั้งเป็นเมื่อไร — tick เลือกงานด้วย enabled=1 อยู่แล้ว
