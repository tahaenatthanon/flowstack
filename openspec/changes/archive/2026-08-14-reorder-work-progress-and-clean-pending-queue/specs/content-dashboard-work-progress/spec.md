# content-dashboard-work-progress Specification (delta)

## MODIFIED Requirements

### Requirement: แสดง Work Progress ตามสถานะ
The dashboard SHALL display a "ความคืบหน้าการผลิต" widget showing a progress bar for each content status, with each status label accompanied by a semantic icon, in the order: เผยแพร่แล้ว, อนุมัติแล้ว, รออนุมัติ, รอแก้ไข, ฉบับร่าง.

#### Scenario: แสดงแถบความคืบหน้าแต่ละสถานะ
- **WHEN** the dashboard loads with `content_items`
- **THEN** the widget shows a progress bar for each of, in this order: เผยแพร่แล้ว (`published`), อนุมัติแล้ว (`approved`), รออนุมัติ (`pending_approval`), รอแก้ไข (`revision`), ฉบับร่าง (`draft`)

#### Scenario: แสดงจำนวนชิ้นและเปอร์เซ็นต์ต่อสถานะ
- **WHEN** a progress bar for a status is rendered
- **THEN** it displays the item count and the percentage of total items for that status

#### Scenario: แสดงยอดรวม
- **WHEN** the Work Progress widget is rendered
- **THEN** it displays the total item count at the bottom of the widget

#### Scenario: สถานะที่ไม่มีรายการแสดง 0%
- **WHEN** a status has zero items
- **THEN** its progress bar renders at 0% width with count `0` and label still visible

#### Scenario: แต่ละสถานะมีไอคอน semantic
- **WHEN** a status row in the Work Progress widget is rendered
- **THEN** an icon is shown before (to the left of) the status label, using the same icon/semantic color as the corresponding status elsewhere in the system (Status filter tabs / approval stat cards)
