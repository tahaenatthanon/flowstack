## Context

แดชบอร์ดคอนเทนต์ (`src/pages/ContentDashboardPage.tsx`) แบ่งเป็น 2 แท็บ: "ภาพรวม" (operational) และ "วิเคราะห์" (insight/engagement) ผูกสถานะแท็บกับ URL query `tab`. ปัญหาคือ:
- แท็บ "วิเคราะห์" ผูกกับ engagement (`views`/`likes`) ซึ่งไม่มี ingestion ใด ๆ เขียน — ทุกแถวเป็น 0 ถาวร
- ข้อมูลกระบวนการผลิตที่มีจริง (`image_gen_status`, `approved_at`, `published_at`, `seo_*`, `content_publish_queue`, conversion จาก `content_plans`/`content_plan_items`) กลับไม่ถูกแสดง

คอลัมน์ที่จำเป็นมีอยู่แล้วทั้งหมด (จากเฟส 0: `published_at`/`approved_at`/`requested_at`; ตาราง `content_publish_queue` มี `retry_count`/`error_msg`/`sent_at`; `publish_channels` มี `platform`; `content_plans.plan_type`; `content_plan_items`; `content_items.seo_*`/`image_gen_status`/`video_gen_status`). **ไม่ต้อง migration**

## Goals / Non-Goals

**Goals:**
- สร้าง endpoint BI รวม `api/content-analytics.php` (2 action) ที่ aggregate จากคอลัมน์ที่มีอยู่ โดยไม่ทำให้ payload ของ list endpoint บวม
- เพิ่ม widget 4 ตัวบนแท็บภาพรวม + 5 ตัวบนแท็บวิเคราะห์
- เปลี่ยนการ์ด engagement ให้แสดงตลอดแม้ค่าเป็น 0

**Non-Goals:**
- ไม่สร้าง engagement ingestion pipeline (`content_engagement_snapshots` + cron) — ไว้ change ถัดไป; best-time panel ยังว่าง
- ไม่สร้าง `content_status_history` (rework rate) — ไว้ change ถัดไป
- ไม่แก้ bug ที่พบระหว่างวิเคราะห์ (best-time ใช้ `DAYOFWEEK(created_at)` แทนเวลาโพสต์จริง; `publish_channels` บางแถว `platform` ว่าง; "เนื้อหายอดนิยม" จัดอันดับด้วย score 0) — ไว้ change แยก
- ไม่มี migration / แก้ schema

## Decisions

### 1. Endpoint แยกไฟล์ `api/content-analytics.php`
สร้างไฟล์ใหม่แยกจาก `content-items.php` เพื่อไม่ให้ payload ของ list บวม

- **เหตุผล:** list endpoint ถูกเรียกบ่อย; ตัวเลข BI ใช้คอลัมน์ที่ list ไม่ส่งมา (`approved_at`, `published_at`, `image_gen_status`, `seo_*`, `plan_item_id`, `retry_count` ฯลฯ) การรวมไว้ที่เดียวทำให้ single source of truth และ lazy-load ได้
- **ทางเลือกที่พิจารณา:** เพิ่ม action ใน `brand-content.php` — ถูกปฏิเสธเพราะไฟล์นั้นยาวมากแล้ว (2800+ บรรทัด) และงานนี้เป็นโดเมน analytics ที่แยกชัดเจน
- โครงสร้าง: `requireAuth()` → `getDB()` → `getMethod()` → dispatch `?action=overview` / `?action=analytics` → `jsonResponse(...)`; ทุก query ผูก `tenant_id`

### 2. Percentile คำนวณใน PHP
p50/p90 ของ lead time คำนวณใน PHP (sort array แล้ว index) ไม่ใช้ `PERCENTILE_CONT`

- **เหตุผล:** `PERCENTILE_CONT` เป็น window function ที่ผูกกับเวอร์ชัน MariaDB ใหม่; การคำนวณใน PHP ไม่ผูกเวอร์ชันและเทสต์ง่าย
- fetch ค่า raw (ชั่วโมงต่อรายการ) แล้วคำนวณใน PHP

### 3. Funnel ใช้ timestamp ไม่ใช่ snapshot status
Funnel การผลิตนับ "เคยผ่าน" แต่ละขั้นจาก `created_at`/`requested_at`/`approved_at`/`published_at` (IS NOT NULL) แทนการนับ `status`

- **เหตุผล:** รายการที่เคยอนุมัติแล้วถูกเด้งกลับ draft ควรยังนับว่าผ่านขั้นอนุมัติ; snapshot status ทำให้ funnel ผิดเพี้ยนเมื่อมี rework
- % ตกหล่น = `1 - (count(next)/count(prev))` ต่อคู่ขั้น

