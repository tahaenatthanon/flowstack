# approval-stat-card-style Specification

## Purpose

กำหนด Visual Style ของ Stat Cards ด้านบนหน้า "รายการอนุมัติ" (`/content-approval`) โดยใช้ `Card` component จาก design system (shadcn-ui) — Title และ Icon อยู่ในแถวเดียวกัน และ Count อยู่ด้านล่าง สอดคล้องกับ KpiCard pattern ในหน้า HomePage

Capability นี้เป็นเจ้าของ **รูปแบบการแสดงผล** ของ Stat Cards เท่านั้น ส่วน **พฤติกรรม** (มี card สถานะใดบ้าง, count มาจากไหน, อัปเดตเมื่อไหร่) อยู่ที่ `approval-stats-cards`

## Requirements

### Requirement: Stat cards display title and icon in same row with count below
ระบบ SHALL แสดง Stat Cards ในหน้ารายการอนุมัติโดยใช้รูปแบบ `Card` component (shadcn-ui) ที่มี `CardHeader` แสดงหัวข้อ (Title) และ Icon ในแถวเดียวกัน (`flex flex-row items-center justify-between`) และ `CardContent` แสดงจำนวนรายการ (Count) อยู่ด้านล่าง

#### Scenario: Stat card renders with correct layout
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** Stat Card แต่ละใบแสดง Title และ Icon ในแถวเดียวกันทางด้านซ้ายและขวาตามลำดับ โดย Count (ตัวเลข) แสดงอยู่ใต้แถว Title/Icon ใน `CardContent`

#### Scenario: Stat card uses Card component from design system
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** Stat Cards ใช้ `<Card>`, `<CardHeader>` (className `flex flex-row items-center justify-between space-y-0 pb-2`), `<CardTitle>` (className `text-sm font-medium`), และ `<CardContent>` จาก `@/components/ui/card` — สอดคล้องกับ KpiCard pattern ในหน้า HomePage

#### Scenario: Stat card grid layout
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** Stat Cards เรียงใน grid `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3` — ไม่ใช้ CSS class `stat-card card-hover`

#### Scenario: Stat card icons and colors preserved
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** Icon และ semantic color tokens คงเดิม: `text-warning` (รออนุมัติ), `text-success` (อนุมัติแล้ว), `text-info` (ขอแก้ไข), `text-destructive` (ปฏิเสธ) โดย Icon ใช้ className `h-4 w-4 {color}`

#### Scenario: Stat cards update on data change
- **WHEN** ผู้ใช้อนุมัติ, ปฏิเสธ, หรือส่งแก้ไข content item
- **THEN** จำนวนใน Stat Cards ปรับปรุงอัตโนมัติตามข้อมูลล่าสุด

#### Scenario: Zero count display
- **WHEN** สถานะใดไม่มีรายการ
- **THEN** Stat Card ของสถานะนั้นแสดงเลข 0
