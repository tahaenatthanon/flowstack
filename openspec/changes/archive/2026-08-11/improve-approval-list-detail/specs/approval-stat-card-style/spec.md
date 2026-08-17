## ADDED Requirements

### Requirement: Stat cards display title and icon in same row with count below
ระบบ SHALL แสดง Stat Cards ในหน้ารายการอนุมัติโดยใช้รูปแบบ `Card` component (shadcn-ui) ที่มี `CardHeader` แสดงหัวข้อ (Title) และ Icon ในแถวเดียวกัน (`flex flex-row items-center justify-between`) และ `CardContent` แสดงจำนวนรายการ (Count) อยู่ด้านล่าง

#### Scenario: Stat card renders with correct layout
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** Stat Card แต่ละใบแสดง Title และ Icon ในแถวเดียวกันทางด้านซ้ายและขวาตามลำดับ โดย Count (ตัวเลข) แสดงอยู่ใต้แถว Title/Icon ใน `CardContent`

#### Scenario: Stat card uses Card component from design system
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** Stat Cards ใช้ `<Card>`, `<CardHeader>` (className `flex flex-row items-center justify-between space-y-0 pb-2`), `<CardTitle>` (className `text-sm font-medium`), และ `<CardContent>` จาก `@/components/ui/card` — สอดคล้องกับ KpiCard pattern ในหน้า HomePage

#### Scenario: Stat card icons and colors preserved
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** Icon และ semantic color tokens คงเดิม: `text-warning` (รออนุมัติ), `text-success` (อนุมัติแล้ว), `text-info` (ขอแก้ไข), `text-destructive` (ปฏิเสธ)

#### Scenario: Stat cards update on data change
- **WHEN** ผู้ใช้อนุมัติ, ปฏิเสธ, หรือส่งแก้ไข content item
- **THEN** จำนวนใน Stat Cards ปรับปรุงอัตโนมัติตามข้อมูลล่าสุด

#### Scenario: Zero count display
- **WHEN** สถานะใดไม่มีรายการ
- **THEN** Stat Card ของสถานะนั้นแสดงเลข 0
