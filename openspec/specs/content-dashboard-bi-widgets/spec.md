# content-dashboard-bi-widgets Specification

## Purpose

กำหนด endpoint BI (`api/content-analytics.php`) และ widget วิเคราะห์/สถิติ (BI) สำหรับแดชบอร์ดคอนเทนต์ แบ่งเป็น widget ฝั่งแท็บ "ภาพรวม" (สุขภาพคิวเผยแพร่, Funnel การผลิต, คอนเทนต์ค้างท่อ, สถานะสร้างสื่อ AI) และแท็บ "วิเคราะห์" (แนวโน้ม Throughput, Lead time, ความสมบูรณ์ SEO, Plan → Content conversion, อัตราสำเร็จการเผยแพร่)

## Requirements

### Requirement: Endpoint BI ต้อง authenticate และกรอง tenant
ระบบ SHALL มี endpoint `api/content-analytics.php` ที่เรียก `requireAuth()` และกรองทุก query ด้วย `tenant_id` ของผู้ใช้ที่ล็อกอิน (เช่นเดียวกับ `content-items.php`)

#### Scenario: ปฏิเสธคำขอที่ไม่มี token
- **WHEN** มีคำขอไปยัง `content-analytics.php` โดยไม่มี JWT ที่ถูกต้อง
- **THEN** endpoint ตอบ 401 และไม่คืนข้อมูลใด

#### Scenario: กรองข้อมูลตาม tenant
- **WHEN** ผู้ใช้ที่ล็อกอินเรียก `?action=overview` หรือ `?action=analytics`
- **THEN** ทุกตัวเลขที่คืนกลับคำนวณเฉพาะแถวที่ `tenant_id` ตรงกับผู้ใช้ปัจจุบัน

### Requirement: action=overview คืนข้อมูล 4 กลุ่ม
ระบบ SHALL มี `GET /content-analytics.php?action=overview` ที่คืน JSON 4 กลุ่ม: `queue`, `funnel`, `aging`, `assets` โดยแต่ละกลุ่ม aggregate จากคอลัมน์ที่มีอยู่แล้ว ไม่มีการ migration

#### Scenario: response มี 4 กลุ่ม
- **WHEN** เรียก `?action=overview`
- **THEN** response เป็น JSON object ที่มีคีย์ `queue`, `funnel`, `aging`, `assets`

#### Scenario: ค่าจำนวนเป็นตัวเลขเสมอ
- **WHEN** ไม่มีข้อมูลสำหรับกลุ่มใดกลุ่มหนึ่ง
- **THEN** กลุ่มนั้นคืนค่าจำนวน `0` หรือ array ว่างตามโครงสร้าง (ไม่ใช่ `null` หรือ error)

### Requirement: action=analytics คืนข้อมูล 5 กลุ่ม
ระบบ SHALL มี `GET /content-analytics.php?action=analytics` ที่คืน JSON 5 กลุ่ม: `throughput`, `lead_time`, `seo`, `plan_conversion`, `publish_success`

#### Scenario: response มี 5 กลุ่ม
- **WHEN** เรียก `?action=analytics`
- **THEN** response เป็น JSON object ที่มีคีย์ `throughput`, `lead_time`, `seo`, `plan_conversion`, `publish_success`

#### Scenario: ขั้นที่ยังไม่มีข้อมูลคืน null ไม่ใช่ 0
- **WHEN** คำนวณ lead time ของขั้นที่ยังไม่มีรายการที่มี timestamp ครบ
- **THEN** ค่า avg/p50/p90 ของขั้นนั้นเป็น `null` (ไม่ใช่ `0`) พร้อม `sample_size` เป็น `0`

### Requirement: Widget สุขภาพคิวเผยแพร่
แท็บ "ภาพรวม" SHALL แสดง widget "สุขภาพคิวเผยแพร่" ที่นับจำนวนรายการใน `content_publish_queue` แยกตามสถานะ `pending`/`processing`/`sent`/`failed` และจำนวน `pending` ที่เลยกำหนด (`scheduled_at < NOW()`)

#### Scenario: นับตามสถานะ
- **WHEN** แท็บ "ภาพรวม" โหลดและเรียก `?action=overview`
- **THEN** widget แสดงจำนวน `pending`, `processing`, `sent`, `failed` แยกกัน

