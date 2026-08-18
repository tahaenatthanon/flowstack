## MODIFIED Requirements

### Requirement: แสดง Stat Cards ยอดวิวรวมและยอดไลก์รวม
The analytics tab of the content dashboard SHALL display two stat cards showing the total views and total likes aggregated across all content items, but SHALL hide these cards when there is no engagement data (total views and total likes are both zero).

#### Scenario: ยอดวิวรวมคำนวณจาก content items
- **WHEN** the analytics tab loads and `content_items` are fetched via `GET /content-items.php`
- **THEN** a "ยอดวิวรวม" stat card displays the sum of `views` across all items

#### Scenario: ยอดไลก์รวมคำนวณจาก content items
- **WHEN** the analytics tab loads and `content_items` are fetched
- **THEN** a "ยอดไลก์รวม" stat card displays the sum of `likes` across all items

#### Scenario: ซ่อนการ์ดเมื่อไม่มีข้อมูล engagement
- **WHEN** the analytics tab loads and the sum of `views` across all items is `0` AND the sum of `likes` across all items is `0`
- **THEN** the "ยอดวิวรวม" and "ยอดไลก์รวม" cards are not rendered (hidden), instead of displaying `0` as a result
