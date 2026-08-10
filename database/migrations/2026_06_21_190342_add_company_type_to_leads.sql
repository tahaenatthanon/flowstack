-- เพิ่มประเภทบริษัทให้ leads เพื่อให้แยกประเภท (ลูกค้า/คู่ค้า/ผู้ผลิต) ตั้งแต่ต้นทาง
-- และส่งต่อค่าไปยัง companies.company_type เมื่อ convert lead เป็นบริษัท
ALTER TABLE `leads`
  ADD COLUMN `company_type` ENUM('customer','partner','manufacturer') NOT NULL DEFAULT 'customer'
    COMMENT 'ประเภทบริษัท: customer=ลูกค้า, partner=คู่ค้า, manufacturer=ผู้ผลิต'
    AFTER `business_type`;