#### Scenario: นับ pending ที่เลยกำหนดด้วยนิยามเดียวกับ overdue_count
- **WHEN** แท็บ "ภาพรวม" โหลด
- **THEN** จำนวน "เลยกำหนด" ตรงกับนิยาม `status='pending' AND scheduled_at < NOW()` (ค่าเดียวกับ `content-publish.php?action=overdue_count`)

#### Scenario: แสดงรายการ failed พร้อมปุ่มลองส่งใหม่
- **WHEN** มีรายการ `failed` อย่างน้อย 1 รายการ
- **THEN** widget แสดงรายการ failed (error_msg, retry_count, ชื่อคอนเทนต์, ชื่อ channel) และปุ่ม "ลองส่งใหม่" ที่เรียก action `send_now` เดิมของ `api/content-publish.php` (ไม่สร้าง endpoint ใหม่)

### Requirement: Widget Funnel การผลิต
แท็บ "ภาพรวม" SHALL แสดง widget "Funnel การผลิต" ที่นับจำนวนที่ "เคยผ่าน" แต่ละขั้นโดย derive จาก timestamp (`created_at` → `requested_at` → `approved_at` → `published_at`) ไม่ใช่ snapshot ของ `status`

#### Scenario: นับจำนวนที่เคยผ่านแต่ละขั้น
- **WHEN** แท็บ "ภาพรวม" โหลด
- **THEN** widget แสดงจำนวนรายการที่เคยผ่านขั้น สร้าง (`created_at` ไม่ NULL), ขออนุมัติ (`requested_at` ไม่ NULL), อนุมัติ (`approved_at` ไม่ NULL), เผยแพร่ (`published_at` ไม่ NULL)

#### Scenario: คำนวณ % ตกหล่นระหว่างขั้น
- **WHEN** แสดง funnel
- **THEN** widget แสดงเปอร์เซ็นต์การตกหล่น (drop-off) ระหว่างขั้นที่อยู่ติดกัน (เช่น สร้าง→ขออนุมัติ)

#### Scenario: รายการที่เคยอนุมัติแล้วถูกเด้งกลับยังนับว่าผ่านขั้นนั้น
- **WHEN** มีรายการที่ `approved_at` ไม่ NULL แต่ `status` ปัจจุบันไม่ใช่ `approved`
- **THEN** รายการนั้นยังถูกนับในขั้น "อนุมัติ" ของ funnel

### Requirement: Widget คอนเทนต์ค้างท่อ (Aging)
แท็บ "ภาพรวม" SHALL แสดง widget "คอนเทนต์ค้างท่อ" ที่แบ่งรายการที่ `status <> 'published'` ตามช่วงอายุจาก `created_at` (0-7 / 8-30 / 31-90 / 90+ วัน)

#### Scenario: แบ่งช่วงอายุ
- **WHEN** แท็บ "ภาพรวม" โหลด
- **THEN** widget แสดงจำนวนรายการที่ยังไม่เผยแพร่ในแต่ละช่วงอายุ 0-7, 8-30, 31-90, และ 90+ วัน (นับจาก `created_at`)

#### Scenario: แสดงรายการที่เก่าสุด 5 รายการ
- **WHEN** มีรายการค้างท่อ
- **THEN** widget แสดงรายการ 5 รายการที่เก่าสุด (เรียงตาม `created_at` เก่า→ใหม่)

### Requirement: Widget สถานะสร้างสื่อ AI
แท็บ "ภาพรวม" SHALL แสดง widget "สถานะสร้างสื่อ AI" ที่สรุปจำนวนตาม `image_gen_status` และ `video_gen_status` (`none`/`generating`/`done`/`failed`)

#### Scenario: สรุปสถานะภาพ
- **WHEN** แท็บ "ภาพรวม" โหลด
- **THEN** widget แสดงจำนวน `content_items` ตามค่า `image_gen_status` (`none`, `generating`, `done`, `failed`)

#### Scenario: สรุปสถานะวิดีโอ
- **WHEN** แท็บ "ภาพรวม" โหลด
- **THEN** widget แสดงจำนวน `content_items` ตามค่า `video_gen_status` (`none`, `generating`, `done`, `failed`)

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
