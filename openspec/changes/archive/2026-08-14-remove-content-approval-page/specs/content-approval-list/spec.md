# content-approval-list Specification (delta)

## MODIFIED Requirements

### Requirement: User can view content approval list
ระบบ SHALL แสดงรายการอนุมัติคอนเทนต์เป็น Tab "รายการอนุมัติ" ในหน้าผลงานคอนเทนต์ (`ContentPage`, route `/content`) เท่านั้น — ไม่มี route แยก `/content-approval` อีกต่อไป — โดยวางถัดจาก Tab "ผลงานทั้งหมด" ทันที และแสดง content items เฉพาะที่อยู่ใน workflow การอนุมัติ (`pending_approval`, `approved`, `revision`, `rejected`) — ไม่รวม `draft` และ `published` มี Filter Status Dropdown สำหรับกรองตามสถานะ ประกอบด้วย: ทุกสถานะ (ไม่รวม draft/published), อนุมัติแล้ว (`approved`), รออนุมัติ (`pending_approval`), ขอแก้ไข (`revision`), ปฏิเสธ (`rejected`)

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
