## 1. Frontend — normalize platform ตอนนับ

- [ ] 1.1 ใน `src/pages/ContentDashboardPage.tsx` เปลี่ยน `const p = item.platform ?? 'unknown'` เป็น `const p = (item.platform ?? 'unknown').trim().toLowerCase()`

## 2. Backend — normalize platform ก่อนบันทึก

- [ ] 2.1 ใน `api/brand-content.php` normalize `$body['platform']` เป็น lowercase (trim) ก่อน INSERT/UPDATE
- [ ] 2.2 ใน `api/brand-content.php` แก้ prompt template `"platform":"Facebook"` → `"platform":"facebook"`
- [ ] 2.3 ใน `api/content-items.php` normalize `$body['platform']` เป็น lowercase (trim) ก่อน INSERT/UPDATE

## 3. ตรวจสอบและทดสอบ

- [ ] 3.1 รัน `pnpm lint` และ `pnpm build` ให้ผ่าน และ `php -l` ไฟล์ที่แก้
- [ ] 3.2 ทดสอบบนเบราว์เซอร์: widget "แพลตฟอร์ม" แสดง Facebook เพียงรายการเดียว (รวม count) แม้ข้อมูลมีทั้ง "Facebook"/"facebook"
