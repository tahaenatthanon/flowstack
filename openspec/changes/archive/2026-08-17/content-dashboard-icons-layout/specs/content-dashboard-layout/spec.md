## MODIFIED Requirements

### Requirement: เนื้อหาล่าสุดเป็นตารางหลัก
The dashboard SHALL render a single Card titled "เนื้อหาล่าสุด" (Recent Content) in the left column, listing the most recent content items as a table, without any Tabs.

#### Scenario: แสดงเนื้อหาล่าสุดเรียงตามวันที่สร้าง
- **WHEN** the dashboard loads with `content_items`
- **THEN** the Card lists up to 5 items sorted by `created_at` descending

#### Scenario: แสดงคอลัมน์ของตาราง
- **WHEN** a recent content item is rendered
- **THEN** it shows a thumbnail, title (truncated, expanding column), type badge (`TYPE_MAP`), platform badge (`PLATFORM_MAP` when present, hidden below `md`), and status badge (`STATUS_MAP`)

#### Scenario: แสดง Thumbnail ด้านหน้าชื่อ
- **WHEN** a recent content item has a `generated_image_url`
- **THEN** the table shows a small thumbnail image (`w-8 h-8 rounded border bg-muted object-cover`) before the title

#### Scenario: Fallback เมื่อไม่มี Thumbnail
- **WHEN** a recent content item has no `generated_image_url`
- **THEN** the table shows the type icon (from `TYPE_MAP[item.type]`) in place of the thumbnail

#### Scenario: แสดงข้อความว่างเมื่อไม่มีข้อมูล
- **WHEN** the dashboard loads with no content items
- **THEN** the Card shows an empty-state message "ไม่มีเนื้อหา"

### Requirement: สมดุล Section ซ้าย–ขวา
The content dashboard SHALL keep the left and right columns visually balanced with equal overall height and equal vertical spacing (`space-y-6`) and consistent card header/content padding across both columns.

#### Scenario: ระยะห่างแนวตั้งสม่ำเสมอ
- **WHEN** the master 2-column layout renders
- **THEN** both the left and right columns use the same vertical gap (`space-y-6`) between cards

#### Scenario: หัว Card สูงเท่ากัน
- **WHEN** each Card in both columns renders
- **THEN** every Card uses `CardHeader` with `pb-2` and `CardTitle` with `text-sm font-medium` for consistent header height

#### Scenario: ความสูงรวมของคอลัมน์เท่ากัน
- **WHEN** the dashboard renders on a wide (`xl`) screen
- **THEN** the left column and right column have equal overall height, with sections proportioned so both columns align at the same bottom edge

#### Scenario: ขอบบน–ล่างของ Card align กัน
- **WHEN** the dashboard renders on a wide (`xl`) screen
- **THEN** the first cards of the left and right columns start at the same top edge and the columns align as a balanced, tidy layout
