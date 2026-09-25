## Why

โพสต์วิดีโอบน Facebook (เผยแพร่ผ่าน `/{page_id}/videos` ตั้งแต่ commit b7b97df) ไม่เคยซิงก์ engagement ได้เลย เพราะ `/videos` คืน **video id** ไม่ใช่ post id แล้ว cron เอา id นี้ไปยิง `/{id}/insights` ซึ่ง Graph API ปฏิเสธด้วย error 100 "Tried accessing nonexisting field (insights)" ยิงทดสอบจริงเมื่อ 25 ก.ย. 2026 แล้วพบว่า video id ต้องใช้ `/{video_id}/video_insights` แทน ตอนนี้โพสต์วิดีโอจึงมี **0 แถว** ใน `content_post_metrics` ควรแก้ก่อนทำแดชบอร์ด page insights (change `facebook-page-insights-dashboard`) เพื่อเริ่มเก็บตัวเลขวิดีโอให้เร็วที่สุด

## What Changes

- บันทึก "ชนิดของ id" ที่ได้จากการเผยแพร่ลง `content_publish_queue` ตอน dispatch (`post` หรือ `video`) ให้ชัดเจน ไม่ต้องเดาจากรูปแบบ id ภายหลัง
- migration เพิ่มคอลัมน์และ backfill แถว Facebook เดิม
- `api/lib/insights-fetch.php` แยกเส้นทาง: id ชนิด `video` ของ Facebook ใช้ `/{video_id}/video_insights` แล้ว map เป็น views/likes รูปแบบเดิม
- cron `content-metrics-sync.php` ส่งชนิดของ id ต่อไปให้ fetch
- ไม่เปลี่ยนโครงตาราง `content_post_metrics` และไม่เปลี่ยน UI

## Capabilities

### New Capabilities
<!-- ไม่มี -->

### Modified Capabilities
- `post-metrics-sync`: ฟังก์ชัน fetch ของ Facebook ต้องรองรับ id วิดีโอผ่าน `video_insights` และ cron ต้องส่งชนิดของ id ที่บันทึกไว้ตอนเผยแพร่
- `content-publish-result-tracking`: ผลการเผยแพร่ต้องบันทึกชนิดของ id (`post`/`video`) ควบคู่กับ `platform_post_id`

## Impact

- **DB:** `content_publish_queue` เพิ่มคอลัมน์ `platform_post_type` (migration ใหม่ + backfill)
- **Backend:** `api/lib/publish-dispatch.php` (`dispatch_facebook`, `publish_record_result` / จุด UPDATE คิว), `api/lib/insights-fetch.php`, `api/cron/content-metrics-sync.php`
- **External:** เรียก Graph API endpoint ใหม่ `/{video_id}/video_insights` (สิทธิ์ `read_insights` มีอยู่แล้วใน Page token)
- ไม่มีผลกับ frontend
