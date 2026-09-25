## Context

- `dispatch_facebook()` (`api/lib/publish-dispatch.php`) เผยแพร่ได้ 3 ทาง: `/feed` (ข้อความ), `/photos` (รูป), `/videos` (วิดีโอ) สองทางแรกเก็บ id แบบผสม `{page_id}_{post_id}` ส่วน `/videos` เก็บ **video id เปล่า** ลง `content_publish_queue.platform_post_id`
- cron `api/cron/content-metrics-sync.php` เอา id ทุกแถวไปเรียก `fetch_post_insights()` ซึ่งยิง `/{id}/insights` เสมอ
- ยิงทดสอบจริง 25 ก.ย. 2026 (v26.0, Page token ของ local):
  - `/{video_id}/insights` → error code 100 "Tried accessing nonexisting field (insights)"
  - `/{video_id}/video_insights` → สำเร็จ ได้ `post_video_avg_time_watched`=16265, `post_video_view_time`=292773, `post_impressions_unique`=11, `fb_reels_total_plays`=32, `blue_reels_play_count`=18, `fb_reels_replay_count`=14, `post_video_likes_by_reaction_type`=[], `post_video_retention_graph`, `post_video_followers`=0
  - วิดีโอที่ทดสอบถูก Facebook จัดเป็น Reel (มี metric ตระกูล `fb_reels_*`) ทั้งที่อัปโหลดผ่าน `/videos`
- error 100 ตัวนี้ใช้รหัสเดียวกับ "metric ไม่รู้จัก" ตัว fallback เดิมใน `_insights_fb_metrics()` จึงยิงซ้ำทีละ metric แล้วล้มทั้งหมด แถววิดีโอถูกนับเป็น error ทุกรอบ และ `content_post_metrics` ไม่มีแถวของวิดีโอเลย

## Goals / Non-Goals

**Goals:**
- โพสต์วิดีโอ Facebook ซิงก์ views/likes เข้า `content_post_metrics` ได้ทุกรอบ cron
- ชนิดของ id ถูกบันทึกอย่างชัดเจนตอนเผยแพร่ ตามกฎ NO MAGIC

**Non-Goals:**
- ไม่เพิ่มคอลัมน์ metric ใหม่ใน `content_post_metrics` (เช่น avg watch time, clicks) ส่วนนี้อยู่ใน change `facebook-page-insights-dashboard`
- ไม่แก้ Instagram / platform อื่น
- ไม่เปลี่ยน UI

## Decisions

### D1: บันทึกชนิด id ตอน dispatch ด้วยคอลัมน์ใหม่ `content_publish_queue.platform_post_type`
`VARCHAR(20) NULL` ค่า `post` | `video` ตั้งค่าใน `dispatch_facebook()` (`$result['platform_post_type']`) แล้วเขียนลงคิวที่จุดเดียวกับ `platform_post_id` ส่วน platform อื่นให้ค่าเริ่มต้นเป็น `post`

ทางเลือกที่ไม่เลือก:
- **เดาจากรูปแบบ id (ไม่มี `_` = วิดีโอ):** ไม่ต้องทำ migration แต่เป็นกฎแฝงที่พังเงียบถ้า Meta เปลี่ยนรูปแบบ id ขัดกับ NO MAGIC จึงใช้แค่ครั้งเดียวตอน backfill
- **ลอง `/insights` ก่อน ถ้า error 100 ค่อยถอยไป `video_insights`:** เปลือง request 2 เท่าทุกรอบ และแยกไม่ออกระหว่าง "metric ถูกยกเลิก" กับ "ผิด endpoint" เพราะใช้ error code เดียวกัน
- **JOIN ดูว่า content_items มีวิดีโอไหม:** เนื้อหาอาจถูกแก้หลังเผยแพร่ ไม่สะท้อนสิ่งที่ส่งไปจริง

### D2: backfill แถวเดิมด้วยกฎรูปแบบ id ครั้งเดียวใน migration
แถว Facebook ที่ `status='sent'` และ `platform_post_id NOT LIKE '%\_%'` → `video` แถวอื่นที่มี `platform_post_id` → `post` ใช้ได้เพราะก่อน change นี้ `/feed` และ `/photos` เก็บ id แบบผสมเสมอ (ดูคอมเมนต์ใน `dispatch_facebook()`)

