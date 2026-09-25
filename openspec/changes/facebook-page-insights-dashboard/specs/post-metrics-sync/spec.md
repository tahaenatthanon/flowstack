## ADDED Requirements

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
