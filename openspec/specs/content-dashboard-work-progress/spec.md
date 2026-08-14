# content-dashboard-work-progress Specification

## Purpose

Display a "ความคืบหน้าการผลิต" (Work Progress) widget on the content dashboard with a progress bar for each content status.

## Requirements

### Requirement: แสดง Work Progress ตามสถานะ
The dashboard SHALL display a "ความคืบหน้าการผลิต" widget showing a progress bar for each content status, with each status label accompanied by a semantic icon.

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

#### Scenario: แต่ละสถานะมีไอคอน semantic
- **WHEN** a status row in the Work Progress widget is rendered
- **THEN** an icon is shown before (to the left of) the status label, using the same icon/semantic color as the corresponding status elsewhere in the system (Status filter tabs / approval stat cards)

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

#### Scenario: แถบใช้สีประจำสถานะ
- **WHEN** a progress bar for a status is rendered
- **THEN** the bar indicator uses the status's `progressColor` from `STATUS_MAP`, which stores the full literal class (e.g. published=`[&>div]:bg-green-600`, approved=`[&>div]:bg-teal-600`, pending_approval=`[&>div]:bg-amber-600`, revision=`[&>div]:bg-blue-600`, draft=`[&>div]:bg-gray-600`)

#### Scenario: รูปแบบตรงกับมาตรฐาน Dashboard Flowstack
- **WHEN** the Work Progress bars are rendered
- **THEN** each bar uses height `h-1.5` and colors the indicator via `progressColor` (full literal `[&>div]:bg-{color}-600`), and the count/percentage text uses the status's `iconColor` — matching the Progress Bar pattern on the Home dashboard

#### Scenario: สีแถบตรงกับ Status Card
- **WHEN** a progress bar for a status is rendered
- **THEN** the bar indicator color matches the Status Card color of that status; for statuses without a Status Card (approved, revision), it matches the status Icon color (`iconColor`)

#### Scenario: ใช้สีจากแหล่งเดียว
- **WHEN** a status color is applied to the Status Card, Icon, or Progress Bar
- **THEN** all three derive from the single source `STATUS_MAP.iconColor` (shade `-600`), so the colors are consistent across the system
