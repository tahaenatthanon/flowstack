# content-dashboard-section-headers Specification

## Purpose

กำหนดไอคอนหัวข้อและปุ่ม action (ดูทั้งหมด/จัดการ) ที่มุมขวาบนของ section Card ในแดชบอร์ดคอนเทนต์ (`ContentDashboardPage`)

## Requirements

### Requirement: ไอคอนหัวข้อทุก section
The content dashboard SHALL render an icon next to the title of every section Card: "ภาพรวมสถานะคอนเทนต์", "เนื้อหาล่าสุด", "รออนุมัติ", "กำหนดการโพสต์ถัดไป", "แพลตฟอร์ม", and "สถานะช่องทาง".

#### Scenario: ไอคอนครบทุก section
- **WHEN** the dashboard renders all section Cards
- **THEN** each section title is preceded by a `lucide-react` icon (e.g. `BarChart3`, `FileText`, `Clock`, `CalendarClock`, `Share2`, `Radio`)

#### Scenario: ไอคอนไม่เบียดชื่อ
- **WHEN** a section title with icon renders
- **THEN** the icon uses a small fixed size (`h-4 w-4`) and the title remains legible

### Requirement: ปุ่ม action มุมขวาบนของ Card
The dashboard SHALL render action buttons in the top-right corner of specific Card headers, aligned opposite the title.

#### Scenario: ปุ่ม ดูทั้งหมด บน เนื้อหาล่าสุด
- **WHEN** the "เนื้อหาล่าสุด" Card renders
- **THEN** a "ดูทั้งหมด" button appears at the top-right and navigates to the content list

#### Scenario: ปุ่ม ดูทั้งหมด บน รออนุมัติ
- **WHEN** the "รออนุมัติ" Card renders
- **THEN** a "ดูทั้งหมด" button appears at the top-right and navigates to the approval list

#### Scenario: ปุ่ม จัดการ บน สถานะช่องทาง
- **WHEN** the "สถานะช่องทาง" Card renders
- **THEN** a "จัดการ" button appears at the top-right and navigates to channel management

#### Scenario: ปุ่มไม่รบกวน layout
- **WHEN** an action button renders in a Card header
- **THEN** it uses a compact (`ghost`/`sm`) style and does not overlap the title
