# content-dashboard-layout Specification

## Purpose

กำหนด master layout แบบ 2 คอลัมน์ responsive และลำดับ section ของหน้าแดชบอร์ดคอนเทนต์ (`ContentDashboardPage`)

## Requirements

### Requirement: Master layout 2 คอลัมน์บนจอใหญ่
ระบบ SHALL จัดวางเนื้อหาหลักของแท็บ "ภาพรวม" (Overview) เป็น 2 คอลัมน์บนจอ `xl` ขึ้นไป โดยคอลัมน์ซ้ายกว้าง 2/3 แสดงข้อมูลสถานะการผลิตและตาราง ส่วนคอลัมน์ขวา 1/3 แสดง widget สถานะและงานที่ต้องทำ

#### Scenario: คอลัมน์ซ้าย (สถานะการผลิต + ตาราง)
- **WHEN** ผู้ใช้เข้าถึงแท็บ "ภาพรวม" บนจอกว้าง (`xl` ขึ้นไป)
- **THEN** "ความคืบหน้าการผลิต" และ Card "เนื้อหาล่าสุด" (ตารางเดียว ไม่มี Tabs) อยู่ฝั่งซ้าย (`xl:col-span-2`)

#### Scenario: คอลัมน์ขวา (สถานะ + งานที่ต้องทำ)
- **WHEN** ผู้ใช้เข้าถึงแท็บ "ภาพรวม" บนจอกว้าง (`xl` ขึ้นไป)
- **THEN** widget "คิวรออนุมัติ", "กำหนดการโพสต์ถัดไป", และ "สถานะช่องทาง" อยู่ฝั่งขวา เรียงตามลำดับนี้ (ไม่มี "แพลตฟอร์ม" — ย้ายไปแท็บวิเคราะห์)

#### Scenario: ลำดับคิวรออนุมัติอยู่บนสุด
- **WHEN** คอลัมน์ขวาของแท็บ "ภาพรวม" ถูก render
- **THEN** "คิวรออนุมัติ" เป็น widget แรกสุดของคอลัมน์ขวา

### Requirement: Responsive ต่ำกว่า xl เป็น stacked column
ระบบ SHALL แสดงทุก section ภายในแต่ละแท็บเรียงเป็น column เดียวเมื่อจอต่ำกว่า `xl`

#### Scenario: จอแคบไม่ overflow (แท็บภาพรวม)
- **WHEN** ผู้ใช้เข้าถึงแท็บ "ภาพรวม" บนจอต่ำกว่า `xl`
- **THEN** ทุก section ในแท็บภาพรวมกลับเป็น stacked column เดียว (1 คอลัมน์) ไม่มี overflow

#### Scenario: จอแคบไม่ overflow (แท็บวิเคราะห์)
- **WHEN** ผู้ใช้เข้าถึงแท็บ "วิเคราะห์" บนจอต่ำกว่า `xl`
- **THEN** ทุก section ในแท็บวิเคราะห์กลับเป็น stacked column เดียว (1 คอลัมน์) ไม่มี overflow

### Requirement: ส่วนหัวแดชบอร์ดไม่มีปุ่ม action
The content dashboard header SHALL NOT render the "ดูเนื้อหาทั้งหมด" and "สร้างคอนเทนต์" action buttons.

#### Scenario: ไม่มีปุ่ม ดูเนื้อหาทั้งหมด
- **WHEN** the content dashboard page renders its header (`PageShell`)
- **THEN** there is no "ดูเนื้อหาทั้งหมด" button

#### Scenario: ไม่มีปุ่ม สร้างคอนเทนต์
- **WHEN** the content dashboard page renders its header (`PageShell`)
- **THEN** there is no "สร้างคอนเทนต์" button

### Requirement: เนื้อหาล่าสุดเป็นตารางหลัก
The dashboard SHALL render a single Card titled "เนื้อหาล่าสุด" (Recent Content) in the left column, listing the most recent content items as a multi-line list, without any Tabs.

#### Scenario: แสดงเนื้อหาล่าสุดเรียงตามวันที่สร้าง
- **WHEN** the dashboard loads with `content_items`
- **THEN** the Card lists up to 5 items sorted by `created_at` descending

#### Scenario: แสดงรูปภาพด้านซ้าย
- **WHEN** a recent content item has a `generated_image_url`
- **THEN** the item shows a thumbnail image on the left, stretched to match the height of the item's data area

#### Scenario: Fallback เมื่อไม่มีรูปภาพ
- **WHEN** a recent content item has no `generated_image_url`
- **THEN** the item shows a muted placeholder box with the type icon (from `TYPE_MAP[item.type]`) on the left

#### Scenario: แสดงชื่อ
- **WHEN** a recent content item is rendered
- **THEN** the title appears on its own line

#### Scenario: แสดงประเภทและแพลตฟอร์มในบรรทัดเดียวกัน
- **WHEN** a recent content item is rendered
- **THEN** the type badge (`TYPE_MAP`) and the platform badge (`PLATFORM_MAP`, or "-" when absent) appear on the same line, with the type before the platform

#### Scenario: แสดงสถานะและวันที่สร้างในบรรทัดเดียวกัน
- **WHEN** a recent content item is rendered
- **THEN** the status badge (`STATUS_MAP`) and the creation date (`created_at`) appear on the same line

#### Scenario: จัดแนวรูปภาพสอดคล้องกันทุกแถว
- **WHEN** multiple recent content items are rendered
- **THEN** each item's thumbnail has the same height as its side data area and aligns consistently across all rows

#### Scenario: แสดงข้อความว่างเมื่อไม่มีข้อมูล
- **WHEN** the dashboard loads with no content items
- **THEN** the Card shows an empty-state message "ไม่มีเนื้อหา"

### Requirement: สมดุล Section ซ้าย–ขวา
The content dashboard SHALL keep the left and right columns visually balanced with equal overall height and equal vertical spacing (`space-y-6`) and consistent card header/content padding across both columns.

#### Scenario: ระยะห่างแนวตั้งสม่ำเสมอ
- **WHEN** the master 2-column layout renders
- **THEN** both the left and right columns use the same vertical gap (`space-y-6`) between cards

#### Scenario: หัว Card สูงเท่ากัน
- **WHEN** each Card in both columns renders
- **THEN** every Card uses `CardHeader` with `pb-2` and `CardTitle` with `text-sm font-medium` for consistent header height

#### Scenario: ความสูงรวมของคอลัมน์เท่ากัน
- **WHEN** the dashboard renders on a wide (`xl`) screen
- **THEN** the left column and right column have equal overall height, with sections proportioned so both columns align at the same bottom edge

#### Scenario: ขอบบน–ล่างของ Card align กัน
- **WHEN** the dashboard renders on a wide (`xl`) screen
- **THEN** the first cards of the left and right columns start at the same top edge and the columns align as a balanced, tidy layout
