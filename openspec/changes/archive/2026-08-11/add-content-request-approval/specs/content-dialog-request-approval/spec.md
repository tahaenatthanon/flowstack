## ADDED Requirements

### Requirement: Request approval button in ContentCardDialog footer
The system SHALL display a "ขออนุมัติ" button in the `DialogFooter` of `ContentCardDialog` when the dialog has an `existingItem` and `contentStatus` is `draft` or `revision`.

#### Scenario: Button visible for draft content with existing item
- **WHEN** `ContentCardDialog` is open with `existingItem` present and `contentStatus === 'draft'`
- **THEN** a "ขออนุมัติ" button is visible in the footer, positioned to the right of the "บันทึก" button

#### Scenario: Button visible for revision content with existing item
- **WHEN** `ContentCardDialog` is open with `existingItem` present and `contentStatus === 'revision'`
- **THEN** a "ขออนุมัติ" button is visible in the footer

#### Scenario: Button hidden for review content
- **WHEN** `ContentCardDialog` is open with `existingItem` present and `contentStatus === 'review'`
- **THEN** the "ขออนุมัติ" button is NOT visible (already in review)

#### Scenario: Button hidden for new content
- **WHEN** `ContentCardDialog` is open without `existingItem` (creating new content)
- **THEN** the "ขออนุมัติ" button is NOT visible regardless of `contentStatus`

#### Scenario: Button hidden when contentStatus prop not provided
- **WHEN** `ContentCardDialog` is open without the `contentStatus` prop
- **THEN** the "ขออนุมัติ" button is NOT visible

### Requirement: Confirm dialog for ContentCardDialog approval request
The system SHALL show a confirmation dialog when user clicks "ขออนุมัติ" in `ContentCardDialog`.

#### Scenario: Confirm dialog appears
- **WHEN** user clicks "ขออนุมัติ" in `ContentCardDialog` footer
- **THEN** a dialog appears with title "ยืนยันการขออนุมัติ" and description mentioning the content title

#### Scenario: User confirms approval request
- **WHEN** user clicks "ยืนยัน" in the confirm dialog
- **THEN** the system sends `PUT /content-items.php?id={id}` with `{ status: 'review' }`
- **AND** the content list and plan queries are invalidated
- **AND** a toast appears with title "ส่งอนุมัติแล้ว"
- **AND** the `ContentCardDialog` closes

#### Scenario: User cancels approval request
- **WHEN** user clicks "ยกเลิก" in the confirm dialog
- **THEN** the dialog closes and no API call is made
- **AND** the `ContentCardDialog` remains open

### Requirement: Button styling in ContentCardDialog footer
The "ขออนุมัติ" button SHALL use styling that makes it visually distinct as a primary action.

#### Scenario: Button visual style
- **WHEN** the "ขออนุมัติ" button is rendered in `ContentCardDialog` footer
- **THEN** it uses `variant="default"` with `size="sm"`
- **AND** it displays a `Send` icon and the text "ขออนุมัติ"
- **AND** it is the rightmost button in the footer, positioned after "บันทึก"

### Requirement: Callers pass contentStatus to ContentCardDialog
Components that render `ContentCardDialog` SHALL pass the `contentStatus` prop when the dialog is used for editing existing content items.

#### Scenario: ContentListTab passes contentStatus
- **WHEN** `ContentListTab` renders `ContentCardDialog` with `existingItem`
- **THEN** it passes `contentStatus={editItemLatest?.status}`

#### Scenario: ContentDetailView passes contentStatus
- **WHEN** `ContentDetailView` renders `ContentCardDialog` (via edit button)
- **THEN** it passes `contentStatus={item.status}`
