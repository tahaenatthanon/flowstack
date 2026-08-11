# approval-stats-cards Specification

## Purpose

กำหนดพฤติกรรมและ Visual Style ของ Stat Cards ด้านบนหน้า "รายการอนุมัติ" (`/content-approval`) ซึ่งสรุปจำนวน content items ตามสถานะ `review`, `published`, `revision`, และ `rejected` โดยใช้รูปแบบ `stat-card card-hover` ให้สอดคล้องกับ Stat Cards ของหน้า Projects

## Requirements

### Requirement: Approval list shows stat cards for each status
ระบบ SHALL แสดง Stat Cards 4 ช่องด้านบนหน้ารายการอนุมัติ สรุปจำนวน content items ตามสถานะ: รออนุมัติ (`review`), อนุมัติแล้ว (`published`), ขอแก้ไข (`revision`), และปฏิเสธ (`rejected`) — โดยใช้ Visual Style แบบ `stat-card card-hover` สอดคล้องกับ Stat Cards ของหน้า Projects

#### Scenario: Display stat cards with projects-style visual
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** ระบบแสดง Stat Cards 4 ช่องเรียงกันใน grid (`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4`) โดยแต่ละ card ใช้ CSS class `stat-card card-hover` พร้อมโครงสร้าง: icon container (`p-1.5 sm:p-2 rounded-lg bg-{color}/10`) ด้านบน, ค่าตัวเลข (`text-xl sm:text-2xl font-bold font-heading`), และชื่อสถานะภาษาไทย (`text-xs sm:text-sm text-muted-foreground`)

#### Scenario: Stat cards use semantic colors
- **WHEN** ผู้ใช้เข้าถึง `/content-approval`
- **THEN** Stat Cards ใช้ semantic color tokens: `text-warning` / `bg-warning/10` (รออนุมัติ), `text-success` / `bg-success/10` (อนุมัติแล้ว), `text-info` / `bg-info/10` (ขอแก้ไข), `text-destructive` / `bg-destructive/10` (ปฏิเสธ)

#### Scenario: Stat cards update on data change
- **WHEN** ผู้ใช้อนุมัติ, ปฏิเสธ, หรือส่งแก้ไข content item
- **THEN** จำนวนใน Stat Cards ปรับปรุงอัตโนมัติตามข้อมูลล่าสุด

#### Scenario: Zero count display
- **WHEN** สถานะใดไม่มีรายการ
- **THEN** Stat Card ของสถานะนั้นแสดงเลข 0
