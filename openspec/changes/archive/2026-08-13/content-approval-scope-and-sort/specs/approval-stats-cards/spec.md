## MODIFIED Requirements

### Requirement: Approval list shows stat cards for each status
ระบบ SHALL แสดง Stat Cards 4 ช่องด้านบนหน้ารายการอนุมัติ สรุปจำนวน content items ตามสถานะ: อนุมัติแล้ว (`approved`), รออนุมัติ (`pending_approval`), ขอแก้ไข (`revision`), และปฏิเสธ (`rejected`) — โดยให้ "อนุมัติแล้ว" อยู่ก่อน "รออนุมัติ"

#### Scenario: Display four status stat cards
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** ระบบแสดง Stat Cards 4 ช่องเรียงกันใน grid แสดงจำนวนของแต่ละสถานะพร้อมชื่อสถานะภาษาไทย ตาม Visual Style ที่กำหนดใน `approval-stat-card-style`

#### Scenario: Stat cards use semantic colors
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** Stat Cards ใช้ semantic color tokens: `text-success` (อนุมัติแล้ว), `text-warning` (รออนุมัติ), `text-info` (ขอแก้ไข), `text-destructive` (ปฏิเสธ)

#### Scenario: Stat cards order — approved before pending_approval
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** stat cards array เรียงลำดับ `approved` ก่อน `pending_approval`

#### Scenario: Counts are independent of active tab and filters
- **WHEN** ผู้ใช้เลือก Tab หรือใช้ตัวกรอง (ประเภท / แพลตฟอร์ม / ค้นหา)
- **THEN** จำนวนใน Stat Cards ยังคงนับจาก content items ทั้งหมด ไม่ถูกจำกัดตาม Tab หรือตัวกรองที่เลือก

#### Scenario: Stat cards update on data change
- **WHEN** ผู้ใช้อนุมัติ, ปฏิเสธ, หรือส่งแก้ไข content item
- **THEN** จำนวนใน Stat Cards ปรับปรุงอัตโนมัติตามข้อมูลล่าสุด

#### Scenario: Zero count display
- **WHEN** สถานะใดไม่มีรายการ
- **THEN** Stat Card ของสถานะนั้นแสดงเลข 0

#### Scenario: Stat card keys updated
- **WHEN** หน้ารายการอนุมัติคำนวณ stat counts
- **THEN** `statusCounts` object ใช้ keys: `approved`, `pending_approval`, `revision`, `rejected`
- **AND** stat cards array ใช้ key ตรงกับ `statusCounts` keys

#### Scenario: Counts reflect new status keys
- **WHEN** มี content items ที่มี status `approved` จำนวน 3 รายการ
- **THEN** stat card "อนุมัติแล้ว" แสดงตัวเลข 3 โดยใช้ `statusCounts.approved`
