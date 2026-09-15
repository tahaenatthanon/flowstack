## Context

เจอเรื่องนี้ระหว่าง `/opsx:explore` ตรวจสอบว่า merge tag ทุกตัวในเทมเพลตอีเมล 20 แบบถูกแทนค่าครบถ้วนหรือไม่ พบว่า `processMergeTags()` (`api/email-utils.php`) มี dead code ที่ตั้งใจให้ `{{company_name}}` มาจากชื่อบริษัทลูกค้า (`$company['name']`, ส่งมาจาก `email-campaigns.php:663` — `$company = ['name' => $recipient['company_name'] ?? '']`) แต่ค่านี้ถูกทับด้วย `$companySettings['company_name']` (บริษัทผู้ส่ง) เสมอผ่าน `array_merge($replacements, $companyReplacements)` ที่ให้ array หลังชนะเมื่อ key ซ้ำกัน

ไล่ตรวจทั้ง 27 จุดที่ใช้ `{{company_name}}` ใน 20 เทมเพลตแล้วพบว่า 26 จุดต้องการบริษัทผู้ส่งจริง (ถูกต้องอยู่แล้ว) มีเพียง 1 จุด (template-8 บรรทัด 432 `Company: {{company_name}}` ในฟอร์แมต "To:/Company:" แบบหัวจดหมายธุรกิจ) ที่ควรเป็นบริษัทผู้รับแต่กลับซ้ำกับบริษัทผู้ส่งที่ลงชื่อท้ายเมลอยู่แล้ว — เป็นบั๊กที่ไม่เคยมีทางแก้ได้เพราะไม่มี tag แยกให้ใช้

ตรวจข้อมูลจริงแล้ว: `customers.company_id` เป็น `NOT NULL` ในระดับ schema และลูกค้าทั้งหมด 1,191 คน (active 1,190 + inactive 1) มีชื่อบริษัทครบ 100% ไม่มีเคสค่าว่าง

## Goals / Non-Goals

**Goals:**
- เพิ่ม merge tag ใหม่ `{{customer_company_name}}` ที่แทนที่ด้วยชื่อบริษัทของลูกค้าผู้รับอีเมลจริง
- แก้บั๊ก template-8 ให้ field "Company:" แสดงบริษัทผู้รับแทนที่จะซ้ำกับบริษัทผู้ส่ง
- ลบ dead code เดิมที่ทำให้เข้าใจผิดว่า `{{company_name}}` รองรับบริษัทลูกค้าได้

**Non-Goals:**
- ไม่แก้ 26 จุดอื่นที่ใช้ `{{company_name}}` ถูกต้องอยู่แล้ว (header, signature, footer copyright)
- ไม่แตะ template-16 (โครงสร้างประโยคไม่เหมาะกับการแทรกชื่อบริษัท — เนื้อหาฝังกลางประโยคเล่าเรื่องแบบ marketing casual ไม่ใช่ greeting header)
- ไม่แก้ signature ของ `processMergeTags()` หรือ call site ใน `email-campaigns.php` — parameter `$company` มีอยู่แล้ว แค่ยังไม่ถูกใช้จริง
- ไม่สร้าง fallback/conditional logic สำหรับกรณีลูกค้าไม่มีชื่อบริษัท เพราะ schema รับประกันว่าไม่มีเคสนี้เกิดขึ้นได้จริง (ยืนยันด้วยข้อมูลจริง 100%)

## Decisions

**Decision 1 — ลบ dead assignment แล้วเพิ่ม key ใหม่แยกต่างหาก แทนที่จะแก้ไขค่าเดิม**
```php
// เดิม (api/email-utils.php)
$replacements = [
    ...
    '{{company_name}}' => $company['name'] ?? ($companySettings['company_name'] ?? ''),  // dead code
    '{{subject}}' => $subject,
];
$companyReplacements = [
    '{{company_name}}' => $companySettings['company_name'] ?? '',  // ตัวนี้ชนะเสมอ
    ...
];

// ใหม่
$replacements = [
    ...
    '{{customer_company_name}}' => $company['name'] ?? '',   // key ใหม่ ไม่ชนกับใคร
    '{{subject}}' => $subject,
];
$companyReplacements = [
    '{{company_name}}' => $companySettings['company_name'] ?? '',  // ไม่เปลี่ยน ยังหมายถึงผู้ส่งเสมอ
    ...
];
```
ทางเลือกที่พิจารณา: เปลี่ยนความหมายของ `{{company_name}}` ให้เป็นบริษัทลูกค้าแทน — ตัดออกทันที เพราะจะกลายเป็น breaking change กระทบ 26 จุดที่ใช้ถูกต้องอยู่แล้วทั่วทั้ง 20 เทมเพลต

