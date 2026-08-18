## Why

แดชบอร์ดคอนเทนต์มองไม่เห็นข้อมูลเชิงปฏิบัติการที่มีอยู่จริงในฐานข้อมูล ขณะที่แท็บ "วิเคราะห์" ผูกกับ engagement ที่ไม่มี ingestion ใด ๆ เขียนเข้ามาเลย (`views`/`likes` = 0 ทุกแถว ไม่มี endpoint ใดเขียน) ทำให้การ์ด engagement, "เนื้อหายอดนิยม", และ best-time panel แสดงผลเป็น 0 ถาวร ในทางกลับกันข้อมูลกระบวนการผลิตที่มีค่าจริงกลับไม่ถูกแสดง: สุขภาพคิวเผยแพร่ (4 `failed` ที่แก้ได้จริง + 6 `pending` ที่เลยกำหนด), funnel การผลิต, อายุคอนเทนต์ (22 ชิ้นค้างเกิน 90 วัน), สถานะสร้างสื่อ AI, ความสมบูรณ์ SEO, และ conversion จากแผนสู่คอนเทนต์

## What Changes

- เพิ่ม endpoint รวมข้อมูล BI ใหม่ `api/content-analytics.php` (แยกจาก `content-items.php`) พร้อม 2 action:
  - `GET ?action=overview` → `queue`, `funnel`, `aging`, `assets`
  - `GET ?action=analytics` → `throughput`, `lead_time`, `seo`, `plan_conversion`, `publish_success`
- เพิ่ม widget 4 ตัวบนแท็บ "ภาพรวม": สุขภาพคิวเผยแพร่, Funnel การผลิต, คอนเทนต์ค้างท่อ (Aging), สถานะสร้างสื่อ AI
- เพิ่ม widget 5 ตัวบนแท็บ "วิเคราะห์": แนวโน้ม Throughput รายเดือน, Lead time แยกตามขั้น, ความสมบูรณ์ SEO, Plan → Content conversion, อัตราสำเร็จการเผยแพร่แยกแพลตฟอร์ม
- เปลี่ยนการ์ด engagement ("ยอดวิวรวม"/"ยอดไลก์รวม") ให้แสดงตลอดเวลาแม้ค่าเป็น 0 (กลับพฤติกรรมซ่อนจากการ์ดเมื่อไม่มีข้อมูล)
- ไม่มี migration — ทุกตัวเลข aggregate จากคอลัมน์ที่มีอยู่แล้ว

## Capabilities

### New Capabilities

- `content-dashboard-bi-widgets`: endpoint BI (`api/content-analytics.php`) + widget 9 ตัว (4 ภาพรวม + 5 วิเคราะห์) ที่ aggregate ข้อมูลกระบวนการผลิต/การเผยแพร่/SEO จากคอลัมน์ที่มีอยู่แล้วใน `content_items`, `content_publish_queue`, `publish_channels`, `content_plans`, `content_plan_items` โดยไม่มีการ migration

### Modified Capabilities

- `content-dashboard-stats`: กลับพฤติกรรมการ์ด "ยอดวิวรวม"/"ยอดไลก์รวม" จาก "ซ่อนเมื่อไม่มีข้อมูล" เป็น "แสดงตลอดแม้ค่าเป็น 0"
- `content-dashboard-tabs`: เพิ่ม widget ใหม่ 4 ตัวในรายการ section ของแท็บ "ภาพรวม" และ 5 ตัวในแท็บ "วิเคราะห์"
- `content-dashboard-layout`: เพิ่มการจัดวาง widget ใหม่ 4 ตัวใน master layout 2 คอลัมน์ของแท็บ "ภาพรวม"

## Impact

- `api/content-analytics.php` — ไฟล์ใหม่ (endpoint BI 2 action)
- `src/hooks/useContent.ts` — เพิ่ม `useContentOverview()` / `useContentAnalytics()` (TanStack Query, lazy `enabled` ตามแท็บ) และ query keys
- `src/components/content/types.ts` — เพิ่ม type ของ response (`ContentOverview`, `ContentAnalytics`)
- `src/pages/ContentDashboardPage.tsx` — เพิ่ม widget 9 ตัว + เปลี่ยนการ์ด engagement ให้แสดงตลอด
- `src/components/content/` — component ใหม่สำหรับ widget (หรือ inline ในหน้า ตามความเหมาะสม)
- `recharts` — ใช้สำหรับกราฟแนวโน้ม (มีใน deps แล้ว)
- ปุ่ม "ลองส่งใหม่" ใน widget สุขภาพคิว เรียก `send_now` เดิมใน `api/content-publish.php` (ไม่สร้าง endpoint ใหม่)
- ไม่กระทบ `content-items.php` (payload ของ list ไม่บวม)
- `content-dashboard-analytics` — ตรวจสอบแล้ว ไม่ต้องแก้: spec นั้นอธิบายเฉพาะ widget "เนื้อหายอดนิยม" และ "เวลาที่ดีที่สุด" เดิม ไม่ได้ enumerate องค์ประกอบทั้งหมดของแท็บวิเคราะห์ (หน้าที่นั้นอยู่ที่ `content-dashboard-tabs`)
