## MODIFIED Requirements

### Requirement: Master layout 2 คอลัมน์บนจอใหญ่
ระบบ SHALL จัดวางเนื้อหาหลักของแท็บ "ภาพรวม" (Overview) เป็น 3 แถวอิสระต่อกันบนจอ `lg` ขึ้นไป โดยแต่ละแถวไม่ผูกความสูงกับแถวอื่น และเลือกอัตราส่วนคอลัมน์ของตัวเอง (1:1 หรือ 2:1) ตามคู่การ์ดที่จับคู่กันในแถวนั้น — แทนที่โครง 2 คอลัมน์ก้อนเดียวครอบทั้ง 6 การ์ดแบบเดิม (ชื่อ requirement คงเดิมไว้เพื่อความต่อเนื่องของ spec history แม้เนื้อหาจะไม่ใช่ "2 คอลัมน์ก้อนเดียว" อีกต่อไป)

#### Scenario: แถว 1 — เผยแพร่ล้มเหลว + คอนเทนต์ค้างท่อ (1:1)
- **WHEN** ผู้ใช้เข้าถึงแท็บ "ภาพรวม" บนจอกว้าง (`lg` ขึ้นไป)
- **THEN** การ์ด "เผยแพร่ล้มเหลว" และ "คอนเทนต์ค้างท่อ" อยู่ในแถวเดียวกัน แบ่งคอลัมน์เท่ากัน (`lg:grid-cols-2`) เรียงตามลำดับนี้

#### Scenario: แถว 2 — เนื้อหาล่าสุด (กว้าง) + ความคืบหน้าการผลิต (แคบ) (2:1)
- **WHEN** ผู้ใช้เข้าถึงแท็บ "ภาพรวม" บนจอกว้าง (`lg` ขึ้นไป)
- **THEN** การ์ด "เนื้อหาล่าสุด" อยู่ฝั่งกว้าง (`lg:col-span-2` ใน `lg:grid-cols-3`) และการ์ด "ความคืบหน้าการผลิต" อยู่ฝั่งแคบ ในแถวถัดจากแถว 1

#### Scenario: แถว 3 — คิวเผยแพร่ + กำหนดการโพสต์ถัดไป (1:1)
- **WHEN** ผู้ใช้เข้าถึงแท็บ "ภาพรวม" บนจอกว้าง (`lg` ขึ้นไป)
- **THEN** การ์ด "คิวเผยแพร่" และ "กำหนดการโพสต์ถัดไป" อยู่ในแถวเดียวกัน แบ่งคอลัมน์เท่ากัน (`lg:grid-cols-2`) ในแถวถัดจากแถว 2 เรียงตามลำดับนี้ (ไม่มี "รออนุมัติ" — ถูกตัดออก — และไม่มี "สถานะช่องทาง" — ย้ายไปแท็บวิเคราะห์)

### Requirement: Responsive ต่ำกว่า xl เป็น stacked column
ระบบ SHALL แสดงทุก section ภายในแท็บ "ภาพรวม" เรียงเป็น column เดียวเมื่อจอต่ำกว่า `lg` และแสดงทุก section ภายในแท็บ "วิเคราะห์" เรียงเป็น column เดียวเมื่อจอต่ำกว่า `xl` (breakpoint ของแท็บภาพรวมเปลี่ยนจาก `xl` เป็น `lg` — ชื่อ requirement คงเดิมไว้เพื่อความต่อเนื่องของ spec history)

#### Scenario: จอแคบไม่ overflow (แท็บภาพรวม)
- **WHEN** ผู้ใช้เข้าถึงแท็บ "ภาพรวม" บนจอต่ำกว่า `lg`
- **THEN** ทุกแถว (แถว 1, 2, 3) กลับเป็น stacked column เดียว (1 คอลัมน์) เรียงตามลำดับการ์ด: เผยแพร่ล้มเหลว, คอนเทนต์ค้างท่อ, เนื้อหาล่าสุด, ความคืบหน้าการผลิต, คิวเผยแพร่, กำหนดการโพสต์ถัดไป — ไม่มี overflow

#### Scenario: จอแคบไม่ overflow (แท็บวิเคราะห์)
- **WHEN** ผู้ใช้เข้าถึงแท็บ "วิเคราะห์" บนจอต่ำกว่า `xl`
- **THEN** ทุก section ในแท็บวิเคราะห์กลับเป็น stacked column เดียว (1 คอลัมน์) ไม่มี overflow

### Requirement: เนื้อหาล่าสุดเป็นตารางหลัก
The dashboard SHALL render a single Card titled "เนื้อหาล่าสุด" (Recent Content) in row 2 (paired with "ความคืบหน้าการผลิต", on the wide side of a 2:1 split), listing the most recent content items as a multi-line list, without any Tabs.

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

### Requirement: สมดุล Section ซ้าย–ขวา
The content dashboard SHALL keep cards within the same row visually consistent — same vertical gap (`gap-6` between rows, `gap-4`–`gap-6` between cards within a row) and consistent card header/content padding across every card, on the overview tab. (ชื่อ requirement คงเดิมไว้เพื่อความต่อเนื่องของ spec history — ขอบเขตเปลี่ยนจาก "สมดุลซ้าย-ขวาทั้งคอลัมน์" เป็น "สมดุลภายในแต่ละแถว")

#### Scenario: ระยะห่างระหว่างแถวสม่ำเสมอ
- **WHEN** the 3-row layout renders
- **THEN** every row uses the same vertical gap between it and the next row

#### Scenario: หัว Card สูงเท่ากัน
- **WHEN** each Card in any row renders
- **THEN** every Card uses `CardHeader` with `pb-2` and `CardTitle` with `text-sm font-medium` for consistent header height

#### Scenario: ไม่บังคับความสูงเท่ากันข้ามแถว
- **WHEN** the dashboard renders on a wide (`lg`) screen
- **THEN** rows are NOT forced to equal overall height with each other — each row's height is determined only by its own two cards, so a taller/shorter row does not leave empty space in an adjacent row

### Requirement: คอลัมน์ต้องดำเนินการแสดงข้อความว่างรวมเมื่อไม่มีงานค้าง
ระบบ SHALL แสดงข้อความว่างรวมจุดเดียวแทนการ์ด "เผยแพร่ล้มเหลว" และ "คอนเทนต์ค้างท่อ" ที่แยกกันแสดง empty state คนละใบ เมื่อทั้งสองอย่างไม่มีรายการ — ครอบเฉพาะแถว 1 (การ์ดทั้งสองใบอยู่แถวเดียวกัน)

#### Scenario: ไม่มีทั้งรายการล้มเหลวและรายการค้างท่อ
- **WHEN** คิวเผยแพร่ไม่มีรายการสถานะ `failed` และไม่มีคอนเทนต์ที่ `status <> 'published'` เลย
- **THEN** แถว 1 แสดงข้อความว่างรวมจุดเดียว (สไตล์เดียวกับข้อความว่างอื่นในหน้านี้: `py-8 text-center text-sm text-muted-foreground`) แทนการแสดงการ์ดว่างแยก 2 ใบ

#### Scenario: มีงานค้างอย่างน้อยหนึ่งอย่าง
- **WHEN** มีรายการ `failed` อย่างน้อย 1 รายการ หรือมีคอนเทนต์ค้างท่ออย่างน้อย 1 รายการ
- **THEN** แสดงการ์ดที่มีข้อมูลตามปกติ ทั้งสองการ์ดไม่ถูกยุบเป็นข้อความรวม
