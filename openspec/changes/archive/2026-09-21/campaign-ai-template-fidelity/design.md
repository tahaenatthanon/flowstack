## Context

ระบบสร้างแคมเปญด้วย AI ปัจจุบัน (`api/lib/campaign-ai-prompt.php` + `api/email-campaigns.php`) ให้ AI ตอบกลับ JSON ที่มี field `body_html` เป็น HTML string เต็มก้อน ซึ่งถูกเขียนตรงเข้า `body_html` ของแคมเปญ โดยไม่ผ่านกลไก compose ของระบบ template ที่มีอยู่แล้ว (`composeCampaignHtml()` ใน `src/lib/campaignTemplateCompose.ts`, ตาม spec `campaign-template-content-composition`) ทำให้ AI มีอำนาจเขียน `<a>` CTA และสไตล์เองอย่างอิสระ ขัดกับ chrome-lock ของ template

ระบบ template (`src/data/emailTemplates.ts`) มี `defaultContent` ต่อ template ที่แสดงธรรมเนียมชัดเจนอยู่แล้ว: ส่วนใหญ่เป็นโครงสร้าง heading + paragraph, ใช้สีเฉพาะตัว (เช่น `#1f2937` ตัวเข้ม หรือ `#ffffff` บนพื้นเข้มของ template หรูหรา), จัดกึ่งกลางประมาณครึ่งหนึ่งของ template และเปิดด้วยคำทักทายที่มี merge tag (`{{first_name}}` เป็นต้น) เสมอ

Pipeline ส่งอีเมล (`api/lib/email-campaign-sender.php`) อ่าน `body_html` ตรงๆ จาก DB แล้วรัน `processMergeTags()` (string substitution แบบ format-agnostic) และ `processEmailHtml()` (tracking) เท่านั้น ไม่มีขั้นตอน strip สไตล์ ดังนั้นสิ่งที่ backend compose ไว้ตอน generate จะคงสภาพไปถึงตอนส่งจริง — ยกเว้นกรณีผู้ใช้เปิดแก้ไขซ้ำผ่าน `ArticleEditor` (TipTap) ซึ่งปัจจุบันไม่คงสไตล์ inline ของ `bulletList`/`listItem`

## Goals / Non-Goals

**Goals:**
- AI ไม่มีอำนาจเขียน HTML, `<a>`, หรือ URL ใดๆ อีกต่อไป — ตอบกลับเป็นเนื้อหาโครงสร้างล้วน (`heading`, `blocks[]`, `cta_text` ไม่บังคับ)
- Backend ประกอบ HTML แบบ deterministic จากเนื้อหาโครงสร้าง + style metadata ต่อ template เดียวกับที่ template นั้นใช้ใน `defaultContent`
- คำทักทายเปิดเรื่องใช้ merge tag `{{first_name}}` เสมอ ตรงธรรมเนียมเดิมของทุก template
- ผลลัพธ์หลัง compose ยังคงแก้ไขต่อได้ผ่าน `ArticleEditor` เหมือนเนื้อหาที่มาจาก template ปกติ (รวมถึง list ที่เพิ่งเพิ่มการรองรับ)
- ใช้ schema เดียวกันทั้ง single-generate (`generateCampaignContent`) และ batch-generate (Phase 2 ของ `aiPlanCampaigns`)

