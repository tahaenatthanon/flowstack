## ข้อกำหนดที่แก้ไข

### Requirement: Stat card keys ใช้ค่า status ที่อัปเดตแล้ว
ระบบ SHALL ใช้ status keys ที่อัปเดตแล้วใน stat cards: `pending_approval` (รออนุมัติ), `approved` (อนุมัติแล้ว), `revision` (ขอแก้ไข), `rejected` (ปฏิเสธ)

#### Scenario: Stat card keys updated
- **WHEN** หน้ารายการอนุมัติคำนวณ stat counts
- **THEN** `statusCounts` object ใช้ keys: `pending_approval`, `approved`, `revision`, `rejected`
- **AND** stat cards array ใช้ key ตรงกับ `statusCounts` keys

#### Scenario: Counts reflect new status keys
- **WHEN** มี content items ที่มี status `pending_approval` จำนวน 3 รายการ
- **THEN** stat card "รออนุมัติ" แสดงตัวเลข 3 โดยใช้ `statusCounts.pending_approval`
