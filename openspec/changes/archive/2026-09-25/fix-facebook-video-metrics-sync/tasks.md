## 1. ยืนยัน Graph API

- [x] 1.1 ยิง `/{video_id}/video_insights` จริง (อ่านอย่างเดียว) กับวิดีโอทั้งแบบ Reel และแบบปกติ (ถ้ามี) บันทึกชื่อ metric ที่ใช้เป็น views/likes ลงคอมเมนต์ในโค้ดและปรับ D3 ใน design.md ถ้าไม่ตรง

## 2. Database

- [x] 2.1 สร้าง migration `database/migrations/2026_09_25_HHMMSS_add_platform_post_type_to_publish_queue.sql` เพิ่มคอลัมน์ `platform_post_type VARCHAR(20) NULL` และ backfill ตาม D2
- [x] 2.2 รัน migration กับ MariaDB local แล้วตรวจด้วย `SHOW COLUMNS FROM content_publish_queue` และนับแถวตามค่า `platform_post_type`

## 3. บันทึกชนิด id ตอนเผยแพร่

- [x] 3.1 `dispatch_facebook()` ตั้ง `$result['platform_post_type']` เป็น `video` (branch `/videos`) หรือ `post` (branch อื่น)
- [x] 3.2 จุด UPDATE `content_publish_queue` ใน `api/lib/publish-dispatch.php` เขียน `platform_post_type` (ค่าเริ่มต้น `post` เมื่อ dispatch ไม่ได้ตั้งค่ามา) ผ่านฟังก์ชันสกัดข้อมูลอ้างอิงโพสต์ตัวเดิม

## 4. ดึง insights ของวิดีโอ

- [x] 4.1 `api/lib/insights-fetch.php`: เพิ่มพารามิเตอร์ `?string $postType = null` ให้ `fetch_post_insights()` และเลือกเส้นทาง facebook ตามชนิด
- [x] 4.2 เพิ่ม `fetch_facebook_video_insights()` เรียก `/{video_id}/video_insights` ด้วย metric ตาม D3 ผ่าน fallback ทีละตัวที่มีอยู่ แล้วคืนรูปแบบเดียวกับ `fetch_facebook_insights()`
- [x] 4.3 `api/cron/content-metrics-sync.php`: SELECT `q.platform_post_type` และส่งต่อให้ `fetch_post_insights()`

## 5. ตรวจสอบ

- [x] 5.1 รัน `php api/cron/content-metrics-sync.php` บน local แล้วยืนยันว่าวิดีโอ `183846…` มีแถวใหม่ใน `content_post_metrics` และรอบรันไม่นับเป็น error
- [x] 5.2 ยืนยันว่าโพสต์ feed/รูปเดิมยังซิงก์ได้ตามปกติ (จำนวนแถวใหม่ต่อรอบไม่ลดลง)
- [x] 5.3 รัน `pnpm lint`, `pnpm build`, `pnpm test` ให้ผ่าน — lint 0 error, build ผ่าน, test fail 8 ตัวใน BatchGenerateDialog/PullFromContentDialog/QuickCreateDialog ซึ่ง fail เหมือนกันก่อนแก้ (ยืนยันด้วย git stash) ไม่เกี่ยวกับ change นี้
