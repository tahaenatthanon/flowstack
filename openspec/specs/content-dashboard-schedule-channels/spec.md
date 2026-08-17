# content-dashboard-schedule-channels Specification

## Purpose

Display upcoming publish schedule and channel connection status widgets on the content dashboard.

## Requirements

### Requirement: แสดงกำหนดการโพสต์ถัดไป
The dashboard SHALL display a "กำหนดการโพสต์ถัดไป" widget listing upcoming scheduled content from `brand-content.php?action=all-schedules` or content items with a future `scheduled_date`.

#### Scenario: แสดงรายการโพสต์ที่กำลังจะถึง
- **WHEN** the dashboard loads with schedules/content items
- **THEN** the widget lists upcoming posts with a `scheduled_date` in the future, ordered ascending by scheduled time

#### Scenario: แสดงชื่อและเวลาของแต่ละโพสต์
- **WHEN** an upcoming post is rendered
- **THEN** it shows the topic/title, platform (or channel name), and formatted scheduled datetime

#### Scenario: แสดงข้อความว่างเมื่อไม่มีโพสต์ถัดไป
- **WHEN** there are no upcoming scheduled posts
- **THEN** the widget shows an empty-state message

### Requirement: แสดงสถานะช่องทางเชื่อมต่อ
The dashboard SHALL display a "สถานะช่องทาง" widget listing publish channels and their connection status, verified against the actual connection to each channel (not merely the `is_active` value), showing each channel's name exactly once (with a platform logo icon before it) and a status (colored dot + text label) placed after its data.

#### Scenario: แสดงชื่อช่องทางเพียงครั้งเดียว
- **WHEN** the dashboard loads with channels
- **THEN** the widget lists each channel showing its name (`ch.name`) exactly once — no duplicate platform badge (WordPress, Facebook, Line OA, TikTok, Lotus Notes / Domino, etc.)

#### Scenario: แสดง Logo Icon ด้านหน้าชื่อ
- **WHEN** the widget renders each channel row
- **THEN** a platform logo icon (`PlatformIcon` for `ch.platform`) is shown before the channel name, in a colored container matching the platform

#### Scenario: ไม่มี Badge แพลตฟอร์มซ้ำ
- **WHEN** the widget renders each channel row
- **THEN** the platform badge (`PLATFORM_MAP[platform].label`) is removed — only the channel name (with logo) and status are shown

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

### Requirement: แสดงแพลตฟอร์มพร้อม Logo Icon และจำนวนคอนเทนต์
The analytics tab of the content dashboard SHALL display a "แพลตฟอร์ม" widget listing each platform's logo icon and name (in the same style as "สถานะช่องทาง"), showing each platform name exactly once, along with its content count derived from the real system data.

#### Scenario: แสดง Logo Icon + ชื่อแพลตฟอร์ม
- **WHEN** the analytics tab loads with `content_items`
- **THEN** the widget lists each platform with a logo icon (`PlatformIcon`) in a colored container and the platform name shown exactly once (no duplicate name badge)

#### Scenario: แสดงจำนวนคอนเทนต์ตามข้อมูลจริง
- **WHEN** the widget renders each platform
- **THEN** it shows the content count (`platformCounts`) computed from `content_items` reflecting the real data

#### Scenario: เรียงตามจำนวนมากไปน้อย
- **WHEN** the widget renders the platform list
- **THEN** platforms are ordered by content count descending (highest first)

#### Scenario: เรียงตามชื่อ A–Z เมื่อจำนวนเท่ากัน
- **WHEN** two or more platforms have the same content count
- **THEN** they are ordered by platform name A–Z (using the platform label)

### Requirement: นับจำนวนแพลตฟอร์มแบบ case-insensitive
The analytics tab SHALL count platform content in a case-insensitive manner, so the same platform written with different casing (e.g. "Facebook" vs "facebook") is aggregated into a single entry.

#### Scenario: รวมแพลตฟอร์มเดียวกัน
- **WHEN** the analytics tab loads with `content_items` where some items have `platform = "Facebook"` and others `platform = "facebook"`
- **THEN** the widget shows a single "Facebook" entry with a combined count (not two separate entries)

### Requirement: ใช้ Card และ Badge จาก Design System
The schedule and channel widgets SHALL use existing `Card`/`Badge` shadcn-ui primitives and `PLATFORM_MAP` colors, consistent with the existing dashboard cards.

#### Scenario: ใช้ Card/Badge primitive เดิม
- **WHEN** the schedule and channel widgets are rendered
- **THEN** they use `Card`, `CardHeader`, `CardTitle`, `CardContent` and `Badge` with `PLATFORM_MAP` colors, matching existing dashboard cards

### Requirement: เพิ่มไอคอนสำหรับแพลตฟอร์ม YouTube
The platform icon system SHALL include a dedicated icon for the "YouTube" platform (`youtube`), so content items or channels with `platform = "youtube"` display a YouTube logo icon (not the fallback icon) along with the correct platform name and color.

#### Scenario: แสดงไอคอน YouTube
- **WHEN** a widget renders a platform or channel with `platform = "youtube"`
- **THEN** it displays the YouTube logo icon (`PlatformIcon`) instead of the default fallback icon

#### Scenario: แสดงชื่อและสีของ YouTube
- **WHEN** a widget renders a platform or channel with `platform = "youtube"`
- **THEN** it shows the label "YouTube" and the red brand color consistent with other platform entries
