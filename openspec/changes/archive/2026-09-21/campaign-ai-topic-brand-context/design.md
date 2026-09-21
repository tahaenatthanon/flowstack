## Context

การ generate แคมเปญด้วย AI ทั้ง 2 จุด (`generateCampaignContent()` สำหรับสร้างเดี่ยว และ `aiPlanCampaigns()` สำหรับ batch ใน `api/email-campaigns.php`) ปัจจุบันรับ input จำกัดแค่ `product_ids`/`product_id` (จาก `ProductPicker`) และ `source_topic` (จากช่อง "หัวข้ออีเมล" ที่พิมพ์ไว้ก่อน generate — เฉพาะจุดสร้างเดี่ยว, batch ไม่มีช่องนี้เลย) ทำให้:
- Batch dialog บังคับเลือกสินค้าเสมอ (`เลือกสินค้า *`, ปุ่ม disabled ถ้าไม่เลือก, backend เช็คซ้ำด้วย `if ($productId === '') jsonError('กรุณาเลือกสินค้า', 400)`)
- ไม่มีทางสร้างแคมเปญที่ไม่ผูกสินค้าได้เลยในทั้งสองจุด ถ้าไม่มีข้อมูลอื่นมาช่วย
- ไม่มีการดึง "บริบทแบรนด์" เข้า prompt เลย ทั้งที่ระบบมี `brand_contexts` table (ใช้แล้วในโมดูล Content ผ่าน `api/brand-content.php`) ซึ่ง tenant นี้มีข้อมูลจริงอยู่แล้ว (`brand.md`, `sop.md`)

โมดูล Content (`api/brand-content.php`) มี pattern ที่แก้ปัญหาคล้ายกันอยู่แล้วและใช้เป็นต้นแบบได้ตรงๆ:
```php
foreach ($stmt->fetchAll() as $ctx) {
    $contextTexts[] = "=== {$ctx['name']} ({$ctx['file_type']}) ===\n{$ctx['content']}";
}
...
if (!empty($contextTexts)) $sysParts[] = "## Brand Context\n" . implode("\n\n", $contextTexts);
```
ใช้ `content` (markdown ดิบ) ตรงๆ ไม่ใช่ `parsed_data` (regex-parsed แบบ best-effort ที่อาจไม่ครบทุก field)

## Goals / Non-Goals

**Goals:**
- ให้สร้าง/วางแผนแคมเปญได้โดยไม่ต้องผูกกับสินค้าใดสินค้าหนึ่ง ถ้ามีไอเดียที่พิมพ์เอง หรือเปิดใช้ brand context
- Batch dialog มีช่องพิมพ์ไอเดีย/ธีมของทั้งชุด เทียบเท่าสิ่งที่สร้างเดี่ยวมีอยู่แล้ว (หัวข้ออีเมล)
- เมื่อมีทั้งไอเดียและสินค้า ให้ไอเดียกำหนดทิศทางหลัก สินค้าเป็นข้อมูลเสริม (ไม่ทะเลาะกันใน prompt)
- เพิ่มทางเลือกดึง brand context (`brand_md` เท่านั้น) เป็นบริบทพื้นฐาน ผ่าน checkbox เปิด/ปิดเอง ไม่บังคับ
- เงื่อนไขขั้นต่ำ: มีอย่างน้อยหนึ่งใน {สินค้า, ไอเดียที่พิมพ์, brand context เปิดใช้}

**Non-Goals:**
- ไม่เปลี่ยนกลไกเลือกสินค้าที่มีอยู่แล้ว (ยังเป็น optional เพิ่มเติมเหมือนเดิม เพิ่มแค่เงื่อนไขขั้นต่ำใหม่)
- ไม่เพิ่มการเลือก brand context เป็นรายไฟล์ (ไม่มี `brand_context_ids` แบบ Content module) — ใช้ทุกแถวที่ `file_type='brand_md'` ของ tenant นั้นเสมอเมื่อเปิด checkbox (ปกติมีแค่ 1 แถวต่อ tenant)
- ไม่แตะ `sop_md`/`custom` — ตามที่ตัดสินใจไว้ว่าเป็นกฎภายในไม่เหมาะให้ AI เอาไปเขียนอีเมลลูกค้า
- ไม่เปลี่ยน validation/flow ของ batch Phase 1 (topic planning) และ Phase 2 (เขียนเนื้อหาเต็ม) นอกเหนือจากการส่ง idea/brand context เข้าไปเป็น context เพิ่ม

