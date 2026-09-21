## 1. Database

- [x] 1.1 สร้าง migration `database/migrations/<timestamp>_create_products_table.sql` — ตาราง `products` (id CHAR(36) PK, tenant_id CHAR(36), name VARCHAR, description TEXT NULL, usp TEXT NULL, price DECIMAL NULL, image_url VARCHAR NULL, status ENUM('active','discontinued') DEFAULT 'active', created_by, created_at, updated_at)
- [x] 1.2 รัน migration กับ local MariaDB (`mysql -u root flowstack < ...`) และตรวจด้วย `DESCRIBE products`
- [x] 1.3 สร้าง migration `database/migrations/<timestamp>_add_product_and_plan_columns_to_email_campaigns.sql` — เพิ่ม `product_id CHAR(36) NULL`, `plan_batch_id CHAR(36) NULL`, `plan_sequence INT NULL` ใน `email_campaigns`
- [x] 1.4 รัน migration และตรวจด้วย `SHOW COLUMNS FROM email_campaigns`

## 2. Bootstrap Products จาก brand.md

- [x] 2.1 เขียน one-time script parse หัวข้อ "รายละเอียด สินค้า/บริการ" จาก `brand_contexts` (`file_type='brand_md'`) แยกเป็นรายการ name+description ต่อสินค้า
- [x] 2.2 ในสคริปต์เดียวกัน: auto-link รูปจาก `content_global_settings.product_refs` เมื่อชื่อ (`name`) ตรงกันเป๊ะ (case-insensitive trim พอ) — ไม่ตรงให้เว้น `image_url` ว่างไว้
- [x] 2.3 รันสคริปต์กับ local DB จริง (ได้ครบ 11 รายการ — หมายเหตุ: ไม่มีรูปเชื่อมสำเร็จเพราะชื่อใน brand.md คือ "AI Portal (Duckkit)" ส่วน product_refs คือ "Duckkit AI Portal" ลำดับคำต่างกัน จึงไม่ตรงแบบ exact-match ตามที่ design.md ระบุไว้ว่าเป็นความเสี่ยงที่ยอมรับได้ — ผู้ใช้แนบรูปเพิ่มเองได้ทีหลังผ่านหน้าจัดการสินค้า) แล้วตรวจด้วยมือผ่าน `SELECT * FROM products` ว่าได้ครบ 11 รายการ + มีรูปอย่างน้อย "Duckkit AI Portal" 1 รายการ

## 3. Backend — Product CRUD API

- [x] 3.1 สร้าง `api/products.php` — GET (list, filter tenant), POST (create), PUT (update), DELETE ตาม pattern เดิม (`requireAuth()`, `getDB()`, `getMethod()`, `jsonResponse`/`jsonError`)
- [x] 3.2 ตรวจว่า DELETE ไม่ลบแคมเปญที่มี `product_id` อ้างถึงสินค้านั้น (ปล่อย FK เป็น SET NULL หรือไม่ใส่ FK constraint แข็งก็ได้ ตามที่ schema อื่นในโปรเจกต์ใช้)

## 4. Backend — AI Generate เนื้อหาแคมเปญเดี่ยว

- [x] 4.1 เพิ่ม action ใหม่ (`?action=generate-content` ใน `api/email-campaigns.php`) ใน `api/email-campaigns.php` หรือ `api/brand-content.php` — รับ `product_ids[]`, `source_topic` (nullable), `tone`
- [x] 4.2 เขียน prompt builder ใหม่ (`api/lib/campaign-ai-prompt.php`)ที่ดึงข้อมูล product (name/description/usp) ของ `product_ids` ที่ส่งมา ใส่เข้า prompt ข้อความ (ของเดิมใน `content-plan-prompt.php` ไม่เคยทำแบบนี้ — ต้องเขียนใหม่ ไม่ใช่แก้ของเดิม เพราะ Content module กับ Campaign module มี requirement ต่างกัน)
- [x] 4.3 ใช้ Direct-mode pattern เดิม (topic เป็น source of truth) — ถ้า `source_topic` ว่าง ให้ AI คิด subject/campaign name เองและคืนค่ามาในผลลัพธ์ ถ้ามีให้คงไว้และไม่คืนค่าคืนมาทับ
- [x] 4.4 คืนผลลัพธ์เป็น `{ subject, name, body_html }` ตรงๆ ไม่สร้าง `content_items` row

