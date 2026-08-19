## MODIFIED Requirements

### Requirement: แสดง Stat Cards ยอดวิวรวมและยอดไลก์รวม
The "เนื้อหา" sub-tab of the analytics tab of the content dashboard SHALL display four stat cards: "จำนวนคอนเทนต์ทั้งหมด", "เผยแพร่แล้ว", "Engagement รวม", and "Content Performance", aggregated across all content items.

#### Scenario: จำนวนคอนเทนต์ทั้งหมดคำนวณจาก content items
- **WHEN** the "เนื้อหา" sub-tab loads and `content_items` are fetched
- **THEN** a "จำนวนคอนเทนต์ทั้งหมด" stat card displays `COUNT(*)` of all items

#### Scenario: เผยแพร่แล้วคำนวณจาก published_at
- **WHEN** the "เนื้อหา" sub-tab loads
- **THEN** a "เผยแพร่แล้ว" stat card displays `SUM(published_at IS NOT NULL)`

#### Scenario: Engagement รวมแสดงค่าจริงแม้เป็น 0
- **WHEN** the "เนื้อหา" sub-tab loads
- **THEN** an "Engagement รวม" stat card displays `SUM(views) + SUM(likes)`, showing the real value even when it is `0`, with a hint "ยังไม่มีการซิงก์ engagement จากแพลตฟอร์ม"

#### Scenario: Content Performance เป็นอัตราการถึงขั้นเผยแพร่
- **WHEN** the "เนื้อหา" sub-tab loads and `COUNT(*) > 0`
- **THEN** a "Content Performance" stat card displays `SUM(published_at IS NOT NULL) / COUNT(*)` as a percentage

#### Scenario: Content Performance แสดงยังไม่มีข้อมูลเมื่อว่าง
- **WHEN** the "เนื้อหา" sub-tab loads and `COUNT(*) = 0`
- **THEN** the "Content Performance" stat card displays `null`/"ยังไม่มีข้อมูล"

### Requirement: Stat Cards ใหม่ใช้สไตล์เดียวกับการ์ดเดิม
The new stat cards SHALL follow the same visual style as the other stat cards on the dashboard, using the KpiCard pattern (title + icon in one row, count below).

#### Scenario: สไตล์การ์ดสอดคล้องกัน
- **WHEN** the four stat cards are rendered
- **THEN** each uses an icon shown as a text-colored icon in the header (right side, same row as the title), with the count shown below — matching the other dashboard stat cards and the approval-list KpiCard pattern

### Requirement: ใช้ Card primitive จาก Design System
The stat cards SHALL be built with the existing `Card`/`CardHeader`/`CardTitle`/`CardContent` shadcn-ui primitives and Tailwind tokens, matching the KpiCard pattern used by the approval-list stat cards.

#### Scenario: ใช้ Card primitive เดิม
- **WHEN** the new stat cards are rendered
- **THEN** they use `Card`, `CardHeader`, `CardTitle`, and `CardContent` from `@/components/ui/card`, with the count rendered as `text-2xl font-bold` — identical to the other dashboard stat cards and the approval-list stat cards
