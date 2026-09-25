## MODIFIED Requirements

### Requirement: insights-fetch ดึง engagement จาก Facebook และ Instagram
`api/lib/insights-fetch.php` SHALL มีฟังก์ชันดึง engagement ของโพสต์จาก Facebook Graph API และ Instagram โดยใช้ **id โพสต์ต่อช่องทาง** (`content_publish_queue.platform_post_id`) เป็นคีย์ และแยก platform ด้วย `match()` ตามแบบ `dispatch_content()` สำหรับ Facebook ฟังก์ชัน SHALL เลือก endpoint ตามชนิดของ id ที่ผู้เรียกส่งมา (`content_publish_queue.platform_post_type`): `post` ใช้ `/{post_id}/insights` และ `video` ใช้ `/{video_id}/video_insights` โดยคืนผลในรูปแบบเดียวกัน (`views`, `likes`) ทั้งสองเส้นทาง

#### Scenario: ดึง Facebook insights ด้วย id โพสต์ต่อช่องทาง
- **WHEN** เรียกฟังก์ชัน fetch ของ platform `facebook` พร้อม id โพสต์ที่มีค่าและชนิด `post`
- **THEN** เรียก Graph API `/{post_id}/insights` และคืนค่า views/likes ที่ map มาจาก metrics ที่ Graph API ยังยอมรับ (`post_reactions_by_type_total` → likes, `post_video_views` → views)

#### Scenario: ดึง Facebook insights ของวิดีโอด้วย video id
- **WHEN** เรียกฟังก์ชัน fetch ของ platform `facebook` พร้อม id ชนิด `video`
- **THEN** เรียก Graph API `/{video_id}/video_insights` (ไม่เรียก `/{id}/insights`) และคืนค่า views/likes ตาม mapping ที่กำหนดใน design.md ของ change นี้

#### Scenario: ชนิด id ไม่ระบุถือเป็นโพสต์
- **WHEN** เรียกฟังก์ชัน fetch ของ platform `facebook` โดยชนิดของ id เป็น NULL หรือค่าว่าง
- **THEN** ใช้เส้นทาง `post` (`/{post_id}/insights`) ตามพฤติกรรมเดิม

#### Scenario: metric ที่ถูกยกเลิกไม่ทำให้ทั้งโพสต์ล้มเหลว
- **GIVEN** Graph API ปฏิเสธชื่อ metric บางตัวด้วย error code 100 (Meta ยกเลิก metric เป็นระยะ เช่นตระกูล `post_impressions`)
- **WHEN** ฟังก์ชัน fetch ของ platform `facebook` ยิงคำขอชุดรวมแล้วถูกปฏิเสธ
- **THEN** ถอยไปยิง metric แยกทีละตัว เก็บค่าที่ยังได้ และรายงานชื่อ metric ที่ถูกปฏิเสธเป็นคำเตือน (ไม่นับเป็น error ของรอบรัน)

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
`api/cron/content-metrics-sync.php` SHALL ดึง engagement ของโพสต์ที่เผยแพร่สำเร็จแล้ว (แถว `content_publish_queue` ที่ `status='sent'` และมี `platform_post_id`) จาก Facebook/Instagram โดยส่ง `platform_post_type` ของแถวนั้นให้ฟังก์ชัน fetch ด้วย แล้ว INSERT แถวใหม่ลง `content_post_metrics` ทุกครั้งที่รัน (time-series) และเขียน **ผลรวมทุกช่องทาง** ของคอนเทนต์นั้นกลับลง `content_items.views`/`content_items.likes`

#### Scenario: เขียน views/likes ลง content_items
- **WHEN** cron รันและ fetch คอนเทนต์ที่เผยแพร่สำเร็จได้ค่า views/likes
- **THEN** แถว `content_items` นั้นมี `views`/`likes` ถูกอัปเดตเป็นผลรวมล่าสุดของทุกช่องทาง

#### Scenario: INSERT แถว time-series ทุกครั้ง
- **WHEN** cron รันสำเร็จ
- **THEN** `content_post_metrics` มีแถวใหม่เพิ่มขึ้นในแต่ละรอบรัน (ไม่ทับแถวเดิม) พร้อม `channel_id` ของช่องทางที่ดึงมา

#### Scenario: โพสต์วิดีโอ Facebook ซิงก์ได้
- **WHEN** cron รันและมีแถวคิว Facebook ที่ `status='sent'` และ `platform_post_type='video'`
- **THEN** `content_post_metrics` มีแถวใหม่ของคอนเทนต์นั้น และรอบรันไม่นับแถวนั้นเป็น error

#### Scenario: ข้ามแถวที่ไม่มี id โพสต์
- **WHEN** คอนเทนต์เผยแพร่แล้วแต่แถวคิวไม่มี `platform_post_id`
- **THEN** cron ข้ามแถวนั้นอย่างเงียบ ๆ ไม่ error

#### Scenario: platform ที่ไม่รองรับไม่ทำให้รอบรันล้มเหลว
- **WHEN** แถวคิวที่ `sent` เป็น platform ที่ยังไม่รองรับ (เช่น `lotusdomino`)
- **THEN** cron ข้ามแถวนั้นและรายงานเป็นจำนวนที่ข้าม ไม่นับเป็น error
