# post-metrics-sync Specification

## Purpose

ดึง engagement (views/likes) ของโพสต์ที่เผยแพร่สำเร็จแล้วกลับจากแพลตฟอร์ม (Facebook/Instagram) เก็บเป็น time-series ในตาราง `content_post_metrics` และเขียนผลรวมทุกช่องทางกลับลง `content_items` เพื่อให้แดชบอร์ดคอนเทนต์แสดงตัวเลขจริง ไม่ใช่ค่าที่กรอกมือ

## Requirements

### Requirement: schema มีตาราง time-series content_post_metrics
ฐานข้อมูล SHALL มีตาราง `content_post_metrics` สำหรับเก็บข้อมูล engagement แบบ time-series (ไม่ใช่ค่าเดียวทับไปทับมา) เพื่อให้ดูแนวโน้มการเติบโตของแต่ละโพสต์ได้ โดยเก็บอย่างน้อย: `id`, `tenant_id`, `content_item_id`, `channel_id`, `platform`, `views`, `likes`, `fetched_at`

#### Scenario: migration เพิ่มตารางสำเร็จ
- **WHEN** migration ของ change นี้รันสำเร็จ
- **THEN** `SHOW COLUMNS FROM content_post_metrics` มีคอลัมน์ `content_item_id`, `platform`, `views`, `likes`, `fetched_at` ครบ

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

### Requirement: cron ลงทะเบียนใน cron_jobs
งานซิงก์ metrics SHALL ลงทะเบียนในตาราง `cron_jobs` ด้วย `type='include'` และ `file_path='api/cron/content-metrics-sync.php'` ตามแบบ `publish-scheduler`/`ai-digest` และบันทึกผลลง `cron_runs`

#### Scenario: ลงทะเบียน cron แบบ include
- **WHEN** งานซิงก์ metrics ถูกสร้างใน cron-manager
- **THEN** `cron_jobs` มีแถวที่ `type='include'` และ `file_path='api/cron/content-metrics-sync.php'`

#### Scenario: บันทึกผลรันลง cron_runs
- **WHEN** cron ซิงก์ metrics รัน
- **THEN** `cron_runs` มีแถวของ job นี้พร้อม `records_processed`/`errors` ที่สะท้อนผลจริง

### Requirement: cron ซิงก์ metrics ตรวจอายุ credentials ก่อนเริ่มทุกรอบ
`api/cron/content-metrics-sync.php` SHALL ตรวจอายุ credentials ของช่องทางเผยแพร่ **ก่อน** เริ่มดึงเมตริก และ SHALL ตรวจในทุกรอบรวมรอบที่ไม่มีโพสต์ให้ซิงก์ — ปัจจุบันไฟล์นี้ `return` ออกทันทีเมื่อไม่มีแถวคิวที่พร้อมซิงก์ ถ้าวางการตรวจไว้หลังจุดนั้น รอบที่คิวว่างจะไม่ตรวจอะไรเลย และคิวว่างคือสถานะที่เกิดได้บ่อยที่สุดเมื่อ token หมดอายุ (ไม่มีอะไรเผยแพร่สำเร็จให้ซิงก์)

งานนี้ถูกเลือกเป็นที่อยู่ของการตรวจเพราะรันเป็นรอบอยู่แล้วและอ่าน credentials ของช่องทางอยู่แล้ว จึงไม่ต้องเพิ่มงาน cron ใหม่

#### Scenario: รอบที่ไม่มีโพสต์ให้ซิงก์ก็ยังตรวจ
- **WHEN** cron รันในรอบที่ไม่มีแถว `content_publish_queue` ที่พร้อมซิงก์
- **THEN** `publish_channels.token_checked_at` ของช่องทางที่ตรวจได้ถูกอัปเดตในรอบนั้น
- **AND** บรรทัดสรุปยังรายงานว่าซิงก์ 0 รายการตามพฤติกรรมเดิม

#### Scenario: การตรวจ credentials ล้มเหลวไม่หยุดการซิงก์
- **WHEN** การตรวจอายุ credentials เกิดข้อผิดพลาด (เช่น Graph API ไม่ตอบ)
- **THEN** cron ยังดึงเมตริกของโพสต์ที่พร้อมซิงก์ต่อจนจบรอบ

### Requirement: ผลการตรวจ credentials ไม่รบกวนการนับผลของรอบรัน
ข้อความรายละเอียดของการตรวจ credentials SHALL ถูกพิมพ์**หลัง**บรรทัดสรุปของงานในทุกทางออกของไฟล์ ทั้งทางออกเมื่อไม่มีโพสต์ให้ซิงก์และทางออกปกติ — `api/lib/cron-runner.php` อ่าน `records_processed`/`errors` จาก output ด้วย `preg_match` ที่นับ match แรก และ `cron_runs.notes` เก็บเพียง 500 ตัวอักษรแรก ข้อความที่พิมพ์ก่อนสรุปจะทำให้ตัวเลขใน `cron_runs` ผิดและดันบรรทัดสรุปหลุดออกจาก `notes`