## 5. Backend — AI วางแผนแคมเปญเป็นชุด

- [x] 5.1 เพิ่ม action ใหม่ (`?action=ai-plan`) รับ `product_id`, `count`, `interval_days`, `start_date`
- [x] 5.2 Validate: `product_id` ต้องมี, `count >= 1`, `interval_days >= 0`
- [x] 5.3 Generate เนื้อหา N แบบ (มุมต่างกันของสินค้าเดียวกัน) โดยเรียก prompt builder จากงาน 4.2 ซ้ำ N ครั้งด้วย seed/instruction ที่ต่างกันเล็กน้อยต่อฉบับ (กันเนื้อหาซ้ำกัน)
- [x] 5.4 Insert `email_campaigns` N แถว: `status='draft'`, `scheduled_at = start_date + (sequence-1)*interval_days`, `product_id`, `plan_batch_id` (UUID เดียวกันทุกแถว), `plan_sequence` (1..N)
- [x] 5.5 ยืนยันด้วยโค้ด/เทสต์ว่าไม่มี path ไหน (ตรวจโค้ด `aiPlanCampaigns()` แล้ว — insert เป็น `status='draft'` ตรงๆ ไม่มีการเรียก `sendCampaignCore()` หรือ set `status='scheduled'` เลยในฟังก์ชันนี้)ใน action นี้ตั้ง `status` เป็น `'scheduled'` หรือเรียก `sendCampaignCore()` เลย

## 6. Frontend — Product Catalog UI

- [x] 6.1 สร้าง `src/hooks/useProducts.ts` — `useProducts`, `useCreateProduct`, `useUpdateProduct`, `useDeleteProduct` (React Query, invalidate key หลัง mutation)
- [x] 6.2 สร้าง `src/components/brand/ProductCatalogForm.tsx` ใหม่แยกต่างหาก (ไม่แก้ `BrandProductRefsForm.tsx` เดิม) — เหตุผล: `BrandProductRefsForm` ผูกกับ `content_global_settings.product_refs` ที่ยังต้องใช้ generate รูปต่อไปตาม non-goal ใน design.md ("ไม่ migrate/แทนที่ product_refs เดิม") การเอาไปต่อกับ `useProducts` โดยตรงจะทำให้ image-gen เดิมขาดข้อมูล product_refs ใหม่แบบเงียบๆ (ผิด NO MAGIC) จึงแยกเป็นคนละ section คนละตารางข้อมูลชัดเจน ต่อกับ `useProducts`
- [x] 6.3 สร้าง component chip picker (`src/components/campaigns/ProductPicker.tsx`) เลือกสินค้า (ใช้ style เดียวกับ "Knowledge Base" chip ใน `QuickCreateDialog.tsx`) — reusable สำหรับงาน 7 และ 8

## 7. Frontend — ปุ่ม "สร้างด้วย AI" ในไดอะล็อกแคมเปญ

- [x] 7.1 เพิ่มปุ่ม "สร้างด้วย AI" ข้าง "ดึงคอนเทนต์" ใน `src/pages/CampaignsPage.tsx` (ใน section เนื้อหาอีเมลของ dialog สร้าง/แก้ไขแคมเปญ)
- [x] 7.2 เพิ่ม panel/popover: product chip picker (จากงาน 6.3) + ตัวเลือกโทนการเขียน + ปุ่ม "สร้าง"
- [x] 7.3 Wire ปุ่ม "สร้าง" เรียก action จากงาน 4.1 โดยส่ง `source_topic = campaignSubject` ถ้ามีค่า มิเช่นนั้นส่งว่าง
- [x] 7.4 Handle ผลลัพธ์: ถ้า `campaignSubject`/`campaignName` ว่างตอนกด ให้ `setCampaignSubject`/`setCampaignName` จากผลลัพธ์ AI, ถ้ามีค่าอยู่แล้วไม่ทับ — ทุกกรณี `setEditableContent`/`setCampaignBody` (ตาม `isChromeLocked`) ด้วยเนื้อหาที่ AI เขียน
- [x] 7.5 ทดสอบ manual ผ่าน dev server: กรณีหัวข้อว่าง และกรณีหัวข้อมีอยู่แล้ว ทั้งสองแบบได้ผลตามข้อ 7.4 (รายละเอียดดูที่ 9.4)

