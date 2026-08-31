## 1. SEO Evaluation

- [x] 1.1 ปรับ `seo_evaluate()` ให้รับ `content_items.type` และเลือก ruleset ของ article/video โดยคงค่าเริ่มต้นเป็น article
- [x] 1.2 แก้กฎ `no_h1` ให้ผ่านเมื่อมี h1 ไม่เกินหนึ่งตัว และ fail เมื่อมี h1 ตั้งแต่สองตัวขึ้นไป
- [x] 1.3 เพิ่มระดับ `pending` สำหรับ metadata ที่ยังว่าง และปรับการคำนวณคะแนนให้ pending ไม่ถูกหักคะแนน
- [x] 1.4 ทำให้ ruleset วิดีโอข้าม `has_h2`, `word_count`, `internal_link` และกฎที่ต้องใช้โครงสร้างบทความ พร้อมตรวจ metadata/hashtags ที่เกี่ยวข้อง
- [x] 1.5 อัปเดต endpoint `seo-checklist` ให้ส่งชนิดคอนเทนต์จริงและคืนสถานะ pending/skip ได้
- [x] 1.6 ตรวจให้ SEO gate บล็อกเฉพาะ `fail` หรือคะแนนต่ำกว่า `seo_gate_min_score` และเปิดใช้งานด้วยค่าที่อนุมัติหลังแก้ครบ

## 2. Content Data And Generation

- [x] 2.1 เพิ่มฟิลด์ SEO ทั้ง 6 รายการใน allowlist ของ `api/content-items.php` และแปลง `structured_data` เป็น JSON อย่างถูกต้องเมื่อจำเป็น
- [x] 2.2 แก้ `generate-article` ให้โหลดคอนเทนต์ด้วย `tenant_id` และใช้ `content_items.type` แทนการเดาชนิดจาก platform
- [x] 2.3 เติม SEO metadata/hashtags ที่จำเป็นในผลลัพธ์วิดีโอ หรือจัดการ fallback ให้สอดคล้องกับ ruleset วิดีโอ
- [x] 2.4 บังคับให้ `meta_keywords` มาจาก Research ที่มีจริง และเขียนค่าว่างเมื่อไม่มี Research โดยไม่ให้ LLM เติมเอง

## 3. Publish Flow

- [x] 3.1 สร้าง payload ต่อ channel โดยให้ channel override มีลำดับสูงสุด และเลือก `article_content.scripts[platform]` เมื่อมีค่า
- [x] 3.2 คง fallback ไป caption/article HTML เดิมเมื่อไม่มี script เฉพาะ platform และไม่เปลี่ยนพฤติกรรมของ CMS ที่ต้องใช้ HTML
- [x] 3.3 แก้การอัปเดตผล publish ไม่ให้ค่า platform ของ channel สุดท้ายถูกใช้แทนผลรวม โดยยึด queue/result ราย channel เป็นแหล่งความจริง
- [x] 3.4 ส่งชนิดคอนเทนต์เข้า SEO gate ในเส้นทาง cron และตรวจ approval/idempotency gate ก่อน dispatch ตามเดิม
- [x] 3.5 ตรวจ tenant filter และสิทธิ์ของเส้นทาง publish ที่ได้รับผลกระทบจากการแก้ shared flow

## 4. Verification

- [x] 4.1 ทดสอบ `seo_evaluate()` สำหรับ h1 ศูนย์/หนึ่ง/สองตัว, metadata ว่าง, article และ video
- [x] 4.2 ทดสอบ endpoint แก้ไข SEO แล้วเรียก checklist ซ้ำ โดยค่าที่แก้ต้องถูกอ่านจากคอลัมน์จริง
- [x] 4.3 ทดสอบ send-now หลาย platform ให้แต่ละ channel ได้ script ของตนเอง, override ทำงาน และ fallback เดิมยังทำงาน
- [x] 4.4 ทดสอบ send-now/cron กรณี approval ไม่ผ่าน, SEO fail, duplicate และผลลัพธ์ผสมหลาย channel
- [x] 4.5 รัน `php -l` กับ PHP ที่แก้ไข และรัน `pnpm lint`, `pnpm build`, `pnpm test`
- [x] 4.6 ตรวจ regression ของ `/content-planner` และ `/content` รวมถึงยืนยันว่าไม่มีข้อมูลข้าม tenant ถูกอ่านหรือส่งออก
