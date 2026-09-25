## Context

- แท็บภาพรวม (`src/pages/ContentDashboardPage.tsx`, ส่วนคอนเทนต์) ใช้ `useContentOverview(trendRange, platformPeriod)` → `api/content-analytics.php?action=overview` ซึ่งคืน `queue`, `funnel`, `aging`, `assets`, `social_snapshot`, `engagement_trend`, `platform_performance`, `page_summary` และหน้าเรียก `useContentItems()`, `useAllSchedules()`, `useOverdueCount()`, `useSendNow()` เพิ่มสำหรับกล่องงาน
- ข้อเท็จจริงของข้อมูลที่ตรวจแล้ว (25 ก.ย. 2026):
  - **Funnel:** `requested_at` = เขียนทับทุกครั้งที่ขอใหม่ ไม่ถูกล้าง; `published_at` = ตั้งครั้งเดียว (`COALESCE`); **`approved_at` ถูกล้างเป็น NULL** เมื่อ reject / ขออนุมัติใหม่ / revision / แก้แผนหรือวันที่ของงานที่ยังไม่เผยแพร่ (`api/approvals.php`, `api/content-items.php`, `api/brand-content.php` 2 จุด) และ `approval_requests` ว่าง ย้อนประวัติไม่ได้ · การเผยแพร่มี gate บังคับอนุมัติก่อน แต่ไม่มี gate "อนุมัติต้องผ่านขออนุมัติ" · funnel เดิมเป็น all-time ไม่ถูก render
  - **Engagement:** `content_post_metrics.likes` = ผลรวม reaction ทุกชนิดของโพสต์ (`post_reactions_by_type_total` / `post_video_likes_by_reaction_type`) เป็นยอดสะสมตลอดชีวิตโพสต์ · โค้ดเดิมใช้ วิว + ไลก์ · ทดสอบ Graph API จริง (25 ก.ย., อ่านอย่างเดียว): `post_activity_by_action_type` คืน `{like, comment, share}` ได้, `post_clicks_by_type` ได้, `post_saves` ถูกปฏิเสธ (#100 invalid metric), video id ต้องถาม `post_id` ก่อนจึงเรียก `/insights` ของโพสต์บนเพจได้ · Reaction ใน insights (7) มากกว่า `reactions.summary` บนโพสต์ (4) ได้
  - **Schedule:** `brand-content.php?action=all-schedules` รวม `content_schedules` (จากแผน, ส่งโดย cron-publish) กับ `content_publish_queue` (จากหน้าต่างเผยแพร่/`send_now`) · cron-publish ส่งผ่าน `publish_via_central_flow()` ซึ่ง INSERT แถวคิวตอนส่งจริง → รายการที่ยัง **pending** ไม่ซ้ำกันระหว่าง 2 ตาราง แต่รายการที่ส่งแล้วมีทั้ง 2 ตาราง
  - **Followers:** `facebook_page_insights_daily` ไม่มีคอลัมน์ platform (เพจเดียวต่อ tenant) ใช้ `pageInsightsRange()` + `PAGE_METRIC_AGG` ที่มีอยู่
  - `ContentDashboardPage.tsx` มีการแก้ที่ยังไม่ commit: หัวข้อตามส่วน และชื่อ "คอนเทนต์ที่ยังไม่เผยแพร่" · `ContentDashboardSections.test.tsx` ยังคาดหัวข้อ "แดชบอร์ดการตลาด"
  - DB local เป็นสำเนา ไม่ใช่ production ตัวเลขอาจเป็นข้อมูลทดสอบ

## Goals / Non-Goals

**Goals:**
- ภาพรวมตอบได้ในแวบเดียวว่าการผลิต → การเผยแพร่ → ผลลัพธ์ เดินอย่างไรในช่วงที่เลือก
- ทุกตัวเลขมีช่วงเวลาและนิยามที่ชัด ตัวเลขที่ควรเท่ากันระหว่างกล่องต้องเท่ากัน
- ไม่มีความสามารถใดหายไปจากระบบ (ปุ่มลองส่งใหม่ยังอยู่)

**Non-Goals:**
- แท็บ "งานวันนี้" และการย้ายกล่องงานออกจากภาพรวม (change แยก ยังไม่ตัดสินตำแหน่ง)
- เก็บประวัติสถานะเพื่อ funnel แบบ "เคยอนุมัติ" (ต้องแก้ database)
- แก้แท็บวิเคราะห์ส่วนอื่นนอกจากนิยาม Engagement ระดับโพสต์ของ sub-tab โซเชียล (D9), ส่วนแคมเปญ, หน้าคอนเทนต์, หน้าปฏิทิน
- เปลี่ยน "Engagement รวม" ของ sub-tab เนื้อหา (`content_items.views/likes` ที่รวมตัวเลขกรอกเอง) และ Best Time (`avg_engagement` จากอีกแหล่ง)
- นับอีเมลแคมเปญในภาพรวมคอนเทนต์
- กฎต้องระวัง / เป้าหมายรายเดือน (ไม่อยู่ในแนวคิดรอบนี้)

## Decisions

### D1: ข้อมูลทั้งหมด ไม่มีช่วงเวลาและไม่มีการเปรียบเทียบ
ผู้ใช้ตัดสิน (25 ก.ย. 2026) ว่าภาพรวมไม่ต้องเทียบเดือนต่อเดือน (MoM) ทั้งใน KPI และในหน้า ให้แสดงภาพรวมจากข้อมูลทั้งหมดที่ระบบมี backend จึงไม่รับพารามิเตอร์ช่วงเวลา ไม่คืน `range` / `compare` / `change_pct` และ frontend ไม่มีตัวเลือกเดือนหรือตัวบ่งชี้ ▲/▼ กล่องที่โดยธรรมชาติไม่ใช่ "ข้อมูลทั้งหมด" (สถานะ ณ ตอนนี้, กำหนดการข้างหน้า, trend รายเดือน) ติดป้ายบอกขอบเขตของตัวเอง
- ร่างแรกใช้ "เดือนนี้ เทียบช่วงวันเดียวกันของเดือนก่อน" — ถูกแทนด้วยการตัดสินใจนี้ ประเด็น "การ์ด 67 แต่กราฟ 0" ยังแก้ได้ เพราะทุกกล่องที่เป็นตัวเลขสรุปใช้ข้อมูลทั้งหมดชุดเดียวกัน
- การดูผลตามช่วงเวลายังทำได้ที่แท็บวิเคราะห์ (มีตัวกรองช่วงวันที่อยู่แล้ว)

### D2: Engagement ระดับโพสต์ ตัวหารเดียวกันทั้งหน้า
ใช้ `fetchSocialSeriesRows()` เดิม (แถวล่าสุดต่อคอนเทนต์ต่อช่องทาง, ไม่กรองวันที่) รวม Engagement ตามนิยาม D9 (ร่างแรกใช้เฉพาะ `likes` — ถูกแทนด้วย D9) แล้วคำนวณ Engagement, Posts (DISTINCT content_item_id), Avg/Post ทั้งใน Global KPI, Platform Performance และ Engagement Trend จากชุดแถวเดียวกัน → ผลรวมของตารางแพลตฟอร์มเท่ากับ KPI เสมอ
- Followers มาจากระดับเพจ (ค่าล่าสุดของ `page_follows` ใน `facebook_page_insights_daily`) จึงใช้ชื่อ "ผู้ติดตามเพจ" และไม่ถูกใช้หารหรือรวมกับตัวเลขระดับโพสต์

### D3: Funnel = คอนเทนต์ทั้งหมด นับแบบ "ถึงขั้นนี้หรือเลยไปแล้ว"
```
cohort    = content_items ทั้งหมดของ tenant
created   = COUNT(*)
requested = SUM(requested_at IS NOT NULL OR approved_at IS NOT NULL OR published_at IS NOT NULL)
approved  = SUM(approved_at IS NOT NULL OR published_at IS NOT NULL)
published = SUM(published_at IS NOT NULL)
in_progress = created − published
```
- นิยาม "หรือเลยไปแล้ว" ทำให้ funnel ลดหลั่นเสมอแม้ข้อมูลข้ามขั้น (เช่น อนุมัติโดยไม่มี `requested_at`)
- ขั้นอนุมัติกำกับว่า "อนุมัติอยู่ ณ ตอนนี้" เพราะ `approved_at` ถูกล้างได้
- ทุกขั้นนับจากคอนเทนต์ชุดเดียวกัน จึงเป็น conversion จริง ไม่เอาจำนวนจากชุดอื่น (เช่นแถวคิว) มาเป็นขั้นสุดท้าย
- ทางเลือกที่ไม่เลือก: แต่ละขั้นนับตามวันที่เกิด (ได้ throughput ไม่ใช่ conversion และมีอยู่แล้วในแท็บวิเคราะห์) · เก็บประวัติสถานะ (ต้องแก้ DB, Non-Goal)

### D4: Schedule summary รวม 2 แหล่งเฉพาะ pending
`content_schedules.status='pending'` (กรอง tenant ผ่าน plan) UNION ALL `content_publish_queue.status='pending'` ที่ `scheduled_at` อยู่ในวันนี้หรือพรุ่งนี้ group ตาม (วัน, HH:MM, platform) — ไม่ซ้ำกันเพราะแถวคิวของกำหนดการถูกสร้างตอนส่ง (ดู Context) รายการ pending ของวันนี้ที่เวลาผ่านไปแล้ว (เลยกำหนด) ยังนับรวม เพราะยังเป็นงานของวันนี้ ส่วนการเตือนเลยกำหนดอยู่ในส่วนงานที่ต้องจัดการ

### D5: สถานะคอนเทนต์ = ข้อมูลเดียวกับ Work Progress แสดงแบบย่อ
backend คืน `status_summary` (COUNT GROUP BY status ของ tenant) และลำดับสถานะใช้ค่าคงที่ชุดเดียวกับ Work Progress ฝั่ง frontend (ไม่ประกาศลำดับซ้ำ) กล่อง Work Progress เดิมในส่วนงานยังนับจาก `useContentItems()` — spec กำหนดให้ตัวเลขตรงกัน และ test ยืนยัน

### D6: หัวข้อตามส่วน
ใช้ตามโค้ดที่แก้ไว้แล้ว เปลี่ยนเฉพาะคำอธิบายส่วนคอนเทนต์ และแก้ `ContentDashboardSections.test.tsx` ที่ยังคาด "แดชบอร์ดการตลาด"

### D7: ส่วนงานที่ต้องจัดการคงของเดิมทั้งก้อน
ย้ายกล่องงานเดิมลงไปด้านล่างใต้หัวข้อ "งานที่ต้องจัดการ" โดยไม่แก้พฤติกรรม (hook เดิม, `send_now` เดิม) — เมื่อทำแท็บงานวันนี้ จะย้ายส่วนนี้ออกทั้งก้อน `queue` และ `aging` ยังอยู่ใน payload ของ overview และไม่ผูกช่วงเวลา แก้ข้อความเตือนเลยกำหนดให้ชี้แท็บ "กำหนดการโพสต์" ของหน้าคอนเทนต์

### D8: payload overview ใหม่ ชื่อ action เดิม
คง `?action=overview` (ผู้เรียกมีแค่แท็บนี้) เปลี่ยน payload เป็นข้อมูลทั้งหมด ไม่รับพารามิเตอร์ช่วงเวลา ถอด `trend_range`/`platform_period`, `social_snapshot`, `page_summary`, `assets`, funnel แบบนับเฉพาะ timestamp · Engagement Trend คืนทุกเดือนตั้งแต่เดือนแรกที่มีโพสต์ที่วัดได้ถึงเดือนปัจจุบัน (เดือนว่างเป็น null) · hook `useContentOverview(enabled)` · component ใหม่ใน `src/components/content/overview/`: `GlobalKpiRow`, `ProductionSection` (funnel + สถานะ + ยังไม่เผยแพร่), `PublishingSection` (health + schedule summary), `ResultsSection` (trend + platform table) และลบ `Overview*` 4 ไฟล์เดิม

### D9: Engagement = Reaction + Comment + Share + Click นิยามเดียวทั้งแดชบอร์ด
ผู้ใช้ตัดสิน (25 ก.ย. 2026) ให้ Engagement เป็นปฏิสัมพันธ์ทั้งหมดที่ระบบเก็บได้ และตอบคำถาม 3 ข้อ: (1) Video Interaction = ปฏิสัมพันธ์บนโพสต์วิดีโอ (Reaction/Comment/Share/Click) **ไม่ใช่ยอดเล่น** — ยอดเล่นแสดงแยก (2) ใช้นิยามเดียวทั้งแท็บภาพรวมและแท็บวิเคราะห์ › โซเชียล (3) ไม่ใช้ Save เลย (ไม่มีคอลัมน์ ไม่แสดง)
```
engagement = likes (Reaction ทุกชนิด) + comments + shares + clicks     ← NULL นับเป็น 0
views (ยอดเล่นวิดีโอ) = แสดงแยก ไม่นับรวม
```
- **ที่เดียวที่นิยามอยู่:** `ENGAGEMENT_PARTS` / `engagementBreakdown()` / `socialEngagement()` ใน `api/content-analytics.php` ทั้ง `?action=overview` และส่วน `social` ของ `?action=analytics` เรียกจากตรงนี้ จึงไม่มีทางได้ตัวเลขต่างกัน
- **แหล่งข้อมูล:** Comment/Share จาก `post_activity_by_action_type` (insights ชุดเดียวกับ Reaction/Click) แทน field `comments.summary`/`shares` ของโพสต์ — ตัวเลขทุกส่วนมาจาก Insights ชุดเดียวกัน แม้ Reaction ใน Insights อาจมากกว่าที่เห็นบนหน้าเพจ (ใส่คำอธิบายไว้ที่การ์ดและ notice card)
- **วิดีโอ:** `video_insights` ไม่มี click/comment/share → ถาม `GET /{video_id}?fields=post_id` แล้วเรียก `/insights` ของ `{page_id}_{post_id}` ถ้าพลาด เก็บ NULL + warning โดยไม่ทำให้โพสต์ล้ม
- **ไม่ใช้ยอดเล่น:** autoplay ทำให้ยอดเล่นสูงเกินจริงและทำให้วิดีโอ 1 ตัวกลบทุกโพสต์; `post_clicks` ของ Facebook นับ "video play" เป็นคลิกอยู่แล้ว การบวกยอดเล่นจะนับซ้ำ
- **ไม่ backfill:** ค่าเป็นยอดสะสมตลอดชีวิตโพสต์และรายงานอ่านแถวล่าสุด cron รอบถัดไปเติมให้ทุกโพสต์เอง (รันแล้วบน local: 16 โพสต์)
- **Global KPI** แสดงบรรทัด "Reaction · Comment · Share · Click" ใต้ตัวเลข (`kpi.breakdown`) ตาราง Platform Performance คงคอลัมน์เดิม
- **ทางเลือกที่ไม่เลือก:** ถ่วงน้ำหนักแต่ละชนิด (อธิบายผู้บริหารยาก), รวมยอดเล่นวิดีโอ, เก็บ Save เป็นช่องว่างไว้ก่อน

## Risks / Trade-offs

- [ภาพรวมไม่บอกว่าเดือนนี้ดีขึ้นหรือแย่ลง] → ตั้งใจตามการตัดสินใจ D1 ใช้ Engagement Trend รายเดือนดูทิศทาง และแท็บวิเคราะห์ดูตามช่วงเวลา
- [ตัวเลขทั้งหมดโตขึ้นเรื่อยๆ ตามอายุการใช้งาน] → ยอมรับ เป็นภาพรวมสะสมโดยเจตนา มีข้อความกำกับว่าเป็นข้อมูลทั้งหมด
- [ขั้นอนุมัติต่ำกว่าความจริงเมื่อมีการส่งกลับแก้บ่อย] → คำกำกับ "อนุมัติอยู่ ณ ตอนนี้" และบันทึกการเก็บประวัติสถานะเป็นงานถัดไป
- [ภาพรวมยังยาวเพราะส่วนงานอยู่ด้านล่าง] → ยอมรับชั่วคราวจนกว่าจะทำแท็บงานวันนี้ ส่วนงานแยกด้วยหัวข้อชัด
- [ผู้ใช้ที่ชินกับปุ่ม 7/30/90 และคอลัมน์ "เข้าชม/อัตรา"] → ข้อมูลรายละเอียดยังอยู่ที่แท็บวิเคราะห์ › โซเชียล
- [ข้อมูล local ไม่ใช่ production] → ตรวจ semantics กับข้อมูลจริงหลัง deploy
- [Engagement ในแดชบอร์ดไม่ตรงกับตัวเลขที่เห็นบนหน้าเพจ Facebook] → ใช้ Insights ชุดเดียวทั้งหมดและกำกับไว้ที่การ์ด/notice card (D9)
- [ตัวเลข Engagement ของแท็บวิเคราะห์เปลี่ยนจาก views+likes เป็นนิยามใหม่ ผู้ใช้ที่จำตัวเลขเดิมอาจสับสน] → การ์ดกำกับสูตร และยอดเล่นวิดีโอยังเห็นได้ในการ์ดแยก
- [ช่วงก่อน cron รอบแรกหลัง deploy Comment/Share เป็น NULL = 0] → รัน cron หลัง migration ทันที
- [ขอ `post_id` ของวิดีโอเพิ่ม 2 คำขอต่อวิดีโอต่อรอบ] → จำนวนวิดีโอน้อยและมีเพดาน 200 แถวต่อรอบอยู่แล้ว

## Migration Plan

1. รัน migration `database/migrations/2026_09_25_170000_add_comments_shares_to_content_post_metrics.sql` (เพิ่มคอลัมน์ NULL ได้ ไม่กระทบโค้ดเดิม)
2. deploy backend + frontend พร้อมกัน (payload overview/analytics เปลี่ยน)
3. รัน cron `content-metrics-sync` หนึ่งรอบเพื่อเติม Comment/Share ให้ทุกโพสต์

rollback = revert commit คอลัมน์ `comments`/`shares` ปล่อยไว้ได้ (NULL ได้ ไม่มีโค้ดเดิมอ่าน)

## Open Questions

- ไม่มี (ตำแหน่งแท็บงานวันนี้และการเก็บประวัติสถานะอยู่นอกขอบเขต)
