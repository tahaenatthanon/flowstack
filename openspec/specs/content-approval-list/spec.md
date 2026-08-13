# content-approval-list Specification

## Purpose

กำหนดพฤติกรรมของหน้า "รายการอนุมัติ" (`/content-approval`) สำหรับดู กรอง จัดเรียง อนุมัติ และปฏิเสธ content items ที่เกี่ยวข้องกับการอนุมัติ (`pending_approval`, `approved`, `revision`, `rejected` — ไม่รวม `draft` และ `published`) รวมถึง Stat Cards สรุปจำนวนตามสถานะ และดีไซน์ของหน้ารายการอนุมัติกับหน้าแดชบอร์ดคอนเทนต์ตาม mockup

## Requirements

### Requirement: User can view content approval list
ระบบ SHALL แสดงหน้ารายการอนุมัติคอนเทนต์ที่ `/content-approval` โดยแสดง content items เฉพาะที่อยู่ใน workflow การอนุมัติ (`pending_approval`, `approved`, `revision`, `rejected`) — ไม่รวม `draft` และ `published` มี Tab Navigation สำหรับกรองตามสถานะโดยใช้รูปแบบเดียวกับ Status Filter ในหน้าผลงานคอนเทนต์ (`h-auto p-1 flex flex-wrap gap-0.5`) ประกอบด้วย: ทั้งหมด (ไม่รวม draft/published), รออนุมัติ (`pending_approval`), อนุมัติแล้ว (`approved`), ขอแก้ไข (`revision`), ปฏิเสธ (`rejected`)

#### Scenario: View approval list with approval-relevant items only
- **WHEN** ผู้ใช้ที่มีสิทธิ์ `content_approval` เข้าถึง `/content-approval`
- **THEN** ระบบแสดงตารางรายการคอนเทนต์ที่มี status เป็น `pending_approval`, `approved`, `revision`, หรือ `rejected` — draft และ published items ไม่แสดง พร้อมข้อมูล: ชื่อคอนเทนต์, ประเภท, แพลตฟอร์ม, วันที่สร้าง, สถานะ และมี Stat Cards สรุปจำนวนแต่ละสถานะด้านบน

#### Scenario: Default tab is "ทั้งหมด"
- **WHEN** ผู้ใช้เข้าถึง `/content-approval` ครั้งแรก
- **THEN** Tab "ทั้งหมด" ถูกเลือกเป็น default และตารางแสดงเฉพาะ approval-relevant items

#### Scenario: No items in selected tab
- **WHEN** Tab ที่เลือกไม่มี content items
- **THEN** ระบบแสดงข้อความ "ไม่มีรายการ" พร้อมระบุสถานะที่เกี่ยวข้อง

### Requirement: User can approve a content item
ระบบ SHALL ให้ผู้ใช้ที่มีสิทธิ์สามารถอนุมัติ content item จากหน้ารายการอนุมัติ โดยเปลี่ยนสถานะเป็น `approved`

#### Scenario: Approve content
- **WHEN** ผู้ใช้คลิก "อนุมัติ" บนรายการคอนเทนต์ที่สถานะ `pending_approval`
- **THEN** ระบบแสดง dialog ยืนยัน และเมื่อยืนยันแล้ว สถานะเปลี่ยนเป็น `approved` และรายการนั้นปรากฏใน Tab "อนุมัติแล้ว"

### Requirement: User can reject a content item
ระบบ SHALL ให้ผู้ใช้ที่มีสิทธิ์สามารถปฏิเสธ content item พร้อมระบุเหตุผล โดยเปลี่ยนสถานะเป็น `rejected` และบันทึกเหตุผลลง `reject_reason`

#### Scenario: Reject content with reason
- **WHEN** ผู้ใช้คลิก "ปฏิเสธ" บนรายการคอนเทนต์
- **THEN** ระบบแสดง dialog ให้กรอกเหตุผล และเมื่อส่งแล้ว สถานะเปลี่ยนเป็น `rejected`, `reject_reason` ถูกบันทึก, และรายการนั้นปรากฏใน Tab "ปฏิเสธ"

