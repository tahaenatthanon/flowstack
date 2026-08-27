## MODIFIED Requirements

### Requirement: แท็บโซเชียลแสดง notice card
sub-tab "โซเชียล" SHALL แสดง notice card ภาษาไทยที่อธิบายตรง ๆ ว่า (1) เมตริก engagement ที่แสดงมาจากตาราง time-series `content_post_metrics` และครอบคลุมเฉพาะ **แพลตฟอร์มที่มีข้อมูลจริงในช่วงที่เลือก** (อ่านจากฟิลด์ `platforms` ที่ backend คืนมา ไม่ hardcode) (2) `views`/`likes` แสดงแยกกันและกำกับที่มา (3) เมตริกระดับเพจ — ผู้ติดตาม (followers), Reach, Impressions, Engagement Rate — **ยังไม่แสดง** เพราะต้องเชื่อมต่อ OAuth page insights (Facebook Graph / Instagram) ซึ่งเป็นงาน integration เฟสถัดไป notice card SHALL ไม่กล่าวอ้างว่าเมตริกเหล่านั้น "กำลังจะมา" ในเฟสนี้

#### Scenario: แสดง notice card อธิบายขอบเขตจากข้อมูลจริง
- **WHEN** ผู้ใช้เปิด sub-tab "โซเชียล"
- **THEN** เห็น notice card ภาษาไทยที่ระบุแพลตฟอร์มที่ครอบคลุมจริงตาม `social.platforms` และเวลาซิงก์ล่าสุด (`social.last_fetched_at`) เมื่อมี

#### Scenario: notice card ไม่กล่าวถึงการ์ดที่ถูกถอดออกเป็นเมตริกที่กำลังจะมี
- **WHEN** notice card ถูก render
- **THEN** อธิบายว่าเมตริกระดับเพจต้องรอ OAuth page insights (integration เฟสถัดไป) โดยไม่สัญญาว่าจะมาในเฟสนี้

## REMOVED Requirements

### Requirement: แท็บโซเชียลแสดง stat card 4 ใบแบบ placeholder
**Reason**: การ์ด em dash 3 ใบ (ผู้ติดตามรวม, Reach รวม, Engagement Rate) เป็นเมตริกระดับเพจที่ไม่มีแหล่งข้อมูลและต้องรอ Facebook app review + OAuth page insights ซึ่งยังไม่มีกำหนด — การคงการ์ดว่างไว้กินพื้นที่ครึ่งหน้าและสื่อผิดว่ากำลังจะมีข้อมูล แทนที่ด้วยชุด widget ที่คำนวณจากข้อมูลจริงใน `content_post_metrics`
**Migration**: พฤติกรรมใหม่อยู่ในข้อกำหนดที่เพิ่มด้านล่าง — "แท็บโซเชียลแสดง stat card จากข้อมูลจริง", "แท็บโซเชียลแสดงกราฟแนวโน้ม engagement รายเดือน", "แท็บโซเชียลแสดง breakdown รายแพลตฟอร์ม", "แท็บโซเชียลแสดงตารางโพสต์เด่น" และ "backend social block คืน per-platform, time-series และ top posts" การ์ด "Engagement รวม" ที่แสดงข้อมูลจริงอยู่แล้วถูกยกไปเป็นส่วนหนึ่งของ stat card ชุดใหม่

## ADDED Requirements

### Requirement: backend social block คืน per-platform, time-series และ top posts
`api/content-analytics.php` action `?action=analytics` ส่วน `social` SHALL คืนข้อมูลที่คำนวณจากตาราง `content_post_metrics` (dedupe เอาแถว `fetched_at` ล่าสุดต่อ (content_item_id, channel_id/platform_post_id) ตาม cohort `content_items.published_at BETWEEN from AND to` ตามพฤติกรรมเดิม) โดยเพิ่มฟิลด์ต่อไปนี้ **โดยไม่ลบฟิลด์รวมเดิม** (`posts`, `views`, `likes`, `engagement`, `last_fetched_at`, `has_data`):

