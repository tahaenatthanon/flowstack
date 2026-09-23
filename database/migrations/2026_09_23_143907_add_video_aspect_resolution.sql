-- video-creation-options: อัตราส่วน/ความละเอียดวิดีโอเลือกตอนสร้างคอนเทนต์แล้วล็อก + แปลงความยาวเดิม
--   video_aspect_ratio  '9:16' | '16:9'   (VARCHAR ไม่ใช่ ENUM — เพิ่มค่าใหม่ได้โดยไม่ต้อง ALTER, validate ที่ PHP)
--   video_resolution    '720p' | '1080p'
--   duration_sec ของวิดีโอ: ตัวเลือกใหม่คือ 30/45/60/90 → แปลงค่าเดิมเป็นค่าที่ใกล้ที่สุด (15→30, 180/600→90)
-- idempotent: รันซ้ำได้

SET @c1 := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'content_items' AND COLUMN_NAME = 'video_aspect_ratio');
SET @sql := IF(@c1 = 0, 'ALTER TABLE content_items ADD COLUMN video_aspect_ratio VARCHAR(8) NULL AFTER duration_sec', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c2 := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'content_items' AND COLUMN_NAME = 'video_resolution');
SET @sql := IF(@c2 = 0, 'ALTER TABLE content_items ADD COLUMN video_resolution VARCHAR(8) NULL AFTER video_aspect_ratio', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE content_items SET duration_sec = 30 WHERE type = 'video' AND duration_sec = 15;
UPDATE content_items SET duration_sec = 90 WHERE type = 'video' AND duration_sec IN (180, 600);

UPDATE content_items SET video_aspect_ratio = '9:16' WHERE type = 'video' AND video_aspect_ratio IS NULL;
UPDATE content_items SET video_resolution   = '720p' WHERE type = 'video' AND video_resolution IS NULL;
