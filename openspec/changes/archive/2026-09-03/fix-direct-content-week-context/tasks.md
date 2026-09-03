## 1. Frontend

- [x] 1.1 ปรับ `src/components/content/dialogs/QuickCreateDialog.tsx` ให้ส่ง `generation_mode: 'direct'` สำหรับการสร้าง Content แบบเดี่ยว
- [x] 1.2 เอา `days: 1` ออกจาก request ของ Direct Creation และคง `platforms`, `type`, context และ options อื่นที่มีอยู่
- [x] 1.3 รักษา `topic.trim()` เป็น Original User Topic/Seed และส่งต่อให้ Research workflow โดยตรง

## 2. Backend

- [x] 2.1 ปรับ `api/brand-content.php?action=generate-plan` ให้รองรับ `generation_mode=direct`
- [x] 2.2 ใน direct mode สร้างเพียง 1 item โดยไม่สร้าง day/week context และไม่ใส่ `week_start`/day instruction ใน prompt
- [x] 2.3 ใน direct mode ใช้ neutral metadata (`day_label=''`, `day_order=0`, `scheduled_date=null`) หรือค่า compatibility ที่เหมาะสมโดยไม่ส่งเข้า AI prompt
- [x] 2.4 คง behavior เดิมของ Content Plan เมื่อไม่ใช่ direct mode
- [x] 2.5 ตรวจ `generate-article` และข้อมูลที่ส่งต่อให้แน่ใจว่าไม่มี weekly/day context ถูกนำกลับมาเป็น generation instruction
- [x] 2.6 ตรวจ contract ของ Research workflow ให้ fetch ใช้ Original User Topic/Seed ไม่ใช่ AI-rewritten topic

## 3. Tests / Verification

- [x] 3.1 ทดสอบ Direct Article, Research OFF ด้วย topic `YouTube`
- [x] 3.2 ทดสอบ Direct Article, Research ON และยืนยัน seed ที่ fetch คือ `YouTube`
- [x] 3.3 ทดสอบ Direct Video, Research OFF/ON และยืนยันไม่มี weekly/day context
- [x] 3.4 ทดสอบ Weekly Content Plan และยืนยัน day/week behavior เดิมยังทำงาน
- [x] 3.5 ทดสอบ Monthly/Quarterly/Yearly Content Plan และ date instruction เดิม
- [x] 3.6 ตรวจ SEO Checklist/Quality Gate ว่ายังทำงานเหมือนเดิมและไม่มี regression

## 4. Build / Lint / Test / PHP

- [x] 4.1 รัน `pnpm lint` — ESLint ผ่าน (0 errors)
- [x] 4.2 รัน `pnpm build` — production build ผ่าน (รวม tsc + vite build)
- [x] 4.3 รัน `pnpm test` — Vitest unit/component tests ผ่าน
- [x] 4.4 รัน PHP test สคริปต์ที่เกี่ยวข้อง (ถ้ามี) เช่น `php scripts/test-seo-generation-requirements.php`
- [x] 4.5 รัน `php -l` บน `api/brand-content.php` และไฟล์ backend ที่แก้ เพื่อยืนยัน syntax ถูกต้อง
- [x] 4.6 ตรวจ type errors ด้วย `tsc -b` หรือ `pnpm build` ที่รัน type check (ตาม script ที่ project กำหนด)
