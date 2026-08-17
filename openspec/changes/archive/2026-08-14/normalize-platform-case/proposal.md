## Why

ในแดชบอร์ดคอนเทนต์ (`ContentDashboardPage`) widget "แพลตฟอร์ม" แสดง Facebook ซ้ำ 2 รายการ เพราะค่า `content_items.platform` ใน DB สะกดไม่สอดคล้องกัน: AI สร้าง content เก็บ `"Facebook"` (ตัว F ใหญ่ จาก prompt template ใน `brand-content.php`) ส่วนการสร้าง manual/default เก็บ `"facebook"` (ตัวพิมพ์เล็ก) — ทำให้ `platformCounts` นับเป็น 2 key แยกกัน ทั้งที่หมายถึงแพลตฟอร์มเดียวกัน

## What Changes

- **Frontend**: ใน `platformCounts` normalize key เป็น `trim().toLowerCase()` เพื่อให้ `"Facebook"`/`"facebook"` นับรวมเป็น key เดียว (ครอบคลุมข้อมูลเก่า)
- **Backend**: normalize ค่า `platform` เป็น lowercase ก่อน INSERT/UPDATE ใน `brand-content.php` และ `content-items.php` และแก้ prompt template `"platform":"Facebook"` → `"facebook"` เพื่อกันไม่ให้เกิดข้อมูลสะกดต่างกันอีก

## Capabilities

### New Capabilities

<!-- ไม่มี capability ใหม่ -->

### Modified Capabilities

- `content-dashboard-schedule-channels`: widget "แพลตฟอร์ม" นับจำนวนรวมแพลตฟอร์มเดียวกัน (case-insensitive) โดยไม่แยก `Facebook`/`facebook`

## Impact

- `src/pages/ContentDashboardPage.tsx` — normalize `item.platform` (trim + lowercase) ใน `platformCounts`
- `api/brand-content.php` — normalize `$body['platform']` เป็น lowercase ก่อนบันทึก + แก้ prompt template
- `api/content-items.php` — normalize `$body['platform']` เป็น lowercase ก่อน INSERT/UPDATE
- ไม่กระทบ DB schema, hooks, หรือ logic การคำนวณจำนวนอื่น
