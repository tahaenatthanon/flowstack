# content-approval-list Specification

## Purpose

กำหนดพฤติกรรมของหน้า "รายการอนุมัติ" ซึ่งเข้าถึงผ่าน Tab "รายการอนุมัติ" ในหน้าผลงานคอนเทนต์ (`/content`) เท่านั้น — ไม่มี route แยก `/content-approval` อีกต่อไป — สำหรับดู กรอง จัดเรียง อนุมัติ และปฏิเสธ content items ที่เกี่ยวข้องกับการอนุมัติ (`pending_approval`, `approved`, `revision`, `rejected` — ไม่รวม `draft` และ `published`) รวมถึง Stat Cards สรุปจำนวนตามสถานะ และดีไซน์ของหน้ารายการอนุมัติกับหน้าแดชบอร์ดคอนเทนต์ตาม mockup

## Requirements

### Requirement: User can view content approval list
ระบบ SHALL แสดงรายการอนุมัติคอนเทนต์เป็น Tab "รายการอนุมัติ" ในหน้าผลงานคอนเทนต์ (`ContentPage`, route `/content`) เท่านั้น — ไม่มี route แยก `/content-approval` — โดยวางถัดจาก Tab "ผลงานทั้งหมด" ทันที และแสดง content items เฉพาะที่อยู่ใน workflow การอนุมัติ (`pending_approval`, `approved`, `revision`, `rejected`) — ไม่รวม `draft` และ `published` มี Filter Status Dropdown สำหรับกรองตามสถานะ ประกอบด้วย: ทุกสถานะ (ไม่รวม draft/published), อนุมัติแล้ว (`approved`), รออนุมัติ (`pending_approval`), ขอแก้ไข (`revision`), ปฏิเสธ (`rejected`)

#### Scenario: Approval list shown as a tab in content page
- **WHEN** ผู้ใช้ที่มีสิทธิ์เข้าถึง `/content`
- **THEN** เห็น Tab "รายการอนุมัติ" อยู่ใน Tab Menu ถัดจาก Tab "ผลงานทั้งหมด"

#### Scenario: เปิด Tab รายการอนุมัติผ่าน URL
- **WHEN** ผู้ใช้เข้าถึง `/content?tab=approval`
- **THEN** หน้า `/content` เปิด Tab "รายการอนุมัติ" โดยตรง (ไม่ใช่ Tab "ผลงานทั้งหมด")

#### Scenario: Route /content-approval ถูกยกเลิก
- **WHEN** ผู้ใช้เข้าถึง `/#/content-approval`
- **THEN** ไม่มี route นี้ (แสดง NotFound) — ฟังก์ชันรายการอนุมัติเข้าถึงได้ผ่าน Tab ใน `/content` เท่านั้น

#### Scenario: Approval list filters to approval-relevant items only
- **WHEN** ผู้ใช้เปิด Tab "รายการอนุมัติ"
- **THEN** ระบบแสดงตารางรายการคอนเทนต์ที่มี status เป็น `pending_approval`, `approved`, `revision`, หรือ `rejected` — draft และ published items ไม่แสดง พร้อมข้อมูล: ชื่อคอนเทนต์, ประเภท, แพลตฟอร์ม, วันที่สร้าง, สถานะ และมี Stat Cards สรุปจำนวนแต่ละสถานะด้านบน

#### Scenario: Sidebar no longer lists approval entry
- **WHEN** ผู้ใช้ดู Sidebar ฝั่ง "การตลาด"
- **THEN** ไม่มีรายการเมนู "รายการอนุมัติ" แยก (ย้ายไปเป็น Tab ในหน้าผลงานคอนเทนต์แล้ว)

#### Scenario: Default filter is "ทุกสถานะ"
- **WHEN** ผู้ใช้เปิด Tab "รายการอนุมัติ" ครั้งแรก
- **THEN** Filter Status Dropdown ถูกเลือกเป็น default "ทุกสถานะ" และตารางแสดงเฉพาะ approval-relevant items

#### Scenario: No items in selected status
- **WHEN** สถานะที่เลือกไม่มี content items
- **THEN** ระบบแสดงข้อความ "ไม่มีรายการ" พร้อมระบุสถานะที่เกี่ยวข้อง

