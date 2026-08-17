# content-dashboard-work-progress Specification (delta)

## MODIFIED Requirements

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
