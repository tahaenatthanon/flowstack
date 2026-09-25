## 1. API `?action=overview`

- [x] 1.1 `overviewRanges(?month)` + validate `month` (รูปแบบ, ไม่อยู่ในอนาคต, ย้อนไม่เกิน 5 เดือน → 400 ภาษาไทย) (D1)
- [x] 1.2 Global KPI: Engagement/Posts/Avg/Post จาก `likes` ของ `fetchSocialSeriesRows()` ทั้ง current/compare + % และผู้ติดตามเพจจาก `pageInsightsRange()` (D2)
- [x] 1.3 Funnel cohort ตาม D3 (created/requested/approved/published/in_progress)
- [x] 1.4 `status_summary` และ `unpublished_aging` (4 ช่วง + total ไม่มีรายการ) (D5)
- [x] 1.5 `publishing_health` จาก `content_publish_queue` ในช่วง (pending+processing, sent, failed, success_rate current/compare, platforms)
- [x] 1.6 `schedule_summary` วันนี้/พรุ่งนี้ รวม 2 แหล่งเฉพาะ pending group ตามเวลา/แพลตฟอร์ม (D4)
- [x] 1.7 `engagement_trend` 6 เดือนตามเดือนที่เผยแพร่ (เดือนไม่มีโพสต์ = null) และ `platform_performance` (posts/engagement/avg/followers) จากชุดแถวเดียวกับ KPI (D2)
- [x] 1.8 คง `queue`/`aging` เดิมสำหรับส่วนงาน ถอด `trend_range`/`platform_period`, `social_snapshot`, `page_summary`, `assets`, funnel all-time (D8)
- [x] 1.9 ทดสอบ API บน local: ช่วงวันที่, funnel ลดหลั่นและตรง SQL ตรวจมือ, ผลรวมตารางแพลตฟอร์มเท่ากับ KPI, success rate, schedule ไม่นับรายการที่ส่งแล้ว, month ผิด → 400

## 2. Frontend

- [x] 2.1 `types.ts` + `useContent.ts`: type ของ payload ใหม่ และ `useContentOverview(month, enabled)`
- [x] 2.2 `OverviewPeriodPicker` (ผูก `?month=`, แสดงช่วงหลัก/เปรียบเทียบ) และ `GlobalKpiRow` (รูปแบบ "3 (+1, ▲50%)", "—", ผู้ติดตามเพจ + ครอบคลุม, คำกำกับวิธีนับ)
- [x] 2.3 `ProductionSection`: funnel (จำนวน + % ต่อขั้น, "อนุมัติอยู่ ณ ตอนนี้", ยังอยู่ระหว่างทาง, empty state), สถานะคอนเทนต์แบบย่อ, คอนเทนต์ที่ยังไม่เผยแพร่ 4 ช่วง (ป้าย "ณ ตอนนี้")
- [x] 2.4 `PublishingSection`: health 4 ตัว + ครอบคลุม, สรุปกำหนดการวันนี้/พรุ่งนี้ (ป้าย "วันนี้–พรุ่งนี้", "ไม่มีกำหนดการ")
- [x] 2.5 `ResultsSection`: Engagement Trend 6 เดือน (ช่องว่างเมื่อ null, "ตามเดือนที่เผยแพร่") และตาราง Platform Performance
- [x] 2.6 `ContentDashboardPage.tsx`: จัดลำดับตาม spec, ย้ายกล่องงานเดิมลงไปใต้หัวข้อ "งานที่ต้องจัดการ" โดยไม่แก้พฤติกรรม, แก้ข้อความเตือนเลยกำหนดให้ชี้แท็บ "กำหนดการโพสต์", คำอธิบายส่วนคอนเทนต์ใหม่, ถอด state `trendRange`/`platformPeriod`
- [x] 2.7 ลบ `OverviewEngagementSummary.tsx`, `OverviewPageSummary.tsx`, `OverviewEngagementTrendChart.tsx`, `OverviewPlatformPerformanceTable.tsx` หลังยืนยันว่าไม่มีผู้ import

## 3. ตรวจสอบ

