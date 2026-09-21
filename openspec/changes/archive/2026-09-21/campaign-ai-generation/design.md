## Context

ระบบตอนนี้มี Content module (`brand-content.php`, `content_items`, `brand_contexts`) ที่ generate ข้อความ/รูปด้วย AI แยกขาดจาก Campaign module (`CampaignsPage.tsx`, `email_campaigns`) ที่สร้างอีเมลด้วยมือหรือ "ดึงคอนเทนท์" ที่มีอยู่แล้วมาใส่เท่านั้น

ข้อมูลสินค้ากระจัดกระจาย 2 ที่ ไม่เชื่อมกัน:
- `product_refs` (JSON ใน `content_global_settings`) — มีรูป + ชื่อ + metadata ทางภาพ (สี/ทรง/mood) ใช้แค่ตอน generate รูป ไม่มีคำอธิบาย/USP
- `brand_contexts` (`file_type='brand_md'`) — มีคำอธิบายสินค้า/USP จริงของ 11 สินค้า แต่เป็น markdown ก้อนเดียว ไม่มี ID แยกรายตัว ถูกส่งเข้า prompt ข้อความทั้งก้อนอยู่แล้วตอน generate-plan แต่ผู้ใช้เจาะจงเลือกสินค้าเดียวไม่ได้

ระบบมี precedent ด้านความปลอดภัยอยู่แล้วสำหรับ AI-planned content: `content_plans.status` เป็น `draft → approved → published` — AI วางแผนได้เต็มที่ แต่ต้องมีคนอนุมัติก่อนเข้าสู่ auto-publish การส่งอีเมลตามเวลาก็มี cron อยู่แล้ว (`send-scheduled-campaigns.php`) ที่ทำงานกับ `email_campaigns.status='scheduled' AND scheduled_at<=NOW()` โดยไม่สนว่าแคมเปญถูกสร้างด้วยมือหรือ AI

## Goals / Non-Goals

**Goals:**
- มีข้อมูลสินค้าที่มีโครงสร้าง (ชื่อ, คำอธิบาย, USP, ราคา, รูป) ใช้ได้ทั้งตอน generate ข้อความและรูป
- ให้ผู้ใช้เลือกสินค้าตอนสร้างแคมเปญในไดอะล็อกเดิมได้ทันที ไม่ต้องออกจากหน้า
- ให้ AI เสนอแผนแคมเปญหลายฉบับ (เว้นระยะวัน) รอบสินค้าที่เลือก โดยไม่ส่งอะไรออกไปจนกว่าคนจะอนุมัติทีละฉบับ
- ใช้ pattern ที่มีอยู่แล้วซ้ำให้มากที่สุด (chip multi-select แบบ Knowledge Base, Direct-mode topic-as-source-of-truth, draft→approved gate แบบ content_plans)

**Non-Goals:**
- ไม่ทำ AI ส่งอัตโนมัติแบบไม่มีคนรีวิวเลย (ตัดสินใจไปแล้วว่าเลือกแบบต้องอนุมัติ)
- ไม่เพิ่ม route/page/menu ใหม่
- ไม่ migrate/แทนที่ `product_refs` เดิม (ยังใช้ generate รูปเหมือนเดิม)
- ไม่ทำแคมเปญโซเชียล ในการเปลี่ยนแปลงนี้ยังคงเป็นอีเมลเท่านั้น (ตามขอบเขตเดิมของ CampaignsPage)
- ไม่แตะ `quotation_items` ให้ผูกกับ products table (คนละเรื่อง อยู่นอกขอบเขต)

## Decisions

1. **สร้างตาราง `products` ใหม่ แทนที่จะขยาย `product_refs`**
   เหตุผล: `product_refs` เป็น JSON blob เก็บในแถวเดียวของ `content_global_settings` query/filter/join ไม่ได้ ไม่รองรับ status ต่อสินค้า และไม่มีที่เก็บคำอธิบาย/USP เลย
   ทางเลือกที่พิจารณา: ขยาย schema ของ JSON ใน `product_refs` ให้มี description/USP — ถูกตัดออกเพราะยังติดปัญหาเดิมเรื่อง query/relational integrity และเป็น global singleton ต่อ tenant ไม่ใช่ entity ที่มี id ของตัวเอง

