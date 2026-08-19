## Context

หน้า `ContentDashboardPage.tsx` (1,036 บรรทัด) ปัจจุบันมี 2 แท็บชั้นที่ 1 (ภาพรวม/วิเคราะห์) ผูกกับ URL param `tab` ผ่าน `useSearchParams` แท็บ "วิเคราะห์" รวม stat card (result metrics + engagement) และ widget ทั้งหมด (แพลตฟอร์ม, Top Content, Best Time, Throughput, Lead time, SEO, Plan conversion, Publish success) ไว้ใน `TabsContent value="analytics"` เดียว

ข้อเท็จจริงจาก DB ที่ต้องคำนึงถึงในการออกแบบ: เมตริกโซเชียล (followers/reach/impressions) และเว็บ (traffic/GA4) ไม่มีตาราง/คอลัมน์รองรับเลย; `content_items.views/likes` มีอยู่แต่กรอกมือ (SUM=0); `content_posting_analytics` มี 0 แถว (ต้อง ≥10 published post จึงคำนวณได้)

## Goals / Non-Goals

**Goals:**
- เพิ่ม sub-tab 3 ส่วนในแท็บวิเคราะห์ + date range filter
- แท็บ "เนื้อหา" ทำงานจริง; แท็บโซเชียล/เว็บไซต์เป็น placeholder ตรงไปตรงมา (ไม่มี mock data)
- แยกให้ชัดว่าเมตริกใด respect ช่วงวันที่ vs snapshot

**Non-Goals:**
- ไม่แตะแท็บ "ภาพรวม" และ widget 12 ตัวในนั้น
- ไม่แตะ `content-items.php` / `content-analytics.php?action=overview`
- ไม่ทำ ingestion/OAuth/cron sync กับแพลตฟอร์มภายนอกหรือ GA4/Search Console
- ไม่สร้าง migration หรือตาราง `content_social_metrics`/`content_web_metrics`
- ไม่ใส่ mock data / seed data / ตัวเลข hardcode

## Decisions

- **แยก sub-tab เป็น component ย่อย** — ไฟล์ `ContentDashboardPage.tsx` ใหญ่แล้ว (1,036 บรรทัด) จึงแยกเป็น `AnalyticsContentTab`, `AnalyticsSocialTab`, `AnalyticsWebsiteTab` ใน `src/components/content/` แล้วให้ `ContentDashboardPage` เป็น orchestrator (จัดการ `tab`/`view`/`from`/`to` state และ wiring data) เพื่อไม่ให้ไฟล์เดียวโตเกินควบคุม — ทางเลือกอื่น (รวมทุกอย่างในหน้าเดียว) ทำให้ maintenance ยากขึ้น

- **Nested Tabs ใช้ primitive เดิมไม่เขียนใหม่** — ใช้ `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` ชั้นที่ 2 ซ้อนใน `TabsContent value="analytics"` โดย `TabsList` ชั้น 2 ใช้คลาส underline ตาม pattern Helpdesk (ต่างจากชั้น 1 โดยเจตนาเพื่อแสดงลำดับชั้น)

- **URL param ตัวที่สอง `view`** — อ่าน/เขียนร่วมกับ `tab` ผ่าน `useSearchParams` โดย fallback `view` เป็น `content` เมื่อค่าไม่รู้จัก/ไม่มี default เป็น `content` (ไม่ใช่ `social`) เพราะเป็นแท็บเดียวมีข้อมูลจริงในเฟสนี้ — เมื่อมี ingestion เฟสถัดไปค่อยย้าย default กลับเป็น social

- **Date filter ใช้ `ReportDateFilter` เดิม (reuse)** — ไม่เขียน date picker ใหม่; ถ้าต้องแก้ component ต้อง backward-compatible (ไม่กระทบหน้า Reports/Sales/Companies ที่ใช้ร่วมกัน) default range = 12 เดือนย้อนหลังถึงวันนี้

- **from/to ผ่าน prepared statement เท่านั้น** — ฝั่ง backend validate รูปแบบ `YYYY-MM-DD` (เช่น `DateTime::createFromFormat`) ก่อนใช้ และ bind เป็น parameter ไม่ interpolate; ถ้าไม่ส่งใช้ default 12 เดือน; `action=overview` ไม่รับ from/to

- **นิยาม respect vs snapshot ชัดเจน** — เขียนเป็นตารางนิยาม (ดู proposal/spec) เพื่อไม่ให้ตัวเลขบนหน้าจอขัดกัน:
  - respect ช่วงวันที่: throughput, lead time, plan conversion, publish success, stat card 4 ใบของแท็บเนื้อหา, เวลาผลิตเฉลี่ย
  - snapshot (ไม่ผูกช่วง): SEO completeness, ความถี่โพสต์ 7 วันล่าสุด, `weekly_posts_target`, best time to post
  - widget snapshot แสดง label "ไม่ผูกช่วงวันที่ที่เลือก"

- **แปลง widget เป็น chart** — "แพลตฟอร์ม" list → Donut (`PieChart` + `innerRadius`), "อัตราสำเร็จการเผยแพร่" progress bar → `BarChart` stacked sent/failed — เพื่อให้มี donut + bar chart ตามที่ต้องการ โดยสี platform ยังใช้ `getPlatformColors()`

- **query key มี from/to** — `contentKeys.biAnalytics(from, to)` และ `contentKeys.resultMetrics(from, to)` รับ parameter เพื่อให้ TanStack Query cache แยกช่วงวันที่

## Risks / Trade-offs

- [ContentDashboardPage ยังคงเป็น orchestrator ใหญ่] → แยก render ของแต่ละ sub-tab เป็น component ย่อย แต่ state wiring ยังอยู่ที่หน้า เพื่อลด scope การ refactor
- [การเปลี่ยน ReportDateFilter อาจกระทบหน้าอื่น] → ไม่แก้ component ถ้าไม่จำเป็น; ถ้าจำเป็น ต้องเพิ่ม props แบบ optional และทดสอบหน้า Reports/Sales/Companies
- [default sub-tab เป็น content อาจไม่ตรงความคาดหวังระยะยาว] → บันทึกไว้ชัดว่าเมื่อมี ingestion เฟสถัดไปให้ย้าย default กลับเป็น social
- [เมตริก snapshot กับ respect ผสมกันทำให้สับสน] → แสดง label "ไม่ผูกช่วงวันที่ที่เลือก" บน widget snapshot ทุกตัว

## Migration Plan

- Deploy: frontend (Vite build) + backend PHP endpoint (no DB migration) → รัน `pnpm lint` / `pnpm build` / `pnpm test`
- Rollback: revert commit; ไม่มี schema change จึง rollback ง่าย

## Open Questions

- (ไม่มี) — ข้อตัดสินใจหลักถูกระบุครบแล้วในสเปคและ design นี้
