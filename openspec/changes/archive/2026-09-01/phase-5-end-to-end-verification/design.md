## Context

AI Research ถูกเพิ่มเข้าระบบเป็น backend/storage/provider/integration แล้วใน phase ก่อนหน้า โดยใช้ `content_items` เดิม ไม่สร้าง module `/content-pipeline` แยก และผู้ใช้ตั้งค่า DataForSEO Login/Password แล้ว

สถานะปัจจุบันที่ต้องปิดช่องว่างคือ `api/content-research.php?action=test` มีอยู่แล้ว แต่ `ResearchProviderForm` ยังปิดปุ่มทดสอบไว้ และยังไม่มีรอบ verification ที่พิสูจน์ครบว่า test, fetch, analyze, generate, SEO และ publish ทำงานต่อกันได้จริงใน flow เดิม

## Goals / Non-Goals

**Goals:**

- เปิดปุ่มทดสอบ DataForSEO ในหน้าตั้งค่า Research
- ตรวจ backend `settings-status`, `test`, `fetch`, `analyze`, `job`, `jobs` และ `keyword-select`
- ตรวจ generation ที่ส่ง `research_job_id` แล้วใช้ Research brief สร้าง SEO metadata
- ตรวจ fallback เมื่อไม่ใช้ Research ว่ายังสร้าง content ได้และไม่แต่ง `meta_keywords`
- ตรวจ SEO/AEO, approval, schedule และ publish flow เดิม
- เพิ่ม automated tests เท่าที่ไม่ต้องพึ่ง provider จริง และแยก manual verification สำหรับ credential จริง

**Non-Goals:**

- ไม่สร้าง `/content-pipeline`
- ไม่เพิ่ม `content_pipeline`
- ไม่สร้าง wizard ใหม่
- ไม่เปลี่ยน schema ถ้า verification ไม่พบปัญหาที่จำเป็นจริง
- ไม่ยิง DataForSEO จริงใน automated test suite

## Decisions

1. ใช้ flow เดิมเป็นฐาน verification

   ทางเลือกคือสร้างหน้าใหม่เพื่อทดสอบ flow ทั้งหมด แต่ถูกยกเลิกแล้วเพราะผู้ใช้ไม่ต้องการระบบแยก ดังนั้น verification ต้องผูกกับ Content Planner/Content UI เดิม และใช้ API ที่มีอยู่

2. เปิดปุ่ม test connection ก่อน full manual run

   ปุ่มนี้เป็นช่องว่างเล็กแต่สำคัญ เพราะ backend มี `action=test` แล้ว ผู้ดูแลควรยืนยัน credential ได้จากหน้า settings โดยไม่ต้องยิง API เอง

3. แยก automated tests กับ provider-real verification

   Automated tests ต้อง mock หรือทดสอบ contract ที่ไม่ต้องใช้ network เพื่อให้ `pnpm test` เสถียร ส่วน DataForSEO credential จริงให้ทำเป็น manual verification เพราะขึ้นกับบัญชี, balance, network และ provider availability

4. ไม่แก้ logic เพิ่มถ้า test ไม่ชี้ว่าพัง

   Phase นี้เป็น verification-first ถ้าพบ defect ให้แก้เฉพาะ defect ที่บล็อก Research flow หรือทำให้ข้อมูลผิด ไม่ refactor ส่วนอื่น

## Risks / Trade-offs

- DataForSEO credential ถูกต้องแต่ provider ชั่วคราวล่ม -> บันทึกผล manual verification เป็น provider failure และยืนยันว่า job เป็น `failed` พร้อม error ภาษาไทย
- Automated tests ไม่ครอบ provider จริง -> ชดเชยด้วย manual checklist ที่ยิง credential จริงหนึ่งรอบ
- การทดสอบ publish อาจส่งโพสต์จริง -> ใช้ channel test/stub หรือยืนยันช่องทางก่อนส่งจริง และตรวจ idempotency/response contract โดยไม่ทำซ้ำพร่ำเพรื่อ
- การแก้ปุ่ม test connection แตะ UI settings -> จำกัด scope เฉพาะ `ResearchProviderForm` และ hook/client ที่จำเป็น
