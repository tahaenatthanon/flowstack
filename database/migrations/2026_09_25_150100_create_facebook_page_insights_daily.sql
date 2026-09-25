-- ตาราง page insights รายวันของเพจ Facebook (change: facebook-page-insights-dashboard)
--
-- ทำไมเป็นตารางแคบ (1 แถว = วัน × metric) ไม่ใช่คอลัมน์ละ metric:
--   Meta ยกเลิก metric เป็นระยะ (ตระกูล impressions หายไปแล้ว) — เพิ่ม/ถอดชื่อ metric ได้โดยไม่ต้อง ALTER
-- value_json: metric ที่ Graph API คืนเป็น object (page_actions_post_reactions_total = {like: n, love: n})
--   เก็บ object ดิบไว้ และ value = ผลรวมทุกชนิด
-- ไม่มี channel_id: ตัดสินใจแล้วว่ารองรับเพจเดียวต่อ tenant — แต่ต้องมี tenant_id เพราะระบบเป็น multi-tenant
-- metric_date: วันที่ของข้อมูลตาม end_time ของ Graph API (ไม่ใช่วันที่ดึง)

CREATE TABLE IF NOT EXISTS facebook_page_insights_daily (
  id          CHAR(36)     NOT NULL,
  tenant_id   CHAR(36)     NOT NULL,
  metric_date DATE         NOT NULL,
  metric      VARCHAR(100) NOT NULL,
  value       BIGINT       NULL,
  value_json  LONGTEXT     NULL,
  fetched_at  DATETIME     NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_fpid_point (tenant_id, metric_date, metric),
  KEY idx_fpid_metric (tenant_id, metric, metric_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
