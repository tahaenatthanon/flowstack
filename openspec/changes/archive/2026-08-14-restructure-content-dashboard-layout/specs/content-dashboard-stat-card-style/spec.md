# content-dashboard-stat-card-style Specification (delta)

## MODIFIED Requirements

### Requirement: Stat cards แสดงหัวข้อและไอคอนในแถวเดียวกัน โดยจำนวนอยู่ด้านล่าง
ระบบ SHALL แสดง Stat Cards ในหน้าแดชบอร์ดคอนเทนต์โดยใช้ `Card` component (shadcn-ui) ที่มี `CardHeader` แสดงหัวข้อ (Title) และ Icon ในแถวเดียวกัน (`flex flex-row items-center justify-between`) และ `CardContent` แสดงจำนวนรายการ (Count) อยู่ด้านล่าง

#### Scenario: Stat card renders with correct layout
- **WHEN** ผู้ใช้เข้าถึงหน้าแดชบอร์ดคอนเทนต์
- **THEN** Stat Card แต่ละใบแสดง Title ด้านบนซ้าย และ Icon ด้านขวาในแถวเดียวกัน โดย Count (ตัวเลข) แสดงอยู่ใต้แถว Title/Icon ใน `CardContent`

#### Scenario: Stat card uses Card component from design system
- **WHEN** ผู้ใช้เข้าถึงหน้าแดชบอร์ดคอนเทนต์
- **THEN** Stat Cards ใช้ `<Card>`, `<CardHeader>` (className `flex flex-row items-center justify-between space-y-0 pb-2`), `<CardTitle>` (className `text-sm font-medium`), และ `<CardContent>` จาก `@/components/ui/card` — สอดคล้องกับ KpiCard pattern ในหน้ารายการอนุมัติ

#### Scenario: Stat card grid layout
- **WHEN** ผู้ใช้เข้าถึงหน้าแดชบอร์ดคอนเทนต์
- **THEN** Stat Cards เรียงใน grid ระยะห่าง `gap-3` และใช้ breakpoint `grid-cols-2 sm:grid-cols-3 xl:grid-cols-6` (ไม่แออัดบนจอ `lg`)

#### Scenario: Stat card icons and colors preserved
- **WHEN** ผู้ใช้เข้าถึงหน้าแดชบอร์ดคอนเทนต์
- **THEN** Icon และ color tokens ของแต่ละ card คงเดิม โดย Icon ใช้ className `h-4 w-4 {color}` (text color ล้วน ไม่ใช้กล่องสีพื้นหลัง)

#### Scenario: Count display format
- **WHEN** ผู้ใช้เข้าถึงหน้าแดชบอร์ดคอนเทนต์
- **THEN** Count (ตัวเลข) แสดงใน `CardContent` ด้วย className `text-2xl font-bold tabular-nums` และใช้ `toLocaleString()` เพื่อคั่นหลักพัน
