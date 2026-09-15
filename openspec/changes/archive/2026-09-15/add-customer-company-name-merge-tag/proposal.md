## Why

ตรวจสอบ merge tag ทั้งหมดที่ใช้ในเทมเพลตอีเมล 20 แบบ (`src/data/emailTemplates.ts`) พบว่า `processMergeTags()` มีบรรทัดที่ตั้งใจให้ `{{company_name}}` แสดงชื่อบริษัทของ**ลูกค้าผู้รับ**ได้ (`$company['name']`) แต่ค่านี้ถูกทับด้วยชื่อบริษัทผู้ส่งเสมอผ่าน `array_merge()` — ทำให้ไม่มีทางอ้างอิงชื่อบริษัทของผู้รับในเทมเพลตได้เลย ระหว่างตรวจสอบยังพบบั๊กจริงใน template-8 ที่ field "Company:" (รูปแบบหัวจดหมายธุรกิจ "To: [ชื่อ] / Company: [บริษัท]") ดันโชว์ชื่อบริษัทผู้ส่งซ้ำกับที่ลงชื่อท้ายเมลอยู่แล้ว ทั้งที่ควรเป็นชื่อบริษัทของผู้รับตามธรรมชาติของฟอร์แมตนี้

## What Changes

- `api/email-utils.php` — ลบ dead code (`$company['name']` ที่ไม่เคยถูกใช้จริงเพราะถูกทับ) ออกจากตำแหน่งเดิม เพิ่ม merge tag ใหม่ `{{customer_company_name}}` แยกต่างหาก แทนที่ด้วยชื่อบริษัทของลูกค้าผู้รับ
- `src/data/emailTemplates.ts` — แทรก `{{customer_company_name}}` เข้า 19 จาก 20 เทมเพลต ที่บรรทัดทักทายผู้รับ:
  - เทมเพลตภาษาไทย 4 แบบ (template-1, 2, 3, 19): เพิ่ม "จาก {{customer_company_name}}"
  - เทมเพลตภาษาอังกฤษ 14 แบบ: เพิ่ม "from {{customer_company_name}}"
  - template-8: **แก้บั๊ก** แทนที่ `Company: {{company_name}}` เป็น `Company: {{customer_company_name}}` (เดิมโชว์บริษัทผู้ส่งซ้ำผิดจุด)
  - template-16: ไม่แตะ (โครงสร้างประโยคไม่เหมาะกับการแทรก ตัดสินใจข้ามระหว่างสำรวจ)
- อัปเดตคอมเมนต์หัวไฟล์ `emailTemplates.ts` ให้รวม `{{customer_company_name}}` เข้า list ของ merge tag ที่รองรับ
- **ไม่รวม**: การแก้ 26 จุดอื่นที่ใช้ `{{company_name}}` (header/signature/footer) — ตรวจสอบแล้วว่าทุกจุดหมายถึงบริษัทผู้ส่งถูกต้องอยู่แล้ว

## Capabilities

### New Capabilities
- `email-campaign-customer-company-merge-tag`: merge tag `{{customer_company_name}}` ใช้งานได้จริงใน `processMergeTags()` แทนที่ด้วยชื่อบริษัทของลูกค้าผู้รับอีเมล แยกจาก `{{company_name}}` ที่หมายถึงบริษัทผู้ส่งเสมอ

### Modified Capabilities
(ไม่มี — ไม่มี spec เดิมครอบคลุมเรื่องนี้ ต่างจาก `email-campaign-subject-merge-tag` ที่เป็นคนละ tag)

## Impact

- `api/email-utils.php` — แก้ `processMergeTags()` เท่านั้น ไม่เปลี่ยน signature (ใช้ parameter `$company` ที่มีอยู่แล้ว)
- `src/data/emailTemplates.ts` — แก้เนื้อหา 19 เทมเพลตจาก 20 + คอมเมนต์หัวไฟล์
- ไม่กระทบ `api/email-campaigns.php` (ยังส่ง `$company` เหมือนเดิม ไม่ต้องแก้ call site)
- ไม่มี DB migration — ข้อมูล `customers.company_id` เป็น `NOT NULL` อยู่แล้ว (ยืนยันแล้วว่า active/inactive customers ทั้งหมด 1,191 คนมีชื่อบริษัทครบ 100% ไม่มี edge case ค่าว่าง)
