## 0. เงื่อนไขก่อนเริ่ม

- [ ] 0.1 ยืนยันว่า change `fix-facebook-video-metrics-sync` ทำเสร็จแล้ว (มีคอลัมน์ `platform_post_type` และ `fetch_facebook_video_insights()`)

## 1. Database

- [ ] 1.1 สร้าง migration `create_facebook_page_insights_daily.sql` ตาม D1 (unique `tenant_id, metric_date, metric`)
- [ ] 1.2 สร้าง migration `add_click_reaction_watch_to_content_post_metrics.sql` เพิ่ม `clicks`, `reactions_json`, `video_avg_watch_ms` (NULL ได้ทั้งหมด)
- [ ] 1.3 สร้าง migration `register_facebook_page_insights_sync_cron.sql` (`type='include'`, `file_path='api/cron/facebook-page-insights-sync.php'`, วันละครั้ง)
- [ ] 1.4 รันทั้ง 3 ไฟล์กับ MariaDB local แล้วตรวจด้วย `SHOW COLUMNS` และ `SELECT` จาก `cron_jobs`

## 2. ดึง page insights

- [ ] 2.1 `api/lib/insights-fetch.php`: เพิ่มรายชื่อ 22 metric และฟังก์ชัน `fetch_facebook_page_insights(array $creds, string $since, string $until)` คืนรายการ (วันที่, metric, value, value_json) พร้อม fallback ทีละ metric เมื่อเจอ error 100
- [ ] 2.2 สร้าง `api/cron/facebook-page-insights-sync.php`: เลือกช่องทาง Facebook ที่ active ช่องทางแรกต่อ tenant, ตัดสินช่วงวันที่ 3 วัน/90 วันตาม D3, upsert, พิมพ์บรรทัดสรุปตามรูปแบบ cron-runner ก่อนรายละเอียด และรองรับ cancel จาก `cron_runs`
- [ ] 2.3 รัน cron บน local แล้วตรวจว่ามีแถวย้อนหลัง 90 วันครบ 22 metric และรันซ้ำแล้วไม่เกิดแถวซ้ำ

## 3. ขยาย post metrics

- [ ] 3.1 `insights-fetch.php`: เพิ่ม `post_clicks` ในชุด metric ของโพสต์, คืน `clicks` และ object reaction ดิบ, ให้ `fetch_facebook_video_insights()` คืน `avg_watch_ms` จาก `post_video_avg_time_watched`
- [ ] 3.2 `api/cron/content-metrics-sync.php`: INSERT `clicks`, `reactions_json`, `video_avg_watch_ms` (NULL เมื่อไม่มีค่า)
- [ ] 3.3 รัน cron แล้วตรวจว่าโพสต์ feed มี `clicks`/`reactions_json` และวิดีโอมี `video_avg_watch_ms`

## 4. API

- [ ] 4.1 `api/content-analytics.php`: เพิ่มค่าคงที่กติกาการรวม (D4) และ action `page_insights` (from/to, กรอง tenant, คืน `has_data`, `last_fetched_at`, `totals`, `daily`)
- [ ] 4.2 เพิ่ม `page_summary` (`has_data`, `followers`, `followers_change`, `page_views` ช่วง 28 วัน) ใน `?action=overview` โดยใช้กติกาเดียวกัน
- [ ] 4.3 เพิ่ม `clicks` และ `video_avg_watch_ms` ใน `social.top_posts` ของ `?action=analytics`
- [ ] 4.4 ทดสอบ API ด้วยข้อมูลจริงบน local: `totals.page_follows` เป็นค่าล่าสุด ไม่ใช่ผลรวม

## 5. Frontend

- [ ] 5.1 `src/components/content/types.ts`: เพิ่ม type ของ `page_insights`, `page_summary` และฟิลด์ใหม่ใน top posts
- [ ] 5.2 `src/hooks/useContent.ts`: เพิ่ม `usePageInsights(from, to)` (React Query key แยก)
- [ ] 5.3 เพิ่มตัวช่วยแปลงหน่วยเวลา ms → วิ/นาที/ชม. ใน `src/lib/`
- [ ] 5.4 สร้าง `src/components/content/PageInsightsSection.tsx` แสดง 5 ส่วนตามชุดสั้น พร้อม empty state ภาษาไทย
- [ ] 5.5 `AnalyticsSocialTab.tsx`: วาง `PageInsightsSection` บนสุด, เพิ่มคอลัมน์ "คลิก" / "ดูเฉลี่ย" ในตารางโพสต์เด่น และแก้ข้อความ notice card (ลบข้อความเรื่องรอ OAuth รวมถึงคอมเมนต์หัวไฟล์)
- [ ] 5.6 `ContentDashboardPage.tsx`: เพิ่มการ์ด "ผู้ติดตาม" และ "เข้าชมเพจ" (ป้าย "28 วันล่าสุด") ในแท็บภาพรวม

## 6. ตรวจสอบ

- [ ] 6.1 เพิ่ม/ปรับ test ใน `src/__tests__/content/` สำหรับ `PageInsightsSection` (มีข้อมูล / ไม่มีข้อมูล) และตัวช่วยแปลงหน่วย
- [ ] 6.2 เปิด dev server แล้วตรวจแท็บภาพรวมและ sub-tab โซเชียลด้วยข้อมูลจริงบน local รวมถึงเปลี่ยนช่วงวันที่
- [ ] 6.3 รัน `pnpm lint`, `pnpm build`, `pnpm test` ให้ผ่าน
