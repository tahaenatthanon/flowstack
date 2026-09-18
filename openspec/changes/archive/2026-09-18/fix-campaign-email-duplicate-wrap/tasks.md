## 1. Migration ฐานข้อมูล

- [x] 1.1 สร้างไฟล์ `database/migrations/2026_09_18_092414_add_template_id_to_email_campaigns.sql` ด้วยคำสั่ง `ALTER TABLE email_campaigns ADD COLUMN template_id VARCHAR(64) NULL AFTER source_content_id;`
- [x] 1.2 รัน migration กับ MariaDB local (`mysql -u root flowstack < database/migrations/<file>.sql`)
- [x] 1.3 ตรวจสอบด้วย `DESCRIBE email_campaigns` ว่ามีคอลัมน์ `template_id` เป็น `varchar(64)` แบบ nullable แล้ว

## 2. Backend: บันทึกค่า template_id

- [x] 2.1 ใน `createEmailCampaign()` (`api/email-campaigns.php` ประมาณบรรทัด 271-307): อ่านค่า `$templateId = $body['template_id'] ?? null;` แล้วเพิ่มเข้าไปในรายการคอลัมน์ INSERT และ params
- [x] 2.2 ใน handler แก้ไขแคมเปญ (`api/email-campaigns.php` ประมาณบรรทัด 355-400): อ่านค่า `template_id` จาก request body และเมื่อ key นี้ถูกส่งมา (รวมถึงกรณีส่ง null มาชัดเจน เพื่อรองรับการยกเลิกการเลือก) ให้เพิ่ม `template_id = ?` เข้าไปใน `$updates`/`$params`

## 3. Backend: ข้ามการห่อ chrome แบบทั่วไปสำหรับแคมเปญที่มาจาก template

- [x] 3.1 ใน handler ส่งอีเมล (`api/email-campaigns.php` ประมาณบรรทัด 665-670) หลังจากโหลด `$rawHtml` แล้ว ให้แยกเงื่อนไขตาม `$campaign['template_id']`: ถ้ามีค่า (ไม่ใช่ null/ไม่ว่าง) ให้ข้ามการเรียก `wrapEmailHtml()` แล้วใช้ผลลัพธ์จาก `processMergeTags(...)` เป็น `$htmlBody` ตรงๆ ถ้าเป็น null ให้เรียก `wrapEmailHtml()` เหมือนเดิม
- [x] 3.2 ตรวจสอบว่า `$campaign` ที่โหลดไว้ก่อนหน้าจุดนี้ (บรรทัด 580, `SELECT *`) มีค่า `template_id` ติดมาด้วยอัตโนมัติแล้วเมื่อคอลัมน์ถูกสร้างขึ้น — ไม่ต้องแก้ query ตรงจุดนี้เพิ่ม

## 4. Frontend: ส่งค่า template_id ไปพร้อม payload ของแคมเปญ

- [x] 4.1 ใน `src/pages/CampaignsPage.tsx` เพิ่ม `template_id: selectedTemplate || null` เข้าไปใน request payload ตอนสร้างแคมเปญ
- [x] 4.2 เพิ่มฟิลด์ `template_id` เดียวกันนี้ใน request payload ตอนแก้ไขแคมเปญด้วย (เพื่อให้การแก้ไขแคมเปญร่างยังคงความสัมพันธ์กับ template ไว้ และการยกเลิกเลือก template ผ่าน `handleTemplateClick` จะถูกบันทึกเป็น null) — และเพิ่มการโหลดค่า `template_id` กลับเข้า state `selectedTemplate` ตอนเปิดแก้ไขแคมเปญร่างเดิมใน `openEditCampaign` (ทั้ง success/catch branch) เพื่อไม่ให้ค่านี้หายไปเมื่อ save ซ้ำ

## 5. การตรวจสอบผลลัพธ์

- [x] 5.1 สร้างแคมเปญจาก template (ทดสอบด้วย template-1) แก้ไขข้อความในแท็บ "แก้ไข" เพื่อบังคับให้ TipTap ตัด wrapper `<html>` ทิ้ง บันทึกแล้วส่งไปยังกล่องจดหมายทดสอบจริง — ยืนยันจากภาพ Gmail จริง ("ทดสอบ template 1 with edit") ว่ามี header และ footer อย่างละชุดเดียว ไม่ซ้อนกันอีกต่อไป (สังเกตเพิ่มเติม: สีพื้นหลัง header หายไปเพราะ TipTap ตัด background-color ทิ้ง — เป็นข้อจำกัดที่ทราบอยู่แล้วตาม design.md ไม่ใช่บั๊กของงานนี้)
- [x] 5.2 สร้างแคมเปญขึ้นเองตั้งแต่ต้น (ไม่เลือก template) ส่งไปยังกล่องจดหมายทดสอบจริง — ยืนยันจากภาพ Gmail จริง ("ทดสอบ เขียนเอง") ว่ายังคงมีการห่อ header/footer แบบทั่วไปเหมือนเดิม ไม่มีการเปลี่ยนแปลงพฤติกรรม
- [x] 5.3 ข้ามการทดสอบข้อนี้ตามคำสั่งผู้ใช้ — ความเสี่ยงต่ำเพราะเป็น code path (`template_id IS NULL` → เรียก `wrapEmailHtml()` เหมือนเดิม) ที่ไม่ได้ถูกแก้ไขเลยในรอบนี้ และได้รับการยืนยันผ่านการทดสอบ 5.2 ด้วยเงื่อนไขเดียวกันแล้ว
- [x] 5.4 รัน `pnpm lint` และ `pnpm build` ตามข้อกำหนดการตรวจสอบของโปรเจกต์ — ผ่านทั้งคู่ (lint: 0 errors, เหลือแต่ warning เดิมที่ไม่เกี่ยวกับไฟล์ที่แก้; build: สำเร็จ)
