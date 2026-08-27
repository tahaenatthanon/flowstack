-- เก็บอายุ credentials ของช่องทางเผยแพร่ลงฐานข้อมูล
-- change: add-ops-alerting-and-token-expiry (spec: publish-channel-token-health)
--
-- token_expires_at:       วันหมดอายุของ token — NULL = ไม่มีวันหมดอายุ (Graph API คืน expires_at = 0)
-- data_access_expires_at: หน้าต่าง data access ซึ่งเป็นเดดไลน์คนละตัวจาก token
--                         token ที่ไม่มีวันหมดอายุยังหยุดเข้าถึงข้อมูลได้เมื่อพ้นหน้าต่างนี้
-- token_checked_at:       เวลาที่ตรวจครั้งล่าสุด — แยก "ตรวจแล้วปกติ" จาก "ไม่ได้ตรวจ"
-- token_status:           valid | expiring | expired | invalid | unsupported (NULL = ยังไม่เคยตรวจ)
--
-- rollback:
--   ALTER TABLE publish_channels
--     DROP COLUMN token_expires_at, DROP COLUMN data_access_expires_at,
--     DROP COLUMN token_checked_at, DROP COLUMN token_status, DROP COLUMN token_error;

ALTER TABLE publish_channels
    ADD COLUMN token_expires_at       DATETIME     NULL AFTER credentials_encrypted,
    ADD COLUMN data_access_expires_at DATETIME     NULL AFTER token_expires_at,
    ADD COLUMN token_checked_at       DATETIME     NULL AFTER data_access_expires_at,
    ADD COLUMN token_status           VARCHAR(20)  NULL AFTER token_checked_at,
    ADD COLUMN token_error            VARCHAR(500) NULL AFTER token_status;
