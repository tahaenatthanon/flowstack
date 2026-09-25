## MODIFIED Requirements

### Requirement: แท็บโซเชียลแสดงตารางโพสต์เด่น
sub-tab "โซเชียล" SHALL แสดงตารางโพสต์เด่นจาก `social.top_posts` โดยแต่ละแถวแสดงชื่อคอนเทนต์, ป้ายแพลตฟอร์ม, วันเผยแพร่, views, likes, คลิก (`clicks`), ดูเฉลี่ย (`video_avg_watch_ms` แสดงเป็นวินาที), engagement และลิงก์ไปโพสต์จริงเมื่อมี `published_url` backend SHALL คืน `clicks` และ `video_avg_watch_ms` ของแถว `content_post_metrics` ล่าสุดของโพสต์นั้นใน `social.top_posts` (null เมื่อไม่มี) โดยนิยาม `engagement` = `views + likes` คงเดิม

#### Scenario: แสดงรายโพสต์พร้อมลิงก์จริง
- **WHEN** `social.top_posts` มีรายการที่ `published_url` ไม่ว่าง
- **THEN** แถวนั้นมีลิงก์ที่เปิดโพสต์จริงบนแพลตฟอร์มได้ และแสดง views/likes/engagement ของโพสต์นั้น

#### Scenario: แสดงคลิกและเวลาดูเฉลี่ย
- **WHEN** โพสต์มี `clicks` = 12 และ `video_avg_watch_ms` = 16265
- **THEN** คอลัมน์ "คลิก" แสดง `12` และคอลัมน์ "ดูเฉลี่ย" แสดง `16.3 วิ`

#### Scenario: ค่าที่ไม่มีแสดงขีด
- **WHEN** `clicks` หรือ `video_avg_watch_ms` เป็น null
- **THEN** คอลัมน์นั้นแสดง "—" (ไม่แสดง `0`)

#### Scenario: ไม่มีโพสต์แสดงข้อความว่าง
- **WHEN** `social.top_posts` = []
- **THEN** ตารางแสดงข้อความว่าง (ไม่มีแถวปลอม)

### Requirement: แท็บโซเชียลแสดง notice card
sub-tab "โซเชียล" SHALL แสดง notice card ภาษาไทยที่อธิบายตรง ๆ ว่า (1) เมตริก engagement ระดับโพสต์มาจากตาราง time-series `content_post_metrics` และครอบคลุมเฉพาะ **แพลตฟอร์มที่มีข้อมูลจริงในช่วงที่เลือก** (อ่านจากฟิลด์ `platforms` ที่ backend คืนมา ไม่ hardcode) (2) `views`/`likes` แสดงแยกกันและกำกับที่มา (3) ข้อมูลระดับเพจมาจาก Facebook Page Insights ที่ระบบเก็บรายวัน ข้อมูลของวันล่าสุดอาจยังไม่ครบเพราะ Facebook ลงข้อมูลย้อนหลัง notice card SHALL ไม่อ้างว่าเมตริกระดับเพจต้องรอการเชื่อมต่อ OAuth

#### Scenario: แสดง notice card อธิบายขอบเขตจากข้อมูลจริง
- **WHEN** ผู้ใช้เปิด sub-tab "โซเชียล"
- **THEN** เห็น notice card ภาษาไทยที่ระบุแพลตฟอร์มที่ครอบคลุมจริงตาม `social.platforms` และเวลาซิงก์ล่าสุด (`social.last_fetched_at`) เมื่อมี

#### Scenario: notice card อธิบายที่มาของข้อมูลเพจ
- **WHEN** notice card ถูก render
- **THEN** อธิบายว่าข้อมูลระดับเพจมาจาก Facebook Page Insights และข้อมูลของวันล่าสุดอาจยังไม่ครบ โดยไม่มีข้อความว่าต้องรอ OAuth page insights
