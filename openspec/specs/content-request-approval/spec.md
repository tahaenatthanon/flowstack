# content-request-approval Specification

## Purpose

Allow content authors to send their own draft or revision work into the approval queue from the content detail view, moving `content_items.status` from `draft`/`revision` to `pending_approval`. This is the author-side counterpart to the approver-side actions in `approval-detail-actions` — the two must never appear together.

## Requirements

### Requirement: Request approval from content detail view
The system SHALL display a "ขออนุมัติ" button in ContentDetailView when `context='content'` and the content item status is `draft` or `revision`.

#### Scenario: Button visible for draft content
- **WHEN** user opens ContentDetailView with `context='content'` and `item.status === 'draft'`
- **THEN** a "ขออนุมัติ" button is visible in the action bar alongside "แก้ไข" and "ตั้งเวลาโพสต์"

#### Scenario: Button visible for revision content
- **WHEN** user opens ContentDetailView with `context='content'` and `item.status === 'revision'`
- **THEN** a "ขออนุมัติ" button is visible in the action bar

#### Scenario: Button hidden for pending_approval content
- **WHEN** user opens ContentDetailView with `context='content'` and `item.status === 'pending_approval'`
- **THEN** the "ขออนุมัติ" button is NOT visible (already in pending approval)

#### Scenario: Button hidden for published content
- **WHEN** user opens ContentDetailView with `context='content'` and `item.status === 'published'`
- **THEN** the "ขออนุมัติ" button is NOT visible (already published)

#### Scenario: Button hidden in approval context
- **WHEN** user opens ContentDetailView with `context='approval'`
- **THEN** the "ขออนุมัติ" button is NOT visible regardless of item status

### Requirement: Confirm dialog before requesting approval
The system SHALL show a confirmation dialog when user clicks "ขออนุมัติ".

#### Scenario: Confirm dialog appears
- **WHEN** user clicks "ขออนุมัติ" button
- **THEN** a dialog appears with title "ยืนยันการขออนุมัติ" and description mentioning the content title

#### Scenario: User confirms approval request
- **WHEN** user clicks "ยืนยัน" in the confirm dialog
- **THEN** the system sends `PUT /content-items.php?id={id}` with `{ status: 'pending_approval' }`
- **AND** the content list and plan queries are invalidated
- **AND** a toast appears with title "ส่งอนุมัติแล้ว"

#### Scenario: User cancels approval request
- **WHEN** user clicks "ยกเลิก" in the confirm dialog
- **THEN** the dialog closes and no API call is made

### Requirement: Button styling consistent with action bar
The "ขออนุมัติ" button SHALL use styling consistent with other action bar buttons.

#### Scenario: Button visual style
- **WHEN** the "ขออนุมัติ" button is rendered
- **THEN** it uses `variant="outline"` with `size="sm"`
- **AND** it displays a `Send` icon and the text "ขออนุมัติ"
- **AND** it uses a blue/primary accent color to distinguish from edit (Pencil icon) and schedule (Clock icon) buttons
