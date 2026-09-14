## MODIFIED Requirements

### Requirement: แสดงสถานะช่องทางเชื่อมต่อ
The "โซเชียล" sub-tab of the analytics tab of the content dashboard SHALL display a "สถานะช่องทาง" widget listing publish channels and their connection status, verified against the actual connection to each channel (not merely the `is_active` value), showing each channel's name exactly once (with a platform logo icon before it) and a status (colored dot + text label) placed after its data. This widget no longer renders on the overview tab.

#### Scenario: แสดงชื่อช่องทางเพียงครั้งเดียว
- **WHEN** the "โซเชียล" sub-tab loads with channels
- **THEN** the widget lists each channel showing its name (`ch.name`) exactly once — no duplicate platform badge (WordPress, Facebook, Line OA, TikTok, Lotus Notes / Domino, etc.)

#### Scenario: แสดง Logo Icon ด้านหน้าชื่อ
- **WHEN** the widget renders each channel row
- **THEN** a platform logo icon (`PlatformIcon` for `ch.platform`) is shown before the channel name, in a colored container matching the platform

#### Scenario: ไม่มี Badge แพลตฟอร์มซ้ำ
- **WHEN** the widget renders each channel row
- **THEN** the platform badge (`PLATFORM_MAP[platform].label`) is removed — only the channel name (with logo) and status are shown

#### Scenario: แสดงสถานะการเชื่อมต่อจริง
- **WHEN** the "โซเชียล" sub-tab loads with channels
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

#### Scenario: ไม่แสดงบนแท็บภาพรวมอีกต่อไป
- **WHEN** the content dashboard renders the "ภาพรวม" (overview) tab
- **THEN** the "สถานะช่องทาง" widget does not appear there (it renders only on the "โซเชียล" sub-tab of the analytics tab)