### 4. ปุ่มลองส่งใหม่ใช้ `send_now` เดิม
widget สุขภาพคิว เรียก action `send_now` ใน `api/content-publish.php` (ไม่สร้าง endpoint ใหม่) โดยส่ง `content_id` + `channel_ids=[channel_id]`

- **เหตุผล:** `send_now` มีอยู่แล้วและรองรับการ dispatch ใหม่ (แทรกแถว `processing` ใหม่); หลีกเลี่ยง endpoint ซ้ำซ้อน
- หมายเหตุ: แถว `failed` เดิมจะยังคงอยู่ (ไม่ถูกลบ) — เป็นข้อจำกัดที่ยอมรับได้เพราะ `send_now` สร้างแถวใหม่

### 5. เปลี่ยนการ์ด engagement เป็นแสดงตลอด
ตัดตัวแปร `hasEngagementData` และเงื่อนไขการซ่อนใน `ContentDashboardPage.tsx`; `analyticsStatCards` = `[...resultStatCards, ...engagementStatCards]` เสมอ; grid column คงที่ `sm:grid-cols-4`

- **เหตุผล:** ตาม requirement ใหม่ของ `content-dashboard-stats` — การ์ดต้องแสดง 0 เพื่อสื่อ "ยังไม่มี engagement" อย่างตรงไปตรงมา (ไม่ใช่ผลลัพธ์ปลอม แต่เป็นค่าจริงที่รอ ingestion)
- แก้ spec `content-dashboard-stats` ให้สอดคล้อง

### 6. การจัดวาง widget ใหม่
- **ภาพรวม (ซ้าย 2/3):** Funnel การผลิต, คอนเทนต์ค้างท่อ, สถานะสร้างสื่อ AI (ต่อจาก Work Progress / ก่อนเนื้อหาล่าสุด)
- **ภาพรวม (ขวา 1/3):** สุขภาพคิวเผยแพร่ (บนสุด) ตามด้วยคิวรออนุมัติเดิม
- **วิเคราะห์:** เพิ่ม 5 widget ใหม่ใต้/รอบ widget เดิม (แนวโน้ม throughput, lead time, SEO, plan conversion, publish success)
- การจัดวางละเอียด (grid span) เป็น implementation detail; spec ระดับ requirement ระบุแค่คอลัมน์/ลำดับหลัก

### 7. Data fetching แบบ lazy ตามแท็บ
เพิ่ม `useContentOverview(enabled)` และ `useContentAnalytics(enabled)` ใน `useContent.ts` โดย `enabled = (tab === 'overview')` และ `(tab === 'analytics')` ตามลำดับ — เลียนแบบ `usePostingAnalytics`; เพิ่ม query key ใน `contentKeys`

## Risks / Trade-offs

- **ไม่มีข้อมูลจริง (engagement = 0, published = 0)** → การ์ด engagement แสดง 0 (ตาม requirement ใหม่) และ funnel/lead time บางขั้นคืน `null` — widget ต้องมี empty state ชัดเจน ไม่แสดงตัวเลขที่ทำให้เข้าใจผิด
- **`publish_channels.platform` เป็น enum ใน schema แต่ข้อมูลจริงมีสตริงว่าง (Youtube)** → ใช้ `NULLIF(platform, '')` และจัดกลุ่มเป็น "ไม่ระบุแพลตฟอร์ม" ใน widget publish_success
- **แถว `failed` เดิมไม่ถูกลบเมื่อลองส่งใหม่** → ยอมรับ; `send_now` สร้างแถวใหม่
- **percentile กับ sample ขนาดเล็ก** → ค่า p50/p90 อาจแกว่งมากเมื่อ sample น้อย; แสดง sample size ควบคู่เสมอ

## Migration Plan

ไม่มี migration — ทุกอย่าง aggregate จากคอลัมน์ที่มีอยู่แล้ว

1. Deploy `api/content-analytics.php` (ไฟล์ใหม่, additive)
2. Deploy frontend (`types.ts`, `useContent.ts`, `ContentDashboardPage.tsx`, component ใหม่) พร้อมกัน
3. Rollback: ลบไฟล์ endpoint ใหม่ + revert frontend (ไม่มี schema ให้ rollback)

## Open Questions

- หน่วย lead time: แสดงเป็นชั่วโมง (ทศนิยม 1 ตำแหน่ง) — เบื้องต้นใช้ชั่วโมง
- หน้าต่าง throughput: 12 เดือนย้อนหลัง (trailing) — ตาม roadmap ที่ระบุ
- ควรแยก widget ใหม่เป็น component ไฟล์เดี่ยว หรือ inline ใน `ContentDashboardPage.tsx`? — เบื้องต้น inline ยกเว้นกราฟแนวโน้มที่ใช้ `recharts` (แยกเป็น component เพื่อ readability)
