## ADDED Requirements

### Requirement: ตัวกรองช่วงวันที่ระดับแท็บวิเคราะห์
แท็บ "วิเคราะห์" SHALL แสดงตัวกรองช่วงวันที่ (Date Range Filter) ที่หัวแท็บ อยู่เหนือ tab bar ระดับที่สอง และใช้ร่วมกันทั้ง 3 sub-tab

#### Scenario: แสดงตัวกรองเหนือ sub-tab
- **WHEN** ผู้ใช้เปิดแท็บ "วิเคราะห์"
- **THEN** ตัวกรองช่วงวันที่แสดงอยู่เหนือ tab bar ระดับที่สอง

#### Scenario: reuse ReportDateFilter component
- **WHEN** แท็บวิเคราะห์ render ตัวกรองช่วงวันที่
- **THEN** ใช้ component `src/components/reports/ReportDateFilter.tsx` เดิม (ไม่เขียน date picker ใหม่)

#### Scenario: default range 12 เดือนย้อนหลัง
- **WHEN** แท็บวิเคราะห์โหลดโดยไม่มีค่า from/to
- **THEN** ตัวกรองแสดงช่วงวันที่ 12 เดือนย้อนหลังถึงวันนี้ (คงพฤติกรรมกราฟ throughput เดิม)

### Requirement: backend รับพารามิเตอร์ from และ to
`api/content-analytics.php?action=analytics` และ `api/brand-content.php?action=result-metrics` SHALL รับ query param `from` และ `to` (รูปแบบ `YYYY-MM-DD`) และใช้เป็นช่วงวันที่ในการกรอง

#### Scenario: validate รูปแบบวันที่
- **WHEN** ค่า `from` หรือ `to` มีรูปแบบไม่ใช่ `YYYY-MM-DD`
- **THEN** endpoint ปฏิเสธด้วย error response (ไม่ใช่ 500) และไม่ประมวลผล

#### Scenario: bind เป็น prepared statement parameter
- **WHEN** endpoint ใช้ค่า from/to ใน SQL
- **THEN** ค่าถูกส่งผ่าน prepared statement parameter เท่านั้น (ไม่ interpolate ลง query string)

#### Scenario: ไม่ส่ง from/to ใช้ default 12 เดือน
- **WHEN** endpoint ถูกเรียกโดยไม่มี from/to
- **THEN** ใช้ช่วง 12 เดือนย้อนหลังถึงปัจจุบันเป็น default

#### Scenario: action=overview ไม่รับ from/to
- **WHEN** เรียก `api/content-analytics.php?action=overview`
- **THEN** endpoint ไม่ผูกช่วงวันที่ (แท็บภาพรวมไม่มีตัวกรอง)

### Requirement: เมตริก respect ช่วงวันที่ vs snapshot
ระบบ SHALL แยกอย่างชัดเจนว่าเมตริกใด respect ช่วงวันที่ที่เลือก และเมตริกใดเป็น snapshot ปัจจุบัน

#### Scenario: เมตริก respect ช่วงวันที่
- **WHEN** ผู้ใช้เปลี่ยนช่วงวันที่
- **THEN** เมตริกต่อไปนี้คำนวณใหม่ตามช่วงวันที่: throughput, lead time, plan conversion, publish success, stat card ทั้ง 4 ใบของแท็บเนื้อหา, และเวลาผลิตเฉลี่ย (กรองด้วย `created_at`/`published_at`/`approved_at` ตามความหมายของแต่ละเมตริก)

#### Scenario: เมตริก snapshot ไม่ผูกช่วงวันที่
- **WHEN** ผู้ใช้เปลี่ยนช่วงวันที่
- **THEN** เมตริกต่อไปนี้คงค่าเดิม (ไม่ผูกช่วงวันที่): ความสมบูรณ์ SEO, ความถี่การโพสต์ 7 วันล่าสุด, เป้าหมาย `weekly_posts_target`, และ best time to post

#### Scenario: widget snapshot มี label กำกับ
- **WHEN** widget ที่เป็น snapshot ถูก render
- **THEN** card แสดง label "ไม่ผูกช่วงวันที่ที่เลือก" ให้ผู้ใช้เห็นชัด

### Requirement: query key แยกตามช่วงวันที่
`useContentAnalytics` และ `useResultMetrics` SHALL ใส่ค่า from/to ลงใน query key เพื่อให้ TanStack Query cache แยกตามช่วงวันที่

#### Scenario: cache แยกตามช่วงวันที่
- **WHEN** ผู้ใช้เปลี่ยนช่วงวันที่แล้วสลับกลับ
- **THEN** แต่ละช่วงวันที่ดึงข้อมูลแยก cache (key มี from/to อยู่ในนั้น)
