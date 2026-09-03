## 1. เพิ่ม helper seo_contract_hints()

- [x] 1.1 เพิ่ม `seo_contract_hints(string $type): string` ใน `api/lib/seo-checklist.php` — คืน field hints ภาษาไทยจาก `seo_generation_requirements()` (requirement + pass_condition + min/max)
- [x] 1.2 ยืนยัน hint สำหรับ meta_description แสดง 120–160 (เดียวกับ evaluator) และ content_length แสดง min 500

## 2. แก้ prompt ใน api/brand-content.php ให้ใช้ contract

- [x] 2.1 แทนที่ `$jsonSchema` hardcode (meta_description "150-160", full_html ">=500", slug) ด้วย hint จาก `seo_contract_hints('article')`
- [x] 2.2 แก้ video prompt (`$mainSys`) ให้ใช้ `seo_contract_hints('video')` แทน hardcode "120-160"
- [x] 2.3 ยืนยันไม่มีค่าเกณฑ์ hardcode เหลือใน prompt (drift)

## 3. แก้ repair feedback ให้ครบ expected + actual

- [x] 3.1 แก้ feedback ใน repair loop ให้ต่อข้อมี `key`, `status`, `message`, `expected` (pass_condition จาก contract), `actual` (ค่าที่วัดได้เมื่อมี)
- [x] 3.2 สร้าง mapping จาก rule key → pass_condition (ใช้ `seo_generation_requirements()`)

## 4. Final gate response เพิ่ม failed_required

- [x] 4.1 ใน `generate-article` response เพิ่ม `failed_required` = รายการ required rule ที่ `failed` (key, message, expected)
- [x] 4.2 คง `generation_status`/`seo_passed`/`status=revision` เดิม

## 5. Verify

- [x] 5.1 รัน `pnpm lint` — ผ่าน (0 errors)
- [x] 5.2 รัน `pnpm build` — ผ่าน
- [x] 5.3 รัน `pnpm test` — Vitest ผ่าน
- [x] 5.4 รัน `php -l` บน `api/lib/seo-checklist.php` และ `api/brand-content.php`
- [x] 5.5 อัปเดต/รัน PHP test — ยืนยัน `seo_contract_hints()` มี pass_condition/min/max และไม่ drift
- [x] 5.6 ยืนยัน publish gate + endpoint เดิมไม่ถดถอย