**Non-Goals:**
- ไม่เปลี่ยนกลไก batch planning (Phase 1: วางแผนหัวข้อ/เวลา) — เปลี่ยนเฉพาะ Phase 2 (เขียนเนื้อหา) และ single-generate
- ไม่เพิ่ม block type อื่นนอกจาก `paragraph`/`list` ในรอบนี้ (เช่น รูปภาพ, ตาราง) — ตาม decision ที่ยืนยันไว้ก่อนหน้า
- ไม่แก้ template ที่ไม่มี `defaultContent` แบบ 2-part (เช่น template ที่มี highlight box พิเศษ) ให้เกินขอบเขต — ใช้ style metadata 3 field (`heading_color`/`body_color`/`text_align`) ตามที่ตัดสินใจไว้ว่าเพียงพอ ไม่ต้อง 1:1 กับทุกรายละเอียดภาพ
- ไม่แก้พฤติกรรม `ArticleEditor` สำหรับ node type อื่นที่ยังไม่รองรับ (เช่น orderedList ถ้าไม่ได้ใช้) — ขยายเท่าที่ `blocks[].type === 'list'` ต้องใช้จริง (`bulletList`/`listItem`)

## Decisions

### 1. AI ตอบกลับเป็น `{heading, blocks[], cta_text?}` แทน `body_html`
ทางเลือกอื่นที่พิจารณา: (a) ให้ AI ยังเขียน HTML แต่ validate/strip `<a>` ทิ้งหลัง generate — ถูกปัดตกเพราะ regex-strip HTML ไม่น่าเชื่อถือ (เสี่ยง false positive/negative) และไม่แก้ปัญหาสไตล์ไม่ตรง template; (b) ให้ AI เลือกจาก template ของ block ที่กำหนดไว้ล่วงหน้า — ปัดตกเพราะซับซ้อนเกินความจำเป็นสำหรับ scope ปัจจุบัน (2 block type พอ)
- Schema: `{"heading": "...", "blocks": [{"type": "paragraph", "text": "..."} | {"type": "list", "items": ["...", "..."]}], "cta_text": "..." }` (cta_text ไม่บังคับ)
- ใช้ schema เดียวกันทั้ง 2 จุดเรียก (single-generate, batch Phase 2) ตาม decision ที่ยืนยันไว้แล้ว

### 2. Backend compose HTML จาก style metadata ต่อ template — ทำที่ PHP ไม่ใช่ TS
เพิ่ม field ต่อ template ใน `emailTemplates.ts`: `heading_color`, `body_color`, `text_align` (`'left' | 'center'`) — ไม่ใช่ regex ดึงสีจาก `defaultContent` อัตโนมัติ (เสี่ยงดึงผิดถ้า `defaultContent` มีหลายสี) แต่กำหนดเองต่อ template ครั้งเดียวตอน implement โดยอ้างอิงจากสีจริงที่มีอยู่ใน `defaultContent` ปัจจุบันของแต่ละ template (สำรวจไว้แล้วระหว่าง explore)

