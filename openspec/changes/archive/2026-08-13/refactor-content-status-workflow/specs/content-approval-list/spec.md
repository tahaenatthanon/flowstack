## ข้อกำหนดที่แก้ไข

### Requirement: ผู้ใช้สามารถดูรายการอนุมัติเนื้อหา
ระบบ SHALL แสดงหน้ารายการอนุมัติคอนเทนต์ที่ `/content-approval` โดยแสดง content items เฉพาะที่อยู่ใน workflow การอนุมัติ (`pending_approval`, `approved`, `revision`, `rejected`) — ไม่รวม `draft` และ `published` มี Tab Navigation สำหรับกรองตามสถานะ ประกอบด้วย: ทั้งหมด (ไม่รวม draft/published), รออนุมัติ (`pending_approval`), อนุมัติแล้ว (`approved`), ขอแก้ไข (`revision`), ปฏิเสธ (`rejected`)

#### Scenario: View approval list with approval-relevant items only
- **WHEN** ผู้ใช้ที่มีสิทธิ์ `content_approval` เข้าถึง `/content-approval`
- **THEN** ระบบแสดงตารางรายการคอนเทนต์ที่มี status เป็น `pending_approval`, `approved`, `revision`, หรือ `rejected` — draft และ published items ไม่แสดง

#### Scenario: Default tab is "ทั้งหมด"
- **WHEN** ผู้ใช้เข้าถึง `/content-approval` ครั้งแรก
- **THEN** Tab "ทั้งหมด" ถูกเลือกเป็น default และตารางแสดงเฉพาะ approval-relevant items

#### Scenario: No items in selected tab
- **WHEN** Tab ที่เลือกไม่มี content items
- **THEN** ระบบแสดงข้อความ "ไม่มีรายการ" พร้อมระบุสถานะที่เกี่ยวข้อง

### Requirement: ผู้ใช้สามารถอนุมัติ content item
ระบบ SHALL ให้ผู้ใช้ที่มีสิทธิ์สามารถอนุมัติ content item จากหน้ารายการอนุมัติ โดยเปลี่ยนสถานะเป็น `approved`

#### Scenario: อนุมัติเนื้อหา
- **WHEN** ผู้ใช้คลิก "อนุมัติ" บนรายการคอนเทนต์ที่สถานะ `pending_approval`
- **THEN** ระบบแสดง dialog ยืนยัน และเมื่อยืนยันแล้ว สถานะเปลี่ยนเป็น `approved` และรายการนั้นปรากฏใน Tab "อนุมัติแล้ว"

### Requirement: ผู้ใช้สามารถปฏิเสธ content item
ระบบ SHALL ให้ผู้ใช้ที่มีสิทธิ์สามารถปฏิเสธ content item พร้อมระบุเหตุผล โดยเปลี่ยนสถานะเป็น `rejected` และบันทึกเหตุผลลง `reject_reason`

#### Scenario: ปฏิเสธเนื้อหาพร้อมเหตุผล
- **WHEN** ผู้ใช้คลิก "ปฏิเสธ" บนรายการคอนเทนต์
- **THEN** ระบบแสดง dialog ให้กรอกเหตุผล และเมื่อส่งแล้ว สถานะเปลี่ยนเป็น `rejected`, `reject_reason` ถูกบันทึก, และรายการนั้นปรากฏใน Tab "ปฏิเสธ"

### Requirement: Stat cards แสดงสรุปสถานะการอนุมัติ
ระบบ SHALL แสดง Stat Cards 4 ใบด้านบนตาราง สรุปจำนวน content items แยกตามสถานะ: รออนุมัติ (`pending_approval`), อนุมัติแล้ว (`approved`), ขอแก้ไข (`revision`), และปฏิเสธ (`rejected`)

#### Scenario: Stat cards display with correct visual style
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** เห็น Stat Card 4 ใบที่ใช้ `Card` component โดยมี Title และ Icon อยู่ในแถวเดียวกันและ Count อยู่ด้านล่าง

#### Scenario: Stat cards use semantic color tokens
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** Stat Cards ใช้ semantic color tokens: `text-warning` (รออนุมัติ), `text-success` (อนุมัติแล้ว), `text-info` (ขอแก้ไข), `text-destructive` (ปฏิเสธ)
