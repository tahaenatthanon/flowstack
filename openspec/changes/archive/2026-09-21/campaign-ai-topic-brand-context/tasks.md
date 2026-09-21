## 1. Backend: Brand Context Fetch & Prompt Section

- [x] 1.1 เพิ่มฟังก์ชัน `campaign_ai_brand_context_section(PDO $db, string $tenantId)` ใน `api/lib/campaign-ai-prompt.php` — query `brand_contexts WHERE tenant_id=? AND file_type='brand_md'` คืน section string รูปแบบเดียวกับ `brand-content.php` (`=== {name} (brand_md) ===\n{content}`) หรือ `''` ถ้าไม่พบแถว
- [x] 1.2 เพิ่ม parameter `use_brand_context`/`brand_context_section` เข้า `campaign_ai_system_prompt()` — เพิ่ม section `## Brand Context` เมื่อมีเนื้อหา
- [x] 1.3 เพิ่ม parameter `idea` เข้า `campaign_ai_system_prompt()` — เพิ่ม section "## โจทย์หลัก (Idea)" ต่อท้าย section สินค้า พร้อม instruction ว่าไอเดียคือทิศทางหลัก สินค้าเป็นข้อมูลเสริม
- [x] 1.4 เพิ่ม parameter `topic_idea` เข้า `campaign_ai_batch_plan_prompt()` (Phase 1) — ให้ AI วางแผนหัวข้อย่อยของแต่ละฉบับให้สอดคล้องกับธีมหลักที่ผู้ใช้พิมพ์

## 2. Backend: Validation & Wiring

- [x] 2.1 แก้ `generateCampaignContent()` ใน `api/email-campaigns.php` — รับ `use_brand_context` จาก request body, เรียก `campaign_ai_brand_context_section()` เมื่อเปิดใช้, ส่งเข้า `campaign_ai_system_prompt()`
- [x] 2.2 แก้ validation ของ `generateCampaignContent()` — ตรวจสอบว่ามีอย่างน้อยหนึ่งใน {product_ids ไม่ว่าง, source_topic ไม่ว่าง, use_brand_context=true พร้อม brand_md ที่พบจริง} ไม่งั้น `jsonError`
- [x] 2.3 แก้ `aiPlanCampaigns()` — รับ `topic_idea` (string, optional) และ `use_brand_context` (boolean) จาก request body
- [x] 2.4 แก้ validation เดิมของ `aiPlanCampaigns()` — เปลี่ยนจาก `if ($productId === '') jsonError('กรุณาเลือกสินค้า', 400)` เป็นเช็ครวม 3 แหล่ง (product/topic_idea/use_brand_context) ตาม design.md decision #4
- [x] 2.5 แก้ `aiPlanCampaigns()` — อนุญาต `$productId` ว่างได้ (ข้าม `_loadCampaignProducts` เมื่อไม่มี), แก้ INSERT ให้ `product_id` เป็น `NULL` ได้เมื่อไม่ได้เลือกสินค้า
- [x] 2.6 ส่ง `topic_idea` เข้า Phase 1 (`campaign_ai_batch_plan_prompt`) และส่ง `idea` (เดียวกัน) เข้า Phase 2 (`campaign_ai_system_prompt` ต่อฉบับ) เพื่อให้เนื้อหาเต็มยังคงยึดธีมหลักด้วย ไม่ใช่แค่ตอนวางแผนหัวข้อ
- [x] 2.7 เพิ่ม field `brand_context_found` (boolean) ในผลลัพธ์ที่ตอบกลับทั้งสอง endpoint เมื่อ `use_brand_context=true` แต่ไม่พบแถว `brand_md` เลย — ให้ frontend toast แจ้งผู้ใช้แทนที่จะ fail เงียบๆ

## 3. Frontend: สร้างแคมเปญเดี่ยว

- [x] 3.1 แก้ hint text ในบริบท panel "สร้างด้วย AI" ให้สื่อว่าช่อง "หัวข้ออีเมล" พิมพ์เป็นไอเดียหลวมๆ ได้ ไม่ต้องเป็นหัวข้อสมบูรณ์ (ไม่แก้ label/required marker ของ field หลัก เพราะใช้ร่วมกับ flow ที่ไม่ใช่ AI ด้วย)
- [x] 3.2 เพิ่ม checkbox "ใช้ข้อมูลแบรนด์" ใน panel "สร้างด้วย AI" (state ใหม่ `aiUseBrandContext`)
- [x] 3.3 แก้ `handleGenerateWithAI()` ให้ส่ง `use_brand_context: aiUseBrandContext` ไปกับ request
- [x] 3.4 แก้ validation ปุ่ม "สร้าง" — disable เฉพาะเมื่อไม่มีทั้งสาม (ไม่มีสินค้า, `campaignSubject` ว่าง, ไม่ติ๊ก brand context)
- [x] 3.5 toast แจ้งผู้ใช้เมื่อ response มี `brand_context_found === false`

