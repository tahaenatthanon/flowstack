## Context

ปัจจุบัน `ArticleEditor` (TipTap) รับผิดชอบทั้งเอกสาร HTML ของแคมเปญ (chrome + เนื้อหาปนกันเป็นก้อนเดียว ผูกกับ state `campaignBody`) พอผู้ใช้พิมพ์แก้ไข เนื้อหาทั้งก้อนต้อง parse เข้า/re-serialize ออกจาก schema ของ TipTap ซึ่งไม่ได้ออกแบบมาแทน HTML เอกสารเต็มรูปแบบได้ 100% — แก้ไปแล้ว 2 รอบ (`style` attribute, `<div>` node ใน `preserve-template-styles-in-editor`) แต่ยังเจอเพิ่ม (`width` HTML attribute หายจาก `<table>`) และไม่มีทางรับประกันได้ว่าจะไม่เจอ attribute อื่นอีกในอนาคต (`cellpadding`, `align` เป็นต้น) เพราะ TipTap's Table extension มีระบบจัดการความกว้างคอลัมน์ของตัวเอง (`colgroup`/`col` สำหรับฟีเจอร์ลากปรับขนาด) ที่ทับ/ไม่รู้จัก `width=` attribute ที่ author ใส่มาเลย (ดูรายละเอียดกลไกใน `node_modules/.pnpm/@tiptap+extension-table@*/.../table/index.js`)

ทั้ง 20 template ใน `emailTemplates.ts` ใช้โครงสร้างเดียวกัน: ตารางนอกเต็มความกว้าง (พื้นหลัง) ครอบตารางในกว้างคงที่ (การ์ดเนื้อหา, `width="NNN" cellpadding="0" cellspacing="0"`) — ยืนยันด้วย `grep` แล้วว่าทั้ง 20 template มี pattern `width="[0-9]+" cellpadding` ครบ จึงเสี่ยงปัญหานี้เท่ากันหมด

## Goals / Non-Goals

**Goals:**
- ดีไซน์ (chrome) ของอีเมลที่ส่งจริงต้องเหมือนกับ template ต้นฉบับ 100% เสมอ ไม่ว่าจะแก้ไขเนื้อหากี่ครั้งก็ตาม — ครอบคลุมปัญหาทั้งที่เจอแล้วและยังไม่เจอในคราวเดียว
- Preview และการส่งจริงใช้ค่า `body_html` เดียวกัน สอดคล้องกันเสมอ
- แคมเปญที่ส่งไปแล้วต้องไม่เปลี่ยนดีไซน์ย้อนหลังไม่ว่าจะแก้ template ในโค้ดทีหลังยังไง (snapshot ที่จุดบันทึก)

**Non-Goals:**
- ไม่เปลี่ยน `ArticleEditor.tsx` แบบ global (ยังใช้ร่วมกับหน้าบทความ `ContentCardDialog.tsx` โดยไม่ถูกกระทบ)
- ไม่บังคับแปลงแคมเปญร่างเก่า (สร้างก่อน migration) ให้เป็นรูปแบบใหม่ — ยังแก้ไขผ่านช่องทางเดิมได้
- ไม่รองรับการแก้ chrome ผ่าน editor อีกต่อไป (เป็นการยอมรับข้อจำกัดตรงๆ แทนที่จะฝืนให้ทำได้แล้วพังแบบสุ่มเหมือนตอนนี้)
- ไม่แก้ปัญหาการขาด HTML sanitization ในขั้นตอนส่งอีเมล (เป็นปัญหาคนละเรื่อง มี task แยกไว้ต่างหากแล้ว)

## Decisions

**Decision: ใช้ placeholder token แบบ manual marker ฝังในสตริง HTML ของแต่ละ template**

รูปแบบ: `{{EMAIL_CONTENT}}` สำหรับโซนเนื้อหาหลัก, `{{CTA_TEXT}}`/`{{CTA_URL}}` สำหรับ CTA (เฉพาะ template ที่มี) — วางตำแหน่งเองทีละ template ไม่ใช้ auto-detect/regex หา `<p>`

