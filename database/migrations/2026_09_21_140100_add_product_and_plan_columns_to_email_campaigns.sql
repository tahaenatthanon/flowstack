ALTER TABLE email_campaigns
  ADD COLUMN product_id CHAR(36) DEFAULT NULL COMMENT 'สินค้าที่แคมเปญนี้พูดถึง (ถ้ามี)' AFTER source_content_id,
  ADD COLUMN plan_batch_id CHAR(36) DEFAULT NULL COMMENT 'ID ชุดแผนที่ AI สร้างพร้อมกัน (แคมเปญในชุดเดียวกันมีค่าเดียวกัน)' AFTER product_id,
  ADD COLUMN plan_sequence INT DEFAULT NULL COMMENT 'ลำดับที่ในชุดแผน (1..N)' AFTER plan_batch_id,
  ADD KEY idx_email_campaigns_plan_batch (plan_batch_id);
