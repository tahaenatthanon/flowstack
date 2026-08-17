# content-dashboard-schedule-channels Specification (delta)

## MODIFIED Requirements

### Requirement: แสดงสถานะช่องทางเชื่อมต่อ
The dashboard SHALL display a "สถานะช่องทาง" widget listing publish channels and their connection status, showing each channel's name exactly once (no duplicate platform badge) and a status (colored dot + text label) placed after its data.

#### Scenario: แสดงชื่อช่องทางเพียงครั้งเดียว
- **WHEN** the dashboard loads with channels
- **THEN** the widget lists each channel showing its name (`ch.name`) exactly once — no duplicate platform badge (WordPress, Facebook, Line OA, TikTok, Lotus Notes / Domino, etc.)

#### Scenario: แสดง Logo Icon ด้านหน้าชื่อ
- **WHEN** the widget renders each channel row
- **THEN** a platform logo icon (`PlatformIcon` for `ch.platform`) is shown before the channel name, in a colored container matching the platform

#### Scenario: ไม่มี Badge แพลตฟอร์มซ้ำ
- **WHEN** the widget renders each channel row
- **THEN** the platform badge (`PLATFORM_MAP[platform].label`) is removed — only the channel name (with logo) and status are shown

#### Scenario: แสดงสถานะจริง (จุดสี + ข้อความ)
- **WHEN** the widget renders each channel's status
- **THEN** it shows a colored dot + text label ("เชื่อมต่อแล้ว"/"ไม่เชื่อมต่อ") reflecting the real connection status, without a background/status badge

#### Scenario: แสดงข้อความว่างเมื่อไม่มีช่องทาง
- **WHEN** there are no configured channels
- **THEN** the widget shows an empty-state message
