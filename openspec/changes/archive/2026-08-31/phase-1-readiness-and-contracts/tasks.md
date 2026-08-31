## 1. ตรวจ baseline ของระบบปัจจุบัน

- [x] 1.1 ตรวจ `seo_evaluate()` และบันทึกผลการรองรับ `pending`, first `<h1>` และ rule set ของ video
- [x] 1.2 ตรวจ publish flow ทั้ง `content-publish.php` และ scheduler ว่าเลือก script ตาม platform และไม่เขียนทับ platform จาก channel สุดท้าย
- [x] 1.3 ตรวจ `content-items.php` ว่ารับ SEO metadata และกรอง tenant ครบ
- [x] 1.4 ตรวจ `brand-content.php` ว่าใช้ content type ที่ระบุโดยตรงและมี tenant filter ตอนโหลด content
- [x] 1.5 ตรวจผล lint, build และ test ล่าสุดของงาน SEO/publish/frontend พร้อมบันทึกข้อสังเกตที่ยังเป็น warning เดิม

## 2. ล็อก contract และ security invariants

- [x] 2.1 ตรวจ contract ใน `specs/ai-research-readiness/spec.md` ให้ตรงกับ requirements และ design
- [x] 2.2 ล็อกรูปแบบ settings status ที่ไม่คืน secret และใช้ `has_research_key`
- [x] 2.3 ล็อก tenant ownership rule สำหรับ Research job, content item และ settings
- [x] 2.4 ล็อกความหมายของ `null` สำหรับ metric ที่ provider ไม่ส่ง และห้ามเติมค่า `0`
- [x] 2.5 ล็อก optional Research behavior เมื่อไม่มี job สถานะ `done`
- [x] 2.6 ยืนยัน FK ของ Research job เป็น nullable และ `ON DELETE SET NULL` ในเอกสารทุกจุด

## 3. กำหนดขอบเขตการเปลี่ยนแปลง

- [x] 3.1 บันทึกรายการไฟล์ที่ Phase 2-5 จะเปลี่ยนและจุดเชื่อมต่อที่ต้องรักษาไว้
- [x] 3.2 บันทึกรายการที่อยู่นอก scope ได้แก่ GSC/Rank Tracking, Best-Time automation, n8n และ AI-assisted editing
- [x] 3.3 ตรวจว่า Phase นี้ไม่มี migration, API endpoint, external API call หรือ frontend route เพิ่ม
- [x] 3.4 ตรวจ `openspec status --change phase-1-readiness-and-contracts` ว่า artifacts ครบและพร้อม apply

## 4. ทดสอบและตรวจก่อนปิดงาน

- [x] 4.1 ตรวจไฟล์ `proposal.md`, `design.md`, `spec.md` และ `tasks.md` ว่าครบและไม่มี placeholder ค้างอยู่
- [x] 4.2 ตรวจ spec format ให้ทุก requirement มี scenario และใช้รูปแบบ `WHEN` / `THEN` ครบ
- [x] 4.3 ตรวจ PHP syntax ของไฟล์ที่เกี่ยวข้องกับ baseline ด้วย XAMPP PHP โดยไม่แก้ไฟล์ระหว่างตรวจ
- [x] 4.4 รัน `pnpm lint` และยืนยันว่าไม่มี error ใหม่จาก Phase นี้
- [x] 4.5 รัน `pnpm build` และยืนยันว่า build สำเร็จ
- [x] 4.6 รัน `pnpm test` และยืนยันว่า test สำเร็จ
- [x] 4.7 ตรวจ `git diff` และ `git status` ให้แน่ใจว่า Phase นี้แก้เฉพาะเอกสารที่กำหนด
- [x] 4.8 ตรวจ `openspec status --change phase-1-readiness-and-contracts` เป็น `4/4 artifacts complete` ก่อนปิดงาน
