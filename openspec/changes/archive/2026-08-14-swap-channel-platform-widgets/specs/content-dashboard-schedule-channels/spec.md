# content-dashboard-schedule-channels Specification (delta)

## ADDED Requirements

### Requirement: เรียงลำดับ widget แพลตฟอร์มก่อนสถานะช่องทาง
The content dashboard SHALL display the "แพลตฟอร์ม" widget before the "สถานะช่องทาง" widget, placing "แพลตฟอร์ม" in the position previously occupied by "สถานะช่องทาง" and "สถานะช่องทาง" in the position previously occupied by "แพลตฟอร์ม".

#### Scenario: แพลตฟอร์มอยู่ก่อนสถานะช่องทาง
- **WHEN** the content dashboard renders its widget column
- **THEN** the "แพลตฟอร์ม" widget appears before the "สถานะช่องทาง" widget

#### Scenario: กำหนดการโพสต์ถัดไปยังอยู่ที่แรก
- **WHEN** the content dashboard renders its widget column
- **THEN** the "กำหนดการโพสต์ถัดไป" widget remains the first widget, and the final order is: กำหนดการโพสต์ถัดไป → แพลตฟอร์ม → สถานะช่องทาง

### Requirement: เพิ่มไอคอนสำหรับแพลตฟอร์ม YouTube
The platform icon system SHALL include a dedicated icon for the "YouTube" platform (`youtube`), so content items or channels with `platform = "youtube"` display a YouTube logo icon (not the fallback icon) along with the correct platform name and color.

#### Scenario: แสดงไอคอน YouTube
- **WHEN** a widget renders a platform or channel with `platform = "youtube"`
- **THEN** it displays the YouTube logo icon (`PlatformIcon`) instead of the default fallback icon

#### Scenario: แสดงชื่อและสีของ YouTube
- **WHEN** a widget renders a platform or channel with `platform = "youtube"`
- **THEN** it shows the label "YouTube" and the red brand color consistent with other platform entries
