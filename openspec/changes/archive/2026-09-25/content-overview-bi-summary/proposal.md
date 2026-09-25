## Why

แท็บ "ภาพรวม" ของแดชบอร์ดคอนเทนต์ตอนนี้ปนงานประจำวันกับผลลัพธ์ และใช้ช่วงเวลาหลายแบบโดยไม่บอกผู้ใช้ (ทั้งหมดตั้งแต่เริ่ม, 28 วัน, 7/30/90 วัน, วัน/สัปดาห์/เดือน) ตัวเลขจึงเทียบกันไม่ได้ เช่น การ์ด Engagement 67 แต่กราฟ 7 วันเป็น 0 ขณะเดียวกัน funnel การผลิตที่ API คำนวณอยู่แล้วก็ไม่ถูกแสดง และนิยาม Engagement (วิว + ไลก์) อ่านผิดได้เพราะโพสต์ Facebook ปกติมีวิวเป็น 0 เสมอ ผู้บริหาร/PM ต้องการภาพรวมแบบ **End-to-End Marketing Content Overview + BI Summary** ที่ดูได้ในแวบเดียวว่าการผลิต → การเผยแพร่ → ผลลัพธ์ เดินได้ดีแค่ไหนและติดอยู่ตรงไหน

## What Changes

- **ข้อมูลทั้งหมด ไม่มีการเปรียบเทียบ (D1):** ภาพรวมแสดงจากข้อมูลทั้งหมดที่ระบบมี (all-time) ไม่มีตัวเลือกช่วงเวลา ไม่มีการเทียบเดือนต่อเดือน (MoM) และไม่มี % เปลี่ยนแปลงในกล่องใดเลย กล่องที่เป็นสถานะ ณ ตอนนี้ และกล่องข้างหน้า ติดป้ายบอกขอบเขตของตัวเอง ("ณ ตอนนี้", "วันนี้–พรุ่งนี้") — ตัวเลขทั้งหน้าจึงเป็นชุดเดียวกันและเทียบกันได้
- **Global KPI:** Engagement, Posts, Avg/Post, Followers — **Engagement = Reaction + Comment + Share + Click ระดับโพสต์ (D2, D9)** พร้อมบรรทัดส่วนประกอบ, Followers กำกับว่าเป็นผู้ติดตามเพจ
- **นิยาม Engagement เดียวทั้งแดชบอร์ด (D9):** Engagement = ปฏิสัมพันธ์ทั้งหมดที่ระบบเก็บได้ = Reaction + Comment + Share + Click ใช้ทั้งแท็บภาพรวมและแท็บวิเคราะห์ › โซเชียล (แทน `views + likes` เดิม) ยอดเล่นวิดีโอแสดงแยกและไม่นับรวม ไม่มี Save เพราะ Facebook ไม่เปิดเผยระดับโพสต์ — เพิ่มการเก็บ Comment/Share ใน `content_post_metrics` และให้โพสต์วิดีโอได้ Click/Comment/Share ผ่านโพสต์บนเพจที่ห่อวิดีโอ
- **1. การผลิต:** Production Funnel สร้าง → ขออนุมัติ → อนุมัติ → เผยแพร่ แบบ conversion ของคอนเทนต์ทั้งหมด (ชุดเดียวกันทุกขั้น) พร้อมจำนวน "ยังอยู่ระหว่างทาง" (D3), สถานะคอนเทนต์แบบย่อ (D5), สรุปคอนเทนต์ที่ยังไม่เผยแพร่ 4 ช่วงอายุ
- **2. การเผยแพร่:** Publishing Health (รอดำเนินการ, ส่งสำเร็จ, ส่งไม่สำเร็จ, Success Rate) จากคิวทั้งหมด และสรุปกำหนดการวันนี้/พรุ่งนี้ (เวลา / แพลตฟอร์ม / จำนวน) จากทั้ง `content_schedules` และ `content_publish_queue` (D4) — ไม่แสดงรายการคิวหรือปุ่มลองใหม่ในส่วนนี้
- **3. ผลลัพธ์:** Engagement Trend รายเดือนตั้งแต่เดือนแรกที่มีข้อมูล และ Platform Performance (Platform / Posts / Engagement / Avg/Post / Followers)
- **งานที่ต้องจัดการ:** กล่องงานประจำวันเดิม (คิวเผยแพร่, กำหนดการโพสต์ถัดไป, เผยแพร่ล้มเหลว + ลองใหม่, คอนเทนต์ที่ยังไม่เผยแพร่, เนื้อหาล่าสุด, ภาพรวมสถานะคอนเทนต์) **คงไว้** ย้ายลงไปด้านล่างใต้หัวข้อ "งานที่ต้องจัดการ" แยกจาก BI ชัดเจน จนกว่าจะมีที่อยู่ใหม่ (แท็บงานวันนี้ เป็น change แยก)
- **ถอด:** การ์ด Engagement ทั้งหมดตั้งแต่เริ่ม, การ์ดผู้ติดตาม/เข้าชมเพจ 28 วัน, ปุ่ม 7/30/90 และ วัน/สัปดาห์/เดือน, คอลัมน์ เข้าชม / อัตรา Engagement / เฉลี่ยต่อสัปดาห์ ของตารางแพลตฟอร์ม
- **หัวข้อหน้า (D6):** เปลี่ยนตามส่วน "แดชบอร์ดคอนเทนต์" / "แดชบอร์ดแคมเปญ" (ตามโค้ดที่แก้ไว้แล้ว) และคำอธิบายส่วนคอนเทนต์เป็น "ภาพรวมประสิทธิภาพการผลิต การเผยแพร่ และผลลัพธ์" เมนูข้างคงชื่อ "แดชบอร์ดการตลาด"
- **แก้ข้อความเตือนเลยกำหนด** ในแท็บภาพรวมที่ชี้ไป "ปฏิทินคอนเทนต์" (ซึ่งไม่แสดงสถานะเลยกำหนด) ให้ชี้ไปหน้าคอนเทนต์ แท็บ "กำหนดการโพสต์"
- **API:** `?action=overview` เปลี่ยน payload เป็นข้อมูลทั้งหมด ไม่มีค่าเปรียบเทียบ และถอดพารามิเตอร์ `trend_range` / `platform_period` (**BREAKING** สำหรับผู้เรียก — ผู้เรียกมีแค่แท็บภาพรวม)

