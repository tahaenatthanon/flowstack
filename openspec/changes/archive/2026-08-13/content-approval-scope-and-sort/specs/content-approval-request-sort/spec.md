## ADDED Requirements

### Requirement: ระบบบันทึกวันที่ขออนุมัติ
ระบบ SHALL บันทึกเวลาที่ content item ถูกส่งขออนุมัติลงในคอลัมน์ `content_items.requested_at` (DATETIME NULL) โดยอัตโนมัติเมื่อสถานะเปลี่ยนเป็น `pending_approval`

#### Scenario: ขออนุมัติบันทึก requested_at
- **WHEN** ผู้ใช้กด "ขออนุมัติ" และสถานะเปลี่ยนเป็น `pending_approval` ผ่าน `PUT /content-items.php`
- **THEN** ระบบ set `requested_at = NOW()` ในแถวของ content item นั้น

#### Scenario: requested_at มีใน API response
- **WHEN** ระบบ query content items ผ่าน `GET /content-items.php`
- **THEN** ผลลัพธ์แต่ละรายการรวม field `requested_at` (หรือ null)

### Requirement: เรียงรายการอนุมัติตามวันที่ขออนุมัติ
หน้ารายการอนุมัติ SHALL มีตัวเลือก Sort ที่เรียงรายการตาม `requested_at` (วันที่ขออนุมัติ) โดยมี 2 ตัวเลือก: "ขออนุมัติล่าสุด → เก่าสุด" และ "ขออนุมัติเก่าสุด → ล่าสุด"

#### Scenario: เรียงล่าสุดก่อน
- **WHEN** ผู้ใช้เลือก Sort "ขออนุมัติล่าสุด → เก่าสุด"
- **THEN** รายการในตารางเรียงตามวันที่ขออนุมัติจากใหม่สุดไปเก่าสุด

#### Scenario: เรียงเก่าสุดก่อน
- **WHEN** ผู้ใช้เลือก Sort "ขออนุมัติเก่าสุด → ล่าสุด"
- **THEN** รายการในตารางเรียงตามวันที่ขออนุมัติจากเก่าสุดไปใหม่สุด

#### Scenario: รายการที่ไม่มี requested_at ใช้ fallback
- **WHEN** รายการมี `requested_at` เป็น NULL (ข้อมูลเดิม)
- **THEN** การเรียงใช้ `updated_at` แทน `requested_at` (ผ่าน `COALESCE(requested_at, updated_at)`)