- `platforms`: อาร์เรย์ของ platform ที่มีข้อมูลจริงใน cohort (`DISTINCT` จากผลจริง) ไม่ hardcode `['facebook','instagram']`
- `by_platform`: อาร์เรย์ `{ platform, posts, views, likes, engagement }` หนึ่งรายการต่อ platform ที่มีข้อมูล
- `monthly`: อาร์เรย์ `{ month: 'YYYY-MM', posts, views, likes, engagement }` หนึ่งจุดต่อเดือนตลอดช่วงที่เลือก โดยเดือนที่ไม่มีข้อมูล = 0 (จัดกลุ่มด้วยเดือนของ `published_at` ให้สอดคล้องกับ `throughput`)
- `top_posts`: อาร์เรย์ `{ content_item_id, title, platform, published_at, views, likes, engagement, published_url }` เรียงตาม `engagement` มากไปน้อย จำกัดจำนวนสูงสุด (top 10) โดย `published_url` เป็น permalink จริงจาก `content_items.published_url` (null เมื่อไม่มี)

`engagement` ในทุกระดับ SHALL นิยามเป็น `views + likes` ให้ตรงกับฟิลด์รวมเดิม

#### Scenario: คืน per-platform breakdown จากข้อมูลจริง
- **WHEN** เรียก `?action=analytics` ในช่วงที่มีเมตริก Facebook อย่างน้อยหนึ่งโพสต์
- **THEN** `social.by_platform` มีรายการของ `facebook` พร้อม `posts`/`views`/`likes`/`engagement` และ `social.platforms` มี `'facebook'` โดยไม่มี platform ที่ไม่มีข้อมูล

#### Scenario: monthly series ครอบคลุมทุกเดือนในช่วง
- **WHEN** เรียก `?action=analytics` ด้วยช่วง 12 เดือน
- **THEN** `social.monthly` มี 12 จุด (หนึ่งจุดต่อเดือน) เดือนที่ไม่มีโพสต์ที่วัดได้มีค่า `views`/`likes`/`engagement`/`posts` = 0

#### Scenario: top_posts เรียงตาม engagement และมี permalink จริง
- **WHEN** เรียก `?action=analytics` ในช่วงที่มีโพสต์ที่วัดได้หลายรายการ
- **THEN** `social.top_posts` เรียงจาก `engagement` มากไปน้อย จำกัด 10 รายการ และแต่ละรายการมี `published_url` จาก `content_items.published_url` (หรือ null เมื่อไม่มี)

#### Scenario: ไม่มีข้อมูลคืนโครงว่างที่ปลอดภัย
- **WHEN** เรียก `?action=analytics` ในช่วงที่ไม่มีเมตริก FB/IG เลย
- **THEN** `social.has_data` = false, `by_platform` = [], `top_posts` = [], `monthly` มีจุดครบทุกเดือนแต่ค่าเป็น 0 และ `platforms` = []

### Requirement: แท็บโซเชียลแสดง stat card จากข้อมูลจริง
sub-tab "โซเชียล" SHALL แสดง stat card ที่ค่าทุกใบมาจากข้อมูลจริงใน `social` เท่านั้น (ไม่มีการ์ด em dash placeholder ของเมตริกที่ไม่มีแหล่งข้อมูล) อย่างน้อยต้องมี "Engagement รวม", จำนวนโพสต์ที่วัดได้ (`posts`), ไลก์รวม (`likes`) และวิวรวม (`views`) ทุกการ์ด SHALL ระบุขอบเขตแพลตฟอร์มจาก `social.platforms`

#### Scenario: ทุกการ์ดมาจากข้อมูลจริง
- **WHEN** sub-tab "โซเชียล" ถูก render ขณะ `social.has_data` = true
- **THEN** การ์ด Engagement รวม/โพสต์ที่วัดได้/ไลก์รวม/วิวรวม แสดงค่าจาก `social` ตรง ๆ และไม่มีการ์ดใดแสดง "—" เป็นค่าถาวรของเมตริกที่ไม่มีแหล่งข้อมูล

#### Scenario: ไม่มีข้อมูลแสดง empty state ไม่ใช่ตัวเลขปลอม
- **WHEN** `social.has_data` = false
- **THEN** การ์ดแสดงสถานะ "ยังไม่มีโพสต์ที่ซิงก์ข้อมูล" อย่างชัดเจน (ไม่แสดง 0 ที่สื่อว่า "ไม่มีคนมีปฏิสัมพันธ์" และไม่แสดงตัวเลขปลอม)