### Requirement: Content items store reject reason
ระบบ SHALL รองรับการบันทึกเหตุผลการปฏิเสธ/ขอแก้ไข (`reject_reason`) ในตาราง `content_items`

#### Scenario: Reject reason stored in database
- **WHEN** ผู้ใช้ปฏิเสธหรือขอแก้ไข content item พร้อมระบุเหตุผล
- **THEN** ระบบบันทึก `reject_reason` ใน column `content_items.reject_reason` พร้อมกับ `status` ที่เปลี่ยนเป็น `rejected` หรือ `revision`

#### Scenario: Reject reason is optional
- **WHEN** ผู้ใช้ปฏิเสธหรือขอแก้ไขโดยไม่ระบุเหตุผล
- **THEN** ระบบยังคงเปลี่ยนสถานะได้ — `reject_reason` เก็บเป็น NULL

### Requirement: Revision items store reason
เมื่อเปลี่ยน status เป็น `revision` (ขอแก้ไข) ระบบ SHALL บันทึกเหตุผลที่ขอแก้ไขลงใน `reject_reason` column

#### Scenario: Revision request with reason
- **WHEN** ผู้ใช้คลิก "ขอแก้ไข" และกรอกเหตุผล
- **THEN** ระบบเปลี่ยน status เป็น `revision` และบันทึก `reject_reason`

#### Scenario: Revision request without reason
- **WHEN** ผู้ใช้คลิก "ขอแก้ไข" โดยไม่กรอกเหตุผล
- **THEN** ระบบยังคงเปลี่ยน status เป็น `revision` — `reject_reason` เป็น NULL

### Requirement: Approval list supports filtering and sorting
ระบบ SHALL รองรับการกรองรายการตามสถานะผ่าน Tab Navigation, การกรองตามประเภทผ่าน Type Filter, การกรองตามแพลตฟอร์มผ่าน Platform Filter, การค้นหาผ่านช่องค้นหา, และการจัดเรียงตามวันที่ขออนุมัติ (`requested_at`) ผ่าน Dropdown

#### Scenario: Filter by status tab
- **WHEN** ผู้ใช้เลือก Tab "ขอแก้ไข"
- **THEN** ระบบแสดงเฉพาะรายการที่มี status เป็น `revision`

#### Scenario: Filter by content type
- **WHEN** ผู้ใช้เลือก "บทความ" จาก Type Filter
- **THEN** ระบบแสดงเฉพาะรายการที่มี `content_type` เป็น `article`

#### Scenario: Type filter and tab work together
- **WHEN** ผู้ใช้เลือก Tab "รออนุมัติ" และ Type Filter "วีดีโอ"
- **THEN** ระบบแสดงเฉพาะรายการที่สถานะ `pending_approval` และ `content_type` เป็น `video`

#### Scenario: Filter by platform
- **WHEN** ผู้ใช้เลือก filter แพลตฟอร์ม
- **THEN** ระบบแสดงเฉพาะรายการที่ตรงกับแพลตฟอร์มที่เลือก

#### Scenario: Search across filtered results
- **WHEN** ผู้ใช้พิมพ์คำค้นหาในช่องค้นหา และเลือก Tab "รออนุมัติ"
- **THEN** ระบบแสดงเฉพาะรายการที่สถานะ `pending_approval` และชื่อตรงกับคำค้นหา

#### Scenario: Sort by request approval date (newest first)
- **WHEN** ผู้ใช้เลือก "ขออนุมัติล่าสุด → เก่าสุด" จาก Sort Dropdown
- **THEN** รายการในตารางเรียงตามวันที่ขออนุมัติ (`requested_at`) จากใหม่สุดไปเก่าสุด

