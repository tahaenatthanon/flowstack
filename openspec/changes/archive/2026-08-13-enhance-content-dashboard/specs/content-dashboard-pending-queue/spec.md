## ADDED Requirements

### Requirement: แสดงคิวรออนุมัติ
The dashboard SHALL display a "คิวรออนุมัติ" widget listing content items with status `pending_approval` sorted by `requested_at` ascending (oldest request first).

#### Scenario: แสดงรายการรออนุมัติ
- **WHEN** the dashboard loads with `content_items`
- **THEN** the widget lists items where `status === 'pending_approval'`

#### Scenario: เรียงตามเวลาขออนุมัติ
- **WHEN** multiple items are pending approval
- **THEN** items are sorted by `requested_at` ascending

#### Scenario: ปุ่มลัดไปหน้ารายการอนุมัติ
- **WHEN** the "คิวรออนุมัติ" widget is rendered
- **THEN** a button or link navigates to `/content-approval`

#### Scenario: แสดงข้อความว่างเมื่อไม่มีรายการรอ
- **WHEN** there are no items with status `pending_approval`
- **THEN** the widget shows an empty-state message "ไม่มีรายการรออนุมัติ"

### Requirement: ใช้ Badge/Button จาก Design System
The pending queue widget SHALL use existing `Badge`/`Button` shadcn-ui primitives and `STATUS_MAP` for status badges, with the approval link using an existing `Button` variant/size.

#### Scenario: ใช้ Badge/Button primitive เดิม
- **WHEN** the pending queue widget is rendered
- **THEN** it uses `Badge` with `STATUS_MAP['pending_approval']` and a `Button` (existing variant/size) for the `/content-approval` link, matching the project's design system
