# content-dashboard-top-content Specification

## Purpose

Display a "เนื้อหายอดนิยม" (Top Content) widget on the content dashboard listing the top content items by views.

## Requirements

### Requirement: แสดง Top Content เรียงตามยอดวิว
The dashboard SHALL display a "เนื้อหายอดนิยม" widget listing the top 5 content items sorted by `views` in descending order.

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

### Requirement: ใช้ Badge และ Table จาก Design System
The Top Content widget SHALL use existing `Badge`/`Table` shadcn-ui primitives and the `TYPE_MAP`/`PLATFORM_MAP` constants, consistent with the existing recent content table.

#### Scenario: ใช้ Badge/Table primitive เดิม
- **WHEN** the Top Content widget is rendered
- **THEN** it uses `Table` and `Badge` primitives with `TYPE_MAP`/`PLATFORM_MAP` colors, matching the existing "เนื้อหาล่าสุด" table
