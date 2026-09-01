## 1. ปุ่มทดสอบการเชื่อมต่อในหน้าตั้งค่า Research

- [x] 1.1 อ่าน `ResearchProviderForm.tsx`, `useContent.ts` และรูปแบบ API client ที่มีอยู่ก่อนเริ่มแก้ไข
- [x] 1.2 เพิ่ม call หรือ hook ฝั่ง frontend สำหรับ `api/content-research.php?action=test`
- [x] 1.3 เปิดใช้งานปุ่ม "ทดสอบการเชื่อมต่อ" เมื่อ provider เป็น DataForSEO และมี credential ที่บันทึกไว้หรือที่กรอกเข้ามา
- [x] 1.4 แสดง toast ภาษาไทยทั้งกรณีสำเร็จและผิดพลาด พร้อมยอดคงเหลือ (balance) เมื่อมีข้อมูล และต้องไม่เปิดเผย credential
- [x] 1.5 เพิ่ม UI/unit test แบบเฉพาะจุด หรือ coverage ที่ใช้ mock สำหรับสถานะสำเร็จ, ล้มเหลว, ปิดใช้งาน (disabled) และกำลังทำงาน (pending)

## 2. การตรวจสอบ Research ฝั่ง Backend

- [x] 2.1 ตรวจสอบว่า `settings-status` คืนสถานะของ provider และไม่มีฟิลด์ที่เป็นความลับ (secret) ติดมาด้วย
- [x] 2.2 ตรวจสอบว่า `test` ทำงานสำเร็จเมื่อใช้ credential ของ DataForSEO ที่ตั้งค่าไว้ และล้มเหลวพร้อมข้อความชัดเจนเมื่อ credential ไม่ถูกต้อง
- [ ] 2.3 ตรวจสอบว่า `fetch` ด้วย seed ภาษาไทยสร้าง job สถานะ `done` พร้อม raw SERP, raw keywords, แถวข้อมูล keyword ที่ normalize แล้ว และ `cost_usd` — **blocked by provider billing requirement** (บัญชี DataForSEO ต้องเติมเงินจริงเพื่อปลดล็อก task endpoints)
- [x] 2.4 ตรวจสอบว่า metric ที่ provider ไม่ส่งมา ยังคงเป็น `NULL` ไม่ใช่ `0`
- [x] 2.5 ตรวจสอบว่าการ fetch ซ้ำภายในช่วงเวลา cache คืนค่า `cached: true` และไม่สร้าง job ใหม่
- [x] 2.6 ตรวจสอบว่ากรณี provider timeout หรือเกิด error จะบันทึก job เป็น `failed` พร้อม response ข้อความผิดพลาดภาษาไทย

## 3. การตรวจสอบ AI Analyze และการสร้างเนื้อหา

- [x] 3.1 ตรวจสอบว่า `analyze` คืน JSON ของ Research brief ที่ถูกต้อง และ primary keyword มาจาก keyword ต้นทางจริง
- [x] 3.2 ตรวจสอบว่า job ที่ไม่ถูกต้อง ไม่สมบูรณ์ หรือข้าม tenant ไม่สามารถนำมา analyze ได้
- [x] 3.3 ตรวจสอบว่า `generate-article` ที่ส่ง `research_job_id` มาด้วย จะใช้ Research brief และเขียน SEO metadata จาก keyword จริง
- [x] 3.4 ตรวจสอบว่า Research job ถูกเชื่อมกลับไปยัง `content_item_id` ที่สร้างขึ้น
- [x] 3.5 ตรวจสอบว่าการสร้างเนื้อหาโดยไม่ส่ง `research_job_id` ยังทำงานได้ และปล่อยให้ `meta_keywords` ว่างไว้

## 4. การตรวจสอบ SEO Approval และการเผยแพร่

- [x] 4.1 ตรวจสอบว่า SEO checklist สะท้อน metadata ที่สร้างขึ้น และรองรับสถานะ `pending`, `warn`, `fail`, `pass` และ `skip`
- [x] 4.2 ตรวจสอบว่าเนื้อหาประเภทวิดีโอ/โซเชียล ไม่ติด fail จากกฎ SEO ที่ใช้กับบทความเท่านั้น
- [x] 4.3 ตรวจสอบว่าเนื้อหาที่ยังไม่ได้อนุมัติ ไม่สามารถเผยแพร่ได้
- [x] 4.4 ตรวจสอบว่าเนื้อหาที่อนุมัติแล้วสามารถตั้งเวลาผ่าน flow การตั้งเวลาที่มีอยู่ได้
- [x] 4.5 ตรวจสอบว่า send_now รายงานผลของแต่ละช่องทางได้ถูกต้อง ทั้งสำเร็จ, ข้าม (skipped) และล้มเหลว (failed)
- [x] 4.6 ตรวจสอบว่ามีการใช้ payload ของ script แยกตามแพลตฟอร์ม เมื่อเผยแพร่ไปยังช่องทางที่ตรงกัน

## 5. ไม่มีโมดูล Pipeline แยก

- [x] 5.1 ตรวจสอบว่าไม่มีไฟล์ `ContentPipelinePage.tsx`
- [x] 5.2 ตรวจสอบว่าไม่มีการลงทะเบียน route `/content-pipeline`
- [x] 5.3 ตรวจสอบว่าไม่มีการเพิ่มเมนูใน sidebar หรือ role permission ชื่อ `content_pipeline`
- [x] 5.4 ตรวจสอบว่า Content Planner และหน้าเนื้อหาเดิมยังใช้งานได้ปกติ

## 6. ด่านตรวจคุณภาพสุดท้าย (Final Quality Gates)

- [x] 6.1 รัน PHP syntax check กับไฟล์ PHP ทุกไฟล์ที่แก้ไขใน change นี้
- [x] 6.2 รัน `pnpm lint`
- [x] 6.3 รัน `pnpm build`
- [x] 6.4 รัน `pnpm test`
- [x] 6.5 บันทึกโน้ตการตรวจสอบ, ความเสี่ยงที่ยังเหลืออยู่ และผลการทดสอบกับ provider จริง (ถ้ามี) ไว้ใน response สุดท้าย
