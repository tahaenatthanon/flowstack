-- ลบงานทดลองเก็บ page metrics ที่ค้างไว้ (change: facebook-page-insights-dashboard)
--
-- ที่มา: ตาราง content_page_metrics และ cron_jobs key 'content-page-metrics-sync' ถูกสร้างใน DB local
--   เมื่อ 1 ก.ย. 2026 โดยไม่มี migration / โค้ด / spec ใน repo — ไฟล์ api/cron/content-page-metrics-sync.php
--   ที่ cron ชี้ไปไม่มีอยู่จริง ถูกแทนที่ด้วย facebook_page_insights_daily + cron facebook-page-insights-sync
--
-- สำรองก่อนลบแล้ว: database/backups/2026_09_25_orphan_content_page_metrics.sql (150 แถว ส.ค.–1 ก.ย.
--   ทุกแถวอยู่ในช่วง 90 วันที่ดึงจาก Graph API ใหม่ได้)
-- บนเครื่องที่ไม่เคยมีของเหล่านี้ (เช่น production) คำสั่งด้านล่างไม่มีผลใด ๆ

DROP TABLE IF EXISTS content_page_metrics;

DELETE FROM cron_jobs WHERE `key` = 'content-page-metrics-sync';
