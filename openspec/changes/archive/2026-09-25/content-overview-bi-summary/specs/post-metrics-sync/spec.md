## ADDED Requirements

### Requirement: post metrics เก็บ Comment และ Share
ตาราง `content_post_metrics` SHALL มีคอลัมน์ `comments` (INT NULL) และ `shares` (INT NULL) และ cron `content-metrics-sync.php` SHALL เขียนค่าทั้งสองทุกรอบที่ Graph API คืนมา จาก metric `post_activity_by_action_type` (object `{like, comment, share}`) ของ `/{post_id}/insights` — ชนิดที่ไม่อยู่ใน object หรือ object ว่าง SHALL เก็บเป็น 0 ส่วน metric ที่ถูกปฏิเสธหรือไม่ได้คำตอบ SHALL เก็บเป็น NULL (ไม่ใช่ 0)

โพสต์ชนิด `video` (เก็บ video id) SHALL ได้ `clicks`, `comments`, `shares` จากโพสต์บนเพจที่ห่อวิดีโอ: `GET /{video_id}?fields=post_id` → `{page_id}_{post_id}` → `/insights` (`post_clicks`, `post_activity_by_action_type`) หากขั้นนี้ล้มเหลว SHALL เก็บทั้งสามค่าเป็น NULL พร้อม warning ใน log โดยไม่ทำให้การซิงก์โพสต์นั้นล้มเหลว (ยังเก็บยอดเล่น/reaction/เวลาดูเฉลี่ยตามเดิม)

ระบบ SHALL NOT เก็บจำนวน Save ระดับโพสต์ เพราะ Facebook ไม่มี metric นี้ (`post_saves` ถูกปฏิเสธเป็น invalid metric) แถวเก่าที่เก็บก่อนมีคอลัมน์ไม่ต้อง backfill เพราะรายงานอ่านแถวล่าสุดต่อโพสต์ และค่าเป็นยอดสะสมตลอดชีวิตโพสต์ที่ cron รอบถัดไปเขียนให้

#### Scenario: migration เพิ่มคอลัมน์
- **WHEN** รัน migration `2026_09_25_170000_add_comments_shares_to_content_post_metrics.sql`
- **THEN** `SHOW COLUMNS FROM content_post_metrics` มี `comments` และ `shares` ชนิด INT NULL

#### Scenario: โพสต์ feed ได้ comment และ share
- **GIVEN** `post_activity_by_action_type` ของโพสต์คืน `{"like":7,"comment":1}`
- **WHEN** cron ซิงก์โพสต์นั้น
- **THEN** แถวใหม่มี `comments` = 1 และ `shares` = 0

#### Scenario: โพสต์วิดีโอได้ click/comment/share ผ่านโพสต์บนเพจ
- **GIVEN** โพสต์ชนิด `video` ที่ video object มี `post_id`
- **WHEN** cron ซิงก์โพสต์นั้น
- **THEN** แถวใหม่มี `clicks`, `comments`, `shares` จาก insights ของ `{page_id}_{post_id}` นอกเหนือจากยอดเล่นและเวลาดูเฉลี่ย

#### Scenario: หา post ของวิดีโอไม่ได้
- **WHEN** `GET /{video_id}?fields=post_id` ล้มเหลวหรือไม่มี `post_id`
- **THEN** แถวใหม่มี `clicks`/`comments`/`shares` เป็น NULL, log มี warning และโพสต์นั้นยังนับเป็นซิงก์สำเร็จ
