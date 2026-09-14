## 1. Backend — `api/content-analytics.php` (`?action=overview`)

- [x] 1.1 เพิ่ม query `social_snapshot`: all-time aggregate (`SUM(views)`, `SUM(likes)`, `COUNT(DISTINCT content_item_id)` จาก `content_post_metrics` ของ tenant) พร้อม `has_data` flag และ `avg_engagement_per_post` (`null` เมื่อ posts=0)
- [x] 1.2 เพิ่ม param `trend_range` (`7`/`30`/`90`, default `7`) และ query `engagement_trend`: bucket ตาม mapping ใน design.md (7=รายวัน, 30=รายสัปดาห์ rolling, 90=รายเดือน rolling) คืน array ของ `{ bucket_label, engagement }` เดนส์ (ไม่ข้าม bucket ที่ไม่มีข้อมูล)
- [x] 1.3 เพิ่ม param `platform_period` (`day`/`week`/`month`, default `day`) และ query `platform_performance`: เริ่มจาก `SELECT DISTINCT platform FROM publish_channels WHERE tenant_id = ? AND is_active = 1` เป็น base list แล้ว `LEFT JOIN` ผลรวม posts/engagement จาก `content_post_metrics` ในช่วงเวลาที่เลือก (rolling window ตาม design.md ข้อ 4) — เพิ่มการรวมแพลตฟอร์มที่มีข้อมูลจริงแต่ไม่ active เข้ามาด้วย (แก้ open question ใน design.md: ข้อมูลเก่าไม่หายไปจากตาราง)
- [x] 1.4 คำนวณ `avg_engagement_per_post` ต่อแถวใน `platform_performance` เป็น `null` เมื่อ `posts = 0` (ไม่หารด้วยศูนย์)
- [x] 1.5 เรียง `platform_performance` จากมากไปน้อยตาม `avg_engagement_per_post` (แถวที่เป็น `null` อยู่ท้ายสุด)
- [x] 1.6 รวม 3 กลุ่มใหม่เข้ากับ response เดิมของ `?action=overview` โดยไม่แก้โครงสร้าง `queue`/`funnel`/`aging`/`assets` เดิม
- [x] 1.7 ตรวจสอบว่าทุก query กรองด้วย `tenant_id` ของผู้ใช้ปัจจุบัน (เหมือน query อื่นในไฟล์นี้)

## 2. Frontend — Types และ hook

- [x] 2.1 เพิ่ม type `SocialSnapshot`, `EngagementTrendPoint`, `PlatformPerformanceRow` ใน `src/components/content/types.ts`
- [x] 2.2 ขยาย type `ContentOverview` (หรือ type ที่ `useContentOverview` คืน) ให้มี `social_snapshot`, `engagement_trend`, `platform_performance`
- [x] 2.3 ปรับ `useContentOverview()` ใน `src/hooks/useContent.ts` ให้รับ/ส่ง param `trend_range` และ `platform_period` (state ของแต่ละ widget อยู่ใน `ContentDashboardPage.tsx` เหมือน pattern เดิมของ `range`/`view`)

## 3. Frontend — Widget การ์ดสรุป Engagement

- [x] 3.1 สร้าง component การ์ดสรุป 4 ใบ (Engagement รวม, โพสต์ที่วัดได้, ไลก์รวม, Engagement เฉลี่ย/โพสต์) ใต้ `src/components/content/` — reuse สไตล์การ์ดจาก `AnalyticsSocialTab.tsx` (`statCards`/`cellValue` pattern) เพื่อความสม่ำเสมอของ UI (`OverviewEngagementSummary.tsx`)
- [x] 3.2 ใช้ `has_data`/`avg_engagement_per_post === null` แสดง "—" แทน "0" ตาม pattern เดิม

## 4. Frontend — Widget กราฟแนวโน้ม Engagement

