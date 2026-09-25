## MODIFIED Requirements

### Requirement: backend social block คืน per-platform, time-series และ top posts
`api/content-analytics.php` action `?action=analytics` ส่วน `social` SHALL คืนข้อมูลที่คำนวณจากตาราง `content_post_metrics` (dedupe เอาแถว `fetched_at` ล่าสุดต่อ (content_item_id, channel_id/platform_post_id) ตาม cohort `content_items.published_at BETWEEN from AND to` ตามพฤติกรรมเดิม) ได้แก่ ฟิลด์รวม `posts`, `views`, `likes`, `comments`, `shares`, `clicks`, `engagement`, `last_fetched_at`, `has_data` และ:

- `platforms`: อาร์เรย์ของ platform ที่มีข้อมูลจริงใน cohort (`DISTINCT` จากผลจริง) ไม่ hardcode `['facebook','instagram']`
- `by_platform`: อาร์เรย์ `{ platform, posts, views, likes, comments, shares, clicks, engagement }` หนึ่งรายการต่อ platform ที่มีข้อมูล
- `monthly`: อาร์เรย์ `{ month: 'YYYY-MM', posts, views, likes, comments, shares, clicks, engagement }` หนึ่งจุดต่อเดือนตลอดช่วงที่เลือก โดยเดือนที่ไม่มีข้อมูล = 0 (จัดกลุ่มด้วยเดือนของ `published_at` ให้สอดคล้องกับ `throughput`)
- `top_posts`: อาร์เรย์ `{ content_item_id, title, platform, published_at, views, likes, comments, shares, clicks, engagement, video_avg_watch_ms, published_url }` เรียงตาม `engagement` มากไปน้อย จำกัดสูงสุด 10 รายการ โดย `comments`/`shares`/`clicks` เป็น `null` เมื่อยังไม่มีช่องทางใดรายงาน และ `published_url` เป็น permalink จริงจาก `content_items.published_url` (null เมื่อไม่มี)

`engagement` ในทุกระดับ SHALL = `likes` + `comments` + `shares` + `clicks` (ค่า NULL นับเป็น 0) — นิยามเดียวกับแท็บภาพรวม `views` (ยอดเล่นวิดีโอ) SHALL คืนแยกและ SHALL NOT ถูกรวมใน `engagement`

#### Scenario: คืน per-platform breakdown จากข้อมูลจริง
- **WHEN** เรียก `?action=analytics` ในช่วงที่มีเมตริก Facebook อย่างน้อยหนึ่งโพสต์
- **THEN** `social.by_platform` มีรายการของ `facebook` พร้อม `posts`/`views`/`likes`/`comments`/`shares`/`clicks`/`engagement` และ `social.platforms` มี `'facebook'` โดยไม่มี platform ที่ไม่มีข้อมูล

#### Scenario: engagement ไม่รวมวิว
- **GIVEN** cohort มี `views` 32, `likes` 7, `comments` 1, `shares` 0, `clicks` 4
- **WHEN** เรียก `?action=analytics`
- **THEN** `social.engagement` = 12

#### Scenario: monthly series ครอบคลุมทุกเดือนในช่วง
- **WHEN** เรียก `?action=analytics` ด้วยช่วง 12 เดือน
- **THEN** `social.monthly` มี 12 จุด (หนึ่งจุดต่อเดือน) เดือนที่ไม่มีโพสต์ที่วัดได้มีทุกค่าเป็น 0

#### Scenario: top_posts เรียงตาม engagement และมี permalink จริง
- **WHEN** เรียก `?action=analytics` ในช่วงที่มีโพสต์ที่วัดได้หลายรายการ
- **THEN** `social.top_posts` เรียงจาก `engagement` มากไปน้อย จำกัด 10 รายการ และแต่ละรายการมี `published_url` จาก `content_items.published_url` (หรือ null เมื่อไม่มี)