2. **Bootstrap ข้อมูลจาก brand.md ด้วย script/migration แบบครั้งเดียว ไม่ parse สดทุกครั้ง**
   เหตุผล: เนื้อหา brand.md เป็น prose อิสระ parse สดทุกครั้งจะเปราะและช้า ทำครั้งเดียวตอน migration แปลงเป็นแถวจริงใน `products` แล้วจากนั้นจัดการผ่าน CRUD ต่อไป ไม่ต้องพึ่ง brand.md อีก

3. **เก็บ `plan_batch_id` + `plan_sequence` ตรงใน `email_campaigns` แทนตาราง `campaign_plans` แยก (ไม่ mirror `content_plans`)**
   เหตุผล: แคมเปญที่ AI วางแผนมาเป็นชุดยังคงเป็นแคมเปญอีเมลปกติทุกอย่าง (แก้ไข/ลบ/ส่ง/ดูสถิติแยกทีละฉบับได้) การมีตารางแม่แยกจะเพิ่ม status machine ที่สองให้ดูแลโดยไม่มีความสามารถใหม่เพิ่มเกินกว่าคอลัมน์ 2 ตัวนี้ให้ได้อยู่แล้ว
   ทางเลือกที่พิจารณา: ตาราง `campaign_plans` แบบ `content_plans` — ถูกเลื่อนไว้ก่อน จะกลับมาพิจารณาใหม่ถ้ามีคนต้องการหน้า "ภาพรวมทั้งแผน" แยกต่างหากในอนาคต

4. **ไม่มีช่อง Topic แยกใน panel generate เดี่ยว — ใช้ "หัวข้ออีเมล" เป็นทั้ง subject และ topic**
   เหตุผล: ลดฟิลด์ซ้ำซ้อน ตรงกับการตัดสินใจที่ยืนยันแล้วว่า ถ้ามีข้อความอยู่ก่อนให้ใช้เป็นอ้างอิง (Direct-mode "source of truth" แบบเดียวกับใน `content-plan-prompt.php`) ถ้าว่างให้ AI เติมให้เอง

5. **ผลลัพธ์ generate เดี่ยวเขียนตรงเข้า state ของฟอร์มแคมเปญ ไม่ผ่าน `content_items`**
   เหตุผล: `content_items` พ่วงเรื่อง research/SEO/publish-status ที่ไม่เกี่ยวกับเนื้อหาอีเมล การผ่าน `content-to-campaign.php` เพิ่มขั้นตอนที่ไม่จำเป็นสำหรับ flow ที่ generate ตรงในไดอะล็อกอยู่แล้ว

6. **Batch generation สร้างแถว `email_campaigns` จริงทันทีเป็น `status='draft'`** (ไม่ใช่ preview อย่างเดียว) เพื่อให้ขึ้นในรายการแคมเปญเดิมทันทีพร้อม badge ใช้หน้าจอแก้ไข/อนุมัติ/ตั้งเวลาเดิมได้เลย ไม่ต้องสร้างหน้ารีวิวแยก

7. **Safety gate**: ไม่มี code path ไหนใน batch endpoint ที่ set `status='scheduled'` ตรงๆ — ต้องผ่านการกดแก้ไข/ตั้งเวลาโดยผู้ใช้เหมือนแคมเปญที่สร้างด้วยมือทุกประการ

8. **(ปรับระหว่าง implement)** หน้าจัดการสินค้าเป็น component ใหม่แยกต่างหาก (`ProductCatalogForm.tsx`) ไม่ใช่การอัพเกรด `BrandProductRefsForm.tsx` เดิมตามที่ tasks.md ร่างไว้ในตอนแรก — เพราะ `BrandProductRefsForm` ผูกกับ `content_global_settings.product_refs` ที่ยังต้องคงไว้ใช้ generate รูปตาม Non-Goal ข้อ 3 การรวมสอง data source เข้า component เดียวกันจะทำให้ image-gen เดิมขาดข้อมูลแบบไม่ explicit (ผิดหลัก NO MAGIC ของโปรเจกต์) จึงแยกเป็นสอง section คนละตารางชัดเจนแทน

