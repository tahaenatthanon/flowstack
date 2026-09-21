## Why

การสร้างแคมเปญอีเมลตอนนี้แยกขาดจากระบบ AI generate เนื้อหาโดยสิ้นเชิง — ต้องไปสร้างคอนเทนต์ที่หน้า Content ก่อน แล้วค่อยกลับมา "ดึงคอนเทนท์" เข้าแคมเปญทีหลัง ไม่มีทางบอก AI ว่ากำลังเขียนถึงสินค้าตัวไหน (ข้อมูลสินค้าที่มีอยู่กระจัดกระจาย: รูปอยู่ที่ `product_refs`, คำอธิบาย/USP อยู่ใน `brand.md` เป็น markdown ก้อนเดียวไม่มี ID แยกรายตัว) และไม่มีทางให้ AI วางแผน+ตั้งเวลาส่งแคมเปญหลายฉบับล่วงหน้าแบบอัตโนมัติเลย

## What Changes

- เพิ่มตาราง `products` ใหม่ พร้อม migration bootstrap ข้อมูลเริ่มต้นจาก `brand.md` (parse รายการสินค้า/บริการ 11 รายการ) และ link รูปจาก `product_refs` ที่ชื่อตรงกัน
- เพิ่มหน้าจัดการสินค้า (CRUD) ต่อยอดจาก `BrandProductRefsForm` เดิมที่หน้า Brand Setting
- เพิ่มปุ่ม "สร้างด้วย AI" ในไดอะล็อกสร้าง/แก้ไขแคมเปญอีเมล (`/campaigns`) — เลือกสินค้าได้หลายรายการ, เลือกโทนการเขียน, ใช้ "หัวข้ออีเมล" ที่มีอยู่เป็น topic อ้างอิงถ้าผู้ใช้กรอกไว้ก่อน หรือให้ AI คิดหัวข้อ/ชื่อแคมเปญให้เองถ้าว่าง
- เพิ่มความสามารถให้ AI วางแผนแคมเปญเป็นชุด (เช่น 3 ฉบับ ห่างกัน N วัน) รอบสินค้าที่เลือก — สร้างแคมเปญ draft หลายฉบับพร้อมวันที่ที่เสนอไว้ ผู้ใช้ต้องอนุมัติ/ตั้งเวลาส่งเองทีละฉบับก่อน (ไม่ auto-send ทันทีที่ AI สร้างเสร็จ)
- แสดง badge บนการ์ดแคมเปญที่บอกว่าเป็นส่วนหนึ่งของชุดแผนเดียวกัน

## Capabilities

### New Capabilities
- `product-catalog`: ตาราง/CRUD/UI จัดการข้อมูลสินค้า (ชื่อ, คำอธิบาย, จุดขาย, ราคา, รูป) รวมถึง bootstrap จาก brand.md
- `campaign-ai-content-generation`: ปุ่ม "สร้างด้วย AI" ในไดอะล็อกแคมเปญ — เลือกสินค้า + generate หัวข้อ/ชื่อแคมเปญ/เนื้อหาอีเมล
- `campaign-ai-batch-planning`: AI วางแผน+สร้างแคมเปญ draft หลายฉบับพร้อมวันที่เสนอ รอการอนุมัติของผู้ใช้ก่อนเข้าสู่คิวส่งจริง

### Modified Capabilities
(ไม่มี — ของเดิมอย่าง `email-campaign-scheduled-send` ทำงานกับ `status='scheduled'` อยู่แล้วไม่ว่าแคมเปญจะถูกสร้างด้วยมือหรือ AI จึงไม่ต้องเปลี่ยน requirement เดิม)

## Impact

- **Database**: ตารางใหม่ `products`; เพิ่มคอลัมน์ `product_id`, `plan_batch_id`, `plan_sequence` ใน `email_campaigns`
- **Backend**: endpoint ใหม่ `api/products.php` (CRUD); action ใหม่สำหรับ generate เนื้อหาแคมเปญเดี่ยว และ action ใหม่สำหรับวางแผนแคมเปญชุด (อยู่ใน `api/email-campaigns.php` หรือ `api/brand-content.php`); prompt builder ใหม่ที่ inject ข้อมูลสินค้าเข้า text generation (ของเดิมไม่เคยทำ)
- **Frontend**: อัพเกรด `BrandProductRefsForm.tsx`; แก้ไข `CampaignsPage.tsx` (ปุ่ม/panel ใหม่ 2 จุด + badge); component ใหม่สำหรับ product picker และ AI plan dialog; hook ใหม่ `useProducts`
- **ไม่กระทบ**: route/menu ใหม่ (ไม่มี), cron ส่งแคมเปญตามเวลาเดิม, `product_refs` เดิม (ยังใช้ generate รูปเหมือนเดิม)
