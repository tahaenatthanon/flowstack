## Why

sub-tab "โซเชียล" ของแดชบอร์ดคอนเทนต์แสดง stat card 4 ใบ แต่มีเพียง "Engagement รวม" ที่ต่อข้อมูลจริง อีก 3 ใบ (ผู้ติดตามรวม, Reach รวม, Engagement Rate) เป็น em dash ตายตัว เพราะเป็นเมตริก**ระดับเพจ**ที่ต้องรอ Facebook app review + OAuth page insights (ยังไม่พร้อมและไม่มีกำหนด) — หน้านี้จึงเสียพื้นที่ครึ่งหนึ่งไปกับการ์ดที่ยังไม่มีวันมีข้อมูลในเฟสนี้ ขณะที่ข้อมูลจริงที่ระบบ**มีอยู่แล้ว** (`content_post_metrics`: views/likes แบบ time-series ต่อโพสต์) ถูกยุบเหลือเลขรวมก้อนเดียว ไม่มีแนวโน้ม ไม่แยกแพลตฟอร์ม และไม่มีรายโพสต์

เปลี่ยนตอนนี้ได้เพราะ FB token กลับมา `valid` (data access ถึง 24 พ.ย. 2026) และ cron `content-metrics-sync` ผลิตข้อมูลจริงแล้ว (FB 5 โพสต์ / 63 แถว ซิงก์ล่าสุดวันนี้) — งานทั้งชุดนี้ทำได้จากข้อมูลในมือ ไม่ต้องรอ credential ภายนอกใด ๆ

## What Changes

- **REMOVED (UI):** เอาการ์ด em dash 3 ใบ (ผู้ติดตามรวม, Reach รวม, Engagement Rate) ออกจาก sub-tab โซเชียล — เมตริกระดับเพจเหล่านี้แยกไปเป็นงาน integration เฟสถัดไป (ติด FB app review) ไม่คงช่องว่างที่สื่อว่า "กำลังจะมา" ทั้งที่ยังไม่มีกำหนด
- **แถว stat card ใหม่ (ข้อมูลจริงล้วน):** แทนด้วยการ์ดที่คำนวณได้จริงจาก `content_post_metrics` — คงการ์ด "Engagement รวม" ไว้ และเพิ่มการ์ดที่วัดได้จริง เช่น จำนวนโพสต์ที่วัดได้, ไลก์รวม, วิวรวม, เวลาซิงก์ล่าสุด
- **กราฟแนวโน้ม engagement รายเดือน** ตลอดช่วงวันที่ที่เลือก (ใช้ pattern เดียวกับ `throughput` ที่มีอยู่แล้วใน `api/content-analytics.php`)
- **แยกรายแพลตฟอร์ม (FB/IG):** backend คืน breakdown ต่อแพลตฟอร์ม (posts/views/likes) แทนการยุบรวม และ label แพลตฟอร์มมาจากข้อมูลที่มีจริง ไม่ hardcode `['facebook','instagram']`
- **ตารางโพสต์เด่น (Top posts):** รายโพสต์ FB/IG เรียงตาม engagement พร้อม views/likes, วันเผยแพร่ และลิงก์ permalink
- **แสดง วิว/ไลก์ แยกกันอย่างตรงไปตรงมา:** ปัจจุบัน FB คืน `views=0` ทุกแถว การยุบเป็น "วิว + ไลก์" ทำให้เข้าใจผิด — แยกแสดงและกำกับที่มา โดยเก็บ views ดิบไว้เผื่อ IG/วิดีโอในอนาคต (ไม่ตัดข้อมูลทิ้ง)
- **ปรับ notice card:** อธิบายความจริงว่าครอบคลุมเฉพาะแพลตฟอร์มที่มีข้อมูลจริง (ปัจจุบัน Facebook — IG channel ปิดอยู่) และเมตริกระดับเพจต้องรอ integration เฟสถัดไป
- ไม่มี mock/hardcoded data ทุกจุด (คงกติกาเดิมของหน้านี้)

## Capabilities

### New Capabilities
<!-- ไม่มี — ทุกอย่างขยายความสามารถของ sub-tab โซเชียลที่มีอยู่แล้ว -->

### Modified Capabilities
- `content-dashboard-social-placeholder`: แทน stat card แบบ placeholder + em dash ด้วยชุด widget ข้อมูลจริงจาก `content_post_metrics` — แถว stat card ที่คำนวณได้จริง, กราฟแนวโน้ม engagement รายเดือน, breakdown รายแพลตฟอร์ม และตารางโพสต์เด่น; backend `?action=analytics` ส่วน `social` คืน time-series + per-platform + top posts + platforms จากข้อมูลจริง; label และ notice card สะท้อนขอบเขตจริง

## Impact

- **Frontend:** `src/components/content/AnalyticsSocialTab.tsx` (เขียน component ใหม่), `src/pages/ContentDashboardPage.tsx` (wiring/prop เท่าที่จำเป็น), `src/components/content/types.ts` (ขยาย `SocialEngagementSummary` + เพิ่ม type ของ series/top-posts/per-platform)
- **Backend:** `api/content-analytics.php` — ขยาย `?action=analytics` ส่วน `social` block (per-platform breakdown, monthly series, top posts, platforms จาก `DISTINCT` ของ cohort) — read-only, ไม่แตะ schema · **หมายเหตุ:** ตรรกะ aggregation ถูกเขียนไว้แล้วใน working tree (uncommitted) แต่ยังไม่ได้ต่อสายเข้า response และมีบั๊ก 2 จุด (`platforms` hardcode, `last_fetched_at` อ้าง `$social` ที่ไม่มีอยู่) — งานที่เหลือคือต่อสาย + แก้บั๊ก (ดู tasks ข้อ 1)
- **Database:** ไม่มีการเปลี่ยน schema — ใช้ `content_post_metrics` + `content_items` ที่มีอยู่
- **ไม่กระทบ:** `api/lib/insights-fetch.php` / `api/cron/content-metrics-sync.php` / publish pipeline (เฟส 2) — งานนี้เป็นชั้น presentation/aggregation ล้วน
- **Out of scope:** followers/reach/impressions ระดับเพจ, OAuth page insights, การต่อ TikTok/LINE OA/LinkedIn/X/website, การแก้ FB app Development mode — ทั้งหมดติด credential/review ภายนอก เป็นเฟสถัดไป (ความเสี่ยง/งานกลุ่ม ข)