## Decisions

### 1. Idea/topic ส่งเป็น parameter ใหม่แยกจาก product เสมอ ไม่ผสมเข้า user message เดิมแบบเดา
Single-generate ใช้ `source_topic` (parameter เดิม, มาจาก "หัวข้ออีเมล") อยู่แล้ว — ไม่ต้องเพิ่ม parameter ใหม่ แค่แก้ label/placeholder ฝั่ง frontend ให้สื่อว่าพิมพ์เป็นไอเดียหลวมๆ ได้ (ไม่ต้องเป็นประโยคหัวข้อสมบูรณ์) ไม่กระทบ backend เลย

Batch เพิ่ม parameter ใหม่ `topic_idea` (string, optional) ส่งเข้า `aiPlanCampaigns()` — ใช้เป็น "โจทย์รวม" ของทั้งชุด ส่งต่อเข้า **Phase 1** (`campaign_ai_batch_plan_prompt()`) เป็น section ใหม่ เพื่อให้ AI วางแผนหัวข้อย่อยของแต่ละฉบับให้สอดคล้องกับธีมหลัก แทนที่จะคิดเองอิสระจากสินค้าอย่างเดียว

ทางเลือกอื่นที่พิจารณา: ผูก `topic_idea` เข้ากับ Phase 2 (เขียนเนื้อหาเต็มต่อฉบับ) แทน — ปัดตกเพราะ Phase 1 เป็นคนกำหนดหัวข้อย่อยของแต่ละฉบับอยู่แล้ว (ตาม requirement "Batch Topics Are Planned Holistically") ถ้าธีมหลักไม่ถึง Phase 1 ตั้งแต่ต้น หัวข้อย่อยจะไม่สอดคล้องกับธีมที่ผู้ใช้ตั้งใจ

### 2. ลำดับความสำคัญ idea vs product: ใส่ทั้งคู่ใน prompt แต่กำกับด้วยข้อความชัดเจนว่าอันไหนคือทิศทางหลัก
ไม่ implement เป็น code logic ที่ตัดข้อมูลสินค้าออกเมื่อมี idea (เพราะยัง "เป็นข้อมูลเสริม" ตามที่ตัดสินใจไว้ ไม่ใช่ override ทิ้งไปเลย) แทนที่จะทำแบบนั้น ใช้ prompt instruction กำกับความสำคัญแทน — เพิ่มข้อความในทั้ง 2 prompt (system prompt generate เดี่ยว + Phase 1 ของ batch):
```
## โจทย์หลัก (Idea)
{idea}
ให้ยึดโจทย์นี้เป็นทิศทางหลักของเนื้อหา — ข้อมูลสินค้า (ถ้ามี) ใช้เป็นรายละเอียดประกอบเท่านั้น ไม่ใช่หัวข้อหลัก
```
วางไว้ "หลัง" section สินค้า (`campaign_ai_products_section()`) เสมอ เพื่อให้เป็น instruction ล่าสุดที่ AI เห็น (position ท้ายๆ มักมีน้ำหนักสูงกว่าใน context ยาว)

### 3. Brand context: fetch แบบเดียวกับ `brand-content.php` เป๊ะ ไม่ parse เพิ่ม
Query `SELECT name, content FROM brand_contexts WHERE tenant_id=? AND file_type='brand_md'` แล้ว format เป็น section เดียวกับที่ Content module ทำ:
```
## Brand Context
=== {name} (brand_md) ===
{content}
```
ใช้ `content` (markdown ดิบ) ไม่ใช้ `parsed_data` — เหตุผลเดียวกับที่ `brand-content.php` เลือกทำแบบนี้อยู่แล้ว (parsed_data เป็น regex best-effort อาจไม่ครบ) การใช้ pattern เดียวกันทำให้พฤติกรรม AI สอดคล้องกันทั้งสองโมดูล และไม่ต้องเขียน parser ใหม่

Frontend ส่ง `use_brand_context: boolean` (checkbox state) ไปกับ request — backend query เฉพาะเมื่อ `true` เท่านั้น (ไม่ query ทิ้งเปล่าๆ ทุกครั้งที่ generate เพื่อประหยัด query ที่ไม่จำเป็น)

