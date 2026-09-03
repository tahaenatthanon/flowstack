## Why

การสร้างคอนเทนต์จาก `QuickCreateDialog` ปัจจุบันเรียก `generate-plan` พร้อม `week_start` และ `days: 1` ทำให้ backend เข้า weekly/day generation path เสมอ แม้ผู้ใช้ต้องการสร้างคอนเทนต์เดี่ยว จากนั้น `api/brand-content.php` สร้าง context เป็น `สัปดาห์เริ่มต้น: ...` และ `สร้างโพสต์สำหรับวันจันทร์` ส่งให้ AI ทำให้ AI นำบริบทการเริ่มต้นสัปดาห์มาเป็นส่วนหนึ่งของหัวข้อ/เนื้อหา เช่น “เริ่มต้นสัปดาห์ด้วย...”

ปัญหานี้เกิดก่อน `generate-article` และไม่ใช่ปัญหาจาก SEO Checklist โดยตรง นอกจากนี้ flow ปัจจุบันยังต้องรักษา topic ที่ผู้ใช้กรอกเป็น seed/source ต้นฉบับ เพื่อไม่ให้ AI rewrite topic แล้วถูกนำไปใช้แทนหัวข้อจริงใน Research/Generation

## What Changes

- เพิ่มการระบุ **generation mode** ให้แยก Direct Content Creation ออกจาก Content Plan อย่างชัดเจน
- `QuickCreateDialog.tsx` ส่งโหมด Direct Content Creation และไม่ส่ง `days: 1` เพื่อใช้เป็นตัวขับ weekly/day context
- `generate-plan` ในโหมด Direct จะสร้างเพียง 1 content item โดยไม่ใส่ `week_start`, `day_label`, `day_order` หรือข้อความเกี่ยวกับวัน/สัปดาห์ลงใน AI prompt
- Content Plan เดิมยังคงใช้ day/week context และพฤติกรรมเดิม
- รักษา **Original User Topic/Seed เป็น Source of Truth** สำหรับ Direct Creation และ AI Research; AI-generated/re-written topic ห้ามถูกใช้แทน input ต้นฉบับ
- `generate-article` ของ Direct Creation ใช้ topic ต้นฉบับ/ข้อมูลของ item และยังใช้ Research Evidence เมื่อเปิด Research โดยไม่เพิ่ม weekly context
- เพิ่ม regression coverage สำหรับ Direct Creation และ Content Plan เพื่อยืนยันว่าไม่มีการปนกันของ context

## Capabilities

### Modified Capabilities

- `content-generation-single-item`: Direct Content Creation ต้องสร้าง content จาก topic ของผู้ใช้โดยไม่รับ weekly/day context (ผ่าน `generation_mode=direct`) และยังสร้างได้ 1 item ต่อการกดสร้าง โดย Content Plan คง day/week behavior เดิม
- `content-generation-research`: เมื่อเปิด Research ใน Direct Creation ต้องใช้ Original User Topic/Seed เป็น `seed_keyword` และต้องไม่ถูก weekly/day context หรือ AI-rewritten topic เปลี่ยนความหมาย

## Impact

- **Frontend:** `src/components/content/dialogs/QuickCreateDialog.tsx`
- **Backend:** `api/brand-content.php` โดยเฉพาะ `generate-plan` และข้อมูลที่ส่งต่อ `generate-article`
- **Tests:** เพิ่ม/ปรับ tests ที่ครอบคลุม Direct Creation และ Content Plan ตาม test structure ที่มีอยู่
- **ไม่เปลี่ยน:** SEO Checklist rules, SEO Quality Gate, Content Plan weekly/day behavior, publish flow และ database schema

## Expected Result

การสร้างบทความด้วย topic เช่น `YouTube` ต้องส่งให้ AI ในลักษณะ `Topic/Seed = YouTube` โดยไม่มีบริบท `วันจันทร์`, `สัปดาห์เริ่มต้น` หรือ `เริ่มต้นสัปดาห์` ที่ระบบเติมให้อัตโนมัติ ขณะที่ Content Plan ยังสามารถสร้างคอนเทนต์ตามวันในสัปดาห์ได้เหมือนเดิม
