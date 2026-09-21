## Why

ฟีเจอร์ "สร้างด้วย AI" ในแคมเปญอีเมลปัจจุบันให้ AI เขียน `body_html` เป็น HTML string เต็มก้อนเอง ทำให้เกิด 2 ปัญหาที่ขัดกับดีไซน์ template สำเร็จรูป: (1) AI แทรกปุ่ม `<a>` CTA ของตัวเองที่มี URL ปลอม/ไม่ทำงาน ซ้อนกับปุ่ม CTA จริงของ template ที่ระบบมีกลไกจัดการแยกอยู่แล้ว (`campaign-template-content-composition`) และ (2) เนื้อหาที่ AI เขียนไม่มีสี/การจัดวาง/คำทักทายแบบ merge tag ตรงตามธรรมเนียมของ template ที่เลือกไว้ ทำให้อีเมลที่ส่งออกดูไม่เป็นมืออาชีพและไม่สอดคล้องกับดีไซน์ที่ทีม brand ออกแบบไว้

## What Changes

- **BREAKING**: ตัด `body_html` ออกจาก JSON schema ที่ AI ต้องตอบกลับทั้งหมด (ทั้ง single-generate และ batch-generate) — AI จะไม่เขียน HTML หรือ `<a>` CTA เองอีกต่อไป
- เปลี่ยน schema การตอบกลับของ AI เป็นเนื้อหาโครงสร้างล้วน: `heading` (คำทักทายเปิดเรื่อง), `blocks[]` (แต่ละ block เป็น `paragraph` หรือ `list`), และ `cta_text` (ข้อความปุ่ม CTA ไม่บังคับส่ง)
- Backend ประกอบ (compose) เนื้อหาที่ AI ส่งกลับเป็น HTML แบบ deterministic โดยใช้ style metadata ต่อ template (`heading_color`, `body_color`, `text_align`) แทนการให้ AI กำหนดสี/การจัดวางเอง
- บังคับให้ AI ใช้ merge tag `{{first_name}}` เปิดคำทักทายใน `heading` เสมอ ตามธรรมเนียมที่ทุก template ใช้อยู่แล้วใน `defaultContent`
- `cta_text` ที่ AI ส่งมา (ถ้ามี) ไหลเข้ากลไก CTA field เดิมของ template (`composeCampaignHtml`) เป็นเพียงข้อความปุ่ม ไม่ใช่ URL — URL ปุ่ม CTA ยังคงเป็นของ template เท่านั้น ไม่มีทางที่ AI จะกำหนด URL ได้
- แก้ไข `ArticleEditor` (TipTap) ให้คง inline `style` attribute ของ `bulletList`/`listItem` ไว้เมื่อแก้ไขเนื้อหาซ้ำ (ปัจจุบันคงไว้เฉพาะ paragraph/link/div/table/heading) เพื่อให้ block ประเภท `list` ที่ backend ประกอบมาไม่เสียสไตล์เมื่อผู้ใช้เปิดแก้ไขต่อ

## Capabilities

### New Capabilities
(ไม่มี — ใช้โครงสร้าง capability เดิมที่มีอยู่แล้ว)

### Modified Capabilities
- `campaign-ai-content-generation`: เปลี่ยน requirement "Generated Body Always Populates The Editor" จากรับ `body_html` ดิบ เป็นรับเนื้อหาโครงสร้าง (`heading`/`blocks`/`cta_text`) แล้วให้ระบบ compose เป็น HTML ตาม template; เพิ่ม requirement ใหม่ว่า AI SHALL NOT เขียน `<a>`/URL เอง และ SHALL ใช้ merge tag `{{first_name}}` ในคำทักทาย
- `campaign-template-content-composition`: เพิ่ม requirement ว่าแต่ละ template SHALL กำหนด style metadata (`heading_color`, `body_color`, `text_align`) และฟังก์ชัน compose SHALL รองรับ input แบบโครงสร้าง (heading/blocks) แปลงเป็น HTML ตามสไตล์ของ template นั้น นอกเหนือจาก `{{EMAIL_CONTENT}}` แบบ string เดิม
- `rich-text-editor-style-fidelity`: เพิ่ม requirement ว่า `ArticleEditor` SHALL คง `style` attribute ของ `bulletList`/`listItem` ไว้เช่นเดียวกับ node ประเภทอื่นที่รองรับอยู่แล้ว

## Impact

- `api/lib/campaign-ai-prompt.php` — เปลี่ยน JSON schema ใน prompt, ตัด instruction "มี CTA ชัดเจน", เพิ่ม instruction เรื่อง merge tag และ template style metadata
- `api/email-campaigns.php` — `generateCampaignContent()`/`aiPlanCampaigns()` ต้องแปลงผลลัพธ์ AI แบบโครงสร้างเป็น `body_html` ผ่าน compose function แทนการใช้ `body_html` จาก AI ตรงๆ
- `src/data/emailTemplates.ts` — เพิ่ม field style metadata (`heading_color`, `body_color`, `text_align`) ต่อ template
- `src/lib/campaignTemplateCompose.ts` — เพิ่มความสามารถ compose จาก structured content (heading/blocks) ตาม style metadata
- `src/components/content/ArticleEditor.tsx` — ขยาย `PreserveInlineStyle` ให้ครอบคลุม `bulletList`/`listItem`
- ไม่กระทบแคมเปญที่มีอยู่เดิม (แก้ที่ generation path เท่านั้น ไม่แตะข้อมูลที่บันทึกไว้แล้ว)
