## Why

แดชบอร์ดคอนเทนต์ตอนนี้แสดงได้แค่ engagement ระดับโพสต์ (วิว + ไลก์) ส่วนตัวเลขระดับเพจ เช่น ผู้ติดตาม การเข้าชมเพจ และการดูวิดีโอ ถูกเขียนไว้ใน spec ว่า "ต้องรอเชื่อม OAuth page insights" แต่ยิงทดสอบจริงเมื่อ 25 ก.ย. 2026 แล้วพบว่า Page token ที่ระบบใช้โพสต์อยู่มีสิทธิ์ `read_insights` อยู่แล้ว และ metric ระดับเพจ 22 ตัวที่ทีมต้องการเรียกได้ครบ จึงทำแดชบอร์ดภาพรวม/วิเคราะห์ได้ทันทีโดยไม่ต้องทำ OAuth ใหม่ และควรเริ่มเก็บข้อมูลให้เร็วที่สุด เพราะ Graph API ให้ดึงข้อมูลย้อนหลังได้จำกัด

## What Changes

- ตารางใหม่ `facebook_page_insights_daily` เก็บค่า metric ระดับเพจรายวัน (1 แถว = วัน × metric) ของเพจ Facebook เพจเดียวต่อ tenant
- cron ใหม่ `facebook-page-insights-sync` ดึง `/{page_id}/insights` วันละครั้ง เก็บ **ครบทั้ง 22 metric** ดึงซ้ำย้อนหลัง 3 วันทุกรอบ (upsert) และดึงย้อนหลัง 90 วันในรอบแรก
- ขยาย `content_post_metrics` เก็บ `post_clicks`, reaction แยกชนิด และเวลาดูวิดีโอเฉลี่ย (`post_video_avg_time_watched` ผ่าน `video_insights`)
- API ใหม่ `api/content-analytics.php?action=page_insights` คืนข้อมูลเพจตามช่วงวันที่ พร้อมรวมค่าตามความหมายของแต่ละ metric (ยอดสะสมใช้ค่าล่าสุด ไม่ sum)
- sub-tab "วิเคราะห์ › โซเชียล" แสดง 5 ส่วนตาม **ชุด metric แบบสั้น**: ภาพรวมเพจ, ผู้ติดตาม, Reaction, วิดีโอ (จำนวนการดู), วิดีโอ (ระยะเวลาการดู) และเพิ่มคอลัมน์ คลิก / ดูเฉลี่ย ในตารางโพสต์เด่น
- แท็บ "ภาพรวม" เพิ่มการ์ด 2 ใบ: "ผู้ติดตาม" และ "เข้าชมเพจ"
- แก้ข้อความ notice card ที่บอกว่าเมตริกระดับเพจต้องรอ OAuth
- **ไม่ทำ** ตัวเลือกหลายเพจ (ตัดสินใจแล้ว)

## Capabilities

### New Capabilities
- `facebook-page-insights-sync`: ตาราง `facebook_page_insights_daily`, ฟังก์ชันดึง page insights และ cron เก็บข้อมูลรายวัน
- `content-dashboard-page-insights`: API `?action=page_insights` และส่วนแสดงผลระดับเพจใน sub-tab "โซเชียล"

### Modified Capabilities
- `post-metrics-sync`: เก็บ clicks, reaction แยกชนิด และเวลาดูวิดีโอเฉลี่ยเพิ่มจาก views/likes
- `content-dashboard-social-placeholder`: notice card ไม่อ้างว่าต้องรอ OAuth อีก และตารางโพสต์เด่นแสดงคอลัมน์ คลิก / ดูเฉลี่ย
- `content-overview-social-performance`: แท็บภาพรวมเพิ่มการ์ด "ผู้ติดตาม" และ "เข้าชมเพจ"

## Impact

- **ต้องทำหลัง** change `fix-facebook-video-metrics-sync` (ใช้ `platform_post_type` และ `video_insights`)
- **DB:** ตารางใหม่ `facebook_page_insights_daily`, คอลัมน์ใหม่ใน `content_post_metrics`, แถวใหม่ใน `cron_jobs` (migration 3 ไฟล์)
- **Backend:** `api/lib/insights-fetch.php`, `api/cron/content-metrics-sync.php`, ไฟล์ใหม่ `api/cron/facebook-page-insights-sync.php`, `api/content-analytics.php`
- **Frontend:** `src/components/content/AnalyticsSocialTab.tsx`, `src/pages/ContentDashboardPage.tsx`, `src/components/content/types.ts`, `src/hooks/useContent.ts`
- **External:** Graph API `/{page_id}/insights` วันละ 1 รอบ (22 metric) ใช้สิทธิ์ที่มีอยู่แล้ว
- ไม่มี route หรือ menuKey ใหม่
