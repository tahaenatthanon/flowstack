## ADDED Requirements

### Requirement: แสดง Stat Cards ยอดวิวรวมและยอดไลก์รวม
The dashboard SHALL display two additional stat cards showing the total views and total likes aggregated across all content items.

#### Scenario: ยอดวิวรวมคำนวณจาก content items
- **WHEN** the dashboard loads and `content_items` are fetched via `GET /content-items.php`
- **THEN** a "ยอดวิวรวม" stat card displays the sum of `views` across all items

#### Scenario: ยอดไลก์รวมคำนวณจาก content items
- **WHEN** the dashboard loads and `content_items` are fetched
- **THEN** a "ยอดไลก์รวม" stat card displays the sum of `likes` across all items

#### Scenario: แสดงศูนย์เมื่อไม่มีข้อมูล
- **WHEN** the dashboard loads with an empty `content_items` array
- **THEN** the "ยอดวิวรวม" and "ยอดไลก์รวม" cards display `0`

### Requirement: Stat Cards ใหม่ใช้สไตล์เดียวกับการ์ดเดิม
The new views/likes stat cards SHALL follow the same visual style as the existing four stat cards.

#### Scenario: สไตล์การ์ดสอดคล้องกัน
- **WHEN** the "ยอดวิวรวม" and "ยอดไลก์รวม" cards are rendered
- **THEN** each uses an icon (`Eye` and `ThumbsUp`) with a colored icon container and consistent padding/label layout matching the existing cards

### Requirement: ใช้ Card primitive จาก Design System
The views/likes stat cards SHALL be built with the existing `Card`/`CardContent` shadcn-ui primitives and Tailwind tokens, matching the existing stat cards without introducing new UI patterns.

#### Scenario: ใช้ Card primitive เดิม
- **WHEN** the new stat cards are rendered
- **THEN** they use `Card` and `CardContent` from `@/components/ui/card` with Tailwind tokens (`p-4`, `rounded-lg`, colored icon container) identical to the existing four stat cards
