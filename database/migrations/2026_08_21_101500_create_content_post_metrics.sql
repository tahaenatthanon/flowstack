-- ตาราง time-series เก็บ engagement ของโพสต์ที่เผยแพร่แล้ว (เฟส 2: post metrics sync)
--
-- ทำไมเป็น time-series ไม่ใช่คอลัมน์เดียวใน content_items:
--   ต้องดูแนวโน้มการเติบโตของโพสต์ได้ ไม่ใช่ snapshot ทับกันทุกรอบ cron
--   content_items.views/likes ยังเก็บ "ผลรวมล่าสุดทุกช่องทาง" ไว้ให้การ์ด/ranking เดิมอ่าน
--
-- channel_id: เก็บต่อช่องทาง เพราะคอนเทนต์เดียวเผยแพร่ได้หลาย channel และ id โพสต์
--   ต่างกันต่อช่องทาง (แหล่งคือ content_publish_queue.platform_post_id)
--   ON DELETE SET NULL — ลบ channel แล้วประวัติ metrics ต้องไม่หาย

CREATE TABLE IF NOT EXISTS content_post_metrics (
  id               CHAR(36)     NOT NULL,
  tenant_id        CHAR(36)     NOT NULL,
  content_item_id  CHAR(36)     NOT NULL,
  channel_id       CHAR(36)     NULL,
  platform         VARCHAR(50)  NOT NULL,
  -- id โพสต์ฝั่งแพลตฟอร์มที่ใช้ดึง insights รอบนี้ — เก็บไว้เพื่อ trace ย้อนหลังได้
  platform_post_id VARCHAR(255) NULL,
  views            INT          NOT NULL DEFAULT 0,
  likes            INT          NOT NULL DEFAULT 0,
  fetched_at       DATETIME     NOT NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_content_fetched (content_item_id, fetched_at),
  KEY idx_tenant_platform (tenant_id, platform),
  KEY idx_channel (channel_id),
  CONSTRAINT fk_cpm_content FOREIGN KEY (content_item_id)
    REFERENCES content_items (id) ON DELETE CASCADE,
  CONSTRAINT fk_cpm_channel FOREIGN KEY (channel_id)
    REFERENCES publish_channels (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