## Risks / Trade-offs

- **[Risk]** เนื้อหาใน brand.md เพี้ยนจาก products table หลัง bootstrap (มี 2 แหล่งข้อมูลสินค้าต่อไป) → **Mitigation**: หลัง migration ให้ `products` เป็นแหล่งอ้างอิงเดียวสำหรับ generate แคมเปญ ส่วน brand.md ยังใช้แค่ context โทน/บุคลิกแบรนด์ระดับกว้างต่อไป ไม่ต้องเป็น source of truth ของรายการสินค้าอีก
- **[Risk]** ชื่อสินค้าใน brand.md ไม่ตรงกับ `product_refs` ทำให้ bootstrap เหลือ 10/11 สินค้าไม่มีรูป → **Mitigation**: bootstrap เป็น best-effort จับคู่ชื่อตรงเป๊ะเท่านั้น ที่เหลือให้ผู้ใช้แนบรูปเพิ่มเองทีหลังผ่านหน้าจัดการสินค้า ไม่ block การใช้งาน
- **[Risk]** ผู้ใช้อาจ generate แคมเปญเป็นชุดจำนวนมากแล้วกด "อนุมัติทั้งหมด" โดยไม่อ่านทีละฉบับจริง ทำให้ safety gate ไม่มีความหมายในทางปฏิบัติ → **Mitigation**: อยู่นอกขอบเขตของโค้ด (เป็นเรื่อง process/การอบรมผู้ใช้) — บันทึกไว้เป็น Open Question ด้านล่าง
- **[Risk]** Prompt ใหม่ที่ inject ข้อมูลสินค้าเข้าไป ถ้าสินค้าที่ migrate มามีแค่ชื่อ (ไม่มีคำอธิบาย/USP) อาจได้เนื้อหาที่ AI เขียนออกมาบางเบา → **Mitigation**: ฟอร์มจัดการสินค้าสนับสนุนให้กรอกคำอธิบาย/USP เพิ่ม ฟิลด์ที่ว่างจะถูกข้ามไม่ใส่เข้า prompt แทนที่จะ error

## Migration Plan

1. สร้าง migration `products` table ตาม convention ของโปรเจกต์ (`database/migrations/YYYY_MM_DD_HHMMSS_*.sql`) รันทันทีกับ local MariaDB
2. เขียนและรัน one-time bootstrap script (parse brand.md → insert แถว, auto-link รูปจาก product_refs ตามชื่อ) — ตรวจสอบผลด้วยมือผ่านหน้าจัดการสินค้าใหม่หลังรันเสร็จ
3. เพิ่มคอลัมน์ `product_id`, `plan_batch_id`, `plan_sequence` ใน `email_campaigns` (nullable ทั้งหมด — แคมเปญเดิมไม่กระทบ)
4. Ship backend endpoints ก่อน แล้วค่อย ship frontend UI ไม่มี feature flag (ทีมใช้งานภายใน) — rollback คือ revert commit/migration ได้เลยเพราะคอลัมน์เป็น nullable ทิ้งไว้ได้แม้ revert UI แล้ว

## Open Questions

- ควรมีหน้า "ดูตามแผน" (group by batch) แยกต่างหากไหม หรือ badge บนการ์ดพอสำหรับตอนนี้? (ตัดสินใจไปทาง badge สำหรับการเปลี่ยนแปลงนี้ก่อน)
- ราคาสินค้าควรรองรับหลายระดับ/หลายสกุลเงินไหม หรือเป็นตัวเลขเดียวพอสำหรับตอนนี้? (สมมติ: decimal เดียว nullable พอสำหรับตอนนี้ ตรงกับความเรียบง่ายระดับ quotation ที่มีอยู่แล้ว)
