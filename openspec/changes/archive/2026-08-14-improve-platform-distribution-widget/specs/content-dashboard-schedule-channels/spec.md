# content-dashboard-schedule-channels Specification (delta)

## ADDED Requirements

### Requirement: แสดงแพลตฟอร์มพร้อม Logo Icon และจำนวนคอนเทนต์
The dashboard SHALL display a "แพลตฟอร์ม" widget listing each platform's logo icon and name (in the same style as "สถานะช่องทาง"), showing each platform name exactly once, along with its content count derived from the real system data.

#### Scenario: แสดง Logo Icon + ชื่อแพลตฟอร์ม
- **WHEN** the dashboard loads with `content_items`
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
