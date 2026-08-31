## Why

ก่อนเริ่มสร้าง AI Research ต้องมี baseline และ contract กลางที่ตรงกับโค้ดปัจจุบัน ไม่เช่นนั้น backend, frontend และฐานข้อมูลอาจใช้สถานะหรือรูปแบบข้อมูลไม่ตรงกัน และอาจแก้ซ้ำส่วน SEO/Publish ที่ทำเสร็จแล้ว

## What Changes

- ตรวจและบันทึกสถานะปัจจุบันของ SEO gate/checklist, publish flow, SEO metadata และ tenant isolation
- กำหนด contract ของ Research job, keyword, settings และ error response สำหรับ phase ถัดไป
- ยืนยันว่า Research job ที่ผูกกับ content ใช้ `ON DELETE SET NULL`
- กำหนดรายการไฟล์และ behavior ที่ phase ถัดไปต้องเปลี่ยน พร้อมขอบเขตที่ห้ามแตะ
- ไม่เปลี่ยน schema, ไม่เรียก DataForSEO และไม่เพิ่มหน้า UI ใน phase นี้

## Capabilities

### New Capabilities

- `ai-research-readiness`: baseline และ contract กลางสำหรับการพัฒนา AI Research แบบแยก tenant

### Modified Capabilities

ไม่มี การแก้ behavior ของ SEO gate และ publish flow เป็นงานที่เสร็จแล้วและจะตรวจยืนยันเท่านั้น

## Impact

- เอกสารแผนและ OpenSpec contract ใน `openspec/changes/phase-1-readiness-and-contracts/`
- อ้างอิง `api/lib/seo-checklist.php`, `api/content-publish.php`, `api/cron/publish-scheduler.php`, `api/content-items.php` และ `api/brand-content.php`
- ไม่แก้ database หรือไฟล์ production code ใน phase นี้
