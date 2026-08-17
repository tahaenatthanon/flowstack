## MODIFIED Requirements

### Requirement: ใช้ Button จาก Design System
The pending queue widget SHALL use the existing `Button` shadcn-ui primitive for the approval link (in the Card header), matching the project's design system (no status `Badge` in the item list).

#### Scenario: ใช้ Button primitive เดิม
- **WHEN** the pending queue widget is rendered
- **THEN** it uses a `Button` (existing variant/size) for the `/content?tab=approval` link, matching the project's design system

#### Scenario: ไม่มีปุ่มด้านล่างซ้ำซ้อน
- **WHEN** the pending queue widget is rendered
- **THEN** there is no full-width "ดูรายการอนุมัติทั้งหมด" button at the bottom of the Card content (only the header "ดูทั้งหมด" button remains)
