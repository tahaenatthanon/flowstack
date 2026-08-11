# approval-stats-cards Specification

## Purpose

กำหนดพฤติกรรมของ Stat Cards ด้านบนหน้า "รายการอนุมัติ" (`/content-approval`) ซึ่งสรุปจำนวน content items ตามสถานะ `review`, `published`, `revision`, และ `rejected`

**Visual Style** ของ Stat Cards กำหนดไว้ที่ capability `approval-stat-card-style` (Card component จาก design system — Title + Icon แถวเดียวกัน, Count ด้านล่าง)

## Requirements

### Requirement: Approval list shows stat cards for each status
ระบบ SHALL แสดง Stat Cards 4 ช่องด้านบนหน้ารายการอนุมัติ สรุปจำนวน content items ตามสถานะ: รออนุมัติ (`review`), อนุมัติแล้ว (`published`), ขอแก้ไข (`revision`), และปฏิเสธ (`rejected`)

#### Scenario: Display four status stat cards
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** ระบบแสดง Stat Cards 4 ช่องเรียงกันใน grid แสดงจำนวนของแต่ละสถานะพร้อมชื่อสถานะภาษาไทย ตาม Visual Style ที่กำหนดใน `approval-stat-card-style`

#### Scenario: Stat cards use semantic colors
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** Stat Cards ใช้ semantic color tokens: `text-warning` (รออนุมัติ), `text-success` (อนุมัติแล้ว), `text-info` (ขอแก้ไข), `text-destructive` (ปฏิเสธ)

#### Scenario: Counts are independent of active tab and filters
- **WHEN** ผู้ใช้เลือก Tab หรือใช้ตัวกรอง (ประเภท / แพลตฟอร์ม / ค้นหา)
- **THEN** จำนวนใน Stat Cards ยังคงนับจาก content items ทั้งหมด ไม่ถูกจำกัดตาม Tab หรือตัวกรองที่เลือก

#### Scenario: Stat cards update on data change
- **WHEN** ผู้ใช้อนุมัติ, ปฏิเสธ, หรือส่งแก้ไข content item
- **THEN** จำนวนใน Stat Cards ปรับปรุงอัตโนมัติตามข้อมูลล่าสุด

#### Scenario: Zero count display
- **WHEN** สถานะใดไม่มีรายการ
- **THEN** Stat Card ของสถานะนั้นแสดงเลข 0