#### Scenario: ไม่มีข้อมูลคืนโครงว่างที่ปลอดภัย
- **WHEN** เรียก `?action=analytics` ในช่วงที่ไม่มีเมตริก FB/IG เลย
- **THEN** `social.has_data` = false, `by_platform` = [], `top_posts` = [], `monthly` มีจุดครบทุกเดือนแต่ค่าเป็น 0 และ `platforms` = []

### Requirement: แท็บโซเชียลแสดง stat card จากข้อมูลจริง
sub-tab "โซเชียล" SHALL แสดง stat card ที่ค่าทุกใบมาจากข้อมูลจริงใน `social` เท่านั้น ได้แก่ "Engagement รวม" (กำกับสูตร "Reaction + Comment + Share + Click"), "Reaction" (`likes`), "Comment", "Share", "Click" และ "ยอดเล่นวิดีโอ" (`views` กำกับว่าแสดงแยก ไม่นับใน Engagement) และแสดงขอบเขตแพลตฟอร์มจาก `social.platforms` พร้อมจำนวนโพสต์ที่วัดได้ (`posts`) ที่หัวส่วน SHALL NOT มีการ์ด Save

#### Scenario: ทุกการ์ดมาจากข้อมูลจริง
- **WHEN** sub-tab "โซเชียล" ถูก render ขณะ `social.has_data` = true
- **THEN** การ์ดทั้ง 6 ใบแสดงค่าจาก `social` ตรง ๆ และหัวส่วนแสดง "ครอบคลุม: <แพลตฟอร์ม> · <posts> โพสต์ที่วัดได้"

#### Scenario: ไม่มีข้อมูลแสดง empty state ไม่ใช่ตัวเลขปลอม
- **WHEN** `social.has_data` = false
- **THEN** การ์ดแสดง "—" และมีข้อความ "ยังไม่มีโพสต์ที่ซิงก์ข้อมูล" อย่างชัดเจน (ไม่แสดง 0 ที่สื่อว่า "ไม่มีคนมีปฏิสัมพันธ์" และไม่แสดงตัวเลขปลอม)

#### Scenario: ไม่มี mock/hardcoded data
- **WHEN** sub-tab "โซเชียล" ถูก render ในทุกสถานะ
- **THEN** ไม่มีตัวเลข, กราฟ หรือรายการที่ไม่ได้มาจาก `social` ที่ backend คืน

### Requirement: แท็บโซเชียลแสดง breakdown รายแพลตฟอร์ม
sub-tab "โซเชียล" SHALL แสดง breakdown ต่อแพลตฟอร์มจาก `social.by_platform` (posts, Reaction, Comment, Share, Click และ engagement) สำหรับแพลตฟอร์มที่มีข้อมูลจริงเท่านั้น

#### Scenario: แสดงเฉพาะแพลตฟอร์มที่มีข้อมูล
- **WHEN** `social.by_platform` มีเฉพาะ `facebook`
- **THEN** ส่วน breakdown แสดงเฉพาะ Facebook ไม่แสดง Instagram หรือแพลตฟอร์มอื่นที่ไม่มีข้อมูล

### Requirement: แท็บโซเชียลแสดงตารางโพสต์เด่น
sub-tab "โซเชียล" SHALL แสดงตารางโพสต์เด่นจาก `social.top_posts` โดยแต่ละแถวแสดงชื่อคอนเทนต์, ป้ายแพลตฟอร์ม, วันเผยแพร่, Reaction, Comment, Share, Click, เล่นวิดีโอ (`views`), ดูเฉลี่ย (`video_avg_watch_ms`), Engagement และลิงก์ไปโพสต์จริงเมื่อมี `published_url`

#### Scenario: แสดงรายโพสต์พร้อมลิงก์จริง
- **WHEN** `social.top_posts` มีรายการที่ `published_url` ไม่ว่าง
- **THEN** แถวนั้นมีลิงก์ที่เปิดโพสต์จริงบนแพลตฟอร์มได้ และแสดงส่วนประกอบและ Engagement ของโพสต์นั้น

