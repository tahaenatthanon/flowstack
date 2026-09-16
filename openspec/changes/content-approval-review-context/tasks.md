## 1. Database migration

- [x] 1.1 สร้างไฟล์ `database/migrations/2026_09_16_133418_add_content_aeo_score_and_approval_rounds.sql` และ `CREATE TABLE content_approval_rounds (...)`
- [x] 1.2 รัน migration จริงกับ MariaDB local
- [x] 1.3 ยืนยันด้วย `SHOW COLUMNS FROM content_items` และ `DESCRIBE content_approval_rounds`
- [x] 1.4 **แก้ไขเพิ่มเติมหลังพบว่ามี 2 คะแนนแยกกัน (SEO+AEO):** แก้ไฟล์ migration เดิมให้มีทั้ง `seo_score` และ `aeo_score`, รัน incremental `ALTER TABLE content_items ADD COLUMN seo_score INT NULL AFTER seo_title;` แพตช์ DB ที่รันไปแล้วให้ครบ, ยืนยันด้วย `SHOW COLUMNS`

## 2. Backend — persist AEO score

- [x] 2.1 หาจุดบันทึกเนื้อหาหลัง generate/repair ใน `api/brand-content.php` (line 2999-3011, action `generate-article`) เพิ่ม `seo_score=?, aeo_score=?` เข้า UPDATE statement ทั้ง 4 variant โดยใช้ค่าจาก `$seoEval['score']`/`$aeoEval['score']` สุดท้ายหลัง repair loop จบ — `php -l` ผ่าน
- [x] 2.2 เช็คจุดอื่นที่มีการเรียก `seo_evaluate()`/`aeo_evaluate()` แล้วบันทึกเนื้อหา — เจอเพิ่มอีก 1 จุดจริง: action `quality-recheck` (line ~469-485) คำนวณทั้งสองคะแนนแต่ไม่เคยบันทึก แก้เพิ่มแล้ว; เช็ค `generate-video` (line 3444+) แล้วไม่มีการเรียก seo/aeo evaluate เลย ไม่ต้องแก้
- [x] 2.3 ตรวจแล้ว: `content-items.php` GET list query ใช้ explicit column list (ไม่ใช่ `ci.*`) เพิ่ม `ci.seo_score, ci.aeo_score` เข้าไปแล้ว; single-item query (line 97, 230) ใช้ `ci.*` อยู่แล้วได้ทั้งสองคอลัมน์อัตโนมัติ; `brand-content.php` ใช้ `SELECT *` ทุกจุดที่ดึง content item ได้อัตโนมัติเช่นกัน ไม่ต้องแก้ — `php -l` ผ่านทั้งคู่

## 3. Backend — approval round history

- [x] 3.1 ใน `api/content-items.php` PUT handler (`?id=`) เพิ่ม logic: เมื่อ `status` ที่ส่งมาเป็น `approved`/`revision`/`rejected` insert แถวใหม่ลง `content_approval_rounds` — `reject_reason` เดิมบน `content_items` ยังคงเขียนเหมือนเดิมด้วย (ผ่าน whitelist `$allowed` เดิม ไม่ได้แตะ)
- [x] 3.2 เพิ่ม nested field `approval_rounds` ใน GET list response — **ปรับจากแผนเดิม:** MariaDB เครื่องนี้เป็น 10.4.32 ยังไม่มี `JSON_ARRAYAGG` (มาใน 10.5) เปลี่ยนมาใช้ query แยกดึงประวัติทั้งหมดของ item ในหน้านั้น (`WHERE content_item_id IN (...)`) แล้ว group ใน PHP แทน — ปลอดภัยกว่าและใช้ได้กับ MariaDB เวอร์ชันนี้

## 4. Frontend — แสดงคะแนน AEO