### Requirement: User can approve a content item
ระบบ SHALL ให้ผู้ใช้ที่มีสิทธิ์สามารถอนุมัติ content item จากหน้ารายการอนุมัติ โดยเปลี่ยนสถานะเป็น `approved`

#### Scenario: Approve content
- **WHEN** ผู้ใช้คลิก "อนุมัติ" บนรายการคอนเทนต์ที่สถานะ `pending_approval`
- **THEN** ระบบแสดง dialog ยืนยัน และเมื่อยืนยันแล้ว สถานะเปลี่ยนเป็น `approved` และรายการนั้นปรากฏในตัวกรองสถานะ "อนุมัติแล้ว"

### Requirement: User can reject a content item
ระบบ SHALL ให้ผู้ใช้ที่มีสิทธิ์สามารถปฏิเสธ content item พร้อมระบุเหตุผล โดยเปลี่ยนสถานะเป็น `rejected` และบันทึกเหตุผลลง `reject_reason`

#### Scenario: Reject content with reason
- **WHEN** ผู้ใช้คลิก "ปฏิเสธ" บนรายการคอนเทนต์
- **THEN** ระบบแสดง dialog ให้กรอกเหตุผล และเมื่อส่งแล้ว สถานะเปลี่ยนเป็น `rejected`, `reject_reason` ถูกบันทึก, และรายการนั้นปรากฏในตัวกรองสถานะ "ปฏิเสธ"

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
ระบบ SHALL รองรับการกรองรายการตามสถานะผ่าน Filter Status Dropdown, การกรองตามประเภทผ่าน Type Filter, การกรองตามแพลตฟอร์มผ่าน Platform Filter, การค้นหาผ่านช่องค้นหา, และการจัดเรียงตามวันที่ขออนุมัติ (`requested_at`) ผ่าน Dropdown

#### Scenario: Filter by status dropdown
- **WHEN** ผู้ใช้เลือกสถานะ "ขอแก้ไข" จาก Filter Status Dropdown
- **THEN** ระบบแสดงเฉพาะรายการที่มี status เป็น `revision`

#### Scenario: Filter by content type
- **WHEN** ผู้ใช้เลือก "บทความ" จาก Type Filter
- **THEN** ระบบแสดงเฉพาะรายการที่มี `content_type` เป็น `article`

#### Scenario: Type filter and status filter work together
- **WHEN** ผู้ใช้เลือกสถานะ "รออนุมัติ" จาก Filter Status และ Type Filter "วีดีโอ"
- **THEN** ระบบแสดงเฉพาะรายการที่สถานะ `pending_approval` และ `content_type` เป็น `video`

#### Scenario: Filter by platform
- **WHEN** ผู้ใช้เลือก filter แพลตฟอร์ม
- **THEN** ระบบแสดงเฉพาะรายการที่ตรงกับแพลตฟอร์มที่เลือก

#### Scenario: Search across filtered results
- **WHEN** ผู้ใช้พิมพ์คำค้นหาในช่องค้นหา และเลือกสถานะ "รออนุมัติ" จาก Filter Status
- **THEN** ระบบแสดงเฉพาะรายการที่สถานะ `pending_approval` และชื่อตรงกับคำค้นหา

#### Scenario: Sort by request approval date (newest first)
- **WHEN** ผู้ใช้เลือก "ล่าสุด-เก่าสุด" จาก Sort Dropdown
- **THEN** รายการในตารางเรียงตามวันที่ขออนุมัติ (`requested_at`) จากใหม่สุดไปเก่าสุด

#### Scenario: Sort by request approval date (oldest first)
- **WHEN** ผู้ใช้เลือก "เก่าสุด-ล่าสุด" จาก Sort Dropdown
- **THEN** รายการในตารางเรียงตามวันที่ขออนุมัติ (`requested_at`) จากเก่าสุดไปใหม่สุด

#### Scenario: All tools grouped in toolbar
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** ช่องค้นหาพร้อมไอคอน `Search` (แว่นขยาย), Filter Status Dropdown, Type Filter, Platform Filter, และ Sort Dropdown ถูกจัดวางใน toolbar บริเวณเดียวกันระหว่าง Stat Cards และตาราง

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