### 4. เงื่อนไขขั้นต่ำ validate ทั้ง frontend และ backend (สองชั้นเหมือน pattern เดิมของโมดูลนี้)
Frontend: ปุ่ม "สร้าง"/"สร้างแผน" disable ก็ต่อเมื่อ **ไม่มีทั้งสาม** อย่าง (ไม่มีสินค้า, ไม่มีไอเดีย, ไม่ติ๊ก brand context) — สอดคล้องกับ pattern ที่ `content_plan_has_any_topic_source()` ใช้ตรวจสอบใน Content module (union ของหลายแหล่ง)

Backend: แก้ validation เดิมของ `aiPlanCampaigns()` จาก `if ($productId === '') jsonError('กรุณาเลือกสินค้า', 400)` เป็นเช็ครวม 3 แหล่ง เหมือนกัน — กันกรณี frontend ถูก bypass (เช่น เรียก API ตรง)

## Risks / Trade-offs

- **[Risk]** Batch ที่ใช้ idea แทนสินค้า จะไม่มี `product_id` ให้ผูกกับแคมเปญที่สร้าง (คอลัมน์ `product_id` ใน `email_campaigns` ปัจจุบันคาดว่ามีค่าเสมอ) → **Mitigation**: อนุญาตให้ `product_id` เป็น `NULL` เมื่อไม่ได้เลือกสินค้า (คอลัมน์นี้รองรับ NULL อยู่แล้วตาม schema เดิม เพราะเดิมทีก็เป็น nullable FK) ไม่กระทบ query อื่นที่อ่าน `product_id` เพราะต้องรองรับ NULL อยู่แล้วในกรณีทั่วไป
- **[Risk]** เปิด brand context พร้อมกับพิมพ์ idea/เลือกสินค้า อาจทำให้ prompt ยาวเกินจำเป็นถ้า `brand.md` มีเนื้อหายาวมาก → **Mitigation**: ยอมรับเป็น known limitation ในรอบนี้ (Content module ก็ไม่ได้ truncate เช่นกัน) ไม่ตัดเนื้อหาเพื่อไม่ให้สูญเสียบริบทที่ผู้ใช้ตั้งใจอัปโหลดไว้
- **[Risk]** Tenant ที่ยังไม่เคยอัปโหลด `brand.md` แล้วติ๊ก "ใช้ข้อมูลแบรนด์" จะได้ section ว่างเปล่า (ไม่มี error แต่ก็ไม่มีประโยชน์) → **Mitigation**: ถ้า query ไม่พบแถวเลย ให้ toast แจ้งผู้ใช้ตอน generate ("ยังไม่มีข้อมูลแบรนด์ในระบบ ข้ามการใช้บริบทนี้") แทนที่จะ fail เงียบๆ หรือ block การ generate
- **[Trade-off]** เพิ่มเงื่อนไข validate ที่ซับซ้อนขึ้น (3 แหล่งรวมกัน) แลกกับความยืดหยุ่นที่ผู้ใช้ต้องการจริง — ยอมรับได้เพราะ logic ไม่ซับซ้อนมาก (OR ของ 3 boolean)

## Migration Plan

1. แก้ frontend: เพิ่มช่อง idea + checkbox brand context ใน `AICampaignPlanDialog.tsx`, เพิ่ม checkbox brand context + แก้ label ใน `CampaignsPage.tsx`
2. แก้ validation ปุ่ม generate ทั้งสองจุดตามเงื่อนไขขั้นต่ำใหม่
3. แก้ `campaign-ai-prompt.php`: เพิ่มฟังก์ชัน brand context section, เพิ่ม idea-priority instruction, เพิ่ม parameter `idea`/`topic_idea` ใน prompt builder ที่เกี่ยวข้อง
4. แก้ `email-campaigns.php`: `generateCampaignContent()` และ `aiPlanCampaigns()` รับ `use_brand_context`, query `brand_contexts`, ปรับ validation ขั้นต่ำ, อนุญาต `product_id`/`product_ids` ว่างได้จริงเมื่อมี idea/brand context ทดแทน
5. ทดสอบ manual: generate แบบไม่มีสินค้า (idea อย่างเดียว), แบบ brand context อย่างเดียว, แบบผสมทั้งสาม, และยืนยันว่า batch ที่ไม่มี product_id ยังบันทึก/แสดงผลในรายการแคมเปญได้ปกติ

## Open Questions

(ไม่มี — decision หลักทั้งหมดถูกยืนยันโดยผู้ใช้แล้วระหว่างขั้นตอน explore)
