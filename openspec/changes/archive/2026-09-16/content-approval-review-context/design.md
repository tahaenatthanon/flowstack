## Context

`api/brand-content.php` คำนวณคะแนน AEO/SEO ผ่าน `seo_evaluate()` อยู่แล้วหลายจุด (บรรทัด ~2948, ~2999-3010 คือจุดที่บันทึกเนื้อหาหลัง generate/repair) แต่คะแนน (`$seoEval['score']`) ถูกใช้แค่ตอบกลับใน JSON response ให้ frontend ตอนนั้นทันที ไม่เคยถูกเขียนลง `UPDATE content_items` เลยสักจุด — เช็ค `SHOW COLUMNS FROM content_items` ยืนยันไม่มีคอลัมน์คะแนนอยู่จริง

ฝั่งการอนุมัติ `api/content-items.php` (PUT `?id=`) ใช้ whitelist ฟิลด์ธรรมดา (`$allowed = [...'status', 'reject_reason'...]`) เขียนทับค่าเดิมทุกครั้งที่มีการเปลี่ยนสถานะ — ไม่มี concept ของ "รอบ" เลย เขียนทับ column เดียวกันซ้ำๆ

ผู้ใช้ (เจ้าของระบบ) ตัดสินใจระหว่างสำรวจไว้ 4 ข้อ: (1) โชว์แค่ตัวเลขคะแนน ไม่ต้อง breakdown (2) ประวัติแยกเป็นรอบๆ (3) ไม่ทำเรื่อง attribution ตอนนี้ (4) ไม่บังคับเปิด SEO panel

## Goals / Non-Goals

**Goals:**
- คะแนน SEO และ AEO ล่าสุด (แยกกัน) ของ content item แต่ละชิ้นต้องอยู่รอดหลัง generate เสร็จ ดูได้ตอนอนุมัติ
- ทุกครั้งที่มีคนตัดสินใจ (อนุมัติ/ขอแก้ไข/ปฏิเสธ) ต้องมีบันทึกเป็นแถวใหม่ ไม่เขียนทับของเดิม
- หน้ารายละเอียดอนุมัติแสดงประวัติทุกรอบเรียงเวลา พร้อมเหตุผลของแต่ละรอบ

**Non-Goals:**
- ไม่ทำ breakdown คะแนนรายข้อ (15 checklist) ในหน้าอนุมัติ — โชว์แค่คะแนนรวม 2 ตัว (SEO, AEO)
- ไม่เพิ่มข้อมูลผู้สร้าง/ผู้ขออนุมัติ/ผู้ตัดสินใจแต่ละรอบ (รอคุยกับทีมก่อนในรอบถัดไป)
- ไม่เปลี่ยนพฤติกรรม SEO metadata panel (`<details>` พับเก็บ) ที่มีอยู่แล้ว

## Decisions

### 1. เพิ่ม 2 คอลัมน์แยก `seo_score` และ `aeo_score` (ทั้งคู่ INT, nullable) บน `content_items` แทนตารางแยก
**แก้ไขจากที่เข้าใจผิดตอนแรก:** ตอนเขียน proposal/spec รอบแรกสมมติว่ามีคะแนนเดียว ("AEO/SEO") แต่ไล่โค้ดจริงตอน implement (`api/brand-content.php:2948-2957`) พบว่าระบบมี **2 ระบบประเมินแยกจากกันจริง** — `$seoEval` (SEO checklist) และ `$aeoEval` (AEO checklist) คนละคะแนน คนละ gate — ยืนยันเพิ่มจาก `ArticleEditor.tsx` ที่มีทั้ง `SeoChecklistPanel` และ `AeoChecklistPanel` แสดงคู่กันเป็น 2 กล่องแยกให้ผู้สร้างเห็นอยู่แล้ว ผู้ใช้ตัดสินใจ (16 ก.ย. 2569) ให้เก็บและโชว์**ทั้ง 2 คะแนนแยกกัน** ไม่รวมเป็นค่าเดียว
**ทำไมเป็นคอลัมน์ ไม่ใช่ตาราง:** เป็นค่าล่าสุดค่าเดียวต่อ content item ต่อระบบประเมิน ไม่ใช่ประวัติ (ตามที่ตกลงไว้ว่า "เห็นแค่คะแนนที่ได้" ไม่ต้องดูย้อนหลัง) — เก็บเป็น 2 คอลัมน์พอ ไม่ต้องมีตารางแยกให้ query ซับซ้อนเกินจำเป็น
**ทางเลือกที่ตัดออก:** (ก) เก็บคะแนนเดียว (เฉลี่ยหรือเลือกแค่ AEO) — ทิ้งข้อมูลจริงที่ระบบคำนวณอยู่แล้วไปเปล่าๆ (ข) เก็บเป็นตารางประวัติคะแนนแยก — เกินความจำเป็นเพราะไม่มีการตัดสินใจให้ต้องดูคะแนนย้อนหลังของรอบก่อนๆ

### 2. เขียนคะแนนทั้ง 2 ที่จุดเดียวกับที่ `article_content` ถูกบันทึกหลัง generate/repair
**ทำไม:** จุดนั้น (`api/brand-content.php` ~line 2999-3010) เป็นจุดเดียวที่รู้ผลทั้ง `$seoEval` และ `$aeoEval` สุดท้ายหลัง repair loop จบแล้ว (ไม่ใช่ผลระหว่างรอบ retry) — เพิ่ม `seo_score=?, aeo_score=?` เข้า UPDATE statement ทั้ง 4 variant ที่มีอยู่แล้วตรงนั้น ไม่ต้องเปิด query ใหม่

