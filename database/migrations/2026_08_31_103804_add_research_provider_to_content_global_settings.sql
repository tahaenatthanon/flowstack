-- ─────────────────────────────────────────────────────────────────────────────
-- Content Pipeline — ตั้งค่า provider ข้อมูลการค้นหา (per-tenant)
--
-- เก็บที่ content_global_settings ไม่ใช่ ai_providers เพราะ:
--   1. ai_providers เป็นตาราง global ไม่มี tenant_id → แยกต่อ tenant ไม่ได้
--   2. ai_providers มีช่องเก็บคีย์แค่ช่องเดียว แต่ DataForSEO ต้องใช้ login + password
--   3. ตารางนี้มี precedent อยู่แล้ว (image_gen_api_key_encrypted) → ทำตาม pattern เดิม
--
-- research_api_key_encrypted ใช้ format เดียวกับ image_gen_api_key_encrypted
-- คือ base64(iv || ciphertext) ผ่าน encryptValue()/decryptValue() (AES-256-CBC)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE `content_global_settings`
  ADD COLUMN IF NOT EXISTS `research_provider` VARCHAR(50) NOT NULL DEFAULT 'none'
    COMMENT 'none = ยังไม่ตั้งค่า → ขั้น Research จะให้ข้ามได้ ไม่บล็อก pipeline',
  ADD COLUMN IF NOT EXISTS `research_api_login` VARCHAR(255) DEFAULT NULL
    COMMENT 'DataForSEO login (อีเมล) — ไม่ใช่ความลับ เก็บ plaintext ได้',
  ADD COLUMN IF NOT EXISTS `research_api_key_encrypted` TEXT DEFAULT NULL
    COMMENT 'DataForSEO password เข้ารหัส AES-256-CBC — ห้ามส่งออก frontend',
  ADD COLUMN IF NOT EXISTS `research_location_code` INT(11) NOT NULL DEFAULT 2764
    COMMENT '2764 = ไทย',
  ADD COLUMN IF NOT EXISTS `research_language_code` VARCHAR(10) NOT NULL DEFAULT 'th',
  ADD COLUMN IF NOT EXISTS `research_cache_hours` SMALLINT UNSIGNED NOT NULL DEFAULT 168
    COMMENT 'อายุ cache กันจ่ายซ้ำ (168 = 7 วัน); 0 = ปิด cache ยิงใหม่ทุกครั้ง';
