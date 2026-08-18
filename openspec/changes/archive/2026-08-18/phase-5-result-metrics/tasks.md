## 1. Database Migration

- [x] 1.1 สร้างไฟล์ `database/migrations/2026_08_18_HHMMSS_add_weekly_posts_target.sql` เพิ่มคอลัมน์ `weekly_posts_target TINYINT UNSIGNED NOT NULL DEFAULT 0` ใน `content_global_settings` (ใช้ `ADD COLUMN IF NOT EXISTS`)
- [x] 1.2 รัน migration กับ local MariaDB ตามกฎ CLAUDE.md และยืนยันด้วย `SHOW COLUMNS FROM content_global_settings;`

## 2. Backend — global-settings รองรับเป้าหมาย

- [x] 2.1 แก้ `api/brand-content.php` action `global-settings` (POST) ให้รับ `weekly_posts_target` เข้าชุด field อัปเดต/insert พร้อม sanitize เป็นจำนวนเต็มไม่ติดลบ
- [x] 2.2 ยืนยัน GET `?action=global-settings` คืน `weekly_posts_target` กลับมา

## 3. Backend — endpoint เมตริกผลลัพธ์

- [x] 3.1 เพิ่ม action `result-metrics` (GET) ใน `api/brand-content.php` คำนวณ `avg_production_hours` (AVG ของ `TIMESTAMPDIFF(HOUR, created_at, approved_at)` เฉพาะ `approved_at IS NOT NULL`), `approved_count`, `posts_last_7_days` (นับ `published_at >= NOW() - INTERVAL 7 DAY`), `published_count`, `weekly_posts_target` (จาก `content_global_settings`) และ `has_data`
- [x] 3.2 ตรวจสอบ response ถูกต้อง: `avg_production_hours` เป็น `null` เมื่อไม่มีแถวที่อนุมัติแล้ว และ `has_data=false` เมื่อไม่มี `approved_at`/`published_at` ใด

## 4. Frontend — types + hook

- [x] 4.1 เพิ่ม type `ResultMetricsResponse` และเพิ่ม field `weekly_posts_target` ใน `GlobalSettings` ที่ `src/components/content/types.ts`
- [x] 4.2 เพิ่ม hook `useResultMetrics(enabled)` ใน `src/hooks/useContent.ts` (TanStack Query เรียก `/brand-content.php?action=result-metrics` เปิดเฉพาะเมื่อแท็บวิเคราะห์ active)

## 5. Frontend — แดชบอร์ด

- [x] 5.1 แก้ `src/pages/ContentDashboardPage.tsx` เพิ่มการ์ดเมตริกผลลัพธ์ "เวลาผลิตเฉลี่ย" และ "ความถี่การโพสต์/สัปดาห์" บนแท็บวิเคราะห์ (แสดง "ยังไม่มีข้อมูล" เมื่อ `avg_production_hours` เป็น null; แสดง "ยังไม่ได้ตั้งเป้าหมาย" เมื่อ `weekly_posts_target` เป็น 0)
- [x] 5.2 ซ่อนการ์ด "ยอดวิวรวม/ยอดไลก์รวม" เมื่อ `totalViews === 0 && totalLikes === 0` แทนการแสดง 0
- [x] 5.3 เพิ่ม input ตั้งค่า "เป้าหมายโพสต์/สัปดาห์" ในหน้าตั้งค่า content ที่ใช้ `useContentGlobalSettings`/`useSaveGlobalSettings` (บันทึก `weekly_posts_target`)

## 6. Verification

- [x] 6.1 รัน `pnpm lint` และ `pnpm build` ผ่าน
- [x] 6.2 ยืนยัน endpoint `?action=result-metrics` คืนค่าจาก DB จริง (ไม่ใช่ 0 ปลอม) และการ์ดวิว/ไลก์หายไปเมื่อไม่มีข้อมูล engagement