#### Scenario: Sort by request approval date (oldest first)
- **WHEN** ผู้ใช้เลือก "ขออนุมัติเก่าสุด → ล่าสุด" จาก Sort Dropdown
- **THEN** รายการในตารางเรียงตามวันที่ขออนุมัติ (`requested_at`) จากเก่าสุดไปใหม่สุด

#### Scenario: All tools grouped in toolbar
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** Tab Navigation (แถวบน), ช่องค้นหาพร้อมไอคอน `Search` (แว่นขยาย), Type Filter, Platform Filter, และ Sort Dropdown (แถวล่าง) ถูกจัดวางใน toolbar บริเวณเดียวกันระหว่าง Stat Cards และตาราง

### Requirement: Stat cards show approval status summary
ระบบ SHALL แสดง Stat Cards 4 ใบด้านบนตาราง สรุปจำนวน content items แยกตามสถานะ: รออนุมัติ, อนุมัติแล้ว, ขอแก้ไข, และปฏิเสธ — โดย Visual Style กำหนดไว้ที่ capability `approval-stat-card-style`

#### Scenario: Stat cards display with correct visual style
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** เห็น Stat Card 4 ใบที่ใช้ `Card` component จาก design system โดยมี Title และ Icon อยู่ในแถวเดียวกันและ Count อยู่ด้านล่าง พร้อม label ภาษาไทยและจำนวนที่อัปเดตตามข้อมูลจริง

#### Scenario: Stat cards use semantic color tokens
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** Stat Cards ใช้ semantic color tokens: `text-warning` (รออนุมัติ), `text-success` (อนุมัติแล้ว), `text-info` (ขอแก้ไข), `text-destructive` (ปฏิเสธ)

### Requirement: Rejected status is distinct from draft
ระบบ SHALL แยกสถานะ `rejected` (ถูกปฏิเสธโดยผู้อนุมัติ) ออกจาก `draft` (บันทึกเป็นร่างโดยผู้สร้าง) ใน `STATUS_MAP` และเก็บ `reject_reason` ใน `content_items.reject_reason` ผ่าน database migration

#### Scenario: Rejected items appear in "ปฏิเสธ" tab
- **WHEN** content item ถูกปฏิเสธโดยผู้อนุมัติ
- **THEN** สถานะเป็น `rejected` และปรากฏใน Tab "ปฏิเสธ" ไม่ใช่ Tab "ร่าง"

#### Scenario: Database schema supports rejected status and reason
- **WHEN** ระบบ INSERT หรือ UPDATE `content_items.status` เป็น `'rejected'` พร้อม `reject_reason`
- **THEN** ฐานข้อมูลยอมรับค่าทั้งสองโดยไม่มี error เนื่องจาก schema รองรับแล้ว

### Requirement: Approval page follows mockup design
หน้า "รายการอนุมัติ" SHALL ใช้ `PageShell` component และ shadcn-ui primitives โดยอิงดีไซน์และโครงสร้างจาก mockup `mockup/pages/content/` (list.php ตาราง+filter, approval_history_handler.php workflow)

#### Scenario: Consistent layout
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** หน้าแสดง breadcrumb "การตลาด > คอนเทนต์โซเชียล > รายการอนุมัติ" และ title "รายการอนุมัติ" ตามมาตรฐานของโปรเจกต์

### Requirement: Dashboard page follows mockup design
หน้า "แดชบอร์ด" (`/content-dashboard`) SHALL ใช้ `PageShell` component และดีไซน์อิงจาก mockup `mockup/pages/content/` สำหรับ overview และ summary ของ content items

#### Scenario: Dashboard layout
- **WHEN** ผู้ใช้เข้าถึง `/content-dashboard`
- **THEN** หน้าแสดง breadcrumb "การตลาด > คอนเทนต์โซเชียล > แดชบอร์ด", overview metrics, และ content summary ตาม mockup design