### 3. สร้างตารางใหม่ `content_approval_rounds` เก็บประวัติการตัดสินใจ
```
id            CHAR(36) PK
content_item_id  CHAR(36) FK → content_items.id ON DELETE CASCADE
decision      ENUM('approved','revision','rejected')
reason        TEXT NULL
decided_at    DATETIME DEFAULT CURRENT_TIMESTAMP
tenant_id     CHAR(36)
```
**ทำไม:** ต้องเก็บได้หลายแถวต่อ content item (1 แถวต่อรอบ) — `reject_reason` เดิมบน `content_items` เป็น column เดี่ยว ทำแบบนี้ไม่ได้ตั้งแต่ต้น
**ทางเลือกที่ตัดออก:** เก็บเป็น JSON array ในคอลัมน์เดียว — เลือกตารางแยกเพราะ query/sort ตามเวลาง่ายกว่า และสอดคล้องกับ pattern ตารางอื่นในระบบ (เช่น `cron_runs`, `email_link_clicks` ที่เป็น log แยกตารางเหมือนกัน)

### 4. `api/content-items.php` PUT: insert แถวใหม่ในตารางประวัติ เมื่อ `status` เปลี่ยนเป็น `approved`/`revision`/`rejected`
**ทำไม:** จุดเดียวที่มีการเปลี่ยนสถานะจากการตัดสินใจอนุมัติอยู่แล้ว (`ContentDetailView.tsx` → `applyDecision()` → PUT นี้) เพิ่ม logic แทรกแถวประวัติคู่กับการ UPDATE เดิม ไม่กระทบ flow อื่น
**คงไว้:** ยังเขียน `reject_reason` บน `content_items` เหมือนเดิมด้วย (ให้ query ที่มีอยู่แล้วที่อ้างอิงคอลัมน์นี้ไม่พัง) แต่ค่าจะเท่ากับ "เหตุผลของรอบล่าสุด" เท่านั้น — แหล่งความจริงสำหรับประวัติเต็มคือตารางใหม่

### 5. ข้อมูลเก่าก่อน migration: ไม่ backfill ประวัติย้อนหลัง
**ทำไม:** `reject_reason` เดิมไม่มี timestamp แยกรายรอบ (ใช้ `updated_at` ของ content item ซึ่งอาจถูกเขียนทับจากเหตุผลอื่นที่ไม่ใช่การอนุมัติ เช่นแก้ไขเนื้อหา) การเดา timestamp ย้อนหลังจะให้ข้อมูลเท็จ — content item ที่มีอยู่ก่อน migration จะเห็นประวัติว่างเปล่าจนกว่าจะมีการตัดสินใจรอบใหม่เกิดขึ้นหลัง deploy

## Risks / Trade-offs

- **[Risk]** `content_approval_rounds` โตไม่จำกัดตามจำนวนรอบ ไม่มี retention policy → **Mitigation**: ยังไม่ทำตอนนี้ เพราะ scale การอนุมัติคอนเทนต์ต่ำ (ตาม `content_items` ปัจจุบันไม่ได้มีปริมาณสูง) พิจารณา archive ทีหลังถ้าจำเป็นจริง
- **[Risk]** เขียน `reject_reason` ซ้ำสองที่ (คอลัมน์เดิม + ตารางใหม่) เสี่ยงข้อมูลไม่ตรงกันถ้ามีจุดอื่นเขียน `reject_reason` ตรงๆ โดยไม่ผ่าน flow ที่แก้ไว้ → **Mitigation**: grep ยืนยันแล้วว่า `content_items.reject_reason` ถูกเขียนจากจุดเดียวคือ PUT นี้ (ผ่าน whitelist `$allowed`) ไม่มีจุดอื่นเขียนตรง

## Migration Plan

1. Migration SQL: `ALTER TABLE content_items ADD COLUMN seo_score INT NULL AFTER seo_title, ADD COLUMN aeo_score INT NULL AFTER seo_score;` + `CREATE TABLE content_approval_rounds (...);`
2. Deploy backend: แก้ 2 จุด (`brand-content.php` เขียนคะแนน, `content-items.php` insert ประวัติ) พร้อมกัน — ถ้า deploy คนละเวลา จุดที่ยังไม่แก้จะแค่ไม่เขียนข้อมูลใหม่ ไม่ error (คอลัมน์/ตารางใหม่เป็น nullable/optional)
3. Deploy frontend: `ContentDetailView.tsx` ดึงประวัติจาก endpoint ใหม่ (หรือ field ใหม่ใน response ของ `content-items.php` GET) มาแสดงเรียงเวลา
4. Rollback: ถ้ามีปัญหา ลบคอลัมน์/ตารางใหม่ได้โดยไม่กระทบ flow เดิม เพราะ `reject_reason` เดิมยังทำงานเป็น fallback อยู่

## Open Questions

- ~~API endpoint สำหรับดึงประวัติ~~ **ตอบแล้วตอน implement:** เป็น nested field `approval_rounds` ใน response ของ `GET content-items.php` (list endpoint ที่ dialog ใช้ข้อมูลอยู่แล้ว ไม่มี endpoint ดึงทีละ item แยกต่างหาก) — implement ด้วย query แยกดึงประวัติของทุก item ในหน้านั้นแล้ว group ใน PHP แทนการทำ `JSON_ARRAYAGG` ในตัว SQL หลัก เพราะ MariaDB เครื่องนี้เป็น 10.4.32 ยังไม่มีฟังก์ชันนี้ (มาใน MariaDB 10.5)
