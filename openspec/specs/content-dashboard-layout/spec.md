# content-dashboard-layout Specification

## Purpose

กำหนด master layout แบบหลายแถว responsive (อัตราส่วนคอลัมน์ต่อแถว) และลำดับ section ของหน้าแดชบอร์ดคอนเทนต์ (`ContentDashboardPage`)

## Requirements

### Requirement: Master layout 2 คอลัมน์บนจอใหญ่
ระบบ SHALL จัดวางเนื้อหาของแท็บ "ภาพรวม" (Overview) เป็น 6 ส่วนเรียงตามลำดับนี้จากบนลงล่าง: (1) แถบการ์ดสรุป Engagement all-time — เต็มความกว้าง, (2) กราฟแนวโน้ม Engagement ควบคุมด้วยช่วงเวลา 7/30/90 วัน — เต็มความกว้าง, (3) แถว "คิวเผยแพร่ + กำหนดการโพสต์ถัดไป" (1:1) — ย้ายมาอยู่ถัดจากกราฟแนวโน้มโดยตรง, (4) แถว "เผยแพร่ล้มเหลว + คอนเทนต์ค้างท่อ" (1:1), (5) แถว "เนื้อหาล่าสุด + ความคืบหน้าการผลิต" (2:1), (6) ตาราง "ประสิทธิภาพแต่ละแพลตฟอร์ม" ควบคุมด้วยช่วงเวลาวัน/สัปดาห์/เดือน — เต็มความกว้าง อยู่ล่างสุดของหน้า บนจอ `lg` ขึ้นไป แต่ละแถวใน (3)-(5) ไม่ผูกความสูงกับแถวอื่นและเลือกอัตราส่วนคอลัมน์ของตัวเอง (1:1 หรือ 2:1) ตามคู่การ์ดที่จับคู่กันในแถวนั้น (ชื่อ requirement คงเดิมไว้เพื่อความต่อเนื่องของ spec history แม้เนื้อหาจะไม่ใช่ "2 คอลัมน์ก้อนเดียว" อีกต่อไป)

#### Scenario: การ์ดสรุป Engagement อยู่บนสุดของหน้า
- **WHEN** ผู้ใช้เข้าถึงแท็บ "ภาพรวม"
- **THEN** แถบการ์ดสรุป 4 ใบ (Engagement รวม, โพสต์ที่วัดได้, ไลก์รวม, Engagement เฉลี่ย/โพสต์) เป็นสิ่งแรกที่แสดง อยู่เหนือ banner แจ้งเตือนเลยกำหนดและทุก widget operational

#### Scenario: กราฟแนวโน้ม Engagement อยู่ถัดจากการ์ดสรุป
- **WHEN** ผู้ใช้เข้าถึงแท็บ "ภาพรวม"
- **THEN** กราฟแนวโน้ม Engagement แสดงเป็นแถวถัดจากการ์ดสรุป ก่อน banner แจ้งเตือนเลยกำหนดและทุก widget operational

#### Scenario: คิวเผยแพร่ + กำหนดการโพสต์ถัดไป อยู่ถัดจากกราฟแนวโน้ม Engagement (1:1)
- **WHEN** ผู้ใช้เข้าถึงแท็บ "ภาพรวม" บนจอกว้าง (`lg` ขึ้นไป)
- **THEN** การ์ด "คิวเผยแพร่" และ "กำหนดการโพสต์ถัดไป" อยู่ในแถวเดียวกัน แบ่งคอลัมน์เท่ากัน (`lg:grid-cols-2`) ในแถวถัดจากกราฟแนวโน้ม Engagement โดยตรง ก่อน banner แจ้งเตือนเลยกำหนดและ widget operational อื่นทั้งหมด

#### Scenario: เผยแพร่ล้มเหลว + คอนเทนต์ค้างท่อ อยู่ถัดจากแถวคิวเผยแพร่ (1:1)
- **WHEN** ผู้ใช้เข้าถึงแท็บ "ภาพรวม" บนจอกว้าง (`lg` ขึ้นไป)
- **THEN** การ์ด "เผยแพร่ล้มเหลว" และ "คอนเทนต์ค้างท่อ" อยู่ในแถวเดียวกัน แบ่งคอลัมน์เท่ากัน (`lg:grid-cols-2`) เรียงตามลำดับนี้ ถัดจากแถว "คิวเผยแพร่ + กำหนดการโพสต์ถัดไป"

