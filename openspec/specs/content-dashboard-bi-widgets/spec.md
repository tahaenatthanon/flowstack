# content-dashboard-bi-widgets Specification

## Purpose

กำหนด endpoint BI (`api/content-analytics.php`) และ widget วิเคราะห์/สถิติ (BI) สำหรับแดชบอร์ดคอนเทนต์ — payload ของ `?action=overview` (เนื้อหาแท็บ "ภาพรวม" กำหนดใน `content-overview-bi`) และ widget ของแท็บ "วิเคราะห์" (แนวโน้ม Throughput, Lead time, ความสมบูรณ์ SEO, Plan → Content conversion, อัตราสำเร็จการเผยแพร่)

## Requirements

### Requirement: Endpoint BI ต้อง authenticate และกรอง tenant
ระบบ SHALL มี endpoint `api/content-analytics.php` ที่เรียก `requireAuth()` และกรองทุก query ด้วย `tenant_id` ของผู้ใช้ที่ล็อกอิน (เช่นเดียวกับ `content-items.php`)

#### Scenario: ปฏิเสธคำขอที่ไม่มี token
- **WHEN** มีคำขอไปยัง `content-analytics.php` โดยไม่มี JWT ที่ถูกต้อง
- **THEN** endpoint ตอบ 401 และไม่คืนข้อมูลใด

#### Scenario: กรองข้อมูลตาม tenant
- **WHEN** ผู้ใช้ที่ล็อกอินเรียก `?action=overview` หรือ `?action=analytics`
- **THEN** ทุกตัวเลขที่คืนกลับคำนวณเฉพาะแถวที่ `tenant_id` ตรงกับผู้ใช้ปัจจุบัน

### Requirement: action=overview คืนข้อมูล 7 กลุ่ม
ระบบ SHALL มี `GET /content-analytics.php?action=overview` ที่คืนข้อมูลของแท็บภาพรวมจากข้อมูลทั้งหมดตามที่กำหนดใน `content-overview-bi` (ไม่มีพารามิเตอร์ช่วงเวลาและไม่มีค่าเปรียบเทียบ) ได้แก่ `kpi`, `funnel`, `status_summary`, `unpublished_aging`, `publishing_health`, `schedule_summary`, `engagement_trend`, `platform_performance` (ชื่อ requirement คงเดิมเพื่อความต่อเนื่อง แต่ไม่ได้จำกัดที่ 7 กลุ่มอีกต่อไป) กลุ่ม `queue`, `aging`, `social_snapshot`, `page_summary`, `assets`, `engagement_trend` แบบ 7/30/90, `platform_performance` แบบ rolling วัน/สัปดาห์/เดือน และ `funnel` แบบนับเฉพาะ timestamp SHALL NOT ถูกคืน พารามิเตอร์ `trend_range` และ `platform_period` ไม่ถูกใช้

#### Scenario: response มีกลุ่มครบ
- **WHEN** เรียก `?action=overview`
- **THEN** response มีคีย์ `kpi`, `funnel`, `status_summary`, `unpublished_aging`, `publishing_health`, `schedule_summary`, `engagement_trend`, `platform_performance` ครบ และไม่มีคีย์ `queue` หรือ `aging`

#### Scenario: ค่าที่ไม่มีข้อมูลเป็น null
- **WHEN** ค่าใดไม่มีข้อมูล (เช่น Avg/Post เมื่อไม่มีโพสต์ที่วัดได้ หรือ Success Rate เมื่อไม่มีรายการจบ)
- **THEN** ค่านั้นเป็น `null` ไม่ใช่ `0` ส่วนจำนวนนับ (count) ที่เป็นศูนย์จริงคืน `0`

### Requirement: action=analytics คืนข้อมูล 5 กลุ่ม
ระบบ SHALL มี `GET /content-analytics.php?action=analytics` ที่คืน JSON 5 กลุ่ม: `throughput`, `lead_time`, `seo`, `plan_conversion`, `publish_success`

#### Scenario: response มี 5 กลุ่ม
- **WHEN** เรียก `?action=analytics`
- **THEN** response เป็น JSON object ที่มีคีย์ `throughput`, `lead_time`, `seo`, `plan_conversion`, `publish_success`

#### Scenario: ขั้นที่ยังไม่มีข้อมูลคืน null ไม่ใช่ 0
- **WHEN** คำนวณ lead time ของขั้นที่ยังไม่มีรายการที่มี timestamp ครบ
- **THEN** ค่า avg/p50/p90 ของขั้นนั้นเป็น `null` (ไม่ใช่ `0`) พร้อม `sample_size` เป็น `0`

