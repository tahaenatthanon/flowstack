## ADDED Requirements

### Requirement: schema มีตารางรายวัน facebook_page_insights_daily
ฐานข้อมูล SHALL มีตาราง `facebook_page_insights_daily` เก็บค่า metric ระดับเพจ 1 แถวต่อ (tenant, วันที่, metric) มีคอลัมน์อย่างน้อย `id`, `tenant_id`, `metric_date` (DATE), `metric` (ชื่อ metric ของ Graph API), `value` (ตัวเลข, NULL ได้), `value_json` (สำหรับ metric ที่คืนเป็น object, NULL ได้), `fetched_at`, `created_at`, `updated_at` และมี unique key บน (`tenant_id`, `metric_date`, `metric`)

#### Scenario: migration สร้างตารางสำเร็จ
- **WHEN** migration ของ change นี้รันสำเร็จ
- **THEN** `SHOW COLUMNS FROM facebook_page_insights_daily` มีคอลัมน์ `tenant_id`, `metric_date`, `metric`, `value`, `value_json`, `fetched_at` ครบ

#### Scenario: ห้ามมีแถวซ้ำต่อวันต่อ metric
- **WHEN** บันทึกค่า metric เดิมของวันเดิมใน tenant เดิมซ้ำ
- **THEN** แถวเดิมถูกอัปเดต (upsert) ไม่เกิดแถวใหม่

### Requirement: ดึง page insights ครบชุด 22 metric
`api/lib/insights-fetch.php` SHALL มีฟังก์ชันดึง `/{page_id}/insights` แบบ `period=day` ตามช่วงวันที่ที่กำหนด สำหรับ metric ทั้ง 22 ตัว: `page_views_total`, `page_follows`, `page_media_view`, `page_total_media_view_unique`, `page_daily_follows`, `page_daily_unfollows`, `page_daily_follows_unique`, `page_daily_unfollows_unique`, `page_actions_post_reactions_total`, `page_actions_post_reactions_like_total`, `page_actions_post_reactions_love_total`, `page_actions_post_reactions_wow_total`, `page_actions_post_reactions_haha_total`, `page_actions_post_reactions_sorry_total`, `page_actions_post_reactions_anger_total`, `page_video_views`, `page_video_views_organic`, `page_video_views_paid`, `page_video_views_autoplayed`, `page_video_views_click_to_play`, `page_video_repeat_views`, `page_video_view_time` ฟังก์ชันนี้ SHALL ไม่แตะฐานข้อมูล (รูปแบบเดียวกับฟังก์ชันอื่นในไฟล์)

#### Scenario: คืนค่ารายวันต่อ metric
- **WHEN** เรียกฟังก์ชันด้วย creds ที่มี `page_id` และ `access_token` และช่วงวันที่ 3 วัน
- **THEN** คืนรายการ (วันที่, metric, ค่า) ของทุก metric ที่ Graph API ตอบกลับ

#### Scenario: metric ที่คืนเป็น object
- **WHEN** Graph API คืนค่าของ metric เป็น object (เช่น `page_actions_post_reactions_total` คืน `{like: n, love: n}`)
- **THEN** ฟังก์ชันคืนค่า object นั้นไว้ครบ (ให้ผู้เรียกเก็บลง `value_json`) และคืนผลรวมของทุกชนิดเป็นค่าตัวเลข

#### Scenario: metric ที่ถูกยกเลิกไม่ทำให้ทั้งรอบล้มเหลว
- **GIVEN** Graph API ปฏิเสธ metric บางตัวด้วย error code 100
- **WHEN** ฟังก์ชันยิงคำขอชุดรวมแล้วถูกปฏิเสธ
- **THEN** ถอยไปยิงทีละ metric เก็บค่าที่ยังได้ และคืนชื่อ metric ที่ถูกปฏิเสธเป็นคำเตือน

#### Scenario: creds ไม่ครบไม่ยิง request
- **WHEN** creds ไม่มี `page_id` หรือ `access_token`
- **THEN** คืนผลล้มเหลวพร้อมข้อความภาษาไทย และไม่มี request ออกไปยัง Graph API

### Requirement: cron facebook-page-insights-sync เก็บข้อมูลรายวัน
ระบบ SHALL มี cron `api/cron/facebook-page-insights-sync.php` ลงทะเบียนใน `cron_jobs` (key `facebook-page-insights-sync`, `type='include'`, วันละครั้ง) ที่ดึง page insights ของช่องทาง Facebook ที่ `is_active=1` ของแต่ละ tenant แล้ว upsert ลง `facebook_page_insights_daily` ทุกรอบ SHALL ดึงย้อนหลัง 3 วันล่าสุด (เพราะ Meta ลงข้อมูลของวันล่าสุดย้อนหลังได้) และเมื่อ tenant นั้นยังไม่มีข้อมูลเลย SHALL ดึงย้อนหลัง 90 วัน

#### Scenario: รอบปกติดึงย้อนหลัง 3 วัน
- **WHEN** cron รันและ tenant มีข้อมูลในตารางแล้ว
- **THEN** ขอข้อมูลช่วง 3 วันล่าสุดและ upsert ค่าใหม่ทับค่าของวันเดิม

#### Scenario: รอบแรกดึงย้อนหลัง 90 วัน
- **WHEN** cron รันและ tenant ยังไม่มีแถวใดในตาราง
- **THEN** ขอข้อมูลย้อนหลัง 90 วัน

#### Scenario: tenant มีช่องทาง Facebook มากกว่า 1 ช่องทาง
- **WHEN** tenant มีช่องทาง Facebook ที่ `is_active=1` มากกว่า 1 ช่องทาง
- **THEN** ใช้ช่องทางที่สร้างก่อนสุด (`created_at` น้อยสุด) ช่องทางเดียว และรายงานในบรรทัด log ว่าข้ามช่องทางที่เหลือ

#### Scenario: รายงานผลตามรูปแบบ cron-runner
- **WHEN** cron รันจบ
- **THEN** บรรทัดแรกของ output เป็นสรุป "Processed N entries, M errors" ตามรูปแบบที่ `api/lib/cron-runner.php` อ่าน แล้วตามด้วยรายละเอียดราย tenant

#### Scenario: tenant หนึ่งล้มเหลวไม่หยุด tenant อื่น
- **WHEN** การดึงข้อมูลของ tenant หนึ่งล้มเหลว (เช่น token ใช้ไม่ได้)
- **THEN** cron นับเป็น error และทำ tenant ถัดไปต่อ