**แก้ไขระหว่าง implement**: ตัดสินใจตอน design ไว้ว่าจะ compose ที่ `campaignTemplateCompose.ts` (TS) แล้วเรียกจาก backend — แต่พบว่าใช้จริงไม่ได้ เพราะ batch generate (`aiPlanCampaigns()`) รันเป็น PHP loop ล้วนที่ insert ตรงลง DB โดยไม่มี frontend คั่นกลางให้เรียกฟังก์ชัน TS ได้เลย จึงย้าย logic การ compose ทั้งหมดไปอยู่ที่ PHP (`api/lib/campaign-ai-prompt.php`) แทน:
- `campaign_ai_render_structured_content($templateMeta, $content)` — mirror ของแนวคิดเดิม render `heading`/`blocks[]` เป็น HTML ด้วย style metadata คืนค่าที่ใช้แทน `{{EMAIL_CONTENT}}`
- `campaign_ai_compose_body_html($templateMeta, $editableContent, $ctaText)` — mirror ของ `composeCampaignHtml()` เดิมใน TS (marker `{{EMAIL_CONTENT}}`/`{{CTA_TEXT}}`/`{{CTA_URL}}`/discount เดิมไม่เปลี่ยน) ใช้เฉพาะ batch path ที่ต้อง insert `body_html` เต็มก้อนทันที
- Single-generate (`generateCampaignContent()`) เรียกแค่ `campaign_ai_render_structured_content()` คืน `editable_content` (เนื้อหาโซนแก้ไขได้ล้วน ไม่ห่อ chrome) กลับไปให้ frontend — frontend ยังคง compose chrome+CTA เต็มก้อนสดๆ ตอนกดบันทึกด้วย `composeCampaignHtml()` (TS) เหมือนเดิมทุกประการ ไม่ซ้ำซ้อนกับที่ PHP ทำ
- ผลที่ตามมา: frontend ต้องส่ง template เต็มก้อน (`emailTemplates` ทั้ง array ไม่ใช่แค่ `{id, nameTH}`) ไปให้ PHP ทั้ง `?action=generate-content` และ `?action=ai-plan` เพื่อให้ PHP มี `heading_color`/`body_color`/`text_align` (และ `html`/`hasCta`/`defaultCtaText`/`defaultCtaUrl`/discount fields สำหรับ batch) ใช้ compose — ยังคงหลักการเดิมที่ frontend เป็นเจ้าของ template list เพียงแหล่งเดียว (`src/data/emailTemplates.ts`) กัน 2 แหล่งข้อมูล drift กัน เพียงแต่ส่ง field ให้ครบขึ้น
- ผลลัพธ์ HTML ที่ batch compose แล้วเก็บเป็น `editable_content`/`body_html`/`cta_text` ในแถว INSERT เดียวกัน เพื่อให้เข้ากับกลไกเปิดแก้ไขซ้ำที่มีอยู่แล้วตาม spec `campaign-template-content-composition`
- Trade-off ที่ยอมรับ: มี compose logic 2 ชุดขนานกัน (TS สำหรับ chrome ปกติที่ไม่ใช่ AI, PHP สำหรับ AI path) แทนที่จะเป็นชุดเดียว — ต้อง sync กันด้วยมือถ้าแก้สูตร render ฝั่งใดฝั่งหนึ่งในอนาคต (คอมเมนต์กำกับไว้ในทั้งสองไฟล์แล้ว)

### 3. `cta_text` ไหลเข้า CTA field ที่มีอยู่แล้ว ไม่สร้างกลไกใหม่
AI ส่ง `cta_text` เป็น string ไม่บังคับ — ถ้าไม่ส่งหรือว่าง ใช้ `defaultCtaText` ของ template (fallback เดิมที่มีอยู่แล้ว) URL ของปุ่มมาจาก template เท่านั้น (`cta_url` ผูกกับ template หรือ `mailto:{{company_email}}` ตามที่ spec เดิมกำหนด) — AI ไม่มีทางส่ง URL ได้เพราะไม่มี field นั้นใน schema เลย

### 4. บังคับ merge tag ผ่าน prompt instruction ไม่ใช่ post-processing
เลือกเพิ่ม instruction ชัดเจนใน prompt ให้ AI เขียน `heading` ขึ้นต้นด้วย `สวัสดีคุณ {{first_name}}` (หรือรูปแบบใกล้เคียงเป็นภาษาไทย) แทนการ post-process แทรกคำทักทายเอง — เหตุผล: AI ต้องแต่งคำให้เข้ากับ tone/context ของแคมเปญนั้นๆ (เช่น เป็นทางการ/เป็นกันเอง) post-processing แบบ fixed template จะขัดกับ tone selection ที่มีอยู่แล้ว
- Validation เพิ่มเติม (soft): ถ้า `heading` ที่ AI ส่งกลับไม่มี `{{first_name}}` ระบบ log warning แต่ไม่ block การ generate (เพื่อไม่ให้ AI response ที่ valid แต่ลืมใส่ merge tag ทำให้ทั้ง batch ล้มเหลว)

### 5. `ArticleEditor` ขยาย `PreserveInlineStyle` ให้ครอบคลุม `bulletList`/`listItem`
เพิ่มสอง type เข้า `types` array ของ `PreserveInlineStyle` extension ที่มีอยู่แล้ว (`src/components/content/ArticleEditor.tsx`) — ใช้ pattern เดียวกับที่ทำกับ `table`/`heading` อยู่แล้ว ไม่ต้องสร้าง extension ใหม่

