## Why

แท็บ "วิเคราะห์" ของแดชบอร์ดคอนเทนต์ปัจจุบันรวมเมตริกทุกอย่าง (โซเชียล, เว็บไซต์, เนื้อหา) ไว้ในหน้าเดียวโดยไม่มีโครงสร้างรองรับหลายมิติข้อมูล และไม่มีตัวกรองช่วงวันที่ ทำให้ข้อมูลเชิง insight ปนกันและวิเคราะห์ย้อนหลังได้ยาก ต้องการแบ่งเป็น sub-tab 3 ส่วนตาม pattern tab ของหน้า Helpdesk เพื่อจัดกลุ่มเมตริกให้ชัดเจน พร้อมเพิ่ม date range filter ระดับแท็บวิเคราะห์

## What Changes

- เพิ่ม nested tab navigation **ภายในแท็บ "วิเคราะห์"** แบ่งเป็น 3 sub-tab: โซเชียล / เว็บไซต์ / เนื้อหา ผูกกับ URL query parameter `view=social|website|content` (default = `content`)
- แท็บ "เนื้อหา" ทำงานได้จริงเต็มรูปแบบ (Stat card 4 ใบ + ย้าย widget เดิมในแท็บวิเคราะห์ทั้งหมดเข้ามา + widget ใหม่ "ประสิทธิภาพการผลิต")
- แท็บ "โซเชียล" และ "เว็บไซต์" สร้างโครง stat card + notice card พร้อม empty state ชัดเจน (ค่าแสดง "—") **ไม่มี mock data / hardcode ตัวเลข**
- เปลี่ยน widget "แพลตฟอร์ม" จาก list เป็น Donut Chart, "อัตราสำเร็จการเผยแพร่" จาก Progress bar เป็น Bar Chart (stacked sent/failed)
- เพิ่ม Date Range Filter ระดับแท็บวิเคราะห์ (reuse `ReportDateFilter`) พร้อมรับ `from`/`to` ใน backend endpoint 2 จุด
- Stat card เดิม 2 ใบ (เวลาผลิตเฉลี่ย, ความถี่การโพสต์/สัปดาห์) ย้ายจาก stat card เป็น widget "ประสิทธิภาพการผลิต"

## Capabilities

### New Capabilities

- `content-dashboard-analytics-subtabs`: โครงสร้าง sub-tab 3 ส่วน (โซเชียล/เว็บไซต์/เนื้อหา) ภายในแท็บวิเคราะห์ + URL param `view` + default sub-tab + visual style ตาม pattern Helpdesk
- `content-dashboard-date-range-filter`: ตัวกรองช่วงวันที่ระดับแท็บวิเคราะห์ + การผูก from/to กับ backend + นิยามว่าเมตริกใด respect ช่วงวันที่ vs snapshot
- `content-dashboard-social-placeholder`: แท็บโซเชียลแบบ placeholder (stat card 4 ใบแสดง "—" + notice card)
- `content-dashboard-website-placeholder`: แท็บเว็บไซต์แบบ placeholder (stat card 4 ใบแสดง "—" + notice card)

### Modified Capabilities

- `content-dashboard-tabs`: ย้ายรายการ section ของแท็บวิเคราะห์ไปอยู่ใต้ sub-tab "เนื้อหา" และเพิ่มโครง sub-tab ชั้น 2
- `content-dashboard-analytics`: ย้าย Top Content / Best Time ไปอยู่ใน sub-tab "เนื้อหา"
- `content-dashboard-bi-widgets`: widget ทั้ง 5 ของแท็บวิเคราะห์ย้ายไป sub-tab "เนื้อหา" + เปลี่ยน 2 ตัวเป็น donut/bar chart + รับ date range
- `content-dashboard-stats`: stat card แท็บวิเคราะห์เปลี่ยนชุดเป็น 4 ใบตาม spec ใหม่ (เนื้อหาทั้งหมด, เผยแพร่แล้ว, Engagement รวม, Content Performance)
- `content-result-metrics`: เวลาผลิตเฉลี่ย/ความถี่การโพสต์เปลี่ยนจาก stat card เป็น widget "ประสิทธิภาพการผลิต" + endpoint รับ from/to

## Impact

- `src/pages/ContentDashboardPage.tsx` — เพิ่ม nested Tabs + จัด widget เข้าแท็บเนื้อหา + wiring date filter
- `src/components/content/` — component ใหม่ (AnalyticsContentTab, AnalyticsSocialTab, AnalyticsWebsiteTab, Donut/Bar chart, ประสิทธิภาพการผลิต)
- `src/components/reports/ReportDateFilter.tsx` — reuse (ไม่แก้ ถ้าจำเป็นต้องแก้ต้องไม่กระทบหน้าอื่น)
- `src/hooks/useContent.ts` — `useContentAnalytics` / `useResultMetrics` รับ from/to + query key มี parameter
- `src/components/content/types.ts` — type ของ response ที่เปลี่ยน
- `api/content-analytics.php` — `action=analytics` รับ from/to
- `api/brand-content.php` — `action=result-metrics` รับ from/to
- ไม่มีการ migration, ไม่มี ingestion/OAuth/cron sync, ไม่สร้างตาราง `content_social_metrics`/`content_web_metrics`
