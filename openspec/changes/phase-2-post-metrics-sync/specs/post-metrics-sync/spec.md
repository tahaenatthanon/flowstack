## ADDED Requirements

### Requirement: schema มีตาราง time-series content_post_metrics
ฐานข้อมูล SHALL มีตาราง `content_post_metrics` สำหรับเก็บข้อมูล engagement แบบ time-series (ไม่ใช่ค่าเดียวทับไปทับมา) เพื่อให้ดูแนวโน้มการเติบโตของแต่ละโพสต์ได้ โดยเก็บอย่างน้อย: `id`, `tenant_id`, `content_item_id`, `channel_id`, `platform`, `views`, `likes`, `fetched_at`

#### Scenario: migration เพิ่มตารางสำเร็จ
- **WHEN** migration ของ change นี้รันสำเร็จ
- **THEN** `SHOW COLUMNS FROM content_post_metrics` มีคอลัมน์ `content_item_id`, `platform`, `views`, `likes`, `fetched_at` ครบ

### Requirement: insights-fetch ดึง engagement จาก Facebook และ Instagram
`api/lib/insights-fetch.php` SHALL มีฟังก์ชันดึง engagement ของโพสต์จาก Facebook Graph API (`/{post_id}/insights`) และ Instagram โดยใช้ **id โพสต์ต่อช่องทาง** (`content_publish_queue.platform_post_id`) เป็นคีย์ และแยก platform ด้วย `match()` ตามแบบ `dispatch_content()`

#### Scenario: ดึง Facebook insights ด้วย id โพสต์ต่อช่องทาง
- **WHEN** เรียกฟังก์ชัน fetch ของ platform `facebook` พร้อม id โพสต์ที่มีค่า
- **THEN** เรียก Graph API `/{post_id}/insights` และคืนค่า views/likes ที่ map มาจาก metrics (reactions → likes, impressions → views)

#### Scenario: ดึง Instagram insights
- **WHEN** เรียกฟังก์ชัน fetch ของ platform `instagram` พร้อม creds `{ ig_user_id, access_token }` ที่ครบ
- **THEN** คืนค่า engagement ของ media นั้น

#### Scenario: platform ที่ไม่รองรับคืน unsupported
- **WHEN** เรียกฟังก์ชัน fetch ด้วย platform ที่ไม่อยู่ใน `facebook`/`instagram`
- **THEN** คืนผลที่ระบุว่า platform นี้ยังไม่รองรับการซิงก์ engagement ในเฟสนี้ (ไม่ error 500)

#### Scenario: creds ไม่ครบคืนความล้มเหลวไม่ใช่ exception
- **WHEN** channel ของ platform ที่รองรับไม่มี `access_token` ใน creds
- **THEN** คืนผลล้มเหลวพร้อมข้อความระบุว่า creds ไม่ครบ และไม่มี request ออกไปยัง Graph API

### Requirement: cron ซิงก์ metrics เขียน views/likes และ time-series
`api/cron/content-metrics-sync.php` SHALL ดึง engagement ของโพสต์ที่เผยแพร่สำเร็จแล้ว (แถว `content_publish_queue` ที่ `status='sent'` และมี `platform_post_id`) จาก Facebook/Instagram แล้ว INSERT แถวใหม่ลง `content_post_metrics` ทุกครั้งที่รัน (time-series) และเขียน **ผลรวมทุกช่องทาง** ของคอนเทนต์นั้นกลับลง `content_items.views`/`content_items.likes`

#### Scenario: เขียน views/likes ลง content_items
- **WHEN** cron รันและ fetch คอนเทนต์ที่เผยแพร่สำเร็จได้ค่า views/likes
- **THEN** แถว `content_items` นั้นมี `views`/`likes` ถูกอัปเดตเป็นผลรวมล่าสุดของทุกช่องทาง

#### Scenario: INSERT แถว time-series ทุกครั้ง
- **WHEN** cron รันสำเร็จ
- **THEN** `content_post_metrics` มีแถวใหม่เพิ่มขึ้นในแต่ละรอบรัน (ไม่ทับแถวเดิม) พร้อม `channel_id` ของช่องทางที่ดึงมา

#### Scenario: ข้ามแถวที่ไม่มี id โพสต์
- **WHEN** คอนเทนต์เผยแพร่แล้วแต่แถวคิวไม่มี `platform_post_id`
- **THEN** cron ข้ามแถวนั้นอย่างเงียบ ๆ ไม่ error

#### Scenario: platform ที่ไม่รองรับไม่ทำให้รอบรันล้มเหลว
- **WHEN** แถวคิวที่ `sent` เป็น platform ที่ยังไม่รองรับ (เช่น `lotusdomino`)
- **THEN** cron ข้ามแถวนั้นและรายงานเป็นจำนวนที่ข้าม ไม่นับเป็น error

### Requirement: cron ลงทะเบียนใน cron_jobs
งานซิงก์ metrics SHALL ลงทะเบียนในตาราง `cron_jobs` ด้วย `type='include'` และ `file_path='api/cron/content-metrics-sync.php'` ตามแบบ `publish-scheduler`/`ai-digest` และบันทึกผลลง `cron_runs`

#### Scenario: ลงทะเบียน cron แบบ include
- **WHEN** งานซิงก์ metrics ถูกสร้างใน cron-manager
- **THEN** `cron_jobs` มีแถวที่ `type='include'` และ `file_path='api/cron/content-metrics-sync.php'`

#### Scenario: บันทึกผลรันลง cron_runs
- **WHEN** cron ซิงก์ metrics รัน
- **THEN** `cron_runs` มีแถวของ job นี้พร้อม `records_processed`/`errors` ที่สะท้อนผลจริง
