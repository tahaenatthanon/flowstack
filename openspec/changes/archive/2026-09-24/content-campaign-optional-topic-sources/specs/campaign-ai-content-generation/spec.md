## MODIFIED Requirements

### Requirement: AI Generate Action In Campaign Dialog
The email campaign create/edit dialog SHALL show the product selection, tone selection, and brand-context fields directly inside the "ข้อมูลแคมเปญ" (campaign info) section of the main form — always visible, not gated behind a collapsible panel that must be opened first. The action that triggers AI generation SHALL be placed in the dialog's footer, alongside the other footer actions (ยกเลิก, บันทึกร่าง, ตั้งเวลาส่ง, ส่งทันที).

#### Scenario: Fields are visible without any extra step
- **WHEN** a user opens the campaign create/edit dialog
- **THEN** the product selection, tone selection, and brand-context checkbox are visible immediately in the campaign info section, without needing to click any "เปิด"/toggle action first

#### Scenario: Generate action lives in the footer
- **WHEN** a user wants to trigger AI generation
- **THEN** the action is available among the dialog's footer buttons, not inside a separate panel within the form body