- ทางเลือกที่พิจารณา: HTML comment marker (`<!--CONTENT_START-->...<!--CONTENT_END-->`) — ปฏิเสธเพราะ comment เสี่ยงถูก parser บางตัวตัดทิ้งระหว่างทาง (เคยเจอปัญหาคล้ายกันมาแล้วกับ attribute ที่ schema ไม่รู้จัก) placeholder token แบบ string literal ธรรมดาปลอดภัยกว่าเพราะเราควบคุม `.replace()` เองตรงๆ ไม่ผ่าน HTML parser ใดๆ เลย
- ทางเลือกที่พิจารณา: เปลี่ยนโครงสร้าง `EmailTemplate` เป็น `{ chromeBefore, chromeAfter }` แยก field แทน token — ทำงานเหมือนกันแต่ต้องแก้โครงสร้างข้อมูลของทั้ง 20 template มากกว่า (ต้องตัดสตริงเป็น 2-3 ท่อนเอง) ขณะที่ token แบบ `.replace()` แก้ตำแหน่งเดียวในสตริงเดิมได้เลย เปลี่ยนน้อยกว่า

**Decision: จังหวะ compose — ฟังก์ชัน pure เรียกได้ทั้งตอน preview (ระหว่างแก้ไข ยังไม่บันทึก) และตอนบันทึก**

```ts
function composeCampaignHtml(template: EmailTemplate, editableContent: string, ctaText?: string, ctaUrl?: string): string {
  let html = template.html.replace('{{EMAIL_CONTENT}}', editableContent);
  if (template.hasCta) {
    html = html.replace('{{CTA_TEXT}}', ctaText ?? template.defaultCtaText ?? '')
               .replace('{{CTA_URL}}', ctaUrl ?? template.defaultCtaUrl ?? '');
  }
  return html;
}
```

เรียกจาก 2 จุด: (1) แท็บ "ตัวอย่าง" ระหว่างกำลังแก้ไข (live, ยังไม่บันทึก) — ให้เห็นผลลัพธ์จริงก่อนกดบันทึก (2) handler บันทึกแคมเปญ — ผลลัพธ์เดียวกันเป๊ะเพราะเป็นฟังก์ชัน pure จาก state เดียวกัน ณ เวลานั้น เมื่อบันทึกแล้วค่านี้กลายเป็น snapshot ถาวรใน `body_html` (ตามข้อ "เก็บเป็น HTML เต็มก้อนหลังประกอบ เพื่อไม่เปลี่ยนย้อนหลัง") — Preview และ Send จึงมาจากค่าเดียวกันเสมอตามที่ตัดสินใจไว้

**Decision: เพิ่มคอลัมน์ใหม่ 3 คอลัมน์ใน `email_campaigns` เพื่อรองรับการเปิดแก้ไขแคมเปญร่างซ้ำ (ไม่ใช่แค่สร้างครั้งเดียว)**

`editable_content` (TEXT, NULL), `cta_text` (VARCHAR, NULL), `cta_url` (VARCHAR, NULL) — เก็บ "วัตถุดิบ" แยกจาก `body_html` (ที่เป็นผลลัพธ์ compose แล้ว) เพื่อให้เปิดแก้ไขแคมเปญร่างซ้ำได้โดยโหลดค่าเหล่านี้กลับเข้า state ตรงๆ ไม่ต้องพยายาม "แกะ" เนื้อหากลับออกจาก `body_html` ที่ compose แล้ว

