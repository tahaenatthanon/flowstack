## ADDED Requirements

### Requirement: User can request revision from approval list
ระบบ SHALL ให้ผู้ใช้ที่มีสิทธิ์สามารถขอแก้ไข content item จากหน้ารายการอนุมัติ โดยเปลี่ยนสถานะเป็น `revision` และบันทึกเหตุผลลง `reject_reason`

#### Scenario: Request revision with reason
- **WHEN** ผู้ใช้คลิก "ขอแก้ไข" บนรายการคอนเทนต์ที่สถานะ `pending_approval`
- **THEN** ระบบแสดง dialog ให้กรอกเหตุผล และเมื่อยืนยันแล้ว สถานะเปลี่ยนเป็น `revision`, `reject_reason` ถูกบันทึก, และรายการนั้นปรากฏในตัวกรองสถานะ "ขอแก้ไข"

#### Scenario: Request revision without reason
- **WHEN** ผู้ใช้คลิก "ขอแก้ไข" โดยไม่กรอกเหตุผล
- **THEN** ระบบยังคงเปลี่ยนสถานะเป็น `revision` — `reject_reason` เก็บเป็น NULL

#### Scenario: Three approval actions available
- **WHEN** รายการคอนเทนต์มีสถานะ `pending_approval`
- **THEN** คอลัมน์ "จัดการ" แสดง 3 ปุ่ม: อนุมัติ, ขอแก้ไข, และ ปฏิเสธ

### Requirement: Manage column keeps fixed width
ระบบ SHALL ล็อกความกว้างคอลัมน์ "จัดการ" ในตารางรายการอนุมัติให้คงที่ เพื่อให้ความกว้างของคอลัมน์อื่นไม่ขยับเมื่อมีหรือไม่มีปุ่ม action

#### Scenario: Column width stays consistent with buttons
- **WHEN** คอลัมน์ "จัดการ" แสดง 3 ปุ่ม (อนุมัติ/ขอแก้ไข/ปฏิเสธ)
- **THEN** ความกว้างคอลัมน์คงที่ (ประมาณ 240px) และปุ่มไม่ขึ้นบรรทัดใหม่ (whitespace-nowrap)

#### Scenario: Column width stays consistent without buttons
- **WHEN** คอลัมน์ "จัดการ" แสดงข้อความ "ดำเนินการแล้ว"
- **THEN** ความกว้างคอลัมน์เท่ากับกรณีมีปุ่ม — คอลัมน์ "ชื่อคอนเทนต์" และคอลัมน์อื่นไม่ขยาย/หดตาม
