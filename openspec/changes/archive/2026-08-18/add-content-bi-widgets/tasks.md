## 1. Backend — Endpoint BI ใหม่

- [x] 1.1 สร้าง `api/content-analytics.php` (requireAuth + getDB + getMethod + tenant filter) พร้อม `GET ?action=overview` คืน `queue`, `funnel`, `aging`, `assets`
- [x] 1.2 เพิ่ม `GET ?action=analytics` คืน `throughput`, `lead_time`, `seo`, `plan_conversion`, `publish_success`
- [x] 1.3 คำนวณ percentile (p50/p90) ของ lead time ใน PHP (ไม่ใช้ `PERCENTILE_CONT`) และคืน `null` เมื่อขั้นนั้นไม่มีข้อมูล
- [x] 1.4 รองรับ `publish_channels.platform` ที่เป็นสตริงว่างด้วย `NULLIF(platform,'')` และคืน success rate เป็น `null` เมื่อแพลตฟอร์มไม่มีรายการจบ

## 2. Frontend — types + hooks

- [x] 2.1 เพิ่ม type `ContentOverview` และ `ContentAnalytics` (และ subtype ที่เกี่ยวข้อง) ใน `src/components/content/types.ts`
- [x] 2.2 เพิ่ม query keys `overview` / `analytics` ใน `contentKeys` (`src/hooks/useContent.ts`) — ใช้ชื่อ `biOverview`/`biAnalytics` เพราะ key `analytics` เดิมถูก `usePostingAnalytics` ใช้อยู่แล้ว
- [x] 2.3 เพิ่ม hook `useContentOverview(enabled)` และ `useContentAnalytics(enabled)` เรียก `/content-analytics.php?action=overview|analytics` แบบ lazy `enabled` ตามแท็บ

## 3. Frontend — Widget แท็บภาพรวม (4 ตัว)

- [x] 3.1 เพิ่ม widget "สุขภาพคิวเผยแพร่" (นับ pending/processing/sent/failed + pending เลยกำหนด, รายการ failed พร้อม error_msg/retry_count/ชื่อคอนเทนต์/ชื่อ channel และปุ่ม "ลองส่งใหม่" เรียก `send_now` เดิม)
- [x] 3.2 เพิ่ม widget "Funnel การผลิต" (derive จาก created_at→requested_at→approved_at→published_at + % ตกหล่น)
- [x] 3.3 เพิ่ม widget "คอนเทนต์ค้างท่อ" (ช่วงอายุ 0-7/8-30/31-90/90+ วัน + ลิสต์ 5 เก่าสุด)
- [x] 3.4 เพิ่ม widget "สถานะสร้างสื่อ AI" (สรุป image_gen_status / video_gen_status)

## 4. Frontend — Widget แท็บวิเคราะห์ (5 ตัว)

- [x] 4.1 เพิ่ม widget "แนวโน้ม Throughput รายเดือน" (recharts, 12 เดือน, 4 เส้น, แกนเวลาหนาแน่นเดือนละจุด)
- [x] 4.2 เพิ่ม widget "Lead time แยกตามขั้น" (avg/p50/p90 + sample size ต่อขั้น)
- [x] 4.3 เพิ่ม widget "ความสมบูรณ์ SEO" (% ต่อฟิลด์ 6 ฟิลด์ + แสดง seo_gate_enabled / seo_gate_min_score)
- [x] 4.4 เพิ่ม widget "Plan → Content conversion" (แยก plan_type + % การแปลง + คอนเทนต์นอกแผน)
- [x] 4.5 เพิ่ม widget "อัตราสำเร็จการเผยแพร่แยกแพลตฟอร์ม" (sent/failed/pending + error ที่พบบ่อย)

## 5. Frontend — เปลี่ยนการ์ด engagement เป็นแสดงตลอด

- [x] 5.1 แก้ `src/pages/ContentDashboardPage.tsx` ลบตัวแปร `hasEngagementData` และเงื่อนไขซ่อนการ์ด "ยอดวิวรวม"/"ยอดไลก์รวม"
- [x] 5.2 ตั้ง `analyticsStatCards` = `[...resultStatCards, ...engagementStatCards]` เสมอ และ grid column คงที่ `sm:grid-cols-4`

## 6. Verification

- [x] 6.1 รัน `pnpm lint` และ `pnpm build` ผ่าน (เพิ่ม `npx tsc --noEmit` เพราะ `pnpm build` เป็น `vite build` ล้วน ไม่ typecheck)
- [x] 6.2 ยืนยัน `?action=overview` และ `?action=analytics` คืนค่าจาก DB จริง (ไม่ใช่ 0 ปลอม) และ widget ทุกตัวมี empty state; การ์ด engagement แสดง 0 ตลอด
