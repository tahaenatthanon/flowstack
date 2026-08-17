## ADDED Requirements

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
The dashboard SHALL display a "สถานะช่องทาง" widget listing publish channels and their active/inactive state from `brand-content.php?action=channels`.

#### Scenario: แสดงช่องทางและสถานะ
- **WHEN** the dashboard loads with channels
- **THEN** the widget lists each channel with a connected/inactive indicator based on `is_active`

#### Scenario: แสดงข้อความว่างเมื่อไม่มีช่องทาง
- **WHEN** there are no configured channels
- **THEN** the widget shows an empty-state message

### Requirement: ใช้ Card และ Badge จาก Design System
The schedule and channel widgets SHALL use existing `Card`/`Badge` shadcn-ui primitives and `PLATFORM_MAP` colors, consistent with the existing dashboard cards.

#### Scenario: ใช้ Card/Badge primitive เดิม
- **WHEN** the schedule and channel widgets are rendered
- **THEN** they use `Card`, `CardHeader`, `CardTitle`, `CardContent` and `Badge` with `PLATFORM_MAP` colors, matching existing dashboard cards