#### Scenario: เนื้อหาล่าสุด (กว้าง) + ความคืบหน้าการผลิต (แคบ) อยู่แถวถัดไป (2:1)
- **WHEN** ผู้ใช้เข้าถึงแท็บ "ภาพรวม" บนจอกว้าง (`lg` ขึ้นไป)
- **THEN** การ์ด "เนื้อหาล่าสุด" อยู่ฝั่งกว้าง (`lg:col-span-2` ใน `lg:grid-cols-3`) และการ์ด "ความคืบหน้าการผลิต" อยู่ฝั่งแคบ ในแถวถัดจากแถว "เผยแพร่ล้มเหลว + คอนเทนต์ค้างท่อ" (ไม่มี "รออนุมัติ" — ถูกตัดออก — และไม่มี "สถานะช่องทาง" — ย้ายไปแท็บวิเคราะห์)

#### Scenario: ตารางประสิทธิภาพแยกแพลตฟอร์มอยู่ล่างสุดของหน้า
- **WHEN** ผู้ใช้เข้าถึงแท็บ "ภาพรวม" บนจอกว้าง (`lg` ขึ้นไป)
- **THEN** ตาราง "ประสิทธิภาพแต่ละแพลตฟอร์ม" แสดงเป็นส่วนสุดท้ายของหน้า ถัดจากแถว "เนื้อหาล่าสุด + ความคืบหน้าการผลิต"

### Requirement: Responsive ต่ำกว่า xl เป็น stacked column
ระบบ SHALL แสดงทุก section ภายในแท็บ "ภาพรวม" เรียงเป็น column เดียวเมื่อจอต่ำกว่า `lg` และแสดงทุก section ภายในแท็บ "วิเคราะห์" เรียงเป็น column เดียวเมื่อจอต่ำกว่า `xl` (breakpoint ของแท็บภาพรวมเปลี่ยนจาก `xl` เป็น `lg` — ชื่อ requirement คงเดิมไว้เพื่อความต่อเนื่องของ spec history)

#### Scenario: จอแคบไม่ overflow (แท็บภาพรวม)
- **WHEN** ผู้ใช้เข้าถึงแท็บ "ภาพรวม" บนจอต่ำกว่า `lg`
- **THEN** ทุก section กลับเป็น stacked column เดียว (1 คอลัมน์) เรียงตามลำดับ: การ์ดสรุป Engagement, กราฟแนวโน้ม Engagement, คิวเผยแพร่, กำหนดการโพสต์ถัดไป, เผยแพร่ล้มเหลว, คอนเทนต์ค้างท่อ, เนื้อหาล่าสุด, ความคืบหน้าการผลิต, ตารางประสิทธิภาพแยกแพลตฟอร์ม — ไม่มี overflow

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
ระบบ SHALL แสดงข้อความว่างรวมจุดเดียวแทนการ์ด "เผยแพร่ล้มเหลว" และ "คอนเทนต์ค้างท่อ" ที่แยกกันแสดง empty state คนละใบ เมื่อทั้งสองอย่างไม่มีรายการ — ครอบเฉพาะแถว "เผยแพร่ล้มเหลว + คอนเทนต์ค้างท่อ" (การ์ดทั้งสองใบอยู่แถวเดียวกัน)

#### Scenario: ไม่มีทั้งรายการล้มเหลวและรายการค้างท่อ
- **WHEN** คิวเผยแพร่ไม่มีรายการสถานะ `failed` และไม่มีคอนเทนต์ที่ `status <> 'published'` เลย
- **THEN** แถว "เผยแพร่ล้มเหลว + คอนเทนต์ค้างท่อ" แสดงข้อความว่างรวมจุดเดียว (สไตล์เดียวกับข้อความว่างอื่นในหน้านี้: `py-8 text-center text-sm text-muted-foreground`) แทนการแสดงการ์ดว่างแยก 2 ใบ

#### Scenario: มีงานค้างอย่างน้อยหนึ่งอย่าง
- **WHEN** มีรายการ `failed` อย่างน้อย 1 รายการ หรือมีคอนเทนต์ค้างท่ออย่างน้อย 1 รายการ
- **THEN** แสดงการ์ดที่มีข้อมูลตามปกติ ทั้งสองการ์ดไม่ถูกยุบเป็นข้อความรวม