- [x] 3.1 test: component ใหม่ (funnel ลดหลั่น/empty, KPI "—" และรูปแบบผู้ติดตาม, success rate "—", schedule ว่าง, ช่องว่างใน trend), ตัวเลขสถานะคอนเทนต์ตรงกับ Work Progress, ปุ่มลองส่งใหม่ในส่วนงานยังเรียก `send_now` · แก้ `ContentDashboardSections.test.tsx` (หัวข้อตามส่วน) และ test เดิมที่ mock payload overview เก่า — ตัวเลขสถานะคอนเทนต์ตรงกับ Work Progress ยืนยันบนหน้าเว็บด้วยข้อมูลจริง (12/9/3/14/19/1 รวม 58) เพราะสองกล่องดึงคนละ API
- [x] 3.2 เปิด dev server ตรวจแท็บภาพรวมด้วยข้อมูลจริงบน local: เดือนนี้/เดือนก่อน, ลำดับส่วน, ป้ายช่วงเวลา, ส่วนงานที่ต้องจัดการใช้งานได้ ทั้งจอใหญ่และมือถือ
- [x] 3.3 รัน `pnpm lint`, `pnpm build`, `pnpm test` — lint 0 error (48 warning เท่าเดิม), build ผ่าน, test ผ่าน 338 (ใหม่ 12) fail 8 ตัวเดิมใน BatchGenerateDialog/PullFromContentDialog/QuickCreateDialog ที่ fail อยู่ก่อนแล้ว

## 4. เปลี่ยนเป็นข้อมูลทั้งหมด ไม่มีการเปรียบเทียบ (ผู้ใช้ตัดสิน 25 ก.ย. — design D1)

- [x] 4.1 API: ถอด `overviewRanges()`/พารามิเตอร์ `month`/`range`/`compare`/`change_pct`; KPI, funnel, publishing health, platform performance คำนวณจากข้อมูลทั้งหมด; trend ตั้งแต่เดือนแรกที่มีโพสต์ที่วัดได้ถึงเดือนปัจจุบัน
- [x] 4.2 Frontend: ลบ `OverviewPeriodPicker` และตัวบ่งชี้ ▲/▼ ทุกจุด, ปรับ types / `useContentOverview(enabled)`, ถอด URL `month`, เพิ่มข้อความกำกับ "ข้อมูลทั้งหมดตั้งแต่เริ่มใช้งาน"
- [x] 4.3 ปรับ test, ตรวจบน dev server, รัน `pnpm lint`, `pnpm build`, `pnpm test` — lint 0 error (48 warning เท่าเดิม), build ผ่าน, test ผ่าน 338 fail 8 ตัวเดิม (BatchGenerateDialog/PullFromContentDialog/QuickCreateDialog) · ResearchProviderForm fail ครั้งเดียวตอนรันทั้งชุด รันเดี่ยวผ่าน 3/3 (flaky ไม่เกี่ยวกับ change นี้)

## 5. Engagement = Reaction + Comment + Share + Click ทั้งแดชบอร์ด (ผู้ใช้ตัดสิน 25 ก.ย. — design D9)

- [x] 5.1 DB: migration `2026_09_25_170000_add_comments_shares_to_content_post_metrics.sql` เพิ่ม `comments`/`shares` INT NULL — รันบน local และตรวจ `SHOW COLUMNS` แล้ว
- [x] 5.2 เก็บข้อมูล: `insights-fetch.php` ขอ `post_activity_by_action_type` (comment/share) และโพสต์วิดีโอขอ click/comment/share ผ่าน `{page_id}_{post_id}` (พลาด = NULL + warning); `content-metrics-sync.php` เขียน `comments`/`shares` และแสดงใน log — รัน cron บน local แล้ว 16 โพสต์ 0 error (วิดีโอได้ clicks=2)
- [x] 5.3 API: `ENGAGEMENT_PARTS` / `engagementBreakdown()` / `socialEngagement()` เป็นนิยามเดียว; overview คืน `kpi.breakdown` และ trend/platform ใช้นิยามใหม่; ส่วน `social` ของ analytics คืน `comments`/`shares`/`clicks` ทุกระดับ และ `engagement` ไม่รวม `views`
- [x] 5.4 Frontend: การ์ด Engagement ในภาพรวมแสดงส่วนประกอบ + คำอธิบาย Insights; แท็บวิเคราะห์ › โซเชียล การ์ด 6 ใบ (Engagement/Reaction/Comment/Share/Click/ยอดเล่นวิดีโอ), breakdown รายแพลตฟอร์ม, ตารางโพสต์เด่นคอลัมน์ใหม่ ("—" เมื่อ null), notice card นิยามใหม่ ไม่มี Save
- [x] 5.5 ตรวจสอบ: test ใหม่ (`AnalyticsSocialEngagement.test.tsx` 2 ข้อ, ส่วนประกอบใน `ContentOverviewBi.test.tsx`), หน้าเว็บตรงกับ SQL ตรวจมือ (ภาพรวม Engagement 42 = Reaction 35 + Comment 2 + Share 0 + Click 5, Avg/Post 3.5; แท็บโซเชียลตรงกัน, ไม่มี scroll แนวนอน), `pnpm lint` 0 error (48 warning เท่าเดิม), `pnpm build` ผ่าน, `pnpm test` ผ่าน 341 fail 8 ตัวเดิม (BatchGenerateDialog/PullFromContentDialog/QuickCreateDialog)
