# content-dashboard-analytics Specification

## Purpose

แสดงข้อมูลเชิง insight ในแท็บ "วิเคราะห์" ของแดชบอร์ดคอนเทนต์ — widget "เนื้อหายอดนิยม" (Top Content) และ "เวลาที่ดีที่สุดในการโพสต์" (Best Time Analytics)

## Requirements

### Requirement: แสดงเนื้อหายอดนิยม (Top Content)
The "เนื้อหา" sub-tab of the "วิเคราะห์" (Analytics) tab SHALL display a "เนื้อหายอดนิยม" widget listing the top content items ordered by an engagement score (`views + likes * 2`) descending, limited to the top 5 items.

#### Scenario: แสดง top 5 เรียงตาม engagement score
- **WHEN** the "เนื้อหา" sub-tab loads with `content_items`
- **THEN** the widget lists up to 5 items sorted by `Number(views) + Number(likes) * 2` descending

#### Scenario: แสดงชื่อ ยอดวิว และยอดไลก์
- **WHEN** a top content item is rendered
- **THEN** it shows the item title, its `views`, and its `likes`

#### Scenario: แสดงข้อความว่างเมื่อไม่มีข้อมูล
- **WHEN** the "เนื้อหา" sub-tab loads with no content items
- **THEN** the widget shows an empty-state message

### Requirement: แสดงเวลาที่ดีที่สุดในการโพสต์
The "เนื้อหา" sub-tab of the "วิเคราะห์" tab SHALL display the "เวลาที่ดีที่สุดในการโพสต์" widget using the existing `BestTimeAnalyticsPanel` component (`src/components/content/BestTimeAnalyticsPanel.tsx`) fed by `usePostingAnalytics()`.

#### Scenario: แสดง panel เวลาโพสต์ดีที่สุด
- **WHEN** the "เนื้อหา" sub-tab loads
- **THEN** it renders `BestTimeAnalyticsPanel` with the posting analytics data

#### Scenario: แสดง empty-state เมื่อข้อมูลไม่พอ
- **WHEN** `usePostingAnalytics()` returns `has_data: false`
- **THEN** the panel shows its empty-state message ("ยังไม่มีข้อมูลเพียงพอ รออย่างน้อย 10 โพสต์เพื่อเริ่มวิเคราะห์")

#### Scenario: ปุ่มคำนวณใหม่
- **WHEN** the user clicks the "คำนวณตอนนี้" button in the panel
- **THEN** the panel triggers the `analytics-recalculate` action (via `useRecalculateAnalytics()`) and refetches the analytics data

### Requirement: โหลดข้อมูลวิเคราะห์เฉพาะเมื่อเปิดแท็บวิเคราะห์
The `usePostingAnalytics` query SHALL be enabled only while the "วิเคราะห์" tab is active, so the `analytics-posting-times` request is not fired when the dashboard is on the "ภาพรวม" tab.

#### Scenario: ไม่โหลดเมื่ออยู่แท็บภาพรวม
- **WHEN** the dashboard is on the "ภาพรวม" tab
- **THEN** `usePostingAnalytics` is disabled and no `analytics-posting-times` request is made

#### Scenario: โหลดเมื่อเปิดแท็บวิเคราะห์
- **WHEN** the user switches to the "วิเคราะห์" tab
- **THEN** `usePostingAnalytics` is enabled and fetches `analytics-posting-times`

### Requirement: analytics-recalculate จัดกลุ่มด้วย published_at
`analytics-recalculate` (`api/brand-content.php`) SHALL จัดกลุ่มข้อมูล "เวลาโพสต์ที่ดีที่สุด" ด้วย `published_at` (ไม่ใช่ `created_at`) เพราะกำลังหาเวลาที่ *โพสต์* แล้วได้ engagement ดี ไม่ใช่เวลาที่ *สร้างดราฟต์*

#### Scenario: จัดกลุ่มตามวัน/ชั่วโมงที่เผยแพร่จริง
- **WHEN** เรียก `?action=analytics-recalculate` เมื่อมีคอนเทนต์ `published` เพียงพอ
- **THEN** ผลลัพธ์ `content_posting_analytics` ใช้ `DAYOFWEEK(published_at)` และ `HOUR(published_at)` ในการจัดกลุ่ม

#### Scenario: คอนเทนต์ที่เผยแพร่ช้ากว่าสร้างไม่ถูกนับผิดกลุ่ม
- **GIVEN** คอนเทนต์สร้างตอน 09:00 แต่เผยแพร่จริงตอน 20:00
- **WHEN** เรียก `analytics-recalculate`
- **THEN** แถวของคอนเทนต์นั้นถูกนับในกลุ่มชั่วโมง 20 (จาก `published_at`) ไม่ใช่ 09 (จาก `created_at`)

### Requirement: เกต ≥10 published รายงานจำนวนที่ขาด
เมื่อเรียก `analytics-recalculate` แล้วคอนเทนต์ `published` ยังไม่ถึง 10 รายการ ระบบ SHALL ตอบด้วยข้อความที่ระบุจำนวนที่ยังขาด เพื่อให้ผู้ใช้รู้ว่าต้องเผยแพร่เพิ่มอีกกี่ชิ้น

#### Scenario: บอกจำนวนที่ขาด
- **GIVEN** มีคอนเทนต์ `published` 3 รายการ
- **WHEN** เรียก `analytics-recalculate`
- **THEN** ตอบ error ที่ระบุว่าขาดอีก 7 รายการ (ไม่ใช่แค่ "Need at least 10 published posts")
