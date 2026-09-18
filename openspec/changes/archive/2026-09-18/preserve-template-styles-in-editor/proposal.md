## Why

`ArticleEditor` (ใช้ TipTap ร่วมกันทั้งในไดอะล็อกแคมเปญและไดอะล็อกเนื้อหาบทความ) ตัด `style` attribute แบบ inline และ element ที่ schema ไม่รู้จักทิ้งอย่างเงียบๆ จาก HTML ที่ผ่านมัน เพราะ schema ของ editor ประกาศ `style` attribute ไว้แค่บน `<p>` และ `<a>` เท่านั้น พอผู้ใช้แก้ไขข้อความหลังเลือก template สำเร็จรูปตัวใดตัวหนึ่งจาก 20 แบบใน `src/data/emailTemplates.ts` ดีไซน์ของ template — สีพื้นหลัง/สีตัวอักษรที่ตั้งผ่าน inline `style` บน `<table>`/`<tr>`/`<td>` และ `<h1>`-`<h4>` รวมถึงวงกลมไอคอนตกแต่งที่สร้างด้วย `<div style="display:flex;...">` — จะหายไปทันทีที่เนื้อหาผ่าน editor ครบรอบ (`setContent()` → `getHTML()`) เรื่องนี้ยืนยันแล้วจากการส่งอีเมลทดสอบจริง: แก้ไข template-1/2/3 ในแท็บ "แก้ไข" แล้วส่ง อีเมลที่ได้กลายเป็นพื้นขาวล้วนกับสีตัวอักษรหัวข้อเป็นค่าเริ่มต้น ทั้งที่ template เดิมมีสีสันครบ ส่วนเวอร์ชันที่ไม่ได้แก้ไขของ template เดียวกันยังคงแสดงผลถูกต้อง — ข้อความยังอยู่ครบ เสียแค่ดีไซน์เท่านั้น

## What Changes

- ขยาย schema ของ TipTap ใน `ArticleEditor` ให้ `style` attribute รอดผ่านการแก้ไขบน element ที่ template ทั้ง 20 แบบใช้จริงในการใส่สี/จัดวาง: `Table`, `TableRow`, `TableCell`, `TableHeader`, และ `Heading` (ระดับ 1-4) — ใช้ pattern `keepStyleAttribute` เดียวกับที่มีอยู่แล้วสำหรับ `StyledParagraph`/`StyledLink`
- เพิ่ม node `Div` เข้าไปใน extension list ของ editor (ปัจจุบันไม่มีเลย) พร้อม attribute เก็บ style เหมือนกัน เพื่อให้วงกลมไอคอนตกแต่งแบบ `<div style="display:flex;...">` ที่ template-5 กับ template-12 ใช้ รอดจากการแก้ไข แทนที่จะถูกตัดทิ้ง
- ไม่แตะ template ที่มีอยู่, ขั้นตอนส่งแคมเปญ, หรือพฤติกรรม `wrapEmailHtml()`/header-footer ซ้อนกัน (แก้ไปแล้วใน `fix-campaign-email-duplicate-wrap` ที่ archive ไปแล้ว) — งานนี้เกี่ยวกับสิ่งที่ rich-text editor ที่ใช้ร่วมกันเก็บรักษาไว้เท่านั้นตอนเนื้อหาถูกแก้ไข

## Capabilities

### New Capabilities
- `rich-text-editor-style-fidelity`: ควบคุมว่า inline styling และ structural element ใดบ้างที่ schema ของ TipTap ใน `ArticleEditor` เก็บรักษาไว้ตอน parse และ re-serialize เนื้อหา HTML โดยไม่ขึ้นกับว่าหน้าไหนเป็นคนเรียกใช้ editor (ไดอะล็อกแคมเปญ หรือไดอะล็อกเนื้อหาบทความ)

### Modified Capabilities
(ไม่มี — `email-campaign-template-picker` และ `email-campaign-body-editor-sync` ดูแลพฤติกรรม UI/sync ของไดอะล็อกแคมเปญ ไม่ใช่การรับประกันความคงเดิมของ HTML ภายในตัว editor เอง ไม่มี requirement ในทั้งสอง spec ที่เปลี่ยนแปลง)

## Impact

- **Frontend**: แก้ที่ `src/components/content/ArticleEditor.tsx` ไฟล์เดียว — ขยาย extensions array และ pattern `keepStyleAttribute` ที่มีอยู่แล้ว
- กระทบทั้ง 2 จุดที่เรียกใช้ `ArticleEditor`: `src/pages/CampaignsPage.tsx` (แคมเปญอีเมล) และ `src/components/content/ContentCardDialog.tsx` (เนื้อหาบทความ) — เช็คแล้วว่าฝั่งเนื้อหาบทความปลอดภัย เพราะไม่ได้พึ่งพา layout ตาราง/div ที่มีสีอยู่แล้ว
- ไม่มีการเปลี่ยนแปลงฝั่ง backend, ฐานข้อมูล, หรือ API
- นอกขอบเขต (แยกเป็นเรื่องต่างหาก ไม่ได้อยู่ใน change นี้): `api/email-utils.php` ปัจจุบันไม่มีการกรอง HTML เลยก่อนส่งอีเมลแคมเปญ และโหมด "HTML Source" ของ `ArticleEditor` ก็ข้าม schema ของ TipTap ไปทั้งหมดผ่าน `onChange(sourceHtml)` ร่วมกับ `emitUpdate: false` — การขยาย schema ให้เก็บ style ได้กว้างขึ้นในงานนี้ไม่ได้ทำให้ช่องโหว่เดิมที่มีอยู่แล้วนั้นรุนแรงขึ้นอย่างมีนัยสำคัญ (HTML ดิบก็ข้าม schema นี้อยู่แล้วตั้งแต่ต้น) แต่เป็นปัญหาคนละเรื่องที่ต้องติดตามแยกต่างหาก
