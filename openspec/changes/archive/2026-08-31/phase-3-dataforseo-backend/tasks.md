## 1. เตรียม provider adapter

- [x] 1.1 ตรวจ helper HTTP/cURL และรูปแบบ error handling ที่มีอยู่ใน `api/`
- [x] 1.2 สร้าง `api/lib/keyword-research.php` พร้อมฟังก์ชันเรียก DataForSEO แบบไม่แตะฐานข้อมูล
- [x] 1.3 เพิ่ม Basic Auth และ timeout 60 วินาที โดยไม่ log credential
- [x] 1.4 เพิ่ม credential test ผ่าน `/v3/appendix/user_data`

## 2. เรียกและ normalize DataForSEO

- [x] 2.1 เรียก SERP Google Organic Live Advanced พร้อม organic results, PAA และ related searches
- [x] 2.2 เรียก Keyword Suggestions พร้อม difficulty และ intent เมื่อ provider ส่งมา
- [x] 2.3 รวม keyword candidates และเรียก Google Ads Search Volume ภายในจำนวนสูงสุดที่กำหนด
- [x] 2.4 normalize response เป็น shape กลาง `serp`, `keywords`, `raw`, `cost_usd`
- [x] 2.5 รักษา metric ที่ไม่มีเป็น `null` และเก็บ source ของ keyword
- [x] 2.6 ตรวจ HTTP status, provider status, response shape และ timeout ให้คืน error ที่ชัดเจน

## 3. สร้าง Research API

- [x] 3.1 สร้าง `api/content-research.php` และเรียก `requireAuth()` ก่อน dispatch action
- [x] 3.2 เพิ่ม `settings-status` โดยคืนเฉพาะ provider config และ `has_key`
- [x] 3.3 เพิ่ม `test` เพื่ออ่าน credential จาก tenant แล้วคืนผลทดสอบโดยไม่เปิดเผย secret
- [x] 3.4 เพิ่ม `fetch` พร้อมสร้าง job, เปลี่ยนสถานะ, บันทึก raw/normalized data และ cost
- [x] 3.5 เพิ่ม cache lookup ตาม tenant/provider/location/language/seed และ `force_refresh`
- [x] 3.6 เพิ่ม `job` และ `jobs` พร้อม tenant filter, content filter และ limit
- [x] 3.7 เพิ่ม `keyword-select` พร้อมตรวจ ownership และบันทึก `is_selected`
- [x] 3.8 จัดการ failure ให้ job เป็น `failed` พร้อมข้อความภาษาไทย

## 4. ความปลอดภัยและความถูกต้องของข้อมูล

- [x] 4.1 ตรวจทุก query และ mutation มี tenant predicate
- [x] 4.2 ตรวจ `content_item_id` ถ้ามีต้องเป็นของ tenant เดียวกัน
- [x] 4.3 ตรวจว่า response และ error ไม่มี password, encrypted key หรือ Authorization header
- [x] 4.4 ตรวจว่า provider ไม่ส่ง metric จะถูกบันทึกเป็น `NULL` ไม่ใช่ `0`
- [x] 4.5 จำกัด seed, candidate keywords และ payload size ตาม contract

## 5. ทดสอบและตรวจก่อนปิดงาน

- [x] 5.1 เพิ่ม unit tests สำหรับ normalization, null metrics และ provider error
- [x] 5.2 ทดสอบ credential ที่ถูกต้องและไม่ถูกต้องโดยไม่เปิดเผย secret
- [x] 5.3 ทดสอบ fetch สำเร็จและตรวจ job/keywords/raw/cost ในฐานข้อมูล
- [x] 5.4 ทดสอบ cache hit และ force refresh ว่าเรียก provider ตามกติกา
- [x] 5.5 ทดสอบ tenant isolation ของ job, content item และ keyword selection
- [x] 5.6 ทดสอบ timeout/HTTP error แล้ว job ต้องเป็น `failed`
- [x] 5.7 ตรวจ PHP syntax ของไฟล์ PHP ที่เพิ่ม/แก้
- [x] 5.8 รัน `pnpm lint`
- [x] 5.9 รัน `pnpm build`
- [x] 5.10 รัน `pnpm test`
- [x] 5.11 ตรวจ `git diff` และ `git status` เฉพาะไฟล์ใน scope
- [x] 5.12 ตรวจ response ไม่มี secret และตรวจฐานข้อมูลก่อน archive
