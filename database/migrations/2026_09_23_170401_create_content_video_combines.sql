-- multi-clip-video: วิดีโอรวม — 1 แถวต่อการรวม 1 ครั้ง (สร้างไฟล์ใหม่ทุกครั้ง ไม่เขียนทับ)
-- source_clips = [{scene_id, scene_index, clip_id}, ...] เรียงตามลำดับฉาก — ระบุที่มาและใช้ตรวจวิดีโอรวมล้าสมัย
-- status='combining' ใช้เป็นการจองกันรวมซ้อน (หมดอายุเมื่อเกิน 10 นาที)
-- content_items.video_url ชี้ไฟล์รวมล่าสุดที่ status='done'

CREATE TABLE IF NOT EXISTS content_video_combines (
  id           CHAR(36)      NOT NULL,
  tenant_id    CHAR(36)      NOT NULL,
  item_id      CHAR(36)      NOT NULL,
  status       ENUM('combining','done','failed') NOT NULL DEFAULT 'combining',
  video_url    VARCHAR(1000) NULL,
  source_clips JSON          NOT NULL,
  error        TEXT          NULL,
  created_at   DATETIME      NOT NULL,
  completed_at DATETIME      NULL,
  updated_at   DATETIME      NOT NULL,
  PRIMARY KEY (id),
  KEY idx_cvcb_item (item_id, created_at),
  KEY idx_cvcb_status (status, created_at),
  CONSTRAINT fk_cvcb_item FOREIGN KEY (item_id) REFERENCES content_items (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
