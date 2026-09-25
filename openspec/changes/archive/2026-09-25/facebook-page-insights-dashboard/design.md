## Context

- แดชบอร์ดคอนเทนต์ (`src/pages/ContentDashboardPage.tsx`) มีแท็บ "ภาพรวม" (`?action=overview`) และ "วิเคราะห์" (`?action=analytics`) ที่มี sub-tab "โซเชียล" (`AnalyticsSocialTab.tsx`) ใช้ข้อมูลระดับโพสต์จาก `content_post_metrics` เท่านั้น
- spec เดิมระบุว่าเมตริกระดับเพจต้องรอ OAuth page insights แต่ยิงทดสอบจริง 25 ก.ย. 2026 พบว่า Page token (เก็บใน `publish_channels.credentials_encrypted` รูปแบบ `{page_id, access_token}`) มี scope `read_insights` และ `/{page_id}/insights?period=day` คืนค่าครบทั้ง 22 metric
- ผลทดสอบที่ส่งผลต่อการออกแบบ:
  - `page_follows` คืนยอดสะสมทุกวัน (2, 2, 2, …) ถ้า sum จะได้ 56 ซึ่งผิด ยอดจริงตรงกับ `followers_count` = 2
  - `page_actions_post_reactions_total` คืน object แยกชนิด
  - `page_video_view_time` เป็น ms และค่าทั้งหมดไปอยู่ที่วันล่าสุดวันเดียว แปลว่า Meta ลง/ปรับข้อมูลย้อนหลัง
  - เพจทดสอบมีผู้ติดตาม 2 คน ค่าส่วนใหญ่เป็น 0
- ผู้ใช้ตัดสินใจแล้ว: เก็บครบ 22 ตัว แสดงชุดสั้น, ใส่ในหน้าที่มีอยู่ (โซเชียล + 2 การ์ดในภาพรวม), **ไม่ทำรองรับหลายเพจ**, แก้บั๊กวิดีโอแยกเป็น change `fix-facebook-video-metrics-sync` ก่อน

## Goals / Non-Goals

**Goals:**
- เริ่มเก็บ page insights รายวันเร็วที่สุด เพื่อสะสมประวัติไว้เกินกว่าที่ Graph API ให้ดึงย้อนหลัง
- แสดงข้อมูลเพจตามความหมายที่ถูกต้องของแต่ละ metric
- ต่อยอด post metrics ด้วย clicks / reaction แยกชนิด / เวลาดูเฉลี่ย

**Non-Goals:**
- รองรับหลายเพจต่อ tenant หรือมีตัวเลือกเพจ
- Instagram / platform อื่น
- ทำ OAuth flow ใหม่
- แสดง metric นอกชุดสั้น (เก็บไว้ในตารางเท่านั้น)
- เรียก Graph API สดตอนเปิดหน้า

## Decisions

### D1: ตารางแบบแคบ (1 แถว = วัน × metric) แทนตารางคอลัมน์ละ metric
`facebook_page_insights_daily(tenant_id, metric_date, metric, value BIGINT NULL, value_json LONGTEXT NULL, fetched_at, ...)` unique (`tenant_id`, `metric_date`, `metric`)
- เหตุผล: Meta ยกเลิก metric เป็นระยะ (ตระกูล impressions หายไปแล้ว) ตารางแคบไม่ต้องทำ migration ทุกครั้งที่ list เปลี่ยน และ metric แบบ object ลง `value_json` ได้เลย
- ทางเลือกที่ไม่เลือก: ตาราง 22 คอลัมน์ query ง่ายกว่า แต่ทุกการเพิ่ม/ถอด metric ต้อง ALTER TABLE ข้อเสียของตารางแคบคือ API ต้อง pivot เอง ซึ่งไม่หนักที่ข้อมูลหลักร้อยแถวต่อเดือน
- ไม่มี `channel_id` ตามการตัดสินใจ "ไม่รองรับหลายเพจ" แต่ **ต้องมี `tenant_id`** เพราะระบบเป็น multi-tenant (กันข้อมูลข้ามบริษัท)
- ใช้ LONGTEXT + `json_decode` ใน PHP ให้เข้ากับตารางอื่นของโปรเจกต์ ไม่พึ่ง JSON function ของ MariaDB

