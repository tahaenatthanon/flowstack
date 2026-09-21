## 1. Template Style Metadata

- [x] 1.1 สำรวจ `defaultContent` ของทุก template ใน `src/data/emailTemplates.ts` เพื่อระบุค่า `heading_color`, `body_color`, `text_align` ที่ตรงกับธรรมเนียมเดิมของแต่ละ template
- [x] 1.2 เพิ่ม field `heading_color`, `body_color`, `text_align` เข้า `EmailTemplate` interface และกำหนดค่าให้ทุก template ใน `emailTemplates.ts`

## 2. Compose Function สำหรับเนื้อหาแบบโครงสร้าง (PHP — แก้จากแผนเดิมที่จะทำที่ TS)

> ระหว่าง implement พบว่า batch generate (`aiPlanCampaigns()`) รันเป็น PHP loop ล้วน insert ตรงลง DB โดยไม่มี frontend คั่นกลางให้เรียกฟังก์ชัน TS ได้ จึงย้าย compose logic ทั้งหมดไปที่ PHP แทน (ดู design.md decision #2 ที่อัปเดตแล้ว)

- [x] 2.1 เพิ่มฟังก์ชัน `campaign_ai_render_structured_content()` ใน `api/lib/campaign-ai-prompt.php` ที่รับ `{heading, blocks[]}` + style metadata ของ template แล้วคืนค่า HTML string สำหรับแทนที่ `{{EMAIL_CONTENT}}`
- [x] 2.2 รองรับ block type `paragraph` — render ด้วย `body_color`/`text_align` ของ template
- [x] 2.3 รองรับ block type `list` — render เป็น `<ul>`/`<li>` ด้วย `body_color` ของ template
- [x] 2.4 render `heading` ด้วย `heading_color`/`text_align` ของ template
- [x] 2.5 เพิ่มฟังก์ชัน `campaign_ai_compose_body_html()` (mirror ของ `composeCampaignHtml()` เดิมใน TS) ใช้ประกอบ HTML เต็มก้อนเฉพาะ batch path ที่ insert ตรงลง DB — เก็บเนื้อหาดิบเป็น `editable_content` ตามกลไกเดิม

## 3. ArticleEditor: คงสไตล์ List

- [x] 3.1 ขยาย `types` array ของ `PreserveInlineStyle` extension ใน `src/components/content/ArticleEditor.tsx` ให้ครอบคลุม `'bulletList'`, `'listItem'`
- [x] 3.2 ทดสอบด้วยมือผ่าน dev server: generate แคมเปญด้วย AI (template-5 ซึ่งมี list block) แล้วแก้ข้อความในเนื้อหา สลับไปดู HTML Source — ยืนยันว่า `<ul style="color:rgb(75,85,99);...">` และ `<li style="color:rgb(75,85,99);margin:0px 0px 8px;">` ยังอยู่ครบหลัง re-serialize (ก่อนแก้จะถูกตัดทิ้ง)

## 4. AI Prompt Schema

- [x] 4.1 แก้ system prompt ใน `api/lib/campaign-ai-prompt.php` — ตัด `body_html` ออกจาก JSON schema, เพิ่ม `heading`, `blocks` (paragraph/list), `cta_text` (ไม่บังคับ)
- [x] 4.2 ตัดข้อความ instruction เดิม "มี CTA ชัดเจน" ออก
- [x] 4.3 เพิ่ม instruction บังคับให้ AI เขียน `heading` ขึ้นต้นด้วยคำทักทายที่มี merge tag `{{first_name}}`
- [x] 4.4 อัปเดต prompt ให้ใช้ schema เดียวกันในจุดที่ใช้สำหรับ batch-generate (Phase 2) ด้วย (ใช้ `campaign_ai_system_prompt()` ฟังก์ชันเดียวกันทั้งสองจุดอยู่แล้ว)

## 5. Backend Parsing & Composition

- [x] 5.1 แก้ `campaign_ai_extract_json()` (default requiredKey) และ `_callCampaignAI()` ใน `api/email-campaigns.php` ให้ตรวจ/ดึง field ใหม่ (`heading`, `blocks`, `cta_text`) แทน `body_html`
- [x] 5.2 แก้ `generateCampaignContent()` ใน `api/email-campaigns.php` ให้เรียก `campaign_ai_render_structured_content()` ประกอบ `editable_content` แทนการใช้ `body_html` ตรงๆ — และแก้ `CampaignsPage.tsx` ให้ส่ง template เต็มก้อนไปให้ PHP + อ่าน `result.editable_content`/`result.cta_text` แทน `result.body_html`
- [x] 5.3 แก้ Phase 2 ของ `aiPlanCampaigns()` ให้ compose `body_html`+`editable_content` ผ่าน `campaign_ai_render_structured_content()`/`campaign_ai_compose_body_html()` ก่อน insert — และแก้ `AICampaignPlanDialog.tsx` ให้ส่ง template เต็มก้อน
- [x] 5.4 เพิ่ม log warning (ไม่ block) ใน `generateCampaignContent()` เมื่อ AI response ไม่มี `{{first_name}}` ใน `heading`

## 6. Verification

- [x] 6.1 รัน `pnpm lint` และ `pnpm build` (ผ่านทั้งคู่ — lint: 0 errors/47 pre-existing warnings ไม่เกี่ยวกับการแก้ครั้งนี้, build: สำเร็จ, php -l ทั้ง 2 ไฟล์ไม่มี syntax error)
- [x] 6.2 ทดสอบผ่าน dev server: generate แคมเปญด้วย AI กับ template-5 (หรูหราสีม่วง, กึ่งกลาง, มี CTA) — HTML Source ยืนยัน `heading` ใช้ `color:#1f2937;text-align:center` และ `paragraph`/`list` ใช้ `color:#4b5563;text-align:center` ตรงกับ style metadata ของ template เป๊ะ พร้อม `{{first_name}}` ขึ้นต้นคำทักทาย
- [x] 6.3 แก้ข้อความในเนื้อหาที่ AI generate มาผ่าน `ArticleEditor` แล้วสลับดู HTML Source ซ้ำ — ยืนยันสไตล์ (รวม list ที่เพิ่งแก้ใน task 3.1) ไม่หายหลัง re-serialize
- [x] 6.4 ตรวจ HTML ที่ generate ออกมา — ไม่มี `<a>` tag ใดๆ ในเนื้อหาเลย ปุ่ม CTA ของ template ("เริ่มต้นควบคุมค่าใช้จ่าย AI วันนี้") มาจาก field `cta_text` แยกต่างหาก ไม่ใช่ลิงก์ปลอมที่ฝังในเนื้อหา
