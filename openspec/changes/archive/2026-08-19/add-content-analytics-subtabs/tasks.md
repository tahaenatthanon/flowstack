## 1. Backend — Date Range Filter

- [x] 1.1 แก้ `api/content-analytics.php` `action=analytics` รับ query param `from`/`to` (YYYY-MM-DD) validate รูปแบบด้วย `DateTime::createFromFormat` ก่อนใช้ และ bind เป็น prepared statement parameter เท่านั้น (ไม่ interpolate)
- [x] 1.2 กรองเมตริก respect ช่วงวันที่ (throughput, lead_time, plan_conversion, publish_success) ด้วยช่วง from/to (default 12 เดือนย้อนหลังเมื่อไม่ส่งมา)
- [x] 1.3 แก้ `api/brand-content.php` `action=result-metrics` รับ `from`/`to` และกรอง `avg_production_hours`/`approved_count` ตามช่วงวันที่ (คง `posts_last_7_days`/`weekly_posts_target` เป็น snapshot ไม่ผูกช่วง)
- [x] 1.4 ยืนยัน `action=overview` ของ `content-analytics.php` ไม่รับ from/to (ไม่เปลี่ยนแปลง)

## 2. Frontend — types + hooks

- [x] 2.1 อัปเดต type ใน `src/components/content/types.ts` ตาม response ที่เปลี่ยน (เพิ่ม field stat card ใหม่ / date range ถ้าจำเป็น)
- [x] 2.2 แก้ `src/hooks/useContent.ts` ให้ `useContentAnalytics(from, to, enabled)` และ `useResultMetrics(from, to, enabled)` รับ from/to และใส่ลงใน query key (`contentKeys.biAnalytics(from,to)` / `contentKeys.resultMetrics(from,to)`)

## 3. Frontend — sub-tab navigation + date filter (ContentDashboardPage)

- [x] 3.1 ใน `src/pages/ContentDashboardPage.tsx` อ่าน/เขียน URL param `view` (social/website/content) ร่วมกับ `tab` ผ่าน `useSearchParams`; fallback/default เป็น `content`; สลับ sub-tab ไม่ให้ `tab=analytics` หลุด
- [x] 3.2 เพิ่ม nested `Tabs` ระดับที่ 2 ใน `TabsContent value="analytics"` ด้วย TabsList/TabsTrigger ตาม style Helpdesk (underline) และไอคอน Share2/Globe/FileText
- [x] 3.3 เพิ่ม `ReportDateFilter` (reuse จาก `src/components/reports/ReportDateFilter.tsx`) เหนือ tab bar ระดับ 2; default range 12 เดือนย้อนหลัง; wiring state from/to ไปยัง hooks
- [x] 3.4 ส่ง state from/to ลงไปยัง component sub-tab แต่ละตัว และ label "ไม่ผูกช่วงวันที่ที่เลือก" บน widget snapshot

## 4. Frontend — แท็บเนื้อหา (AnalyticsContentTab)

- [x] 4.1 สร้าง `src/components/content/AnalyticsContentTab.tsx` และย้าย stat card + widget ทั้งหมดในแท็บวิเคราะห์เดิมเข้ามา
- [x] 4.2 เพิ่ม stat card 4 ใบ: เนื้อหาทั้งหมด (COUNT), เผยแพร่แล้ว (SUM published_at NOT NULL), Engagement รวม (SUM views+likes, ค่าจริงแม้ 0 + hint "ยังไม่มีการซิงก์ engagement จากแพลตฟอร์ม"), Content Performance (อัตราถึงขั้นเผยแพร่ %, null เมื่อ COUNT=0)
- [x] 4.3 ย้าย widget "แพลตฟอร์ม" เป็น Donut Chart (recharts PieChart + innerRadius + legend + getPlatformColors)
- [x] 4.4 ย้าย widget "อัตราสำเร็จการเผยแพร่แยกแพลตฟอร์ม" เป็น Bar Chart (recharts BarChart stacked sent/failed)
- [x] 4.5 ย้าย widget เดิมที่เหลือ (เนื้อหายอดนิยม, เวลาที่ดีที่สุดในการโพสต์, แนวโน้ม Throughput, Lead time, ความสมบูรณ์ SEO, Plan → Content conversion) โดยไม่เปลี่ยน logic
- [x] 4.6 เพิ่ม widget ใหม่ "ประสิทธิภาพการผลิต" (ย้าย stat card เวลาผลิตเฉลี่ย + ความถี่การโพสต์/สัปดาห์ เข้ามาเป็น widget พร้อม label "ไม่ผูกช่วงวันที่ที่เลือก" ในส่วนความถี่)

## 5. Frontend — แท็บโซเชียล + เว็บไซต์ (placeholder)

- [x] 5.1 สร้าง `src/components/content/AnalyticsSocialTab.tsx`: stat card 4 ใบ (ผู้ติดตามรวม, Engagement รวม, Reach รวม, Engagement Rate) ค่าแสดง "—" + hint "ยังไม่ได้เชื่อมต่อแหล่งข้อมูล" + notice card ภาษาไทย (Facebook Graph/Instagram/TikTok)
- [x] 5.2 สร้าง `src/components/content/AnalyticsWebsiteTab.tsx`: stat card 4 ใบ (Traffic รวม, ผู้เข้าชม, Page Views, Conversion Rate) ค่า "—" + hint + notice card (Google Analytics 4 / Search Console)
- [x] 5.3 ยืนยันทั้งสองแท็บไม่มี mock data / hardcode ตัวเลข / chart ปลอม

## 6. Verification

- [x] 6.1 รัน `pnpm lint` ผ่าน
- [x] 6.2 รัน `pnpm build` ผ่าน
- [x] 6.3 รัน `pnpm test` ผ่าน
- [x] 6.4 เปิด dev server ทดสอบ: `/content-dashboard` แท็บภาพรวมเหมือนเดิม (regression), `?tab=analytics` เข้า sub-tab เนื้อหาเป็น default, `?tab=analytics&view=social|website` แสดง "—" + notice, `?view=bogus` fallback content, refresh คงแท็บเดิมทั้ง 2 ชั้น
- [x] 6.5 ทดสอบ endpoint: `?action=analytics&from=2026-01-01&to=2026-08-18` คืนค่าถูกต้อง; from/to รูปแบบผิดถูก reject (ไม่ 500); `?action=overview` ไม่รับ from/to
- [x] 6.6 ตรวจ preview: เปลี่ยน date range แล้ว widget respect ช่วงเปลี่ยน / snapshot ไม่เปลี่ยน; mobile tab bar ระดับ 2 scroll ได้; console ไม่มี error
