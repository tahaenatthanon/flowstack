-- เพิ่มคอลัมน์เลือกโมเดล AI สำหรับฟีเจอร์ค้นหาลูกค้าใหม่ (Lead Generation)
-- ใช้กับ ai_search และการสรุปอีเมล (IMAP) ในหน้า lead-generation
-- ถ้าไม่เลือก จะ fallback ไปใช้ ai_chat_model_id แล้วค่อยใช้โมเดลเริ่มต้น
ALTER TABLE `company_settings`
  ADD COLUMN `ai_lead_model_id` CHAR(36) NULL
    COMMENT 'โมเดล AI สำหรับฟีเจอร์ค้นหาลูกค้าใหม่ (lead generation)'
    AFTER `ai_analyst_model_id`;
