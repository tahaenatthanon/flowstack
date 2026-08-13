## ข้อกำหนดที่แก้ไข

### Requirement: Tab navigation ใช้ status key ที่อัปเดตแล้ว
ระบบ SHALL ใช้ status keys ที่อัปเดตแล้วใน tab navigation ของหน้ารายการอนุมัติ: `pending_approval` (รออนุมัติ), `approved` (อนุมัติแล้ว), `revision` (ขอแก้ไข), `rejected` (ปฏิเสธ)

#### Scenario: Tab values match database status keys
- **WHEN** หน้ารายการอนุมัติแสดง tab
- **THEN** tab `value` properties ใช้ keys: `pending_approval`, `approved`, `revision`, `rejected`
- **AND** ไม่มี tab ที่ใช้ key `review` หรือ `published`
