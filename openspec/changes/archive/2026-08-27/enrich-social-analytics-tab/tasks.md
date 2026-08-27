## 1. Backend — ต่อสาย social aggregation ที่คำนวณไว้แล้วเข้ากับ response ใน `api/content-analytics.php`

> **สถานะจริง (ตรวจ 27 ส.ค.):** `api/content-analytics.php` มีงานค้างใน working tree (uncommitted, `M` — 139 insertions/26 deletions vs HEAD). ตรรกะ aggregation เขียนไว้ครบแล้วและตรงกับ spec/design: deduped query `$socialStmt` (บรรทัด ~507–532, latest `fetched_at` ต่อ (`content_item_id`, `COALESCE(channel_id, '#'+platform_post_id)`), cohort `ci.published_at BETWEEN ? AND ?`, FB/IG เท่านั้น) และการรวมใน PHP ที่ผลิต `$socialByPlatform`, `$socialMonthly`, `$socialTopPosts`, `$socialPlatformList`, `$socialLastFetched` (บรรทัด ~537–644) — **แต่ `jsonResponse` ส่วน `social` (บรรทัด ~650–661) ยังไม่ emit ค่าเหล่านี้และมีบั๊ก 2 จุด** งานที่เหลือจึงเป็นการ "ต่อสาย + แก้บั๊ก" ไม่ใช่เขียนใหม่

- [x] 1.1 อ่าน `social` block ปัจจุบัน (บรรทัด ~650–661) และตรรกะ aggregation ที่มีอยู่ (บรรทัด ~507–644) เพื่อยืนยันว่าตรง spec ก่อนแตะ — **ไม่เขียน logic ใหม่ถ้าของเดิมถูกต้อง**
- [x] 1.2 **แก้บั๊ก:** `'platforms' => ['facebook','instagram']` (hardcode) → `$socialPlatformList` (DISTINCT ที่คำนวณไว้แล้ว บรรทัด ~594–595; ไม่มีข้อมูล = `[]`) (Decision 3)
- [x] 1.3 **แก้บั๊ก:** `'last_fetched_at' => $social['last_fetched_at'] ?? null` — `$social` ไม่มีอยู่แล้วหลัง rewrite (เดิมมาจาก aggregate query ที่ถูกแทน) ทำให้คืน `null` เสมอ → เปลี่ยนเป็น `$socialLastFetched` (บรรทัด ~539/558)
- [x] 1.4 emit อาร์เรย์ที่คำนวณไว้แล้วใน `social` block: เพิ่ม `'by_platform' => $socialByPlatform`, `'monthly' => $socialMonthly`, `'top_posts' => $socialTopPosts` (ปัจจุบันเป็น dead code — คำนวณแต่ไม่ถูกส่งออก)
- [x] 1.5 ยืนยันว่า aggregation ที่มีอยู่ตรง spec โดยไม่ต้องแก้: latest `fetched_at` ต่อ (content_item_id, channel/platform_post_id); cohort = `published_at`; `engagement = views + likes` ทุกระดับ; `monthly` หนา (เติม 0 ทุกเดือนในช่วง); `top_posts` เรียง engagement จำกัด 10; `published_url` จาก `content_items.published_url` (null คงเป็น null) — แก้เฉพาะเมื่อพบว่าไม่ตรง
- [x] 1.6 `/c/xampp/php/php.exe -l api/content-analytics.php` ผ่าน และ `grep '\$social\['` ต้องไม่เหลือ (ยืนยันไม่มี Undefined variable `$social` ตกค้าง) — read-only, ไม่แตะ schema/insights-fetch/cron

## 2. Frontend — types

- [x] 2.1 `src/components/content/types.ts` — ขยาย `SocialEngagementSummary` เพิ่ม `by_platform: SocialPlatformStat[]`, `monthly: SocialMonthlyPoint[]`, `top_posts: SocialTopPost[]` โดยคง field เดิมทั้งหมด
- [x] 2.2 เพิ่ม type ใหม่: `SocialPlatformStat { platform; posts; views; likes; engagement }`, `SocialMonthlyPoint { month; posts; views; likes; engagement }`, `SocialTopPost { content_item_id; title; platform; published_at; views; likes; engagement; published_url: string | null }`

## 3. Frontend — เขียน `AnalyticsSocialTab.tsx` ใหม่

