# content-dashboard-stat-card-style Specification

## Purpose

กำหนดรูปแบบการแสดงผล (Visual Style) ของ Stat Cards ในหน้าแดชบอร์ดคอนเทนต์ (`ContentDashboardPage`) ให้ใช้ KpiCard pattern เดียวกับ Stat Card ในหน้ารายการอนุมัติ — หัวข้ออยู่ด้านบน (ซ้าย), ไอคอนอยู่ด้านขวา (แถวเดียวกับหัวข้อ), จำนวนอยู่ด้านล่าง

## Requirements

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

### Requirement: Stat cards update on data change
จำนวนใน Stat Cards SHALL ปรับปรุงอัตโนมัติตามข้อมูลล่าสุด

#### Scenario: Stat cards update on data change
- **WHEN** ข้อมูล content items เปลี่ยนแปลง (fetch ใหม่ผ่าน React Query)
- **THEN** จำนวนใน Stat Cards ปรับปรุงอัตโนมัติตามข้อมูลล่าสุด

#### Scenario: Zero count display
- **WHEN** ไม่มีข้อมูลสำหรับ metric นั้น
- **THEN** Stat Card ของ metric นั้นแสดงเลข 0

### Requirement: Stat card border ตรงกับสีไอคอน
Stat Cards ในแดชบอร์ดคอนเทนต์ SHALL มีสีกรอบ (border) ตรงกับสีไอคอนของแต่ละ card เพื่อบ่งชี้สถานะได้ชัดเจนขึ้น

#### Scenario: สีกรอบตรงกับสีไอคอน
- **WHEN** ผู้ใช้เข้าถึงหน้าแดชบอร์ดคอนเทนต์
- **THEN** แต่ละ Stat Card มี `border-{color}` ระดับเดียวกับสีไอคอน (เช่น เนื้อหาทั้งหมด = `border-blue-600`, เผยแพร่แล้ว = `border-green-600`, รออนุมัติ = `border-amber-600`, ฉบับร่าง = `border-gray-600`, ยอดวิวรวม = `border-cyan-600`, ยอดไลก์รวม = `border-pink-600`)

### Requirement: Stat card ใช้รูปแบบเดียวกับ Status Card ในหน้าโปรเจกต์
Stat Cards ในแดชบอร์ดคอนเทนต์ SHALL ใช้ class `stat-card` เป็น base decoration เดียวกับ Status Card ในหน้าโปรเจกต์ (`src/components/StatCards.tsx`) (`rounded-xl` + padding + default border + `bg-card`) โดยไม่มี hover effect และคงการจัดวางองค์ประกอบภายในเดิม (หัวข้อด้านซ้าย, ไอคอนด้านขวา, จำนวนด้านล่าง)

#### Scenario: decoration base เดียวกับหน้าโปรเจกต์
- **WHEN** ผู้ใช้เข้าถึงหน้าแดชบอร์ดคอนเทนต์
- **THEN** แต่ละ Stat Card ใช้ class `stat-card` เป็น base (`rounded-xl` + padding + default border + `bg-card`) — ตรงกับ decoration ของ Status Card ในหน้าโปรเจกต์

#### Scenario: ไม่มี hover effect
- **WHEN** ผู้ใช้เลื่อนเมาส์ไปวาง (hover) บน Stat Card
- **THEN** การ์ดไม่ขยับ/ไม่เพิ่มเงา (ไม่มี class `card-hover`) — รูปแบบการแสดงผลคงที่

#### Scenario: คง layout หัวข้อซ้าย ไอคอนขวา จำนวนล่าง
- **WHEN** ผู้ใช้เข้าถึงหน้าแดชบอร์ดคอนเทนต์
- **THEN** แต่ละ Stat Card คงการจัดวางภายในเดิม — หัวข้อ (label) ด้านซ้าย, ไอคอนด้านขวาในแถวเดียวกัน, จำนวน (count) ด้านล่าง — ไม่เปลี่ยน Layout

### Requirement: Stat card แสดงสีพื้นหลังตาม Status
Stat Cards ในแดชบอร์ดคอนเทนต์ SHALL มีสีพื้นหลังตาม Status ของแต่ละ card โดยใช้รูปแบบสีเดียวกับ Status Card หน้าโปรเจกต์ (`bg-{color}/10`)

#### Scenario: สีพื้นหลังตรงกับ Status
- **WHEN** ผู้ใช้เข้าถึงหน้าแดชบอร์ดคอนเทนต์
- **THEN** แต่ละ Stat Card มีสีพื้นหลัง (`bg-{color}/10`) ตรงกับ Status (เนื้อหาทั้งหมด = `bg-blue-500/10`, เผยแพร่แล้ว = `bg-green-500/10`, รออนุมัติ = `bg-amber-500/10`, ฉบับร่าง = `bg-gray-500/10`, ยอดวิวรวม = `bg-cyan-500/10`, ยอดไลก์รวม = `bg-pink-500/10`) — ตรงกับ pattern ของ Status Card หน้าโปรเจกต์

#### Scenario: คง layout หลังเพิ่มสีพื้นหลัง
- **WHEN** ผู้ใช้เข้าถึงหน้าแดชบอร์ดคอนเทนต์
- **THEN** การเพิ่มสีพื้นหลังไม่เปลี่ยน layout ภายใน — หัวข้อยังอยู่ซ้าย, ไอคอนยังอยู่ขวา, จำนวนยังอยู่ล่าง

### Requirement: จำนวน (Count) ใช้เฉดเข้มเดียวกับพื้นหลัง
Stat Cards ในแดชบอร์ดคอนเทนต์ SHALL แสดงจำนวน (Count) ด้วยสีเดียวกับพื้นหลังของ Card แต่ใช้เฉดสีที่เข้มกว่า เพื่อให้ข้อความเด่นชัดและอ่านง่าย

#### Scenario: จำนวนใช้เฉดเข้มเดียวกับพื้นหลัง
- **WHEN** ผู้ใช้เข้าถึงหน้าแดชบอร์ดคอนเทนต์
- **THEN** จำนวน (Count) ใช้สี `text-{color}-700` เดียวกับพื้นหลังของ card นั้น (เนื้อหาทั้งหมด = `text-blue-700`, เผยแพร่แล้ว = `text-green-700`, รออนุมัติ = `text-amber-700`, ฉบับร่าง = `text-gray-700`, ยอดวิวรวม = `text-cyan-700`, ยอดไลก์รวม = `text-pink-700`) — เด่นชัดและอ่านง่ายบนพื้นหลัง `bg-{color}/10`
