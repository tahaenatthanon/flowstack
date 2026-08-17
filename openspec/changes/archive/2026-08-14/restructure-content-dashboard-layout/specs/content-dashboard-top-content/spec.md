# content-dashboard-top-content Specification (delta)

## MODIFIED Requirements

### Requirement: แสดง Top Content เรียงตามยอดวิว
The dashboard SHALL display a "เนื้อหายอดนิยม" (Top Content) widget listing the top 5 content items sorted by `views` in descending order, presented together with "เนื้อหาล่าสุด" (Recent Content) in a single Card using `Tabs`.

#### Scenario: เรียงลำดับตามยอดวิว
- **WHEN** the dashboard loads with `content_items`
- **THEN** the widget lists up to 5 items sorted by `views` descending

#### Scenario: แสดงรายละเอียดแต่ละรายการ
- **WHEN** a top content item is rendered
- **THEN** it shows the title, type badge (via `TYPE_MAP`), platform badge (via `PLATFORM_MAP` when present), and its view count

#### Scenario: แสดงข้อความว่างเมื่อไม่มีข้อมูล
- **WHEN** the dashboard loads with no content items
- **THEN** the widget shows an empty-state message "ไม่มีเนื้อหา"

#### Scenario: แสดงไม่เกิน 5 รายการ
- **WHEN** there are more than 5 content items
- **THEN** only the top 5 by views are displayed

#### Scenario: นำเสนอผ่าน Tabs ร่วมกับเนื้อหาล่าสุด
- **WHEN** the dashboard renders the content list Card
- **THEN** a `TabsList` shows tabs "เนื้อหายอดนิยม" (default) and "เนื้อหาล่าสุด", and selecting a tab swaps the table between top content and recent content
