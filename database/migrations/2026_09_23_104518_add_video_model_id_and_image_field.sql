-- kie-video-adapter:
--   1) content_items.video_model_id — model ที่ใช้สร้างวิดีโอ ใช้เลือก adapter ตอน poll
--      (แม้แอดมินเปลี่ยน model ระหว่างรอ) และเป็นฐานให้ Phase 3a ล็อก model ต่อวิดีโอ
--   2) features.video.image_field ของ Seedance — ชื่อฟิลด์ภาพเริ่มต้นใน input ของ /api/v1/jobs/createTask
--      seedance-1.5-pro = input_urls (array, ทดสอบจริงแล้ว) / seedance-2, seedance-2-5 = first_frame_url (string, ตาม docs)
-- idempotent: รันซ้ำได้

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'content_items' AND COLUMN_NAME = 'video_model_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE content_items ADD COLUMN video_model_id CHAR(36) NULL AFTER video_job_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'content_items' AND CONSTRAINT_NAME = 'fk_content_items_video_model'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE content_items ADD CONSTRAINT fk_content_items_video_model FOREIGN KEY (video_model_id) REFERENCES ai_models(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE ai_models
SET features = JSON_SET(features, '$.video.image_field', 'input_urls')
WHERE provider_id = 'provider-kieai' AND model_id = 'bytedance/seedance-1.5-pro'
  AND JSON_EXISTS(features, '$.video');

UPDATE ai_models
SET features = JSON_SET(features, '$.video.image_field', 'first_frame_url')
WHERE provider_id = 'provider-kieai' AND model_id IN ('bytedance/seedance-2', 'bytedance/seedance-2-5')
  AND JSON_EXISTS(features, '$.video');