### Requirement: Widget แนวโน้ม Throughput รายเดือน
sub-tab "เนื้อหา" ของแท็บ "วิเคราะห์" SHALL แสดง widget "แนวโน้ม Throughput รายเดือน" เป็นกราฟ (recharts) ย้อนหลัง 12 เดือน มี 4 เส้น: สร้าง / ขออนุมัติ / อนุมัติ / เผยแพร่ โดยแต่ละเมตริกนับในเดือนของ timestamp ตัวเอง และ respect ช่วงวันที่จากตัวกรอง (default 12 เดือน)

#### Scenario: 4 เส้นต่อเดือนครบ
- **WHEN** sub-tab "เนื้อหา" โหลดและเรียก `?action=analytics`
- **THEN** กราฟแสดง 4 เส้น (สร้าง/ขออนุมัติ/อนุมัติ/เผยแพร่) บนแกนเวลา 12 เดือนย้อนหลัง

#### Scenario: แกนเวลาหนาแน่น
- **WHEN** บางเดือนไม่มีข้อมูล (0 รายการ)
- **THEN** เดือนนั้นยังปรากฏบนแกนเวลาด้วยค่า 0 (ไม่ถูกข้าม)

#### Scenario: respect ช่วงวันที่ที่เลือก
- **WHEN** ผู้ใช้เปลี่ยนช่วงวันที่เป็นช่วงที่สั้นลง
- **THEN** กราฟคำนวณใหม่จากรายการที่ timestamp อยู่ในช่วงวันที่นั้น

### Requirement: Widget แพลตฟอร์มเป็น Donut Chart
sub-tab "เนื้อหา" SHALL แสดง widget "แพลตฟอร์ม" เป็น Donut Chart (recharts `PieChart` พร้อม `innerRadius`) แทน list เดิม พร้อม legend และคงสี platform จาก `getPlatformColors()` ใน `src/lib/platformConfig.ts`

#### Scenario: แสดง Donut Chart
- **WHEN** sub-tab "เนื้อหา" โหลดและมี `content_items`
- **THEN** widget "แพลตฟอร์ม" แสดง PieChart แบบ donut (มี innerRadius) แทนรายการ list

#### Scenario: ใช้สี platform จาก getPlatformColors
- **WHEN** แสดง donut chart
- **THEN** แต่ละ slice ใช้สีจาก `getPlatformColors(platform)`

#### Scenario: แสดง legend
- **WHEN** แสดง donut chart
- **THEN** แสดง legend ระบุชื่อและจำนวนของแต่ละแพลตฟอร์ม

#### Scenario: แสดง empty state
- **WHEN** ไม่มี `content_items`
- **THEN** widget แสดง empty-state message

### Requirement: Widget Lead time แยกตามขั้น
แท็บ "วิเคราะห์" SHALL แสดง widget "Lead time แยกตามขั้น" ที่แสดง avg / p50 / p90 (ชั่วโมง) ของ สร้าง→ขออนุมัติ, ขออนุมัติ→อนุมัติ, อนุมัติ→เผยแพร่, และ สร้าง→เผยแพร่ (รวม) พร้อม sample size ต่อขั้น

#### Scenario: แสดง avg/p50/p90 ต่อขั้น
- **WHEN** แท็บ "วิเคราะห์" โหลด
- **THEN** widget แสดง avg, p50, p90 (ชั่วโมง) ของแต่ละขั้น พร้อม sample size

#### Scenario: percentile คำนวณใน PHP
- **WHEN** คำนวณ p50/p90
- **THEN** ใช้การคำนวณ percentile ใน PHP (ไม่ใช่ `PERCENTILE_CONT` ของ SQL) เพื่อไม่ผูกกับเวอร์ชัน MariaDB

#### Scenario: ขั้นที่ไม่มีข้อมูลคืน null
- **WHEN** ขั้นใดไม่มีรายการที่มี timestamp ครบ
- **THEN** avg/p50/p90 ของขั้นนั้นเป็น `null` (ไม่ใช่ 0) และ sample size เป็น 0

### Requirement: Widget ความสมบูรณ์ SEO
แท็บ "วิเคราะห์" SHALL แสดง widget "ความสมบูรณ์ SEO" ที่แสดง % ของบทความ (`type='article'`) ที่มีค่าในแต่ละฟิลด์ (`article_content`, `seo_title`, `slug`, `meta_description`, `meta_keywords`, `og_image`) และแสดงเกณฑ์ `seo_gate_enabled` / `seo_gate_min_score` ที่บังคับใช้อยู่

