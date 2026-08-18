## Context

หลังเฟส 0 (`phase-0-publish-result-tracking`) แก้บั๊กบันทึกผลเผยแพร่แล้ว ตาราง `content_items` มีคอลัมน์ `published_at`, `published_url`, `external_post_id`, `approved_at` เป็นวัตถุดิบพร้อมใช้ (`approved_at` ถูกตั้งโดย `api/content-items.php` PUT เมื่อสถานะเป็น `approved`, `published_at` ถูกตั้งโดยเส้นทาง publish ต่าง ๆ) แต่แดชบอร์ดคอนเทนต์ยังไม่มีการนำวัตถุดิบนี้มาสร้าง "เมตริกผลลัพธ์" การ์ดบนแท็บ "วิเคราะห์" ปัจจุบันเป็น "ยอดวิวรวม/ยอดไลก์รวม" ซึ่งทุกแถวมี `views=0`/`likes=0` (กลไก sync engagement ยังไม่มาถึงจนกว่าเฟส 2) จึงโชว์ 0 ตลอดเหมือนมีผลลัพธ์ทั้งที่ยังไม่มีข้อมูลจริง

เป้าหมายเฟส 5 คือเติมเมตริกผลลัพธ์ 2 ตัวที่คำนวณได้จากข้อมูลภายในระบบล้วน ๆ (ไม่พึ่ง credentials ภายนอก): **เวลาผลิตต่อชิ้น** (lead time) และ **ความถี่การเผยแพร่** เทียบเป้าหมาย พร้อมซ่อนการ์ดวิว/ไลก์ที่ไม่มีข้อมูล

## Goals / Non-Goals

**Goals:**
- เพิ่ม endpoint เมตริกผลลัพธ์ที่คำนวณจาก `approved_at`/`published_at` จริง
- เพิ่มเป้าหมายความถี่รายสัปดาห์ที่ตั้งค่าได้ใน `content_global_settings`
- แสดงการ์ด "เวลาผลิตเฉลี่ย" และ "ความถี่การโพสต์/สัปดาห์" บนแท็บวิเคราะห์
- ซ่อนการ์ดวิว/ไลก์เมื่อไม่มีข้อมูล engagement (ไม่โชว์ 0 เป็นผลลัพธ์)

**Non-Goals:**
- ไม่ sync ข้อมูล engagement (views/likes) จริง — นั่นคือเฟส 2 (ต้องรอ FB/WordPress API)
- ไม่ refactor เส้นทาง publish
- ไม่เพิ่ม/แก้คอลัมน์บน `content_items` (คอลัมน์ที่ต้องใช้มีอยู่แล้วจากเฟส 0)
- ไม่แตะ `analytics-posting-times`/`analytics-recalculate` (Best Time) เดิม

## Decisions

### 1. คำนวณเมตริกบน backend ผ่าน action ใหม่ `result-metrics`
เลือกเพิ่ม `?action=result-metrics` ใน `api/brand-content.php` (GET) แทนการคำนวณฝั่ง frontend

- **เหตุผล:** frontend ปัจจุบัน `GET /content-items.php` ไม่ได้ SELECT `published_at`/`approved_at` กลับมา การแก้ frontend ต้องแก้ SQL ของ list endpoint และส่งข้อมูลที่อาจไม่จำเป็นทุกรายการ การคำนวณบน backend สอดคล้องกับ pattern เดิมของ `analytics-posting-times` และทำให้ metric เป็น single source of truth
- **ทางเลือกที่พิจารณา:** เพิ่ม `published_at`/`approved_at` เข้า `content-items.php` แล้วคำนวณใน React — ถูกปฏิเสธเพราะกระจาย logic และเพิ่ม payload ให้ list endpoint ที่ถูกเรียกบ่อย

Response shape ที่ออกแบบ:
```json
{
  "avg_production_hours": 27.5,
  "approved_count": 12,
  "posts_last_7_days": 3,
  "published_count": 35,
  "weekly_posts_target": 4,
  "has_data": true
}
```
- `avg_production_hours` = `AVG(TIMESTAMPDIFF(HOUR, created_at, approved_at))` เฉพาะแถวที่ `approved_at IS NOT NULL` (เป็น `null` เมื่อไม่มี)
- `posts_last_7_days` = `COUNT(*)` ของแถวที่ `published_at >= NOW() - INTERVAL 7 DAY`
- `weekly_posts_target` = อ่านจาก `content_global_settings` (default 0)
- `has_data` = มีแถวใดที่ `approved_at` หรือ `published_at` ไม่เป็น NULL

### 2. เพิ่มคอลัมน์ `weekly_posts_target` แทนการ hardcode เป้าหมาย
เพิ่ม migration เพิ่ม `weekly_posts_target TINYINT UNSIGNED NOT NULL DEFAULT 0` ลง `content_global_settings`

- **เหตุผล:** เป้าหมายความถี่เป็นค่าที่ผู้ใช้ควรตั้งเองได้ และ `content_global_settings` เป็นที่เก็บค่าการตั้งค่า content อยู่แล้ว (มี `seo_gate_enabled`, `seo_gate_min_score` จากเฟส 4) ค่า `0` สื่อ "ยังไม่ได้ตั้งเป้าหมาย"
- **ทางเลือกที่พิจารณา:** ใส่ค่าคงที่ในโค้ด — ถูกปฏิเสธเพราะไม่ยืดหยุ่น และข้อ NO MAGIC ของโปรเจกต์
- ใช้ `ADD COLUMN IF NOT EXISTS` ตาม pattern ของ migration เฟส 0/4 เพื่อให้รันซ้ำได้ปลอดภัย

