## ADDED Requirements

### Requirement: บันทึกเวลา approved_at เมื่อเนื้อหาถูกอนุมัติ
เมื่อสถานะของ `content_items` เปลี่ยนเป็น `approved` ระบบ SHALL บันทึก `approved_at = NOW()` ลงในแถวนั้น เพื่อให้เฟสถัดไปสามารถคำนวณเวลาผลิต (lead time) จาก `created_at` → `approved_at`

#### Scenario: อนุมัติเนื้อหาแล้วบันทึกเวลา
- **WHEN** ผู้ใช้ (approver) เรียก `PUT /content-items.php?id={id}` ด้วย `{ status: 'approved' }`
- **THEN** แถว `content_items` นั้นมี `approved_at` ไม่เป็น NULL

#### Scenario: สถานะอื่นไม่บันทึก approved_at
- **WHEN** สถานะถูกเปลี่ยนเป็นค่าอื่นที่ไม่ใช่ `approved` (เช่น `published`, `draft`, `rejected`)
- **THEN** `approved_at` ไม่ถูกตั้งค่าใหม่จากการเปลี่ยนสถานะครั้งนั้น