- ทางเลือกที่พิจารณา: ไม่เพิ่มคอลัมน์ใหม่เลย ตอนเปิดแก้ไขซ้ำให้เทียบ `body_html` กับ `template.html` ปัจจุบัน (โดยตำแหน่ง marker) เพื่อแกะ `editableContent` กลับออกมา — ปฏิเสธ เพราะเปราะบางมาก ถ้า `emailTemplates.ts` ถูกแก้แม้แค่ typo เล็กน้อยในส่วน chrome หลังจากแคมเปญร่างถูกสร้างไว้แล้ว การแกะกลับจะ "ไม่ตรง" ทันที (string ก่อน/หลัง marker ไม่ match) ทำให้แก้ไขแคมเปญร่างเก่าพังโดยไม่มีสัญญาณเตือน
- **ผลพลอยได้ที่ดี**: คอลัมน์ใหม่นี้ nullable และมีแต่แคมเปญที่สร้างหลัง migration เท่านั้นที่มีค่า (ไม่ใช่ NULL) — ทำให้เช็คได้ง่ายๆ ด้วย `editable_content IS NOT NULL` ว่าแคมเปญนี้เป็นรูปแบบใหม่ (เปิดแก้ไขแบบ chrome-lock) หรือรูปแบบเก่า (เปิดแก้ไขทั้งเอกสารแบบเดิม) — implement ข้อ "แคมเปญร่างเก่าแก้ไขแบบเดิม" ได้จากเงื่อนไขนี้โดยตรง ไม่ต้องมี flag แยกเพิ่ม
- นี่แก้ไขจากที่เคยบอกไว้ระหว่างคุยว่า "ไม่ต้อง migrate ฐานข้อมูล" — ตอนนั้นคิดถึงแค่ flow สร้าง+ส่งครั้งเดียว ไม่ได้คิดถึง flow เปิดแก้ไขแคมเปญร่างซ้ำ ซึ่งจำเป็นต้องมีที่เก็บ "วัตถุดิบ" แยกต่างหาก

**Decision: CTA เป็น field โครงสร้าง (text + URL) แยกจาก editable content โดยสิ้นเชิง ไม่ให้แก้ผ่าน rich-text editor**

- ทางเลือกที่พิจารณา: รวม CTA ไว้ในโซนเนื้อหาที่แก้ไขได้ (เหมือนเดิม ให้ editor ดูแล) — ปฏิเสธตามที่ตัดสินใจไว้แล้ว เพราะ CTA มีโครงสร้าง/สไตล์ปุ่มที่ผูกกับดีไซน์ (สี gradient, border-radius) ถือเป็น chrome ถ้าปล่อยให้ editor แก้ได้จะเจอปัญหา style หายแบบเดียวกับที่เจอมาตลอด
- ปุ่มเสริม "แทรกปุ่มลิงก์ในอีเมล" (toolbar เดิมของ `ArticleEditor`) ยังใช้งานได้ตามปกติ**ภายในโซนเนื้อหาที่แก้ไขได้** — เป็นคนละกลไกกับ CTA หลักของ template (ที่ล็อกเป็น field แยก) ผู้ใช้แทรกปุ่ม/ลิงก์เสริมเองระหว่างพิมพ์ได้เหมือนเดิมทุกประการ ไม่ถูกจำกัดเพิ่ม

## Risks / Trade-offs

- [Risk] ต้องกำหนด marker + นิยาม "โซนแก้ไขได้" ทีละ 1 ใน 20 template ด้วยมือ — งานหนักและเสี่ยงตัดสินใจไม่สอดคล้องกันระหว่าง template (เช่น template ที่มี list "Key Features" อาจตัดสินใจว่าเป็น chrome หรือ content ต่างกันไปในแต่ละตัว) → **การรับมือ**: ทำทีละ template จริง ตรวจสอบผลลัพธ์ด้วยการทดสอบส่งจริงเทียบ "edit"/"no edit" ให้เหมือนกันทุกครั้งก่อนถือว่าเสร็จ 1 ตัว
- [Risk] เพิ่มคอลัมน์ DB ใหม่ต้องตาม CLAUDE.md migration process (สร้างไฟล์ + รันจริงกับ local MariaDB + verify) — มีขั้นตอนเพิ่มจากที่คิดไว้แต่แรกว่า "ไม่ต้อง migrate" → **การรับมือ**: เป็น migration แบบ additive/nullable ล้วนๆ ไม่กระทบข้อมูลเดิม ความเสี่ยงต่ำ
- [Risk] ผู้ใช้ที่เคยชินกับการแก้ chrome ผ่าน editor (แม้จะพังบ่อย) จะทำแบบนั้นไม่ได้อีกต่อไปสำหรับแคมเปญใหม่ → **การรับมือ**: ยอมรับเป็น trade-off ที่ตั้งใจ (ตามที่ตัดสินใจไว้แล้วในข้อ 3-4) เพราะพฤติกรรมเดิมไม่เสถียรอยู่แล้ว
- [Trade-off] แคมเปญร่างเก่า (ก่อน migration) ยังคงมีความเสี่ยงบั๊กแบบเดิม (สี/ความกว้างหาย) ถ้าเปิดแก้ไขต่อ — ยอมรับตามที่ตัดสินใจไว้ (ข้อ 9) เพื่อไม่ให้ผู้ใช้เสียงานที่ทำค้างไว้