**Decision 2 — แทรกที่ตำแหน่งทักทายผู้รับ แยกคำเชื่อมตามภาษาของแต่ละเทมเพลต**
```
เทมเพลตไทย (1, 2, 3, 19):      "จาก {{customer_company_name}}"   ต่อท้ายชื่อผู้รับ
เทมเพลตอังกฤษ (14 แบบที่เหลือ): "from {{customer_company_name}}"  ต่อท้ายชื่อผู้รับ
```
ทางเลือกที่พิจารณา: เติมคำว่า "บริษัท" นำหน้าใน pattern ไทย ("จากบริษัท {{customer_company_name}}") — ตัดออก เพราะชื่อบริษัทไทยในระบบมักมีคำว่า "บริษัท...จำกัด" อยู่ในชื่อเต็มอยู่แล้ว (เช่น "บริษัท เค ที เอ็น บิสซิเนส โซลูชั่นส์ จำกัด") การเติมนำหน้าอีกจะซ้ำคำ

**Decision 3 — template-8: แทนที่ (ไม่ใช่เพิ่ม) เพราะเป็นการแก้บั๊ก**
```
เดิม: <strong>Company:</strong> {{company_name}}
ใหม่: <strong>Company:</strong> {{customer_company_name}}
```
ส่วน `{{company_name}}` ในบรรทัด "Sincerely,<br>{{company_name}}<br>{{company_phone}}" (บรรทัด 442) ไม่แตะ เพราะเป็นการลงชื่อผู้ส่งที่ถูกต้องอยู่แล้ว

**Decision 4 — ข้าม template-16 แทนที่จะฝืนแทรก**
ทางเลือกที่พิจารณา: เขียนประโยคใหม่ "{{first_name}} at {{customer_company_name}}, we thought of you first!" — ตัดออกระหว่าง explore เพราะอ่านแล้วสะดุด (ซ้ำการอ้างถึงบุคคลเดียวกัน 2 ครั้งในประโยคเดียว) เทมเพลตนี้มีโครงสร้างต่างจาก 19 แบบอื่นจริง (ฝังชื่อกลางประโยคเล่าเรื่อง ไม่ใช่ greeting header) — 19/20 เทมเพลตมี capability นี้ก็เพียงพอแล้ว ไม่จำเป็นต้องครบ 20/20

## Risks / Trade-offs

- **[Risk] เทมเพลตที่ผู้ใช้เคย custom แก้ไขเองไปแล้ว (ไม่ใช่ต้นฉบับ 20 แบบ) จะไม่มี `{{customer_company_name}}` ให้ใช้** → **Mitigation:** ยอมรับ — change นี้แก้แค่ template ต้นฉบับใน `emailTemplates.ts` ผู้ใช้ที่ต้องการใช้ tag ใหม่ในเทมเพลตที่ตัวเองแก้ไขเองสามารถพิมพ์ `{{customer_company_name}}` เพิ่มเองได้ทันที เพราะ backend รองรับแล้ว
- **[Risk] แคมเปญที่ถูกสร้าง/ส่งไปแล้วก่อนหน้านี้จะไม่มีผลย้อนหลัง** → **Mitigation:** ยอมรับ เป็นธรรมชาติของการเปลี่ยน template ต้นฉบับ ไม่กระทบแคมเปญที่ copy เนื้อหาไปแล้วก่อนหน้า

## Migration Plan

1. แก้ `api/email-utils.php` (ลบ dead code + เพิ่ม key ใหม่)
2. แก้ `src/data/emailTemplates.ts` (19 เทมเพลต + คอมเมนต์หัวไฟล์)
3. ไม่มี DB migration, ไม่มี breaking change
4. Rollback: revert commit ที่เกี่ยวข้อง ไม่มีข้อมูลถูกทำลาย

## Open Questions

- ไม่มีคำถามค้างอยู่ — ตัดสินใจครบทุกจุดระหว่าง explore mode (ชื่อ tag, คำเชื่อมภาษาไทย, กรณีพิเศษ template-8 และ template-16)
