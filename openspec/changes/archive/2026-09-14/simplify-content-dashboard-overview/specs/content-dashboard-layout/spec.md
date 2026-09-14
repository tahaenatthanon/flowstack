## MODIFIED Requirements

### Requirement: Master layout 2 คอลัมน์บนจอใหญ่
ระบบ SHALL จัดวางเนื้อหาหลักของแท็บ "ภาพรวม" (Overview) เป็น 2 คอลัมน์ตามจุดประสงค์บนจอ `xl` ขึ้นไป โดยคอลัมน์ซ้าย "ต้องดำเนินการ" กว้าง 2/3 (`xl:col-span-2`) แสดง widget ที่ต้องการการตัดสินใจจากผู้อนุมัติ ส่วนคอลัมน์ขวา "ภาพรวม" กว้าง 1/3 (`xl:col-span-1`) แสดง widget ข้อมูลอ้างอิง/สรุปสถานะ

#### Scenario: คอลัมน์ซ้าย (ต้องดำเนินการ)
- **WHEN** ผู้ใช้เข้าถึงแท็บ "ภาพรวม" บนจอกว้าง (`xl` ขึ้นไป)
- **THEN** การ์ด "เผยแพร่ล้มเหลว" และ "คอนเทนต์ค้างท่อ" อยู่ฝั่งซ้าย (`xl:col-span-2`) เรียงตามลำดับนี้

#### Scenario: คอลัมน์ขวา (ภาพรวม)
- **WHEN** ผู้ใช้เข้าถึงแท็บ "ภาพรวม" บนจอกว้าง (`xl` ขึ้นไป)
- **THEN** widget "ความคืบหน้าการผลิต", "คิวเผยแพร่", "กำหนดการโพสต์ถัดไป", และ Card "เนื้อหาล่าสุด" อยู่ฝั่งขวา (`xl:col-span-1`) เรียงตามลำดับนี้ (ไม่มี "รออนุมัติ" — ถูกตัดออก — และไม่มี "สถานะช่องทาง" — ย้ายไปแท็บวิเคราะห์)

#### Scenario: หัวข้อกำกับแต่ละคอลัมน์
- **WHEN** คอลัมน์ซ้ายและขวาของแท็บ "ภาพรวม" ถูก render
- **THEN** แต่ละคอลัมน์มีข้อความหัวข้อกำกับ ("ต้องดำเนินการ" ฝั่งซ้าย, "ภาพรวม" ฝั่งขวา) แสดงด้วย `<h3 className="text-sm font-semibold mb-3">` เหนือการ์ดใบแรกของคอลัมน์นั้น — สไตล์เดียวกับหัวข้อกลุ่มการ์ดใน `BudgetPage.tsx`

### Requirement: เนื้อหาล่าสุดเป็นตารางหลัก
The dashboard SHALL render a single Card titled "เนื้อหาล่าสุด" (Recent Content) in the right column ("ภาพรวม"), listing the most recent content items as a multi-line list, without any Tabs.

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
- **THEN** the type badge (`TYPE_MAP`) and the platform badge appear on the same line, with the type before the platform
- **AND** when the item has at least one platform, the platform badge is rendered via `PlatformBadgeList` (parsed from `platform`/`platforms`, one pill per platform with its own icon/color) — not a raw `PLATFORM_MAP[item.platform]` lookup, which fails to render anything when the item has more than one platform
- **AND** when the item has no platform at all, the placeholder `-` is shown instead (unchanged)

#### Scenario: แสดงสถานะและวันที่สร้างในบรรทัดเดียวกัน
- **WHEN** a recent content item is rendered
- **THEN** the status badge (`STATUS_MAP`) and the creation date (`created_at`) appear on the same line

#### Scenario: จัดแนวรูปภาพสอดคล้องกันทุกแถว
- **WHEN** multiple recent content items are rendered
- **THEN** each item's thumbnail has the same height as its side data area and aligns consistently across all rows

#### Scenario: แสดงข้อความว่างเมื่อไม่มีข้อมูล
- **WHEN** the dashboard loads with no content items
- **THEN** the Card shows an empty-state message "ไม่มีเนื้อหา"

## ADDED Requirements

### Requirement: คอลัมน์ต้องดำเนินการแสดงข้อความว่างรวมเมื่อไม่มีงานค้าง
ระบบ SHALL แสดงข้อความว่างรวมจุดเดียวแทนการ์ด "เผยแพร่ล้มเหลว" และ "คอนเทนต์ค้างท่อ" ที่แยกกันแสดง empty state คนละใบ เมื่อทั้งสองอย่างไม่มีรายการ

#### Scenario: ไม่มีทั้งรายการล้มเหลวและรายการค้างท่อ
- **WHEN** คิวเผยแพร่ไม่มีรายการสถานะ `failed` และไม่มีคอนเทนต์ที่ `status <> 'published'` เลย
- **THEN** คอลัมน์ "ต้องดำเนินการ" แสดงข้อความว่างรวมจุดเดียว (สไตล์เดียวกับข้อความว่างอื่นในหน้านี้: `py-8 text-center text-sm text-muted-foreground`) แทนการแสดงการ์ดว่างแยก 2 ใบ

#### Scenario: มีงานค้างอย่างน้อยหนึ่งอย่าง
- **WHEN** มีรายการ `failed` อย่างน้อย 1 รายการ หรือมีคอนเทนต์ค้างท่ออย่างน้อย 1 รายการ
- **THEN** แสดงการ์ดที่มีข้อมูลตามปกติ ทั้งสองการ์ดไม่ถูกยุบเป็นข้อความรวม
