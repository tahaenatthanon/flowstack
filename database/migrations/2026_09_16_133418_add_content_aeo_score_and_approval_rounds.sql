-- เพิ่มคอลัมน์เก็บคะแนน SEO และ AEO ล่าสุดบน content_items (แยกกัน 2 ค่า —
-- ระบบมี 2 ชุดประเมินคนละคะแนน ไม่ใช่ค่าเดียว ดู design.md decision 1)
-- และตารางใหม่เก็บประวัติการตัดสินใจอนุมัติแบบแยกรอบ (1 แถวต่อ 1 รอบ)
-- ดู openspec/changes/content-approval-review-context/design.md สำหรับเหตุผล

ALTER TABLE content_items
  ADD COLUMN seo_score INT NULL AFTER seo_title,
  ADD COLUMN aeo_score INT NULL AFTER seo_score;

CREATE TABLE content_approval_rounds (
  id CHAR(36) PRIMARY KEY,
  content_item_id CHAR(36) NOT NULL,
  decision ENUM('approved','revision','rejected') NOT NULL,
  reason TEXT NULL,
  decided_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  tenant_id CHAR(36) NOT NULL,
  FOREIGN KEY (content_item_id) REFERENCES content_items(id) ON DELETE CASCADE,
  INDEX idx_content_item (content_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