## 4. Frontend: AI วางแผนแคมเปญ (Batch)

- [x] 4.1 เพิ่ม state `topicIdea` (string) และช่อง input "แนวคิด/ธีมของชุดแคมเปญ" ใน `AICampaignPlanDialog.tsx`
- [x] 4.2 เพิ่ม checkbox "ใช้ข้อมูลแบรนด์" (state `useBrandContext`) ใน `AICampaignPlanDialog.tsx`
- [x] 4.3 แก้ label "เลือกสินค้า *" — เอา `*` (required marker) ออก เปลี่ยนเป็นแค่ "เลือกสินค้า (ไม่บังคับ)"
- [x] 4.4 แก้ `handleGenerate()` ให้ส่ง `topic_idea`/`use_brand_context` (ส่ง `product_id: productIds[0]` เดิมไว้ — เป็น `undefined` เองอยู่แล้วเมื่อ array ว่าง เพราะ `productIds[0]` บน array ว่างคือ `undefined`)
- [x] 4.5 แก้ validation ปุ่ม "สร้างแผน" — จาก `disabled={productIds.length === 0}` เป็น disable เฉพาะเมื่อไม่มีทั้งสาม (ไม่มีสินค้า, `topicIdea` ว่าง, ไม่ติ๊ก brand context)
- [x] 4.6 toast แจ้งผู้ใช้เมื่อ response มี `brand_context_found === false`

## 5. Verification

- [x] 5.1 รัน `pnpm lint`, `pnpm build`, `php -l` ทั้งไฟล์ PHP ที่แก้ (ผ่านหมด — lint 0 errors/47 pre-existing warnings, build สำเร็จ, php -l ทั้งสองไฟล์ไม่มี syntax error)
- [x] 5.2 ทดสอบผ่าน dev server: สร้างแคมเปญเดี่ยวด้วย idea อย่างเดียว (ไม่เลือกสินค้า, ไม่ติ๊ก brand context) — generate สำเร็จ เนื้อหาเป็นคำทักทายสงกรานต์/ปีใหม่ไทยตรงตามไอเดียที่พิมพ์ ไม่มีสินค้าปนเลย
- [x] 5.3 ทดสอบ: ติ๊ก brand context อย่างเดียว (ไม่มีสินค้า ไม่มีไอเดีย) — generate สำเร็จ เนื้อหากล่าวถึง "KTN Business Solutions" ตรงจาก `brand.md` จริง
- [x] 5.4 ทดสอบ: ไม่มีทั้งสามอย่างเลย — ปุ่ม "สร้าง" (เดี่ยว) disabled ยืนยันแล้ว (คลิกแล้วไม่มีอะไรเกิดขึ้น เนื้อหา editor ไม่เปลี่ยน) — batch dialog validation ตรวจสอบทาง code review เพราะ browser ระวังไม่ให้คลิกพลาดอีกหลังเหตุการณ์ส่งอีเมลไม่ตั้งใจ
- [x] 5.5 ทดสอบ: มีทั้ง idea (เชิญงานเปิดสาขาเชียงใหม่) และสินค้า (AI Portal Duckkit) พร้อมกัน — เนื้อหายึด idea เป็นหลัก (เปิดเรื่องด้วยคำเชิญงาน) สินค้าถูกวางเป็นไฮไลต์เสริมในงาน ตรงตาม priority ที่ออกแบบไว้
- [x] 5.6 ทดสอบ batch ด้วย idea อย่างเดียว (ไม่มีสินค้า) — ผ่าน confirm dialog แล้วสร้างสำเร็จ 2 ฉบับ ("ต้อนรับ..."/"ติดตามผล...") ตรงตามธีม, แสดงผลในรายการแคมเปญปกติ (`product_id NULL` ไม่พัง), สถานะยังเป็นฉบับร่าง (ส่งสำเร็จทั้งหมดไม่เปลี่ยน) — ลบ test data ทั้ง 2 ฉบับออกหลังตรวจสอบแล้ว
