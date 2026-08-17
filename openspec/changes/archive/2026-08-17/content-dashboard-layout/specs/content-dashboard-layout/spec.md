## MODIFIED Requirements

### Requirement: Master layout 2 คอลัมน์บนจอใหญ่
ระบบ SHALL จัดวางเนื้อหาหลักของแดชบอร์ดคอนเทนต์เป็น 2 คอลัมน์บนจอ `xl` ขึ้นไป โดยคอลัมน์ซ้ายกว้าง 2/3 แสดงข้อมูลวิเคราะห์และตาราง ส่วนคอลัมน์ขวา 1/3 แสดง widget สถานะและงานที่ต้องทำ

#### Scenario: คอลัมน์ซ้าย (วิเคราะห์ + ตาราง)
- **WHEN** ผู้ใช้เข้าถึงแดชบอร์ดคอนเทนต์บนจอกว้าง (`xl` ขึ้นไป)
- **THEN** "ความคืบหน้าการผลิต" และ Card "เนื้อหาล่าสุด" (ตารางเดียว ไม่มี Tabs) อยู่ฝั่งซ้าย (`xl:col-span-2`)

#### Scenario: คอลัมน์ขวา (สถานะ + งานที่ต้องทำ)
- **WHEN** ผู้ใช้เข้าถึงแดชบอร์ดคอนเทนต์บนจอกว้าง (`xl` ขึ้นไป)
- **THEN** widget "คิวรออนุมัติ", "กำหนดการโพสต์ถัดไป", "สถานะช่องทาง", และ "แพลตฟอร์ม" อยู่ฝั่งขวา เรียงตามลำดับนี้

#### Scenario: ลำดับคิวรออนุมัติอยู่บนสุด
- **WHEN** คอลัมน์ขวาถูก render
- **THEN** "คิวรออนุมัติ" เป็น widget แรกสุดของคอลัมน์ขวา

## ADDED Requirements

### Requirement: เนื้อหาล่าสุดเป็นตารางหลัก
The dashboard SHALL render a single Card titled "เนื้อหาล่าสุด" (Recent Content) in the left column, listing the most recent content items as a table, without any Tabs.

#### Scenario: แสดงเนื้อหาล่าสุดเรียงตามวันที่สร้าง
- **WHEN** the dashboard loads with `content_items`
- **THEN** the Card lists up to 5 items sorted by `created_at` descending

#### Scenario: แสดงคอลัมน์ของตาราง
- **WHEN** a recent content item is rendered
- **THEN** it shows title (truncated, expanding column), type badge (`TYPE_MAP`), platform badge (`PLATFORM_MAP` when present, hidden below `md`), and status badge (`STATUS_MAP`)

#### Scenario: แสดงข้อความว่างเมื่อไม่มีข้อมูล
- **WHEN** the dashboard loads with no content items
- **THEN** the Card shows an empty-state message "ไม่มีเนื้อหา"

### Requirement: สมดุล Section ซ้าย–ขวา
The content dashboard SHALL keep the left and right columns visually balanced with equal vertical spacing (`space-y-6`) and consistent card header/content padding across both columns.

#### Scenario: ระยะห่างแนวตั้งสม่ำเสมอ
- **WHEN** the master 2-column layout renders
- **THEN** both the left and right columns use the same vertical gap (`space-y-6`) between cards

#### Scenario: หัว Card สูงเท่ากัน
- **WHEN** each Card in both columns renders
- **THEN** every Card uses `CardHeader` with `pb-2` and `CardTitle` with `text-sm font-medium` for consistent header height

#### Scenario: ขอบบน–ล่างของ Card align กัน
- **WHEN** the dashboard renders on a wide (`xl`) screen
- **THEN** the first cards of the left and right columns start at the same top edge and the columns align as a balanced, tidy layout
