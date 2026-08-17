## MODIFIED Requirements

### Requirement: เนื้อหาล่าสุดเป็นตารางหลัก
The dashboard SHALL render a single Card titled "เนื้อหาล่าสุด" (Recent Content) in the left column, listing the most recent content items as a multi-line list, without any Tabs.

#### Scenario: แสดงเนื้อหาล่าสุดเรียงตามวันที่สร้าง
- **WHEN** the dashboard loads with `content_items`
- **THEN** the Card lists up to 5 items sorted by `created_at` descending

#### Scenario: แสดงรูปภาพด้านซ้าย
- **WHEN** a recent content item has a `generated_image_url`
- **THEN** the item shows a thumbnail image on the left, stretched to match the height of the item's data area

#### Scenario: Fallback เมื่อไม่มีรูปภาพ
- **WHEN** a recent content item has no `generated_image_url`
- **THEN** the item shows a muted placeholder box with the type icon (from `TYPE_MAP[item.type]`) on the left

#### Scenario: แสดงชื่อ
- **WHEN** a recent content item is rendered
- **THEN** the title appears on its own line

#### Scenario: แสดงประเภทและแพลตฟอร์มในบรรทัดเดียวกัน
- **WHEN** a recent content item is rendered
- **THEN** the type badge (`TYPE_MAP`) and the platform badge (`PLATFORM_MAP`, or "-" when absent) appear on the same line, with the type before the platform

#### Scenario: แสดงสถานะและวันที่สร้างในบรรทัดเดียวกัน
- **WHEN** a recent content item is rendered
- **THEN** the status badge (`STATUS_MAP`) and the creation date (`created_at`) appear on the same line

#### Scenario: จัดแนวรูปภาพสอดคล้องกันทุกแถว
- **WHEN** multiple recent content items are rendered
- **THEN** each item's thumbnail has the same height as its side data area and aligns consistently across all rows

#### Scenario: แสดงข้อความว่างเมื่อไม่มีข้อมูล
- **WHEN** the dashboard loads with no content items
- **THEN** the Card shows an empty-state message "ไม่มีเนื้อหา"