#### Scenario: แสดงคลิกและเวลาดูเฉลี่ย
- **WHEN** โพสต์มี `clicks` = 12 และ `video_avg_watch_ms` = 16265
- **THEN** คอลัมน์ "Click" แสดง `12` และคอลัมน์ "ดูเฉลี่ย" แสดง `16.3 วิ`

#### Scenario: ค่าที่ไม่มีแสดงขีด
- **WHEN** `comments`, `shares`, `clicks` หรือ `video_avg_watch_ms` เป็น null
- **THEN** คอลัมน์นั้นแสดง "—" (ไม่แสดง `0`)

#### Scenario: ไม่มีโพสต์แสดงข้อความว่าง
- **WHEN** `social.top_posts` = []
- **THEN** ตารางแสดงข้อความว่าง (ไม่มีแถวปลอม)

### Requirement: แท็บโซเชียลแสดง notice card
sub-tab "โซเชียล" SHALL แสดง notice card ภาษาไทยที่อธิบายตรง ๆ ว่า (1) เมตริกระดับโพสต์มาจาก Facebook Insights ที่ซิงก์อัตโนมัติ และครอบคลุมเฉพาะ **แพลตฟอร์มที่มีข้อมูลจริงในช่วงที่เลือก** (อ่านจากฟิลด์ `platforms` ไม่ hardcode) (2) Engagement = Reaction + Comment + Share + Click (นิยามเดียวกับแท็บภาพรวม) ยอดเล่นวิดีโอแสดงแยกและไม่นับรวม Facebook ไม่เปิดเผย Save ระดับโพสต์ และตัวเลขจาก Insights อาจต่างจากที่เห็นบนหน้าเพจ (3) ข้อมูลระดับเพจมาจาก Facebook Page Insights ที่ระบบเก็บรายวัน ข้อมูลของวันล่าสุดอาจยังไม่ครบเพราะ Facebook ลงข้อมูลย้อนหลัง notice card SHALL ไม่อ้างว่าเมตริกระดับเพจต้องรอการเชื่อมต่อ OAuth

#### Scenario: แสดง notice card อธิบายขอบเขตจากข้อมูลจริง
- **WHEN** ผู้ใช้เปิด sub-tab "โซเชียล"
- **THEN** เห็น notice card ภาษาไทยที่ระบุแพลตฟอร์มที่ครอบคลุมจริงตาม `social.platforms` และเวลาซิงก์ล่าสุด (`social.last_fetched_at`) เมื่อมี

#### Scenario: notice card อธิบายนิยาม Engagement
- **WHEN** notice card ถูก render
- **THEN** อธิบายว่า Engagement = Reaction + Comment + Share + Click และยอดเล่นวิดีโอไม่ถูกนับรวม

#### Scenario: notice card อธิบายที่มาของข้อมูลเพจ
- **WHEN** notice card ถูก render
- **THEN** อธิบายว่าข้อมูลระดับเพจมาจาก Facebook Page Insights และข้อมูลของวันล่าสุดอาจยังไม่ครบ โดยไม่มีข้อความว่าต้องรอ OAuth page insights

## REMOVED Requirements

### Requirement: แท็บโซเชียลแสดง วิว และ ไลก์ แยกกันอย่างตรงไปตรงมา
**Reason**: Engagement ไม่ได้เป็น `views + likes` อีกต่อไป — เปลี่ยนเป็น Reaction + Comment + Share + Click และยอดเล่นวิดีโอแสดงแยกโดยไม่นับรวม (design D9)
**Migration**: การแสดงแยกและการกำกับสูตรย้ายไปอยู่ใน requirement "แท็บโซเชียลแสดง stat card จากข้อมูลจริง" และ notice card; ข้อมูล `views` ยังคืนจาก backend ตามเดิม
