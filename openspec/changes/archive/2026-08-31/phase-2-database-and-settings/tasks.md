## 1. ตรวจและเตรียม migration

- [x] 1.1 ตรวจ schema ปัจจุบันของ `content_items` และ `content_global_settings` ก่อนแก้ migration
- [x] 1.2 ตรวจ migration Research ที่มีอยู่ให้ตรงกับ contract และใช้ `ON DELETE SET NULL` กับ `content_item_id`
- [x] 1.3 ตรวจชื่อไฟล์ migration ให้เป็น timestamp ตามกฎโครงการและไม่ชนกับ migration เดิม

## 2. เพิ่ม Research schema

- [x] 2.1 สร้างตาราง `content_research_jobs` พร้อม status enum, raw fields, analysis, cost และ timestamps
- [x] 2.2 เพิ่ม index สำหรับ tenant, content item และ cache identity
- [x] 2.3 สร้างตาราง `content_research_keywords` พร้อม metric ที่ nullable และ source/is_selected
- [x] 2.4 เพิ่ม foreign key job-to-keywords แบบ `ON DELETE CASCADE`
- [x] 2.5 เพิ่ม foreign key content-to-job แบบ `ON DELETE SET NULL`
- [x] 2.6 เพิ่มคอลัมน์ Research settings ใน `content_global_settings` พร้อมค่า default ไทย

## 3. รันและตรวจฐานข้อมูล

- [x] 3.1 รัน migration ทั้งหมดกับ XAMPP MariaDB ทันทีหลังตรวจไฟล์
- [x] 3.2 ตรวจ `DESCRIBE content_research_jobs`
- [x] 3.3 ตรวจ `DESCRIBE content_research_keywords`
- [x] 3.4 ตรวจ `SHOW COLUMNS FROM content_global_settings LIKE 'research%'`
- [x] 3.5 ตรวจ foreign key และ index สำคัญให้ตรงกับ design

## 4. ขยาย settings API และ frontend

- [x] 4.1 เพิ่มการอ่าน/บันทึก Research settings ใน `action=global-settings` โดยกรอง tenant
- [x] 4.2 เข้ารหัส DataForSEO password ด้วย helper เดิมก่อนบันทึก
- [x] 4.3 ลบ encrypted key ออกจาก response และส่ง `has_research_key` แทน
- [x] 4.4 เพิ่ม Research fields ใน TypeScript settings type
- [x] 4.5 สร้าง `ResearchProviderForm.tsx` ด้วยข้อความภาษาไทยและ validation พื้นฐาน
- [x] 4.6 เพิ่มฟอร์มใน `BrandSettingPage.tsx` โดยไม่กระทบ AI settings เดิม
- [x] 4.7 เพิ่มปุ่มทดสอบการเชื่อมต่อเป็นจุดเชื่อมสำหรับ backend phase ถัดไป โดยยังไม่เรียก provider จริงใน phase นี้

## 5. ทดสอบและตรวจก่อนปิดงาน

- [x] 5.1 ทดสอบ GET settings ว่าไม่คืน plaintext หรือ encrypted secret
- [x] 5.2 ทดสอบ tenant isolation ของ settings
- [x] 5.3 ทดสอบบันทึก password แล้วตรวจว่าเก็บเป็น encrypted value
- [x] 5.4 ทดสอบ migration ซ้ำได้โดยไม่สร้างตาราง/คอลัมน์ซ้ำ
- [x] 5.5 ตรวจ PHP syntax ของไฟล์ PHP ที่แก้ด้วย XAMPP PHP
- [x] 5.6 รัน `pnpm lint`
- [x] 5.7 รัน `pnpm build`
- [x] 5.8 รัน `pnpm test`
- [x] 5.9 ตรวจ `git diff` และ `git status` ว่าเปลี่ยนเฉพาะไฟล์ใน scope
- [x] 5.10 ตรวจ schema และ settings API อีกครั้งก่อน archive change