#### Scenario: คำนวณ % ต่อฟิลด์
- **WHEN** แท็บ "วิเคราะห์" โหลด
- **THEN** widget แสดงเปอร์เซ็นต์ของบทความที่มีค่าครบ (ไม่ว่าง/ไม่ NULL) ในแต่ละฟิลด์ SEO ทั้ง 6 ฟิลด์

#### Scenario: แสดงเกณฑ์เกต SEO
- **WHEN** `content_global_settings.seo_gate_enabled` = 1
- **THEN** widget แสดงสถานะเกตที่บังคับใช้ (`seo_gate_enabled`) และคะแนนขั้นต่ำ (`seo_gate_min_score`)

### Requirement: Widget Plan → Content conversion
แท็บ "วิเคราะห์" SHALL แสดง widget "Plan → Content conversion" ที่แยกตาม `plan_type` แสดงจำนวนแผน, plan items, จำนวนที่แปลงเป็นคอนเทนต์ (`plan_item_id` ไม่ NULL), จำนวนที่เผยแพร่, และ % การแปลง พร้อมจำนวนคอนเทนต์ที่สร้างนอกแผน (`plan_item_id IS NULL`)

#### Scenario: แยกตาม plan_type
- **WHEN** แท็บ "วิเคราะห์" โหลด
- **THEN** widget แสดงตารางแยกตาม `plan_type` (`weekly`/`monthly`/`quarterly`/`yearly`) พร้อมจำนวนแผนและ % การแปลง

#### Scenario: นับคอนเทนต์นอกแผน
- **WHEN** มี `content_items` ที่ `plan_item_id IS NULL`
- **THEN** widget แสดงจำนวนคอนเทนต์ที่สร้างนอกแผนแยกออกมา

### Requirement: Widget อัตราสำเร็จการเผยแพร่เป็น Bar Chart
sub-tab "เนื้อหา" SHALL แสดง widget "อัตราสำเร็จการเผยแพร่" เป็น Bar Chart (recharts `BarChart` แบบ stacked `sent`/`failed`) แยกตามแพลตฟอร์ม แทน Progress bar เดิม พร้อม error ที่พบบ่อยสุดต่อแพลตฟอร์ม

#### Scenario: แสดง Bar Chart stacked sent/failed
- **WHEN** sub-tab "เนื้อหา" โหลดและมีรายการเผยแพร่
- **THEN** widget แสดง BarChart แบบ stacked แยก `sent` และ `failed` ต่อแพลตฟอร์ม

#### Scenario: แสดง error ที่พบบ่อย
- **WHEN** แพลตฟอร์มมีรายการ failed
- **THEN** widget แสดง error ที่พบบ่อยสุดของแพลตฟอร์มนั้น

#### Scenario: success rate เป็น null เมื่อยังไม่มีรายการจบ
- **WHEN** แพลตฟอร์มยังไม่มีรายการที่จบ (`sent` หรือ `failed`)
- **THEN** success rate ของแพลตฟอร์มนั้นเป็น `null` (คิวที่ยังไม่เคยส่ง ≠ 0%)

#### Scenario: รองรับ platform ที่เป็นสตริงว่าง
- **WHEN** มีแถว `publish_channels` ที่ `platform` เป็นสตริงว่าง
- **THEN** query ใช้ `NULLIF(platform, '')` เพื่อไม่ให้แถวนั้นถูกจับกลุ่มผิด (จัดเป็น "ไม่ระบุแพลตฟอร์ม")

### Requirement: Widget ทุกตัวมี empty state
widget BI ทุกตัว SHALL แสดง empty state ที่ชัดเจนเมื่อไม่มีข้อมูล (ยกเว้นการ์ด engagement ที่ต้องแสดง 0 ตาม spec `content-dashboard-stats`)

#### Scenario: แสดง empty state ไม่ใช่ตัวเลขที่ทำให้เข้าใจผิด
- **WHEN** widget ใดไม่มีข้อมูล (เช่น funnel มี 0 ทุกขั้น หรือ publish_success ไม่มีแพลตฟอร์ม)
- **THEN** widget แสดงข้อความ empty state ที่ชัดเจนเป็นภาษาไทย แทนการแสดงตัวเลขที่อาจทำให้เข้าใจผิด
