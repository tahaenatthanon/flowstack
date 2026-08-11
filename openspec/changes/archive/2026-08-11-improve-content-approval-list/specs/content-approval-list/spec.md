## MODIFIED Requirements

### Requirement: User can view content approval list
ระบบ SHALL แสดงหน้ารายการอนุมัติคอนเทนต์ที่ `/content-approval` โดยแสดง content items ทุกสถานะ มี Tab Navigation สำหรับกรองตามสถานะโดยใช้รูปแบบเดียวกับ Status Filter ในหน้าผลงานคอนเทนต์ (`h-auto p-1 flex flex-wrap gap-0.5`) ประกอบด้วย: ทั้งหมด, รออนุมัติ (`review`), อนุมัติแล้ว (`published`), ขอแก้ไข (`revision`), ปฏิเสธ (`rejected`)

#### Scenario: View approval list with all items
- **WHEN** ผู้ใช้ที่มีสิทธิ์ `content_approval` เข้าถึง `/content-approval`
- **THEN** ระบบแสดงตารางรายการคอนเทนต์ทั้งหมด พร้อมข้อมูล: ชื่อคอนเทนต์, ประเภท, แพลตฟอร์ม, วันที่สร้าง, สถานะ และมี Stat Cards สรุปจำนวนแต่ละสถานะด้านบน

#### Scenario: Default tab is "ทั้งหมด"
- **WHEN** ผู้ใช้เข้าถึง `/content-approval` ครั้งแรก
- **THEN** Tab "ทั้งหมด" ถูกเลือกเป็น default และตารางแสดงรายการทุกสถานะ

#### Scenario: No items in selected tab
- **WHEN** Tab ที่เลือกไม่มี content items
- **THEN** ระบบแสดงข้อความ "ไม่มีรายการ" พร้อมระบุสถานะที่เกี่ยวข้อง

### Requirement: User can approve a content item
ระบบ SHALL ให้ผู้ใช้ที่มีสิทธิ์สามารถอนุมัติ content item จากหน้ารายการอนุมัติ

#### Scenario: Approve content
- **WHEN** ผู้ใช้คลิก "อนุมัติ" บนรายการคอนเทนต์ที่สถานะ `review`
- **THEN** ระบบแสดง dialog ยืนยัน และเมื่อยืนยันแล้ว สถานะเปลี่ยนเป็น `published` และรายการนั้นปรากฏใน Tab "อนุมัติแล้ว"

### Requirement: User can reject a content item
ระบบ SHALL ให้ผู้ใช้ที่มีสิทธิ์สามารถปฏิเสธ content item พร้อมระบุเหตุผล โดยเปลี่ยนสถานะเป็น `rejected`

#### Scenario: Reject content with reason
- **WHEN** ผู้ใช้คลิก "ปฏิเสธ" บนรายการคอนเทนต์
- **THEN** ระบบแสดง dialog ให้กรอกเหตุผล และเมื่อส่งแล้ว สถานะเปลี่ยนเป็น `rejected` และรายการนั้นปรากฏใน Tab "ปฏิเสธ"

### Requirement: Approval list supports filtering and sorting
ระบบ SHALL รองรับการกรองรายการตามสถานะผ่าน Tab Navigation, การกรองตามประเภทผ่าน Type Filter, การกรองตามแพลตฟอร์มผ่าน Platform Filter, การค้นหาผ่านช่องค้นหา, และการจัดเรียงตามวันที่ผ่าน Dropdown

#### Scenario: Filter by status tab
- **WHEN** ผู้ใช้เลือก Tab "ขอแก้ไข"
- **THEN** ระบบแสดงเฉพาะรายการที่มี status เป็น `revision`

#### Scenario: Filter by content type
- **WHEN** ผู้ใช้เลือก "บทความ" จาก Type Filter
- **THEN** ระบบแสดงเฉพาะรายการที่มี `content_type` เป็น `article`

#### Scenario: Type filter and tab work together
- **WHEN** ผู้ใช้เลือก Tab "รออนุมัติ" และ Type Filter "วีดีโอ"
- **THEN** ระบบแสดงเฉพาะรายการที่สถานะ `review` และ `content_type` เป็น `video`

#### Scenario: Search across filtered results
- **WHEN** ผู้ใช้พิมพ์คำค้นหาในช่องค้นหา และเลือก Tab "รออนุมัติ"
- **THEN** ระบบแสดงเฉพาะรายการที่สถานะ `review` และชื่อตรงกับคำค้นหา

#### Scenario: Sort by date
- **WHEN** ผู้ใช้เลือก "เก่า → ใหม่" จาก Sort Dropdown
- **THEN** รายการในตารางเรียงตามวันที่สร้างจากเก่าสุดไปใหม่สุด

#### Scenario: All tools grouped in toolbar
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** Tab Navigation (แถวบน), ช่องค้นหาพร้อมไอคอน `Search` (แว่นขยาย), Type Filter, Platform Filter, และ Sort Dropdown (แถวล่าง) ถูกจัดวางใน toolbar บริเวณเดียวกันระหว่าง Stat Cards และตาราง

## ADDED Requirements

### Requirement: Stat cards show approval status summary
ระบบ SHALL แสดง Stat Cards 4 ใบด้านบนตาราง สรุปจำนวน content items แยกตามสถานะ: รออนุมัติ, อนุมัติแล้ว, ขอแก้ไข, และปฏิเสธ — โดยใช้ Visual Style แบบ `stat-card card-hover` สอดคล้องกับ Stat Cards ของหน้า Projects

#### Scenario: Stat cards display with correct visual style
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** เห็น Stat Card 4 ใบที่ใช้ CSS class `stat-card card-hover` พร้อม icon container แบบ `rounded-lg bg-{color}/10` อยู่ด้านบน, ค่าตัวเลขแบบ `font-bold font-heading`, และ label ภาษาไทยใต้ค่า พร้อมจำนวนที่อัปเดตตามข้อมูลจริง

#### Scenario: Stat cards use semantic color tokens
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** Stat Cards ใช้ semantic color tokens: `text-warning` (รออนุมัติ), `text-success` (อนุมัติแล้ว), `text-info` (ขอแก้ไข), `text-destructive` (ปฏิเสธ)

### Requirement: Rejected status is distinct from draft
ระบบ SHALL แยกสถานะ `rejected` (ถูกปฏิเสธโดยผู้อนุมัติ) ออกจาก `draft` (บันทึกเป็นร่างโดยผู้สร้าง) ใน `STATUS_MAP` และเพิ่ม `'rejected'` ใน ENUM ของ column `status` ในตาราง `content_items` ผ่าน database migration

#### Scenario: Rejected items appear in "ปฏิเสธ" tab
- **WHEN** content item ถูกปฏิเสธโดยผู้อนุมัติ
- **THEN** สถานะเป็น `rejected` และปรากฏใน Tab "ปฏิเสธ" ไม่ใช่ Tab "ร่าง"

#### Scenario: Database schema supports rejected status
- **WHEN** ระบบ INSERT หรือ UPDATE `content_items.status` เป็น `'rejected'`
- **THEN** ฐานข้อมูลยอมรับค่า `'rejected'` โดยไม่มี error เนื่องจาก ENUM มีค่านี้แล้ว