### D2: cron แยก `facebook-page-insights-sync` วันละครั้ง ไม่รวมกับ `content-metrics-sync`
- ข้อมูลเพจเป็นรายวัน ส่วน post metrics รันทุก 6 ชั่วโมง รวมกันจะยิงเพจ 4 ครั้ง/วันโดยไม่ได้อะไรเพิ่ม
- แยกแล้ว `cron_runs` ของแต่ละงานนับผลของตัวเอง ไม่ปนกัน (เข้ากับข้อกำหนดเรื่องการนับผลของ cron เดิม)
- ใช้การตรวจอายุ token ที่ `content-metrics-sync` ทำอยู่แล้ว ไม่ตรวจซ้ำ

### D3: ดึงย้อนหลัง 3 วันแล้ว upsert ทุกรอบ, รอบแรก 90 วัน
- ผลทดสอบ `page_video_view_time` แสดงว่าค่าของวันล่าสุดยังเปลี่ยนได้ การดึงซ้ำ 3 วันทำให้ค่านิ่งในที่สุด
- 90 วันคือช่วงที่ไม่เกินเพดาน since/until ต่อคำขอของ Graph API (ประมาณ 93 วัน) จึงใช้คำขอเดียวต่อ metric set
- upsert ด้วย `INSERT ... ON DUPLICATE KEY UPDATE` บน unique key

### D4: กติกาการรวมค่าต่อ metric อยู่ที่ตารางค่าคงที่เดียวใน PHP
`PAGE_METRIC_AGG = ['page_follows' => 'latest', 'page_actions_post_reactions_total' => 'object_sum', 'page_total_media_view_unique' => 'daily_only', <อื่นๆ> => 'sum']` ใช้ทั้ง `?action=page_insights` และ `page_summary` ใน `?action=overview` เพื่อไม่ให้เกิดสูตรซ้ำสองที่ ตามกฎ NO MAGIC ทุก metric ที่ไม่ได้ระบุชัด = `sum`

### D5: API ใหม่ `?action=page_insights` แทนการยัดลง `?action=analytics`
- `analytics` เป็น payload ใหญ่ที่ทุก sub-tab ใช้ร่วมกัน ถ้าใส่ page insights ลงไปทุก sub-tab จะต้องโหลดด้วย
- sub-tab โซเชียลเรียก hook ใหม่ `usePageInsights(from, to)` ด้วยช่วงวันที่เดียวกับตัวกรองของแท็บวิเคราะห์ (query key แยก)
- `page_summary` (2 การ์ดภาพรวม) ใส่ใน `?action=overview` เพราะแท็บภาพรวมโหลด endpoint นั้นอยู่แล้ว เป็นค่าเล็ก

### D6: post metrics ใหม่เป็นคอลัมน์ใน `content_post_metrics`
เพิ่ม `clicks INT NULL`, `reactions_json LONGTEXT NULL`, `video_avg_watch_ms INT NULL` ต่อจากตารางเดิม (ไม่สร้างตารางใหม่) เพราะเป็น 1:1 กับรอบซิงก์เดิม NULL = ปลายทางไม่รายงาน ต่างจาก 0 ตามหลักเดียวกับที่ spec เดิมแยก "ไม่มีข้อมูล" กับ "ไม่มีคนดู"
- `fb_post_metric_names()` เพิ่ม `post_clicks`
- `_insights_metric_map()` รวม object เป็นตัวเลขอยู่แล้ว ต้องคืน object ดิบของ `post_reactions_by_type_total` ด้วยเพื่อเก็บลง `reactions_json`
- วิดีโอใช้ `fetch_facebook_video_insights()` จาก change ก่อนหน้า เพิ่มการคืน `post_video_avg_time_watched`

