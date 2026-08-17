## MODIFIED Requirements

### Requirement: Button styling in ContentCardDialog footer
The "ขออนุมัติ" button SHALL use styling that makes it visually distinct as a primary action while keeping a consistent height with the sibling buttons in the footer.

#### Scenario: Button visual style
- **WHEN** the "ขออนุมัติ" button is rendered in `ContentCardDialog` footer
- **THEN** it uses `variant="default"` with default size (no `size="sm"`), matching the height of the "บันทึก" button
- **AND** it displays a `Send` icon and the text "ขออนุมัติ"
- **AND** it is the rightmost button in the footer, positioned after "บันทึก"
