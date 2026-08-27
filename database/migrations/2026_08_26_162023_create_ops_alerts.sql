-- ตารางกันการแจ้งเตือนซ้ำของ ops alert
-- change: add-ops-alerting-and-token-expiry (spec: ops-failure-alerting)
--
-- alert_key ผูกกับ "เรื่อง" ไม่ใช่ "เหตุการณ์" (เช่น publish_fail:facebook, cron_fail:publish-scheduler)
-- เพื่อให้ความล้มเหลวซ้ำเรื่องเดิมยุบเป็นแถวเดียวและใช้ last_sent_at คุมเพดาน 1 ครั้ง/ชั่วโมง
--
-- rollback: DROP TABLE ops_alerts;

CREATE TABLE IF NOT EXISTS ops_alerts (
    id            CHAR(36)     NOT NULL,
    alert_key     VARCHAR(191) NOT NULL,
    tenant_id     CHAR(36)     NOT NULL,
    first_seen_at DATETIME     NOT NULL,
    last_sent_at  DATETIME     NULL,
    send_count    INT          NOT NULL DEFAULT 0,
    resolved_at   DATETIME     NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_ops_alerts_key_tenant (alert_key, tenant_id),
    KEY idx_ops_alerts_open (resolved_at, last_sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