- [x] 4.1 สร้าง component กราฟเส้น (recharts `LineChart`, เส้นเดียว) พร้อมตัวเลือกช่วงเวลา 7/30/90 วัน (ปุ่ม/toggle ไม่ใช่ dropdown ตาม mockup ที่อ้างอิง) (`OverviewEngagementTrendChart.tsx`)
- [x] 4.2 แสดง empty state ภาษาไทยเมื่อไม่มี engagement ในช่วงที่เลือก (ไม่วาดเส้นแบนที่ 0)
- [x] 4.3 label แกน x ให้สื่อ granularity ที่ใช้อยู่ (เช่น "รายวัน"/"รายสัปดาห์"/"รายเดือน") เพื่อไม่ให้สับสนกับตารางด้านล่างที่มีตัวเลือกคนละชุด

## 5. Frontend — Widget ตารางประสิทธิภาพแยกแพลตฟอร์ม

- [x] 5.1 สร้าง component ตาราง (Platform, Posts, Engagement รวม, Engagement เฉลี่ย/โพสต์) พร้อมตัวเลือกช่วงเวลา วัน/สัปดาห์/เดือน (ป้ายชื่อต่างจากกราฟด้านบนโดยตั้งใจ) (`OverviewPlatformPerformanceTable.tsx`)
- [x] 5.2 แถวที่ `avg_engagement_per_post === null` แสดง "—" ในคอลัมน์นั้น
- [x] 5.3 เรียงตามลำดับที่ backend ส่งมา (ไม่ sort ซ้ำฝั่ง frontend)

## 6. จัดวาง Layout ในแท็บภาพรวม

- [x] 6.1 แก้ `src/pages/ContentDashboardPage.tsx`: วางการ์ดสรุป (3) เป็นสิ่งแรกในแท็บภาพรวม เหนือ banner แจ้งเตือนเลยกำหนด
- [x] 6.2 วางกราฟแนวโน้ม (4) ถัดจากการ์ดสรุป ก่อน banner แจ้งเตือน/widget operational เดิม
- [x] 6.3 วางตารางประสิทธิภาพ (5) เป็นส่วนสุดท้ายของแท็บภาพรวม ถัดจากแถว 3 เดิม (คิวเผยแพร่ + กำหนดการโพสต์ถัดไป)
- [x] 6.4 ตรวจสอบ responsive: ทุก section stack เป็นคอลัมน์เดียวบนจอต่ำกว่า `lg` ตามลำดับใหม่ (ดู scenario ใน `content-dashboard-layout` delta spec) — ยืนยันในเบราว์เซอร์จริง (มือถือ 375px) ไม่มี page-level overflow (`docScrollWidth === docClientWidth`)

## 7. Verification

- [x] 7.1 รัน `pnpm lint` และ `pnpm build` (0 error ทั้งคู่ — lint warning ที่เหลือเป็นของเดิม ไม่เกี่ยวกับไฟล์ที่แก้)
- [x] 7.2 ทดสอบ manual: เปิดแท็บภาพรวม ตรวจว่าการ์ด/กราฟ/ตารางแสดงถูกต้องทั้งกรณีมีข้อมูลและกรณี tenant ที่ยังไม่เคย sync (empty state ไม่ใช่ 0 ปลอม) — ทดสอบกับข้อมูลจริงใน local DB (login admin@flowstack.com): การ์ด 35/15/35/2 ตรงกับ `social_snapshot`, กราฟ 7 วัน default แสดง empty state ถูกต้อง (ไม่มี engagement ในช่วงนั้นจริง), ตารางแสดง Facebook พร้อมแพลตฟอร์มอื่นเป็น "—"
- [x] 7.3 ทดสอบสลับตัวเลือกช่วงเวลาของกราฟ (7/30/90) และของตาราง (วัน/สัปดาห์/เดือน) แยกกัน ยืนยันว่าไม่กระทบ widget อื่น — ยืนยันจาก network requests จริง: เปลี่ยน `platform_period` แล้ว `trend_range` คงเดิมและกลับกัน, ผลรวม engagement_trend (33+2=35) ตรงกับ `social_snapshot.engagement` พอดี ยืนยันความถูกต้องของ bucket logic
- [x] 7.4 ทดสอบ responsive บนจอแคบ (< lg) ว่าลำดับ section ตรงตาม scenario ใหม่และไม่มี overflow