## 8. Frontend — AI วางแผนแคมเปญเป็นชุด

- [x] 8.1 สร้าง `src/components/campaigns/AICampaignPlanDialog.tsx` — wizard: เลือกสินค้า (chip picker จากงาน 6.3, required) → จำนวนฉบับ/ระยะห่างวัน/วันเริ่ม → ปุ่มยืนยัน (มีข้อความยืนยันก่อนยิงจริงแบบเดียวกับ `QuickCreateDialog`'s `confirm()`) → progress → done
- [x] 8.2 เพิ่มปุ่ม "AI วางแผนแคมเปญ" ที่ toolbar บนสุดของ `CampaignsPage.tsx` เปิด dialog นี้
- [x] 8.3 Wire ไปเรียก action จากงาน 5.1 — เสร็จแล้ว invalidate query แคมเปญ list ให้ขึ้นแถวใหม่ทันที
- [x] 8.4 เพิ่ม badge บนการ์ดแคมเปญใน list (`CampaignsPage.tsx`) แสดงเมื่อ `plan_batch_id` ไม่ว่าง — ข้อความรูปแบบ "ชุดแผน (X/N)" คำนวณจากจำนวนแคมเปญในชุดเดียวกันที่ status ผ่าน draft ไปแล้ว

## 9. Verification (ตาม CLAUDE.md — ต้องทำก่อนปิดงาน)

- [x] 9.1 รัน `pnpm lint` (0 errors, 47 warning เดิมที่มีอยู่ก่อนแล้ว ไม่มี warning ใหม่จากไฟล์ที่แก้ในงานนี้)
- [x] 9.2 รัน `pnpm test` (252/254 ผ่าน — 2 test ที่ fail อยู่ใน `PullFromContentDialog.test.tsx` ยืนยันแล้วว่า fail อยู่ก่อนแล้วบน main โดยไม่แตะไฟล์ของงานนี้เลย ไม่เกี่ยวกับการเปลี่ยนแปลงนี้ จึงไม่แก้ตาม SCOPE DRIFT)
- [x] 9.3 รัน `pnpm build` (สำเร็จ ไม่มี TypeScript error)
- [x] 9.4 ทดสอบ manual ผ่าน dev server ครบ 3 flow (ผ่านทั้งหมด):
      - จัดการสินค้า: แก้ไข "AI Portal (Duckkit)" เพิ่ม USP+ราคา → PUT 200 OK → ยืนยันด้วย SQL ว่าบันทึกจริง
      - สร้างแคมเปญเดี่ยวด้วย AI: (ก) หัวข้อว่าง → AI เติมทั้งชื่อแคมเปญ+หัวข้ออีเมลให้ (ข) หัวข้อมีอยู่แล้ว ("ทดสอบหัวข้อคงเดิม ห้าม AI แก้") → หัวข้อไม่ถูกทับ มีแค่ชื่อแคมเปญที่ว่างถูกเติม และเนื้อหาที่ AI เขียนตรงกับสินค้าที่เลือก (Smart Factory 360° ก็ได้เนื้อหาเกี่ยวกับ Smart Factory จริง ไม่ใช่ AI Portal)
      - AI วางแผนแคมเปญชุด: เลือก AI Portal (Duckkit), 2 ฉบับ → สร้าง email_campaigns 2 แถว status='draft' พร้อม badge "ชุดแผน (0/2)" ในรายการ → ยืนยันว่าไม่มีฉบับไหนถูกส่ง/ตั้งเวลาอัตโนมัติ (ทั้งคู่อยู่ที่ draft, มีแค่ปุ่ม ส่ง/แก้ไข ให้กดเองเท่านั้น) → ลบ 2 ฉบับทดสอบทิ้งหลังยืนยันเสร็จ ไม่ให้ค้างในระบบจริง
