# content-dashboard-layout Specification (delta)

## ADDED Requirements

### Requirement: ส่วนหัวแดชบอร์ดไม่มีปุ่ม action
The content dashboard header SHALL NOT render the "ดูเนื้อหาทั้งหมด" and "สร้างคอนเทนต์" action buttons.

#### Scenario: ไม่มีปุ่ม ดูเนื้อหาทั้งหมด
- **WHEN** the content dashboard page renders its header (`PageShell`)
- **THEN** there is no "ดูเนื้อหาทั้งหมด" button

#### Scenario: ไม่มีปุ่ม สร้างคอนเทนต์
- **WHEN** the content dashboard page renders its header (`PageShell`)
- **THEN** there is no "สร้างคอนเทนต์" button