## Risks / Trade-offs

- **[Risk]** AI อาจส่ง `blocks[]` ว่างเปล่าหรือ `heading` ว่าง → **Mitigation**: คงกลไก validation/retry เดิมที่มีอยู่แล้วสำหรับ malformed JSON (`campaign_ai_extract_json`) ขยายให้ตรวจ field required ของ schema ใหม่ด้วย
- **[Risk]** Template ที่ไม่ได้ตามด้วยโครงสร้าง heading+paragraph มาตรฐาน (เช่น template-2 ที่มี highlight box) อาจได้ผลลัพธ์ที่ดู "เรียบ" กว่าปกติเพราะ compose ใหม่ไม่รู้จัก highlight box → **Mitigation**: ยอมรับเป็น known limitation ตาม Non-Goals — ยังดีกว่าเดิมที่ AI เขียนสีมั่วไม่ตรง template เลย
- **[Risk]** การตัด `body_html` ออกจาก schema เป็น breaking change กับ AI response เดิม — ถ้ามี in-flight request หรือ cache ของ prompt version เก่า → **Mitigation**: ไม่มี backward-compat fallback ตามกฎ CLAUDE.md (ไม่มีการ hack ย้อนกลับ), เปลี่ยนพร้อมกันทั้ง prompt และ parser ในการ deploy เดียว
- **[Trade-off]** เพิ่ม complexity ที่ backend (compose function ต้องรองรับ 2 รูปแบบ input: string เดิม กับ structured ใหม่) แลกกับการควบคุมคุณภาพ/ความสอดคล้องของอีเมลที่ส่งออกได้แน่นอนกว่าเดิมมาก

## Migration Plan

1. เพิ่ม style metadata (`heading_color`, `body_color`, `text_align`) ให้ทุก template ใน `emailTemplates.ts`
2. เพิ่มฟังก์ชัน compose จาก structured content ที่ PHP (`campaign_ai_render_structured_content`, `campaign_ai_compose_body_html` ใน `campaign-ai-prompt.php`) — ไม่ใช่ TS ตามที่ระบุใน decision #2
3. แก้ `ArticleEditor.tsx` ขยาย `PreserveInlineStyle`
4. แก้ `campaign-ai-prompt.php` เปลี่ยน schema + instruction (ตัด `body_html`, เพิ่ม `heading`/`blocks`/`cta_text`, เพิ่ม merge tag instruction, ตัด "มี CTA ชัดเจน")
5. แก้ `email-campaigns.php` (`generateCampaignContent`, `aiPlanCampaigns` Phase 2) ให้เรียก compose function ใหม่ (PHP) แทนการใช้ `body_html` จาก AI ตรงๆ — และแก้ frontend (`CampaignsPage.tsx`, `AICampaignPlanDialog.tsx`) ให้ส่ง template เต็มก้อนไปให้ PHP ใช้ compose
6. ทดสอบ manual ผ่าน dev server: generate แคมเปญด้วย AI 2-3 template ที่มีสไตล์ต่างกัน (สว่าง/มืด, ชิดซ้าย/กึ่งกลาง) ตรวจว่า heading/paragraph/list ออกมาตรงสไตล์ และมี `{{first_name}}` ในคำทักทาย แล้วเปิดแก้ไขซ้ำผ่าน `ArticleEditor` ตรวจว่าสไตล์ list ไม่หาย
7. ไม่มี migration ของข้อมูลเดิม — แคมเปญที่มีอยู่แล้วไม่ถูกแตะต้อง (เปลี่ยนเฉพาะ generation path)

## Open Questions

(ไม่มี — decision ทั้งหมดถูกยืนยันโดยผู้ใช้แล้วระหว่างขั้นตอน explore)
