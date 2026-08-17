# content-dashboard-schedule-channels Specification (delta)

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: เรียงลำดับ widget แพลตฟอร์มก่อนสถานะช่องทาง
**Reason**: widget "แพลตฟอร์ม" ย้ายออกจากแท็บภาพรวมไปยังแท็บวิเคราะห์แล้ว ลำดับเดิม "กำหนดการโพสต์ถัดไป → แพลตฟอร์ม → สถานะช่องทาง" จึงใช้ไม่ได้อีกต่อไป
**Migration**: ในแท็บภาพรวม ลำดับคอลัมน์ขวากลายเป็น "คิวรออนุมัติ" → "กำหนดการโพสต์ถัดไป" → "สถานะช่องทาง"; widget "แพลตฟอร์ม" แสดงในแท็บวิเคราะห์แทน
