## Why

เมื่อผู้ใช้แก้ไขข้อความในแคมเปญอีเมลที่มาจาก template สำเร็จรูป ดีไซน์ของ template (สี, ความกว้างการ์ด, padding, border, icon, รูปภาพ, โครงสร้าง) มีความเสี่ยงเสียหายทุกครั้ง เพราะ `ArticleEditor` (TipTap) พยายามรับผิดชอบทั้งเอกสาร (chrome + content ปนกัน) ทั้งที่ TipTap ไม่ได้ออกแบบมาให้แทน HTML เต็มรูปแบบได้ 100% — ที่ผ่านมาแก้แบบ patch ทีละจุด (`style` attribute, `<div>` node) ไปแล้วใน `preserve-template-styles-in-editor` แต่ยังพบปัญหาความกว้างการ์ด (`width="580"` เป็น HTML attribute ที่ TipTap ไม่รองรับ ถูกทิ้งตอน parse ทำให้การ์ดขยายเต็มจอ) และไม่มีทางรับประกันได้ว่าจะไม่เจอ attribute อื่นที่หายไปอีกในอนาคต (เช่น `cellpadding`, `align`) — เป็นการไล่แก้ปัญหาแบบ whack-a-mole ที่ไม่มีวันจบ

แนวทางแก้ที่ถูกจุดคือไม่ให้ chrome ผ่าน editor เลยตั้งแต่ต้น แยกออกจากเนื้อหาที่แก้ไขได้อย่างเด็ดขาด

## What Changes

- เพิ่ม editable-region marker (`{{EMAIL_CONTENT}}`) ที่กำหนดตำแหน่งเองทีละ template ใน `emailTemplates.ts` (ไม่ใช้ auto-detect/regex หา `<p>` อัตโนมัติ) แบ่งแต่ละ template เป็น chrome (ก่อน/หลัง marker) + เนื้อหาเริ่มต้น (`defaultContent`)
- template ที่มีปุ่ม CTA เพิ่ม marker แยก (`{{CTA_TEXT}}`, `{{CTA_URL}}`) พร้อม field `hasCta`/`defaultCtaText`/`defaultCtaUrl` — CTA ถือเป็นส่วนหนึ่งของ chrome ห้ามแก้โครงสร้างผ่าน editor โดยตรง ต้องแก้ผ่าน field ข้อความ/URL แยกต่างหาก
- `CampaignsPage.tsx`: เปลี่ยน editor ให้เห็นเฉพาะ `defaultContent` (ไม่ใช่ HTML เต็มเอกสาร) — chrome ไม่มีวันผ่าน editor เลย
- เพิ่มฟังก์ชัน compose `chromeBefore + editableContent + chromeAfter` (แทนที่ CTA marker ด้วยค่าจาก field แยก) ทำงาน**ครั้งเดียวตอนบันทึก** (สร้าง/แก้ไขแคมเปญ) ผลลัพธ์คือ HTML เต็มก้อนที่ส่งเป็น `body_html` เหมือนพฤติกรรมเดิมทุกประการ
- Preview และ Send ใช้ `body_html` ที่บันทึกไว้ค่าเดียวกัน — backend (`api/email-campaigns.php`) **ไม่ต้องแก้ไข** ยังทำแค่ merge tags + tracking เหมือนเดิม ไม่ประกอบ design ใหม่จาก template
- แคมเปญที่ส่งไปแล้ว/แคมเปญร่างเก่าที่สร้างไว้ก่อน migration นี้ (ไม่มี marker) ยังคงอ่าน/แก้ไขผ่านช่องทางเดิม (ทั้งเอกสารผ่าน editor ตรงๆ) — ไม่บังคับแปลงย้อนหลัง
- ไม่เปลี่ยน `ArticleEditor.tsx` แบบ global — logic เรื่อง chrome/editable-zone จำกัดอยู่แค่ฝั่ง `CampaignsPage.tsx` เท่านั้น ไม่กระทบหน้าเนื้อหาบทความ (`ContentCardDialog.tsx`)

## Capabilities

### New Capabilities
- `campaign-template-content-composition`: กำหนดว่าแคมเปญที่มาจาก template สำเร็จรูปแยก chrome (ดีไซน์ตายตัว) ออกจากเนื้อหาที่แก้ไขได้อย่างไร, จังหวะที่ประกอบ (compose) เป็น HTML เต็มก้อน, และการจัดการ CTA เป็น field แยก

### Modified Capabilities
(ไม่มี — `email-campaign-template-picker` ดูแล UI การเลือก/toggle template ซึ่งไม่เปลี่ยน, `rich-text-editor-style-fidelity` ดูแล fidelity ของ `ArticleEditor` โดยรวมซึ่งไม่เปลี่ยนเช่นกันตามที่ตัดสินใจไว้ว่าไม่แตะ editor แบบ global, `campaign-email-rendering` ดูแล backend send pipeline ซึ่งพฤติกรรมยังตรงตาม requirement เดิมทุกประการ — ไม่มี requirement ใดในทั้ง 3 capability ที่ต้องเปลี่ยน)

## Impact

- **Frontend**: `src/data/emailTemplates.ts` (โครงสร้าง `EmailTemplate` ใหม่ + แก้ marker ทีละ 1 ใน 20 template), `src/pages/CampaignsPage.tsx` (state model, UI field CTA แยก, ฟังก์ชัน compose)
- **ไม่แตะ**: `api/email-campaigns.php`, `src/components/content/ArticleEditor.tsx`, ฐานข้อมูล (schema เดิมพอ), แคมเปญเก่า/ร่างเก่า
- งานส่วนใหญ่เป็นการตัดสินใจ "อะไรคือเนื้อหาที่แก้ไขได้" ทีละ 1 ใน 20 template — เป็นแรงงานคนที่ต้องทำทีละตัว ไม่ใช่ auto-detect ได้
