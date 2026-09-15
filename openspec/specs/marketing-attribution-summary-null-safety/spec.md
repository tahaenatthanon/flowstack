## Purpose

ป้องกันไม่ให้การ์ดสรุป KPI ในแท็บ Attribution (Marketing) เกิด crash เมื่อ backend ส่งค่า `null` มาให้ field ตัวเลขใน `summary` ไม่ว่าจะเป็นเพราะช่วงเวลาที่เลือกไม่มีข้อมูล หรือกรณีอื่นที่ยังไม่ถูกป้องกันในอนาคต

## Requirements

### Requirement: การ์ดสรุป KPI ในแท็บ Attribution ต้องไม่ crash เมื่อช่วงเวลาที่เลือกไม่มีข้อมูล
`GET /api/marketing-attribution.php` SHALL คืนค่าตัวเลขทุก field ใน `summary` (`total_leads`, `total_won`, `total_lost`, `total_won_value`, `source_count`) เป็นตัวเลข (0 หรือมากกว่า) เสมอ ไม่ว่าช่วงเวลาที่ร้องขอจะมีข้อมูลตรงเงื่อนไขหรือไม่ — SHALL NOT คืนค่า `null` สำหรับ field เหล่านี้ไม่ว่ากรณีใด และ `AttributionTab.tsx` SHALL แสดงผลการ์ดสรุป KPI ได้ตามปกติ (ไม่ throw error) แม้ได้รับค่า `null` จาก response

#### Scenario: เลือกช่วงเวลาที่ไม่มี sales_opportunities สร้างขึ้นเลย
- **WHEN** ผู้ใช้เลือกช่วงเวลาที่ไม่มี `sales_opportunities` ที่ `created_at` อยู่ในช่วงนั้นเลยแม้แต่รายการเดียว
- **THEN** `GET /api/marketing-attribution.php` SHALL คืนค่า `summary.total_won`, `summary.total_lost`, `summary.total_won_value` เป็น `0` (ไม่ใช่ `null`)
- **AND** แท็บ Attribution SHALL แสดงการ์ด KPI ตามปกติ (เช่น "ดีลที่ชนะ" แสดง "0") ไม่เกิด ErrorBoundary

#### Scenario: เลือกช่วงเวลาที่มีข้อมูลปกติ
- **WHEN** ผู้ใช้เลือกช่วงเวลาที่มี `sales_opportunities` อยู่ในช่วงนั้น
- **THEN** `summary` SHALL คืนค่าตัวเลขที่คำนวณจากข้อมูลจริงตามปกติ ไม่มีการเปลี่ยนแปลงพฤติกรรมจากเดิม

#### Scenario: Frontend ได้รับค่า null จาก field ที่ยังไม่ถูกป้องกันในอนาคต
- **WHEN** `AttributionTab.tsx` เรียก `.toLocaleString()` บนค่าจาก `summary` field ใดก็ตามที่อาจเป็น `null`
- **THEN** โค้ด SHALL มี fallback (เช่น `?? 0`) ก่อนเรียก `.toLocaleString()` เสมอ เพื่อไม่ให้ทั้ง component crash แม้ backend ส่ง `null` มาโดยไม่ตั้งใจ