- [x] 4.1 เพิ่ม field `seo_score`, `aeo_score` ใน type `ContentItem` (`src/components/content/types.ts`)
- [x] 4.2 ใน `ContentDetailView.tsx` header meta row แสดง "SEO {score}" และ "AEO {score}" แยกกัน เมื่อไม่เป็น NULL (ซ่อนแต่ละตัวอิสระถ้าตัวนั้น NULL) พร้อมสีตามเกณฑ์เดียวกับ `seo_gate_status()` ฝั่ง backend (≥90 เขียว, 80-89 เหลือง, ต่ำกว่าแดง)

## 5. Frontend — ประวัติการตัดสินใจแบบแยกรอบ

- [x] 5.1 เพิ่ม type `ApprovalRound` (decision, reason, decided_at) และ field `approval_rounds: ApprovalRound[]` ใน `ContentItem` (`src/components/content/types.ts`)
- [x] 5.2 แก้ส่วนแสดง reject reason banner เดิมใน `ContentDetailView.tsx` จากแบนเนอร์เดียวจาก `item.reject_reason` เป็น map ทุกแถวใน `item.approval_rounds` เรียงเก่า→ใหม่ (ตรงกับที่ backend คืนมา) แต่ละรอบมีกล่อง สี และ label แยกตาม decision (อนุมัติ/ขอแก้ไข/ปฏิเสธ) ไม่ปนกัน
- [x] 5.3 ซ่อนส่วนประวัติทั้งหมดถ้า `item.approval_rounds` ว่างหรือไม่มี (`length > 0` guard) ตามที่ระบุใน spec

## 6. ตรวจสอบ

- [x] 6.1 `php -l` ไฟล์ PHP ที่แก้ทั้งหมด — ผ่านทั้งคู่
- [x] 6.2 `pnpm lint` — 0 errors (47 warning เดิม ไม่มีของใหม่)
- [x] 6.3 `pnpm build` — ผ่าน
- [x] 6.4 `pnpm test` — 254/254 ผ่าน (รวม `ContentApprovalTab.test.tsx` เดิม)
- [x] 6.5 ทดสอบจริงในเบราว์เซอร์: **ปรับวิธีทดสอบ** — ใช้ item ที่มีเนื้อหาอยู่แล้ว (`ยกระดับความเร็ว...`) กด "ตรวจ Quality" แทนการ generate ใหม่ (เร็วกว่า เรียกโค้ดจุดเดียวกันคือ `quality-recheck`) ยืนยันคะแนนถูกบันทึกจริงใน DB (`seo_score=94, aeo_score=100`) และ badge "SEO 94 / AEO 100" ขึ้นในหน้าอนุมัติถูกต้อง (สีเขียวตามเกณฑ์ ≥90) จากนั้นเรียก PUT `content-items.php` (ผ่าน session ที่ login ค้างอยู่) ขอแก้ไข 2 รอบติดกันด้วยเหตุผลต่างกัน ("รอบที่ 1: แก้หัวข้อ H2..." กับ "รอบที่ 2: เพิ่มตัวอย่างลูกค้าไทยจริง") ยืนยันใน DB ว่าได้ 2 แถวแยกกันเรียงเวลาถูกต้อง แล้วเปิดรายละเอียดอีกครั้งในเบราว์เซอร์ เห็น "รอบ 1 — ขอแก้ไข" และ "รอบ 2 — ขอแก้ไข" แยกกล่องชัดเจน คนละเหตุผล ไม่ปนกัน — ผ่าน
- [x] 6.6 ทดสอบ content item เก่าที่มีอยู่ก่อน migration (`Smart Factory 360°` มี `reject_reason` เดิม, `seo_score`/`aeo_score` เป็น NULL) เปิดดูในเบราว์เซอร์ได้ปกติไม่ error (เช็ค console ไม่มี error), ไม่โชว์ badge คะแนน (ถูกต้องเพราะ NULL), และไม่มีส่วนประวัติ (ค้นหา "ประวัติ"/"เหตุผล" ในหน้าไม่เจอ — guard `length > 0` ทำงานถูกต้องเพราะยังไม่มีแถวใน `content_approval_rounds`) — ผ่าน
