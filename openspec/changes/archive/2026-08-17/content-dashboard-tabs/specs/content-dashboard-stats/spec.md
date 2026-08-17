# content-dashboard-stats Specification (delta)

## MODIFIED Requirements

### Requirement: แสดง Stat Cards ยอดวิวรวมและยอดไลก์รวม
The analytics tab of the content dashboard SHALL display two stat cards showing the total views and total likes aggregated across all content items.

#### Scenario: ยอดวิวรวมคำนวณจาก content items
- **WHEN** the analytics tab loads and `content_items` are fetched via `GET /content-items.php`
- **THEN** a "ยอดวิวรวม" stat card displays the sum of `views` across all items

#### Scenario: ยอดไลก์รวมคำนวณจาก content items
- **WHEN** the analytics tab loads and `content_items` are fetched
- **THEN** a "ยอดไลก์รวม" stat card displays the sum of `likes` across all items

#### Scenario: แสดงศูนย์เมื่อไม่มีข้อมูล
- **WHEN** the analytics tab loads with an empty `content_items` array
- **THEN** the "ยอดวิวรวม" and "ยอดไลก์รวม" cards display `0`
