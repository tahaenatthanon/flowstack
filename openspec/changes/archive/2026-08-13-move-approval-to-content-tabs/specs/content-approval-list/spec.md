## MODIFIED Requirements

### Requirement: User can view content approval list
ระบบ SHALL แสดงรายการอนุมัติคอนเทนต์เป็น Tab "รายการอนุมัติ" ในหน้าผลงานคอนเทนต์ (`ContentPage`) โดยวางถัดจาก Tab "ผลงานทั้งหมด" ทันที และแสดง content items เฉพาะที่อยู่ใน workflow การอนุมัติ (`pending_approval`, `approved`, `revision`, `rejected`) — ไม่รวม `draft` และ `published`

#### Scenario: Approval list shown as a tab in content page
- **WHEN** ผู้ใช้ที่มีสิทธิ์เข้าถึง `/content`
- **THEN** เห็น Tab "รายการอนุมัติ" อยู่ใน Tab Menu ถัดจาก Tab "ผลงานทั้งหมด"

#### Scenario: Approval list filters to approval-relevant items only
- **WHEN** ผู้ใช้เปิด Tab "รายการอนุมัติ"
- **THEN** ระบบแสดงตารางรายการคอนเทนต์ที่มี status เป็น `pending_approval`, `approved`, `revision`, หรือ `rejected` — draft และ published items ไม่แสดง

#### Scenario: Sidebar no longer lists approval entry
- **WHEN** ผู้ใช้ดู Sidebar ฝั่ง "การตลาด"
- **THEN** ไม่มีรายการเมนู "รายการอนุมัติ" แยก (ย้ายไปเป็น Tab ในหน้าผลงานคอนเทนต์แล้ว)