### 3. รองรับการเขียนเป้าหมายผ่าน `global-settings` เดิม
ขยาย action `global-settings` (POST) ให้รับ `weekly_posts_target` เข้าในชุด field ที่อัปเดต/insert เช่นเดียวกับ `global_instruction`/`image_gen_provider` (GET อ่าน `SELECT *` อยู่แล้วจึงคืนคอลัมน์ใหม่อัตโนมัติ)

- **เหตุผล:** ไม่ต้องสร้าง endpoint ใหม่ ใช้กลไกบันทึก settings ที่ `useSaveGlobalSettings()` เรียกอยู่แล้ว
- ต้อง sanitize เป็นจำนวนเต็มไม่ติดลบก่อนบันทึก

### 4. การ์ดผลลัพธ์วางบนแท็บ "วิเคราะห์" และซ่อนวิว/ไลก์เมื่อไม่มีข้อมูล
- เพิ่ม hook `useResultMetrics()` (TanStack Query) เรียก `?action=result-metrics` เปิดเฉพาะเมื่อแท็บวิเคราะห์ active (เลียนแบบ `usePostingAnalytics`)
- เปลี่ยน `engagementStatCards` บน `ContentDashboardPage.tsx` เป็นการ์ดผลลัพธ์ 2 ใบ: "เวลาผลิตเฉลี่ย" และ "ความถี่การโพสต์/สัปดาห์"
- ซ่อนการ์ดวิว/ไลก์เมื่อ `totalViews === 0 && totalLikes === 0` (เงื่อนไขใน React ก่อน render)
- ค่า `avg_production_hours` แสดงเป็นชั่วโมง (ปัดเศษทศนิยม 1 ตำแหน่ง) หรือ "ยังไม่มีข้อมูล" เมื่อ `null`; การ์ดความถี่แสดง `posts_last_7_days` และเปรียบเทียบเป้าหมาย ("ยังไม่ได้ตั้งเป้าหมาย" เมื่อเป้าหมายเป็น 0, "เกินเป้าหมาย/ต่ำกว่าเป้าหมาย/ตรงเป้าหมาย" ตามจำนวน)

### 5. UI ตั้งเป้าหมาย (เล็ก, reuse global-settings)
เพิ่ม input จำนวนเต็ม "เป้าหมายโพสต์/สัปดาห์" ในหน้าตั้งค่า content ที่ใช้ `useContentGlobalSettings`/`useSaveGlobalSettings` อยู่แล้ว (บริเวณเดียวกับ `global_instruction`) เพื่อให้ผู้ใช้ตั้งค่า `weekly_posts_target` ได้โดยไม่ต้องแก้ DB ตรง

- **เหตุผล:** ถ้าไม่มี UI ตั้งค่า เป้าหมายจะติด 0 ตลอดและการเปรียบเทียบไม่มีความหมาย — จึงต้องมีช่องตั้งค่าขั้นต่ำหนึ่งช่อง

## Risks / Trade-offs

- **ไม่มีข้อมูลจริง (approved/published ยังน้อย)** → การ์ด "เวลาผลิตเฉลี่ย" แสดง "ยังไม่มีข้อมูล" และการ์ดความถี่แสดง 0 — ยอมรับได้เพราะ metric สะท้อนข้อมูลจริง ตามข้อ "อย่าโชว์ 0 เป็นผลลัพธ์" เฉพาะการ์ดวิว/ไลก์ (ส่วนความถี่เป็น count ที่ 0 มีความหมายจริง)
- **`weekly_posts_target` ไม่มี UI ตั้งค่าในเฟสนี้** → เพิ่ม input ขั้นต่ำตาม Decision 5 เพื่อลดความเสี่ยงนี้; ถ้าตัดออก เป้าหมายจะติด 0
- **`TIMESTAMPDIFF(HOUR, ...)` ปัดลงเป็นชั่วโมงเต็ม** → lead time อาจหยาบสำหรับชิ้นที่ใช้เวลาไม่กี่ชั่วโมง — ยอมรับได้ (ระดับชั่วโมงเพียงพอ); ถ้าต้องละเอียดขึ้นใช้ `TIMESTAMPDIFF(MINUTE, ...)/60` เป็นทางเลือกที่บันทึกไว้
- **Migration รันซ้ำ** → ใช้ `ADD COLUMN IF NOT EXISTS` เพื่อ idempotency

## Migration Plan

1. สร้าง `database/migrations/2026_08_18_HHMMSS_add_weekly_posts_target.sql` (เพิ่ม `weekly_posts_target` ใน `content_global_settings`)
2. รันกับ local MariaDB ตามกฎ CLAUDE.md และยืนยันด้วย `SHOW COLUMNS FROM content_global_settings;`
3. Deploy โค้ด `api/brand-content.php` + frontend พร้อมกัน (ไม่มี breaking change — endpoint ใหม่ และคอลัมน์มี default)
4. Rollback: ลบ endpoint/UI ใหม่ และ `ALTER TABLE content_global_settings DROP COLUMN weekly_posts_target;` (ข้อมูลเป้าหมายหายเท่านั้น ไม่กระทบ flow เดิม)

## Open Questions

- หน่วยของเวลาผลิต: แสดงเป็นชั่วโมง หรือ วัน/ชั่วโมง (เช่น "1 วัน 3 ชม.")? — เบื้องต้นใช้ชั่วโมง (ทศนิยม 1 ตำแหน่ง)
- หน้าต่าง "7 วันล่าสุด" เพียงพอสำหรับนิยาม "โพสต์/สัปดาห์" หรือควรเป็นค่าเฉลี่ยย้อนหลัง 28 วัน? — เบื้องต้นใช้ trailing 7 วันตาม roadmap
