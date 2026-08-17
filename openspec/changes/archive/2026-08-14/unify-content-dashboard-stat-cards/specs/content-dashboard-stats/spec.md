# content-dashboard-stats Specification (delta)

## MODIFIED Requirements

### Requirement: Stat Cards ใหม่ใช้สไตล์เดียวกับการ์ดเดิม
The new views/likes stat cards SHALL follow the same visual style as the other stat cards on the dashboard, using the KpiCard pattern (title + icon in one row, count below).

#### Scenario: สไตล์การ์ดสอดคล้องกัน
- **WHEN** the "ยอดวิวรวม" and "ยอดไลก์รวม" cards are rendered
- **THEN** each uses an icon (`Eye` and `ThumbsUp`) shown as a text-colored icon in the `CardHeader` (right side, same row as the title), with the count shown below in `CardContent` — matching the other dashboard stat cards and the approval-list KpiCard pattern

### Requirement: ใช้ Card primitive จาก Design System
The views/likes stat cards SHALL be built with the existing `Card`/`CardHeader`/`CardTitle`/`CardContent` shadcn-ui primitives and Tailwind tokens, matching the KpiCard pattern used by the approval-list stat cards.

#### Scenario: ใช้ Card primitive เดิม
- **WHEN** the new stat cards are rendered
- **THEN** they use `Card`, `CardHeader` (`flex flex-row items-center justify-between space-y-0 pb-2`), `CardTitle` (`text-sm font-medium`), and `CardContent` from `@/components/ui/card`, with the count rendered as `text-2xl font-bold` — identical to the other dashboard stat cards and the approval-list stat cards