## Capabilities

### New Capabilities
- `content-overview-bi`: แท็บภาพรวมแบบ End-to-End + BI Summary — ช่วงเวลา, Global KPI, การผลิต (funnel/สถานะ/ยังไม่เผยแพร่), การเผยแพร่ (health/กำหนดการสรุป), ผลลัพธ์ (trend/platform performance), ส่วนงานที่ต้องจัดการ และนิยามข้อมูลของแต่ละกล่อง

### Modified Capabilities
- `content-dashboard-tabs`: ถอดข้อ "แท็บภาพรวมแสดงข้อมูลเชิงปฏิบัติการ" (แทนด้วย `content-overview-bi`)
- `content-dashboard-bi-widgets`: payload ของ `?action=overview` ใหม่ (ข้อมูลทั้งหมด ไม่มีค่าเปรียบเทียบ) และตำแหน่ง/ชื่อของ widget คิวเผยแพร่, เผยแพร่ล้มเหลว, คอนเทนต์ที่ยังไม่เผยแพร่ ในส่วนงานที่ต้องจัดการ
- `content-overview-social-performance`: ถอดการ์ด all-time, กราฟ 7/30/90, ตารางแพลตฟอร์มแบบเดิม และการ์ด 28 วัน (แทนด้วย `content-overview-bi`)
- `content-dashboard-layout`: ถอด layout เดิมของแท็บภาพรวม (แทนด้วยลำดับส่วนใน `content-overview-bi`)
- `marketing-dashboard-sections`: หัวข้อหน้าเปลี่ยนตามส่วน แทน "แดชบอร์ดการตลาด" คงที่
- `post-metrics-sync`: เก็บ `comments` / `shares` ต่อโพสต์ และ Click/Comment/Share ของโพสต์วิดีโอผ่านโพสต์บนเพจ (D9)
- `content-dashboard-social-placeholder`: แท็บวิเคราะห์ › โซเชียลใช้นิยาม Engagement ใหม่ แสดง Reaction/Comment/Share/Click แยก และยอดเล่นวิดีโอแยกไม่นับรวม (D9)

## Impact

- **Backend:** `api/content-analytics.php` (`?action=overview` คำนวณใหม่จากข้อมูลทั้งหมด, funnel แบบ cohort, publishing health, schedule summary, platform performance คอลัมน์ใหม่; ส่วน `social` ของ `?action=analytics` ใช้นิยาม Engagement ใหม่ D9) — ไม่แตะ `?action=page_insights` · `api/lib/insights-fetch.php` และ `api/cron/content-metrics-sync.php` เก็บ comment/share (D9)
- **Frontend:** `src/pages/ContentDashboardPage.tsx`, `src/components/content/AnalyticsSocialTab.tsx`, component ใหม่ใน `src/components/content/overview/`, ลบ `OverviewEngagementSummary.tsx`, `OverviewPageSummary.tsx`, `OverviewEngagementTrendChart.tsx`, `OverviewPlatformPerformanceTable.tsx`, `src/hooks/useContent.ts`, `src/components/content/types.ts`, test ที่เกี่ยวข้อง (รวม `ContentDashboardSections.test.tsx` ที่ยังคาดหัวข้อ "แดชบอร์ดการตลาด")
- **DB:** migration `2026_09_25_170000_add_comments_shares_to_content_post_metrics.sql` เพิ่ม `content_post_metrics.comments` / `shares` (INT NULL) ไม่ต้อง backfill
- **ไม่แตะ:** แท็บวิเคราะห์ส่วนอื่นนอกจาก sub-tab โซเชียลระดับโพสต์ (รวม "Engagement รวม" ของ sub-tab เนื้อหาที่มาจาก `content_items.views/likes` และ Best Time), ส่วนแคมเปญ, หน้าคอนเทนต์, หน้าปฏิทิน
- **งานที่ตามมา (ไม่อยู่ใน change นี้):** แท็บ "งานวันนี้" (ตำแหน่งยังไม่ตัดสิน: หน้าคอนเทนต์หรือปฏิทิน), แสดงสถานะการส่งบนปฏิทิน, เก็บประวัติสถานะเพื่อ funnel แบบ "เคยอนุมัติ"