#### Scenario: ไม่มี mock/hardcoded data
- **WHEN** sub-tab "โซเชียล" ถูก render ในทุกสถานะ
- **THEN** ไม่มีตัวเลข, กราฟ หรือรายการที่ไม่ได้มาจาก `social` ที่ backend คืน

### Requirement: แท็บโซเชียลแสดง วิว และ ไลก์ แยกกันอย่างตรงไปตรงมา
sub-tab "โซเชียล" SHALL แสดง `views` และ `likes` แยกกัน และเมื่อแสดงค่า "Engagement รวม" SHALL กำกับสูตร (`views + likes`) ให้ผู้ใช้เห็น เพื่อไม่ให้เข้าใจผิดเมื่อ `views` เป็น 0 (เช่น Facebook feed post ปัจจุบันคืน `views = 0`) — ระบบ SHALL ไม่ตัดค่า `views` ทิ้งจากข้อมูล เพื่อรองรับแพลตฟอร์ม/ชนิดโพสต์ที่มี view จริงในอนาคต

#### Scenario: views เป็น 0 ไม่ทำให้ตัวเลขสื่อผิด
- **GIVEN** โพสต์ Facebook ทั้งหมดในช่วงมี `views` = 0 และมี `likes` > 0
- **WHEN** sub-tab "โซเชียล" ถูก render
- **THEN** การ์ดวิวรวมแสดง 0 อย่างชัดเจน, การ์ดไลก์รวมแสดงค่าจริง และ Engagement รวม กำกับว่าคือ `views + likes`

### Requirement: แท็บโซเชียลแสดงกราฟแนวโน้ม engagement รายเดือน
sub-tab "โซเชียล" SHALL แสดงกราฟแนวโน้ม engagement รายเดือนจาก `social.monthly` ตลอดช่วงวันที่ที่เลือก โดยผูกกับตัวกรองช่วงวันที่ของแท็บวิเคราะห์

#### Scenario: แสดงกราฟรายเดือนตามช่วงที่เลือก
- **WHEN** sub-tab "โซเชียล" ถูก render ขณะมี `social.monthly`
- **THEN** เห็นกราฟที่มีหนึ่งจุด/แท่งต่อเดือนตามช่วงที่เลือก และเดือนที่ค่าเป็น 0 ยังปรากฏบนแกน

#### Scenario: ไม่มีข้อมูลไม่แสดงกราฟปลอม
- **WHEN** `social.has_data` = false
- **THEN** ส่วนกราฟแสดงข้อความว่างแทน ไม่วาดเส้น/แท่งจากค่า 0 ปลอม

### Requirement: แท็บโซเชียลแสดง breakdown รายแพลตฟอร์ม
sub-tab "โซเชียล" SHALL แสดง breakdown ต่อแพลตฟอร์มจาก `social.by_platform` (posts/views/likes/engagement) สำหรับแพลตฟอร์มที่มีข้อมูลจริงเท่านั้น

#### Scenario: แสดงเฉพาะแพลตฟอร์มที่มีข้อมูล
- **WHEN** `social.by_platform` มีเฉพาะ `facebook`
- **THEN** ส่วน breakdown แสดงเฉพาะ Facebook ไม่แสดง Instagram หรือแพลตฟอร์มอื่นที่ไม่มีข้อมูล

### Requirement: แท็บโซเชียลแสดงตารางโพสต์เด่น
sub-tab "โซเชียล" SHALL แสดงตารางโพสต์เด่นจาก `social.top_posts` โดยแต่ละแถวแสดงชื่อคอนเทนต์, ป้ายแพลตฟอร์ม, วันเผยแพร่, views, likes, engagement และลิงก์ไปโพสต์จริงเมื่อมี `published_url`

#### Scenario: แสดงรายโพสต์พร้อมลิงก์จริง
- **WHEN** `social.top_posts` มีรายการที่ `published_url` ไม่ว่าง
- **THEN** แถวนั้นมีลิงก์ที่เปิดโพสต์จริงบนแพลตฟอร์มได้ และแสดง views/likes/engagement ของโพสต์นั้น

#### Scenario: ไม่มีโพสต์แสดงข้อความว่าง
- **WHEN** `social.top_posts` = []
- **THEN** ตารางแสดงข้อความว่าง (ไม่มีแถวปลอม)