- [x] 3.1 ลบการ์ด em dash 3 ใบ (ผู้ติดตาม, Reach, Engagement Rate) และค่าคงที่ `PLACEHOLDER_VALUE`/`PLACEHOLDER_HINT` ที่ผูกกับการ์ดเหล่านั้นออก
- [x] 3.2 แถว stat card ข้อมูลจริง: "Engagement รวม" (กำกับใต้ว่า `= วิว + ไลก์`), "โพสต์ที่วัดได้" (`posts`), "ไลก์รวม" (`likes`), "วิวรวม" (`views`) — ทุกใบระบุขอบเขตแพลตฟอร์มจาก `social.platforms` (Decision 2)
- [x] 3.3 กราฟแนวโน้ม engagement รายเดือนจาก `social.monthly` ใช้ pattern แท่ง/เส้นเดียวกับ `throughput`/`BestTimeAnalyticsPanel` (ไม่เพิ่ม chart lib) หัวข้อ/คำอธิบายระบุว่าเป็น engagement ของโพสต์ตามเดือนที่เผยแพร่ (Decision 5, 7)
- [x] 3.4 breakdown รายแพลตฟอร์มจาก `social.by_platform` แสดงเฉพาะแพลตฟอร์มที่มีข้อมูล (posts/views/likes/engagement)
- [x] 3.5 ตารางโพสต์เด่นจาก `social.top_posts`: ชื่อ, ป้ายแพลตฟอร์ม, วันเผยแพร่, views, likes, engagement, ลิงก์เปิดโพสต์จริงเมื่อ `published_url` ไม่ว่าง
- [x] 3.6 empty state ทุกส่วนเมื่อ `has_data=false`: แสดง "ยังไม่มีโพสต์ที่ซิงก์ข้อมูล" — ไม่วาดกราฟจาก 0 ปลอม ไม่มีแถว/ตัวเลขปลอม (คงกติกา no mock/hardcoded data)
- [x] 3.7 ปรับ notice card: ครอบคลุมเฉพาะแพลตฟอร์มที่มีข้อมูลจริงตาม `social.platforms` + เวลาซิงก์ล่าสุด (`last_fetched_at`); เมตริกระดับเพจต้องรอ OAuth page insights (เฟสถัดไป) — ไม่กล่าวว่า "กำลังจะมา"
- [x] 3.8 คงคอมเมนต์หัวไฟล์ที่ห้าม mock/hardcoded data และข้อความ UI ทั้งหมดเป็นภาษาไทย

## 4. Wiring

- [x] 4.1 ยืนยันว่า `src/pages/ContentDashboardPage.tsx` ส่ง `social`/`socialLoading` ครบอยู่แล้ว และ `useContentAnalytics(from,to,...)` เป็นแหล่งของ `social.monthly` (กราฟผูกช่วงวันที่ผ่าน prop เดิม — ไม่ต้องเพิ่ม prop ใหม่); ปรับเท่าที่จำเป็นถ้า component ต้องการ range เพิ่ม

## 5. ตรวจสอบก่อนปิดงาน

- [x] 5.1 คำนวณค่าคาดหวังจาก DB โดยตรง (facebook 5 โพสต์: `views` รวม = 0, `likes` รวมจาก snapshot ล่าสุดต่อโพสต์, `platforms` = `['facebook']`, `monthly` มีข้อมูลเฉพาะเดือน ส.ค. 2026) เพื่อใช้เทียบผล endpoint
- [x] 5.2 เรียก `?action=analytics` (ผ่าน dev server ที่ล็อกอินแล้ว) ในช่วง default 12 เดือน แล้วยืนยัน `social.by_platform`/`monthly`/`top_posts`/`platforms` ตรงกับค่าที่คำนวณใน 5.1 และ field รวมเดิมไม่เปลี่ยนค่า
- [x] 5.3 ตรวจ UI: การ์ดทุกใบมาจากข้อมูลจริง (ไม่มี "—" ถาวร), การ์ดวิวรวมแสดง 0 ชัดเจน, ลิงก์ top post เปิด permalink FB จริงได้, ไม่มีข้อความกล่าวถึงเมตริกระดับเพจว่า "กำลังจะมา"
- [x] 5.4 ตรวจ empty state ด้วยช่วงวันที่ที่ไม่มีข้อมูล (เช่น 2025) — ไม่มีกราฟ/แถว/ตัวเลขปลอม
- [x] 5.5 `pnpm lint` และ `pnpm build` ผ่าน
