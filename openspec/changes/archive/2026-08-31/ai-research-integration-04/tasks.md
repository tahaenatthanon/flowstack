## 1. แยก AI credential และตรวจ baseline

- [x] 1.1 อ่านและบันทึก behavior เดิมของ `resolveAICreds()` และ `getAIContentParams()` ก่อนย้าย
- [x] 1.2 สร้าง `api/lib/ai-creds.php` และย้าย helper โดยคง signature และผลลัพธ์เดิม
- [x] 1.3 ปรับ `brand-content.php` และ Research API ให้ใช้ helper กลางโดยไม่ duplicate decrypt logic
- [x] 1.4 ตรวจว่า response และ error ไม่ส่ง API key, password, encrypted key หรือ Authorization header

## 2. สร้าง AI Research analysis contract

- [x] 2.1 กำหนด schema กลางของ brief: primary keyword, secondary keywords, intent, PAA, content gaps, competitor angles, outline, word count และ AEO notes
- [x] 2.2 สร้าง prompt ภาษาไทยสำหรับวิเคราะห์เฉพาะข้อมูลจาก Research job และระบุ source metadata
- [x] 2.3 ระบุใน prompt ว่าห้ามแต่ง search volume, difficulty หรือ metric ที่ไม่มีใน source
- [x] 2.4 เพิ่ม parser และ validator สำหรับ JSON response พร้อมตรวจ required fields และชนิดข้อมูล
- [x] 2.5 เพิ่มการตรวจ metric ใน brief เทียบกับข้อมูล Research และปฏิเสธค่าที่ AI สร้างขึ้นเอง

## 3. เพิ่ม Research API analyze

- [x] 3.1 เพิ่ม action `analyze` ใน `api/content-research.php` โดยตรวจ authentication และ tenant scope
- [x] 3.2 โหลดเฉพาะ job ที่เป็นของ tenant เดียวกันและมีสถานะ `done`
- [x] 3.3 จำกัดข้อมูลที่ส่งเข้า prompt โดยใช้ normalized data และควบคุมขนาด raw payload
- [x] 3.4 เรียก AI content model เดิมและแปลง provider error เป็นข้อความภาษาไทยที่เหมาะสม
- [x] 3.5 บันทึก brief ลง `analysis` และเวลาลง `analyzed_at` เมื่อ validation ผ่านเท่านั้น
- [x] 3.6 คืน job id, brief, provider, location, language และ fetched time โดยไม่เปิดเผย secret
- [x] 3.7 จัดการ job ที่ไม่มี, คนละ tenant, ไม่ใช่ `done` หรือ AI คืน JSON ผิดรูปแบบ

## 4. เชื่อม generate-article กับ Research

- [x] 4.1 เพิ่ม `research_job_id` และ `brand_context_ids` แบบ optional ใน input contract ของ `generate-article`
- [x] 4.2 โหลด Research job ด้วย tenant predicate และตรวจสถานะ `done` กับ brief ที่ validate แล้ว
- [x] 4.3 เพิ่ม brief, selected keywords และ source metadata เข้า prompt อย่าง traceable
- [x] 4.4 บังคับ primary keyword จาก Research ใน SEO title, slug, meta description, ย่อหน้าแรก และ headings
- [x] 4.5 ใช้ keyword ที่เลือกจาก Research เป็นแหล่ง `meta_keywords` และไม่ให้ LLM คิด keyword เอง
- [x] 4.6 เมื่อไม่มี `research_job_id` ให้รักษา flow เดิมและเขียน `meta_keywords` เป็นค่าว่าง
- [x] 4.7 ผูก `content_item_id` กลับไปยัง Research job หลังสร้าง content สำเร็จ โดยกรอง tenant

## 5. ความปลอดภัยและ regression

- [x] 5.1 ทดสอบ tenant isolation ของ `analyze`, `generate-article` และการ update linkage
- [x] 5.2 ทดสอบ job ที่ไม่ใช่ `done`, ไม่มี brief และ brief ไม่ผ่าน schema
- [x] 5.3 ทดสอบว่า metric ที่เป็น `null` ไม่ถูกแทนด้วยตัวเลขจาก AI
- [x] 5.4 ทดสอบ `generate-plan` เดิมและ `generate-article` ที่ไม่ส่ง `research_job_id`
- [x] 5.5 ตรวจ PHP syntax ของไฟล์ PHP ที่เพิ่มหรือแก้
- [x] 5.6 รัน `pnpm lint`
- [x] 5.7 รัน `pnpm build`
- [x] 5.8 รัน `pnpm test`
- [x] 5.9 ตรวจ `git diff` และ `git status` เฉพาะไฟล์ใน scope ก่อนปิดงาน