### D7: UI ใช้ component และ recharts ที่ `AnalyticsSocialTab.tsx` ใช้อยู่
- ส่วนข้อมูลเพจวางไว้ **บนสุด** ของ sub-tab (ก่อนส่วนระดับโพสต์เดิม) เพราะเป็นภาพรวมกว้างสุด
- แยก component ใหม่ `PageInsightsSection.tsx` ใน `src/components/content/` ไม่ขยายไฟล์เดิม (374 บรรทัด) ให้ยาวขึ้นอีก
- กราฟ follow/unfollow เป็นแท่งคู่รายวัน, reaction เป็นแท่งแนวนอนแยกชนิด, วิดีโอเป็นแท่ง organic/paid ใช้สีตาม token เดิมของหน้า
- ตัวช่วยแปลงหน่วย ms → "x.x วิ" / "x.x นาที" / "x.x ชม." ใน `src/lib/` ใช้ร่วมกับคอลัมน์ "ดูเฉลี่ย"

## Risks / Trade-offs

- [Meta ยกเลิก metric ในอนาคต] → fallback ทีละ metric + warning ใน log ของ cron, UI แสดง "—" เมื่อไม่มีค่า
- [เพจเล็ก ค่าเป็น 0 เกือบทั้งหมด ดูเหมือนระบบพัง] → empty state ที่อธิบายชัด และ notice card บอกที่มาของข้อมูล
- [ค่าวันล่าสุดยังไม่นิ่ง] → D3 + ข้อความใน notice card
- [ข้อมูลเก่ากว่า 90 วันหายถาวร] → ยอมรับได้ เป็นเหตุผลที่ต้องเริ่มเก็บเร็ว
- [ทดสอบบน local ซึ่งไม่ใช่ production] → ต้องรัน migration 3 ไฟล์และเปิด cron บน production ตอน deploy (ตาม runbook และต้องขออนุมัติก่อนแตะ platform.ktnbs.com)
- [ตัดสินใจไม่เก็บ `channel_id`] → ถ้าอนาคตมีเพจที่ 2 ต้องทำ migration เพิ่มคอลัมน์และถือว่าข้อมูลเดิมเป็นของเพจแรก ผู้ใช้รับทราบแล้ว

## Migration Plan

0. `2026_09_25_150000_drop_orphan_content_page_metrics.sql`: ลบตาราง `content_page_metrics` และ cron `content-page-metrics-sync` ที่เป็นงานทดลองค้างใน DB local (ไม่มีโค้ด/migration/spec ใน repo, ไฟล์ cron ไม่มีอยู่จริง) สำรองไว้ที่ `database/backups/2026_09_25_orphan_content_page_metrics.sql` บน production ไม่มีผล
1. `2026_09_25_HHMMSS_create_facebook_page_insights_daily.sql`
2. `2026_09_25_HHMMSS_add_click_reaction_watch_to_content_post_metrics.sql`
3. `2026_09_25_HHMMSS_register_facebook_page_insights_sync_cron.sql` (`INSERT IGNORE` รูปแบบเดียวกับ `register_content_metrics_sync_cron.sql`, interval "วันละครั้ง")
4. รันบน local ตามลำดับและตรวจด้วย `SHOW COLUMNS` / `SELECT` จาก `cron_jobs`
5. Rollback: ปิด cron (`enabled=0`), DROP ตารางใหม่, DROP คอลัมน์ใหม่ UI จะแสดง empty state เอง

## Open Questions

- เวลาที่เหมาะสมของ cron วันละครั้ง: เสนอหลังเที่ยงคืนเวลาไทย เช่น 02:00 ให้แอดมินปรับได้ที่ Cron Manager
