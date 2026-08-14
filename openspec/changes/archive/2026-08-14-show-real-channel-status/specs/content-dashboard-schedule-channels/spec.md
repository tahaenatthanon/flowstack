# content-dashboard-schedule-channels Specification (delta)

## MODIFIED Requirements

### Requirement: แสดงสถานะช่องทางเชื่อมต่อ
The dashboard SHALL display a "สถานะช่องทาง" widget listing publish channels and their connection status, verified against the actual connection to each channel (not merely the `is_active` value), showing the status as a colored dot + text label (no background / no status badge) placed after each channel's data.

#### Scenario: แสดงสถานะการเชื่อมต่อจริง
- **WHEN** the dashboard loads with channels
- **THEN** the widget lists each channel with a status (colored dot + text label) placed after its data: "เชื่อมต่อแล้ว" (green dot) only when the system verifies the channel connection actually works, "ไม่เชื่อมต่อ" (red dot) when the connection cannot be established or is incomplete

#### Scenario: ไม่ใช้เพียง is_active เป็นตัวบอกสถานะ
- **WHEN** the widget renders each channel's status
- **THEN** the status is derived from a real connection check (server-side test), not solely from the `is_active` value — `is_active` alone does not determine "เชื่อมต่อแล้ว"

#### Scenario: แสดงจุดสี + ข้อความ โดยไม่มีพื้นหลัง/Status Badge
- **WHEN** the widget renders each channel's status
- **THEN** the status shows a colored dot + text label ("เชื่อมต่อแล้ว"/"ไม่เชื่อมต่อ") without a background or status badge, consistent with the system UI

#### Scenario: สีสะท้อนสถานะจริง
- **WHEN** the widget renders each channel's status
- **THEN** "เชื่อมต่อแล้ว" uses a green dot and "ไม่เชื่อมต่อ" uses a red dot, reflecting the real connection status of each channel

#### Scenario: แสดงข้อความว่างเมื่อไม่มีช่องทาง
- **WHEN** there are no configured channels
- **THEN** the widget shows an empty-state message
