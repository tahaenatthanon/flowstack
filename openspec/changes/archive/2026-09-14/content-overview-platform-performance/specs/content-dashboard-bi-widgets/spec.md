## MODIFIED Requirements

### Requirement: action=overview คืนข้อมูล 7 กลุ่ม
ระบบ SHALL มี `GET /content-analytics.php?action=overview` ที่คืน JSON 7 กลุ่ม: `queue`, `funnel`, `aging`, `assets`, `social_snapshot`, `engagement_trend`, `platform_performance` โดยแต่ละกลุ่ม aggregate จากคอลัมน์ที่มีอยู่แล้ว ไม่มีการ migration — 3 กลุ่มหลังเป็นของใหม่ที่เพิ่มในการเปลี่ยนแปลงนี้ (ดู `content-overview-social-performance` สำหรับพฤติกรรม widget ที่ใช้ข้อมูลเหล่านี้)

#### Scenario: response มี 7 กลุ่ม
- **WHEN** เรียก `?action=overview`
- **THEN** response เป็น JSON object ที่มีคีย์ `queue`, `funnel`, `aging`, `assets`, `social_snapshot`, `engagement_trend`, `platform_performance` ครบ

#### Scenario: ค่าจำนวนเป็นตัวเลขเสมอ
- **WHEN** ไม่มีข้อมูลสำหรับกลุ่มใดกลุ่มหนึ่ง
- **THEN** กลุ่มนั้นคืนค่าจำนวน `0` หรือ array ว่างตามโครงสร้าง (ไม่ใช่ `null` หรือ error)

#### Scenario: social_snapshot มี has_data แยกจากตัวเลข
- **WHEN** เรียก `?action=overview` และยังไม่มีโพสต์ที่ซิงก์ engagement สำเร็จเลย
- **THEN** กลุ่ม `social_snapshot` คืน `has_data: false` พร้อมฟิลด์ตัวเลข (`engagement`, `posts`, `likes`, `avg_engagement_per_post`) เป็น `0`/`null` ตามลำดับ เพื่อให้ frontend แยกแสดง "—" แทน "0" ได้ (`avg_engagement_per_post` เป็น `null` เมื่อ `posts = 0`)

#### Scenario: engagement_trend รับ param range และ auto-bucket
- **WHEN** เรียก `?action=overview&trend_range=7|30|90`
- **THEN** กลุ่ม `engagement_trend` คืน array ของจุดข้อมูล engagement โดย bucket ตาม range: `7` = รายวัน (7 จุด), `30` = รายสัปดาห์ (rolling 7 วัน), `90` = รายเดือน (rolling 30 วัน) — ค่า default เมื่อไม่ส่ง param คือ `7`

#### Scenario: platform_performance รับ param period และรวมแพลตฟอร์มที่ไม่มีโพสต์
- **WHEN** เรียก `?action=overview&platform_period=day|week|month`
- **THEN** กลุ่ม `platform_performance` คืน array ที่ครอบคลุมทุกแพลตฟอร์มใน `publish_channels` ที่ `is_active=1` ของ tenant (ไม่ใช่เฉพาะแพลตฟอร์มที่มีโพสต์ในช่วงที่เลือก) โดย `period=day` นับเฉพาะวันนี้, `week` นับย้อนหลัง 7 วัน, `month` นับย้อนหลัง 30 วัน (rolling ทั้งหมด, ไม่ใช่ปฏิทิน) — ค่า default เมื่อไม่ส่ง param คือ `day`

#### Scenario: platform_performance แต่ละแถวมี avg_engagement_per_post ป้องกันหารศูนย์
- **WHEN** แพลตฟอร์มหนึ่งในผลลัพธ์ `platform_performance` มี `posts = 0` ในช่วงที่เลือก
- **THEN** ฟิลด์ `avg_engagement_per_post` ของแถวนั้นเป็น `null` (ไม่ใช่ `0` หรือหารด้วยศูนย์)