## Migration Plan

1. Migration DB: เพิ่มคอลัมน์ `editable_content` (TEXT NULL), `cta_text` (VARCHAR(255) NULL), `cta_url` (VARCHAR(500) NULL) ใน `email_campaigns` — รันตามขั้นตอน migration ของโปรเจกต์ (สร้างไฟล์ → รันจริง → verify ด้วย `DESCRIBE`)
2. แก้ `EmailTemplate` interface ใน `emailTemplates.ts` เพิ่ม field `defaultContent`, `hasCta?`, `defaultCtaText?`, `defaultCtaUrl?`
3. แก้ template ทีละตัว (เริ่มจากตัวที่ทดสอบไปแล้วในเซสชันนี้ก่อน: template-1, 2, 3, 5, 12) ฝัง marker `{{EMAIL_CONTENT}}` (และ `{{CTA_TEXT}}`/`{{CTA_URL}}` ถ้ามี) ย้ายข้อความเดิมไปเป็นค่า `defaultContent`/`defaultCtaText`/`defaultCtaUrl`
4. แก้ `CampaignsPage.tsx`: เพิ่ม state `editableContent`, `ctaText`, `ctaUrl`; เพิ่ม `composeCampaignHtml()`; ผูก `ArticleEditor` เข้ากับ `editableContent` แทน `campaignBody`; แสดง field CTA แยกเมื่อ `selectedTemplate` มี `hasCta`; แท็บ "ตัวอย่าง" render จาก `composeCampaignHtml(...)`; ตอนบันทึกส่ง `body_html: composeCampaignHtml(...)` พร้อม `editable_content`/`cta_text`/`cta_url` ดิบไปด้วย
5. แก้ `openEditCampaign()`: เช็ค `campaign.editable_content !== null` → โหมดใหม่ (โหลด `editableContent`/`ctaText`/`ctaUrl` กลับเข้า state ตรงๆ) — ถ้าเป็น `null` → โหมดเดิม (โหลดทั้งเอกสารเข้า `campaignBody` แบบเดิมทุกประการ, ไม่ผ่าน compose)
6. แก้ `api/email-campaigns.php`: create/update handler รับ/บันทึก `editable_content`, `cta_text`, `cta_url` เพิ่ม (แค่ persist ตรงๆ ไม่ต้องมี logic ประมวลผลเพิ่ม) — ส่วน send handler **ไม่ต้องแก้** ยังอ่าน `body_html` ตรงๆ เหมือนเดิม
7. ทดสอบทีละ template ที่แก้ไว้: เลือก template → แก้ข้อความ → preview ตรงกับ "ไม่แก้ไข" ทุกจุด (สี/ความกว้าง/CTA) → บันทึก → เปิดแก้ไขซ้ำ → ค่าเดิมโหลดกลับถูกต้อง → ส่งจริงไป Gmail ยืนยันภาพสุดท้าย
8. ทดสอบ regression: แคมเปญร่างเก่า (สร้างก่อน migration) เปิดแก้ไขยังทำงานแบบเดิม, แคมเปญที่ไม่ใช้ template (`template_id` null) ไม่ได้รับผลกระทบเลย, หน้าเนื้อหาบทความไม่ได้รับผลกระทบเลย
9. รัน `pnpm lint` และ `pnpm build`

Rollback: migration DB เป็น additive/nullable ล้วนๆ ย้อนกลับโค้ดฝั่ง frontend/backend ได้โดยไม่ต้อง drop คอลัมน์ (ปล่อยว่างไว้ไม่มีผลเสีย)

## Open Questions

- ไม่มี — ทุกจุดตัดสินใจสำคัญได้รับการยืนยันจากผู้ใช้แล้วระหว่างการ explore ก่อนหน้านี้ ยกเว้นเรื่องคอลัมน์ DB เพิ่มเติมที่เป็นการต่อยอดทางวิศวกรรมจากสิ่งที่ตกลงไว้ (ควร confirm กับผู้ใช้อีกครั้งก่อน apply จริง)
