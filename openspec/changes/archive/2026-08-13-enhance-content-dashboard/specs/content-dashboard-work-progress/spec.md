## ADDED Requirements

### Requirement: แสดง Work Progress ตามสถานะ
The dashboard SHALL display a "ความคืบหน้าการผลิต" widget showing a progress bar for each content status.

#### Scenario: แสดงแถบความคืบหน้าแต่ละสถานะ
- **WHEN** the dashboard loads with `content_items`
- **THEN** the widget shows a progress bar for each of: เผยแพร่แล้ว (`published`), รออนุมัติ (`pending_approval`), อนุมัติแล้ว (`approved`), รอแก้ไข (`revision`), ฉบับร่าง (`draft`)

#### Scenario: แสดงจำนวนชิ้นและเปอร์เซ็นต์ต่อสถานะ
- **WHEN** a progress bar for a status is rendered
- **THEN** it displays the item count and the percentage of total items for that status

#### Scenario: แสดงยอดรวม
- **WHEN** the Work Progress widget is rendered
- **THEN** it displays the total item count at the bottom of the widget

#### Scenario: สถานะที่ไม่มีรายการแสดง 0%
- **WHEN** a status has zero items
- **THEN** its progress bar renders at 0% width with count `0` and label still visible

### Requirement: เปอร์เซ็นต์คำนวณจากจำนวนรวม
The percentage for each status SHALL be computed by dividing that status's count by the total item count.

#### Scenario: คำนวณเปอร์เซ็นต์ถูกต้อง
- **WHEN** there are 10 total items and 4 are `published`
- **THEN** the `published` bar shows 40% and label "4 ชิ้น (40%)"

### Requirement: ใช้ Progress component จาก Design System
The Work Progress widget SHALL use the existing `Progress` shadcn-ui primitive and status colors from `STATUS_MAP` for progress bars instead of custom markup.

#### Scenario: ใช้ Progress primitive
- **WHEN** the Work Progress bars are rendered
- **THEN** each bar uses the `Progress` component from `@/components/ui/progress` with the status color from `STATUS_MAP`, consistent with the project's design system
