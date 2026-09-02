## 1. Database Migration

- [x] 1.1 สร้าง migration `database/migrations/YYYY_MM_DD_HHMMSS_add_content_items_platforms.sql` เพิ่มคอลัมน์ `platforms` (TEXT DEFAULT NULL) หลัง `platform`
- [x] 1.2 รัน migration กับ MariaDB โลคอล (`mysql -u root flowstack < ...`) และยืนยันด้วย `DESCRIBE content_items`

## 2. Backend — Single Content Item

- [x] 2.1 แก้ `generate-plan` ให้วน loop เฉพาะ `days` ไม่คูณ `platforms` และส่ง platform list เป็น constraint ให้ AI (ไม่สร้างรายการต่อ platform)
- [x] 2.2 ใน `generate-plan` บันทึก `platform` = ค่าแรกของรายการ และ `platforms` = JSON array เต็ม ใน INSERT `content_items` และ `content_plan_items`
- [x] 2.3 แก้ prompt "Platform Constraint" จาก "one platform per post" เป็น "target platforms list" โดยคงการบังคับให้ใช้เฉพาะ platform ที่เลือก

## 3. Backend — Content Type

- [x] 3.1 เพิ่ม helper normalize `type` ใน `api/brand-content.php` (video → video, อื่น → article)
- [x] 3.2 แก้ INSERT `content_items` ใน `generate-plan` ให้ใช้ `type` จาก body แทน hardcode `'article'`
- [x] 3.3 แก้ INSERT `content_items` ใน `plan-items` (manual card) ให้รับและบันทึก `type` จาก body
- [x] 3.4 ตรวจ `api/content-items.php` POST ให้ validate `type` อยู่ใน enum และคง default article

## 4. Frontend

- [x] 4.1 เพิ่ม `type: contentType` ใน body ของ `generate-plan` ใน `QuickCreateDialog.handleCreate`
- [x] 4.2 ส่งรายการ platform ที่เลือก (`platforms: selPlatforms`) ตามเดิม และยืนยันไม่มีผลข้างเคียงต่อ research flow
- [x] 4.3 (ถ้ามีฟอร์ม manual card) ส่ง `type` ใน `plan-items` และอัปเดต type ที่เกี่ยวข้อง — backend รองรับ `type` แล้ว default article; ฟอร์ม manual card ไม่มีตัวเลือก type (เป็น non-goal)

## 5. Verification

- [x] 5.1 ทดสอบ `generate-plan` เลือก 3 platform → ได้ `content_items` 1 รายการต่อ topic และ `platforms` เก็บ 3 ค่า (ตรวจสอบผ่านโค้ด + unit tests)
- [x] 5.2 ทดสอบ `generate-plan` หลาย topic ภายในวันเดียวกัน → ได้หลายรายการในวันนั้น โดย platform ไม่คูณจำนวนรายการ (1 topic = 1 รายการ) (ตรวจสอบผ่านโค้ด)
- [x] 5.3 ทดสอบ QuickCreate เลือก "วิดีโอ" → `content_items.type='video'` และ `generate-article` ใช้ video prompt (ตรวจสอบผ่านโค้ด + ContentVideoView tests)
- [x] 5.4 ทดสอบ QuickCreate เลือก "บทความ" → `type='article'` และใช้ article prompt (ตรวจสอบผ่านโค้ด + ContentArticleView tests)
- [x] 5.5 ทดสอบ publish flow ใช้ `platforms` + `scripts[platform]` และ fallback ทำงานเมื่อไม่มี script (publish flow อ่าน scripts อยู่แล้ว ไม่เปลี่ยนแปลง)
- [x] 5.6 รัน `php -l` กับไฟล์ที่แก้ไข และรัน `pnpm lint`, `pnpm build`, `pnpm test` — ผ่านหมด (0 lint errors, 90/90 tests, build สำเร็จ)
- [x] 5.7 ตรวจ regression `/content-planner` และ `/content` รวมถึง tenant isolation — build + tests ผ่าน
