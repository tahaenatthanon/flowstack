# content-dashboard-pending-queue Specification (delta)

## MODIFIED Requirements

### Requirement: แสดงคิวรออนุมัติ
The dashboard SHALL display a "คิวรออนุมัติ" widget listing content items with status `pending_approval` sorted by `requested_at` ascending (oldest request first), showing each item's title and creation date (`created_at`), without a status badge.

#### Scenario: แสดงรายการรออนุมัติ
- **WHEN** the dashboard loads with `content_items`
- **THEN** the widget lists items where `status === 'pending_approval'`

#### Scenario: เรียงตามเวลาขออนุมัติ
- **WHEN** multiple items are pending approval
- **THEN** items are sorted by `requested_at` ascending

#### Scenario: แสดงวันที่สร้างของแต่ละรายการ
- **WHEN** a pending item is rendered
- **THEN** it shows the item's creation date (`created_at`), not `requested_at`

#### Scenario: ไม่แสดง Status ในรายการ
- **WHEN** a pending item is rendered
- **THEN** the item does NOT show a status badge (every item in the queue is already `pending_approval`)

#### Scenario: ปุ่มลัดไปหน้ารายการอนุมัติ
- **WHEN** the "คิวรออนุมัติ" widget is rendered
- **THEN** a button or link navigates to `/content?tab=approval` (Tab "รายการอนุมัติ" ในหน้า `/content`) — ไม่ใช่ `/content-approval`

#### Scenario: แสดงข้อความว่างเมื่อไม่มีรายการรอ
- **WHEN** there are no items with status `pending_approval`
- **THEN** the widget shows an empty-state message "ไม่มีรายการรออนุมัติ"

### Requirement: ใช้ Button จาก Design System
The pending queue widget SHALL use the existing `Button` shadcn-ui primitive for the approval link, matching the project's design system (no status `Badge` in the item list).

#### Scenario: ใช้ Button primitive เดิม
- **WHEN** the pending queue widget is rendered
- **THEN** it uses a `Button` (existing variant/size) for the approval link, matching the project's design system