จำนวนช่องทางที่มีสถานะ `unsupported` SHALL ไม่ถูกนับรวมใน `errors` ของรอบรัน

#### Scenario: ตัวเลขใน cron_runs ยังตรงกับผลการซิงก์
- **WHEN** cron รันจบในรอบที่มีการตรวจ credentials และพบช่องทางที่ผิดปกติ
- **THEN** `cron_runs.records_processed` และ `cron_runs.errors` ยังตรงกับผลการซิงก์เมตริก ไม่ใช่ตัวเลขจากส่วนตรวจ credentials

#### Scenario: บรรทัดสรุปยังอยู่ใน notes
- **WHEN** cron รันจบในรอบที่ส่วนตรวจ credentials พิมพ์รายละเอียดหลายบรรทัด
- **THEN** `cron_runs.notes` ยังขึ้นต้นด้วยบรรทัดสรุปของงาน

### Requirement: รอบซิงก์ที่มี error ต้องแจ้งเตือน
เมื่อรอบรันของ `content-metrics-sync` มีจำนวน error มากกว่า 0 ระบบ SHALL ส่งแจ้งเตือนที่ระบุจำนวนและตัวอย่างข้อความ error — ปัจจุบันความล้มเหลวถูกเขียนลง log ของรอบรันเท่านั้น ทำให้เมตริกหยุดอัปเดตโดยแดชบอร์ดยังแสดงตัวเลขเก่าเหมือนปกติ

การแจ้งเตือน SHALL อยู่ในระดับรอบรัน (หนึ่งเรื่องต่องาน) ไม่ใช่หนึ่งเรื่องต่อโพสต์ที่ล้มเหลว เพราะโพสต์เก่าจำนวนมากล้มด้วยเหตุเดียวกันได้ในรอบเดียว

#### Scenario: รอบที่มี error แจ้งเตือน
- **WHEN** รอบรันจบด้วยจำนวน error มากกว่า 0
- **THEN** มีแจ้งเตือนที่ระบุจำนวน error และตัวอย่างข้อความ error

#### Scenario: รอบที่ไม่มี error ไม่รบกวน
- **WHEN** รอบรันจบด้วย 0 error แม้จะข้ามหลายแถวเพราะ platform ไม่รองรับหรือไม่มี id โพสต์
- **THEN** ไม่มีแจ้งเตือนถูกส่ง

#### Scenario: หลายโพสต์ล้มในรอบเดียวยุบเป็นเรื่องเดียว
- **WHEN** รอบรันเดียวมีโพสต์ล้มเหลวหลายรายการ
- **THEN** มีแจ้งเตือนหนึ่งเรื่องของงานนี้ ไม่ใช่หนึ่งเรื่องต่อโพสต์

### Requirement: post metrics เก็บ clicks, reaction แยกชนิด และเวลาดูวิดีโอเฉลี่ย
ตาราง `content_post_metrics` SHALL มีคอลัมน์ `clicks` (INT NULL), `reactions_json` (reaction แยกชนิด, NULL ได้) และ `video_avg_watch_ms` (INT NULL) และ cron `content-metrics-sync.php` SHALL เขียนค่าเหล่านี้ทุกรอบที่ Graph API คืนมา: โพสต์ชนิด `post` ได้ `clicks` จาก `post_clicks` และ `reactions_json` จาก `post_reactions_by_type_total` ส่วนโพสต์ชนิด `video` ได้ `video_avg_watch_ms` จาก `post_video_avg_time_watched` ของ `/{video_id}/video_insights` ค่าที่ปลายทางไม่รายงาน SHALL เก็บเป็น NULL (ไม่ใช่ 0) คอลัมน์ `views`/`likes` และการเขียนผลรวมลง `content_items` คงเดิม

#### Scenario: migration เพิ่มคอลัมน์สำเร็จ
- **WHEN** migration ของ change นี้รันสำเร็จ
- **THEN** `SHOW COLUMNS FROM content_post_metrics` มี `clicks`, `reactions_json`, `video_avg_watch_ms`

#### Scenario: โพสต์ feed ได้ clicks และ reaction แยกชนิด
- **WHEN** cron ซิงก์โพสต์ Facebook ชนิด `post`
- **THEN** แถวใหม่ใน `content_post_metrics` มี `clicks` และ `reactions_json` ตามที่ Graph API คืน

#### Scenario: วิดีโอได้เวลาดูเฉลี่ย
- **WHEN** cron ซิงก์โพสต์ Facebook ชนิด `video` และ `video_insights` คืน `post_video_avg_time_watched` = 16265
- **THEN** แถวใหม่มี `video_avg_watch_ms` = 16265

#### Scenario: ค่าที่ไม่มีเก็บเป็น NULL
- **WHEN** โพสต์ชนิด `post` ไม่มีข้อมูลเวลาดูวิดีโอ
- **THEN** `video_avg_watch_ms` ของแถวนั้นเป็น NULL