### D3: mapping ของ `video_insights` → views/likes
- **views:** ใช้ `fb_reels_total_plays` ถ้ามี (Reel) ไม่มีก็ใช้ `total_video_views` (วิดีโอปกติ) ถ้าไม่มีทั้งคู่ให้เป็น 0 พร้อม warning ใน log
- **likes:** ผลรวมของ `post_video_likes_by_reaction_type` (object แยกชนิด → รวมด้วย `_insights_metric_map()` เดิม)
- ขอ metric แบบระบุชื่อ (`?metric=...`) ไม่ดึงทั้งหมด เพื่อใช้ fallback ทีละตัวที่มีอยู่แล้ว ถ้า Meta ยกเลิกบางตัว
- ผล task 1.1 (25 ก.ย. 2026): เพจมีวิดีโอตัวเดียวและเป็น Reel ขอ `fb_reels_total_plays`=32, `post_video_likes_by_reaction_type`=[], `post_video_avg_time_watched`=16265 ได้ ส่วน `total_video_views` ขอได้ไม่ error แต่ไม่มีข้อมูล (สำหรับ Reel) จึงใช้เป็นตัวสำรองได้อย่างปลอดภัย ยืนยันวิดีโอที่ไม่ใช่ Reel ไม่ได้เพราะไม่มีในเพจ
- ⚠️ **ห้ามใส่ `post_video_views` ในคำขอ `video_insights`** เพราะตอบ error code 1 "An unknown error" ซึ่งไม่ใช่ code 100 ตัว fallback จะไม่ทำงานและคำขอจะล้มทั้งชุด
- `/{video_id}?fields=reactions` ใช้กับ video id ไม่ได้ (error 100) จึงไม่มีทางอื่นให้ได้ reaction ของวิดีโอในตอนนี้

### D4: แยกฟังก์ชันใหม่ `fetch_facebook_video_insights()` ไม่แทรก if ในฟังก์ชันเดิม
`fetch_post_insights()` รับพารามิเตอร์ `?string $postType = null` เพิ่ม แล้ว `match` ภายในของ facebook เลือกฟังก์ชัน เส้นทางเดิมไม่ถูกแตะ ลดความเสี่ยงที่โพสต์ feed จะเสีย

## Risks / Trade-offs

- [Reel กับวิดีโอปกติคืน metric คนละชุด] → D3 ใช้ fallback หลายชื่อ และ task 1.1 ยืนยันด้วยการยิงจริง
- [`post_video_likes_by_reaction_type` คืน `[]` แม้หน้าเพจมี like] → ยอมรับ ค่า likes ของวิดีโออาจต่ำกว่าจริง บันทึกเป็นข้อจำกัดในคอมเมนต์ ถ้าต้องการตัวเลขแม่นกว่านี้ค่อยพิจารณา `/{video_id}?fields=reactions.summary(true)` ในอนาคต
- [local ไม่ใช่ production] → migration ต้องรันบน production ตอน deploy ด้วย (ตาม runbook staging/deploy) ค่า backfill จะต่างกันตามข้อมูลจริง

## Migration Plan

1. `database/migrations/2026_09_25_HHMMSS_add_platform_post_type_to_publish_queue.sql`: `ALTER TABLE content_publish_queue ADD COLUMN platform_post_type VARCHAR(20) NULL AFTER platform_post_id` + UPDATE backfill ตาม D2
2. รันบน local แล้วตรวจด้วย `SHOW COLUMNS` และ `SELECT platform_post_type, COUNT(*) ... GROUP BY 1`
3. Rollback: `ALTER TABLE content_publish_queue DROP COLUMN platform_post_type` แล้วโค้ดจะถอยไปใช้เส้นทาง `post` ตาม scenario "ชนิด id ไม่ระบุ"

## Open Questions

- วิดีโอที่ไม่ใช่ Reel คืน metric ชื่ออะไรจาก `video_insights` ให้ปิดประเด็นนี้ใน task 1.1
