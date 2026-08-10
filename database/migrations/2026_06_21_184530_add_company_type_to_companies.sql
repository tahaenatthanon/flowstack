-- เพิ่มประเภทบริษัท (ความสัมพันธ์ทางธุรกิจ) เพื่อแยกการใช้ข้อมูลให้ถูกต้อง
-- customer = ลูกค้า, partner = คู่ค้า, manufacturer = ผู้ผลิต
-- หมายเหตุ: แยกจาก business_type (อุตสาหกรรม) และ tier (ระดับมูลค่าลูกค้า)
ALTER TABLE `companies`
  ADD COLUMN `company_type` ENUM('customer','partner','manufacturer') NOT NULL DEFAULT 'customer'
    COMMENT 'ประเภทบริษัท: customer=ลูกค้า, partner=คู่ค้า, manufacturer=ผู้ผลิต'
    AFTER `business_type`,
  ADD INDEX `idx_companies_company_type` (`tenant_id`, `company_type`);
