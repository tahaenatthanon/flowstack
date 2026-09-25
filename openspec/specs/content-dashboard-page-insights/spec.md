# content-dashboard-page-insights Specification

## Purpose

API `?action=page_insights` และส่วนแสดงผลข้อมูลระดับเพจ Facebook 5 ส่วนใน sub-tab "วิเคราะห์ › โซเชียล" โดยรวมค่าตามความหมายของแต่ละ metric (ยอดสะสมใช้ค่าล่าสุด ไม่ sum)

## Requirements

### Requirement: API page_insights คืนข้อมูลเพจตามช่วงวันที่
`api/content-analytics.php?action=page_insights&from=YYYY-MM-DD&to=YYYY-MM-DD` SHALL คืนข้อมูลจาก `facebook_page_insights_daily` ของ tenant ของผู้ใช้เท่านั้น ประกอบด้วย `has_data`, `last_fetched_at`, `totals` (ค่ารวมของช่วงต่อ metric) และ `daily` (ค่ารายวันต่อ metric ทุกวันในช่วง วันที่ไม่มีข้อมูล = null) โดยรวมค่าตามชนิดของ metric ดังนี้:
- **ยอดสะสม** (`page_follows`): ใช้ค่าของวันล่าสุดในช่วงที่มีข้อมูล และคืนค่าของวันแรกในช่วงด้วยเพื่อคำนวณการเปลี่ยนแปลง ห้าม sum
- **object** (`page_actions_post_reactions_total`): รวมค่าแยกตามชนิด reaction ข้ามวัน
- **unique รายวัน** (`page_total_media_view_unique`): ไม่คืนค่ารวมของช่วง (คืนเฉพาะรายวัน)
- **อื่น ๆ ทั้งหมด:** sum ข้ามวัน
- `page_video_view_time` คืนหน่วยมิลลิวินาทีตามต้นทาง

#### Scenario: ผู้ติดตามใช้ค่าล่าสุดไม่ sum
- **GIVEN** `page_follows` มีค่า 2 ทุกวันตลอด 28 วัน
- **WHEN** เรียก API ด้วยช่วง 28 วันนั้น
- **THEN** `totals.page_follows` = 2 (ไม่ใช่ 56)

#### Scenario: ข้อมูลแยก tenant
- **WHEN** ผู้ใช้ของ tenant A เรียก API
- **THEN** ไม่มีข้อมูลของ tenant อื่นปนมา

#### Scenario: ยังไม่มีข้อมูล
- **WHEN** tenant ยังไม่มีแถวใน `facebook_page_insights_daily`
- **THEN** คืน `has_data: false` และ HTTP 200 (ไม่ error)

### Requirement: sub-tab โซเชียลแสดงส่วนข้อมูลระดับเพจ 5 ส่วน
sub-tab "วิเคราะห์ › โซเชียล" SHALL แสดงข้อมูลระดับเพจตามช่วงวันที่เดียวกับตัวกรองของแท็บวิเคราะห์ แบ่ง 5 ส่วน ใช้เฉพาะ **ชุด metric แบบสั้น** และข้อความทั้งหมดเป็นภาษาไทย:
1. **ภาพรวมเพจ:** การ์ด "ผู้ติดตาม" (`page_follows`), "เข้าชมเพจ" (`page_views_total`), "การดูสื่อ" (`page_media_view`)
2. **ผู้ติดตาม:** กราฟรายวันของ follow (`page_daily_follows`) และ unfollow (`page_daily_unfollows`)
3. **Reaction:** reaction รวม (`page_actions_post_reactions_total`) และแยกชนิด Like / Love / Wow / Haha (`_like_total`, `_love_total`, `_wow_total`, `_haha_total`)
4. **วิดีโอ — จำนวนการดู:** การดูทั้งหมด (`page_video_views`) แยก Organic (`_organic`) / Paid (`_paid`)
5. **วิดีโอ — ระยะเวลาการดู:** เวลาดูรวม (`page_video_view_time`) แสดงเป็นนาทีหรือชั่วโมง ไม่แสดงเป็นมิลลิวินาที

#### Scenario: แสดงครบ 5 ส่วน
- **WHEN** ผู้ใช้เปิด sub-tab "โซเชียล" และ `has_data` = true
- **THEN** เห็นทั้ง 5 ส่วนตามลำดับข้างต้น

#### Scenario: เปลี่ยนช่วงวันที่
- **WHEN** ผู้ใช้เปลี่ยนตัวกรองช่วงวันที่ของแท็บวิเคราะห์
- **THEN** ข้อมูลทั้ง 5 ส่วนโหลดใหม่ตามช่วงที่เลือก

#### Scenario: การ์ดผู้ติดตามแสดงการเปลี่ยนแปลง
- **WHEN** การ์ด "ผู้ติดตาม" render
- **THEN** แสดงยอดล่าสุดพร้อมผลต่างเทียบกับวันแรกของช่วง (เช่น "+3" หรือ "−1")

#### Scenario: เวลาดูวิดีโอแปลงหน่วย
- **WHEN** `page_video_view_time` รวม = 292773 ms
- **THEN** แสดงเป็น "4.9 นาที" (หรือหน่วยชั่วโมงเมื่อเกิน 60 นาที)

#### Scenario: ยังไม่มีข้อมูลเพจ
- **WHEN** `has_data` = false
- **THEN** แสดงข้อความภาษาไทยว่ายังไม่มีข้อมูลเพจและระบบจะเริ่มเก็บหลังงานซิงก์รอบแรก แทนการแสดงเลข 0

#### Scenario: ส่วน Reaction ไม่มี reaction ในช่วง
- **WHEN** reaction รวมของช่วงเท่ากับ 0
- **THEN** ส่วน Reaction แสดงข้อความว่างภาษาไทย ไม่วาดกราฟว่าง
