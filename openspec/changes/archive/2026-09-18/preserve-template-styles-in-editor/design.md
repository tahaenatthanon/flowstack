## Context

`ArticleEditor` ([src/components/content/ArticleEditor.tsx](../../../src/components/content/ArticleEditor.tsx)) เป็น TipTap/ProseMirror editor — ตัว editor นี้ parse HTML ที่รับเข้ามาผ่าน schema ของตัวเอง (`extensions` array ที่ `useEditor()`) แล้วทุกครั้งที่มีการแก้ไข (`onUpdate`) จะ re-serialize กลับเป็น HTML ผ่าน `editor.getHTML()` — attribute หรือ element ใดก็ตามที่ schema ไม่ได้ประกาศไว้จะถูกตัดทิ้งในรอบ re-serialize นี้ ไม่ใช่แค่ตอน parse ครั้งแรก

ปัจจุบัน (ก่อนการแก้ไขนี้) มีแค่ 2 จุดที่ patch ให้เก็บ `style` attribute ไว้ ผ่าน pattern `keepStyleAttribute` ที่มีอยู่แล้วในไฟล์ ([ArticleEditor.tsx:19-38](../../../src/components/content/ArticleEditor.tsx:19)):
- `StyledParagraph` (`.extend()` จาก `Paragraph`)
- `StyledLink` (`.extend()` จาก `Link`)

เหตุผลเดิมที่ patch แค่ 2 จุดนี้ (ตาม comment ในโค้ด) คือเพื่อให้ปุ่ม CTA ที่ toolbar "แทรกปุ่มลิงก์ในอีเมล" แทรกเข้ามา ยังคงหน้าตาเป็นปุ่มได้ (พึ่งพา style บน `<a>` และ `text-align:center` บน `<p>` ที่ห่ออยู่) — ไม่ได้ตั้งใจให้ครอบคลุม template ทั้ง 20 แบบที่ใช้ `<table>`/`<td>`/`<h1>`-`<h4>` เป็นหลักในการใส่สี

## Goals / Non-Goals

**Goals:**
- แก้ไขข้อความใน template ใดก็ตาม (ทั้ง 20 แบบ) แล้วสี/พื้นหลัง/ขอบที่ผูกกับ `<table>`, `<tr>`, `<td>`, `<th>`, `<h1>`-`<h4>` ต้องไม่หายไปหลังแก้ไข
- เพิ่มการรองรับ `<div>` (พร้อม `style`) เพื่อให้วงกลมไอคอนตกแต่งใน template-5/template-12 รอดจากการแก้ไขด้วย
- ใช้ pattern เดียวกับที่มีอยู่แล้วในไฟล์ (`keepStyleAttribute`) หรือ pattern ที่ดีกว่าแต่ยังสอดคล้องกับโครงสร้างเดิม ไม่ใช่การเขียนกลไกใหม่คนละแบบ

**Non-Goals:**
- ไม่ทำ HTML sanitization/allowlist สำหรับค่า `style` (แยกเป็นงานความปลอดภัยต่างหาก — `api/email-utils.php` ไม่มีการกรอง HTML เลยก่อนส่งอีเมลอยู่แล้วในปัจจุบัน ไม่ว่าจะทำ change นี้หรือไม่ และ "HTML Source" mode ของ editor ก็ข้าม schema นี้ไปเลยอยู่แล้ว งานนี้จึงไม่ทำให้ surface เสี่ยงเพิ่มขึ้นอย่างมีนัยสำคัญ)
- ไม่แก้ปัญหา header/footer ซ้อนกัน (แก้ไปแล้วใน `fix-campaign-email-duplicate-wrap`)
- ไม่เปลี่ยนเนื้อหา/โครงสร้างของ 20 template ใน `emailTemplates.ts`
- ไม่รับประกันว่า CSS ทุกรูปแบบ (เช่น `@media`, `animation`, CSS ที่ผูกกับ selector แทน inline style) จะรอดผ่าน editor — ขอบเขตนี้ครอบคลุมเฉพาะ `style` attribute แบบ inline ที่ template ทั้ง 20 แบบใช้จริงเท่านั้น

## Decisions

**Decision: ใช้ `addGlobalAttributes()` (built-in ของ TipTap) แทนการ `.extend()` ทีละ node แบบเดิม**

TipTap มี `Extension.create({ addGlobalAttributes() { return [{ types: [...], attributes: {...} }] } })` สำหรับเพิ่ม attribute เดียวกันให้หลาย node/mark type พร้อมกันในจุดเดียว

- ทางเลือกที่พิจารณา: ทำตาม pattern เดิมเป๊ะๆ คือ `.extend()` ทีละตัว (`StyledTableCell`, `StyledTableRow`, `StyledHeading`, ...) — ข้อดีคือสอดคล้องกับโค้ดเดิม 100% อ่านง่ายเพราะเห็นแพทเทิร์นซ้ำ แต่ข้อเสียคือต้องเขียนซ้ำ 5-6 รอบ และถ้ามี node ใหม่เพิ่มเข้ามาทีหลัง (เช่นอนาคตเพิ่ม extension อื่น) ต้องจำมา patch เพิ่มเองทุกครั้ง เสี่ยงตกหล่น
- **เลือก `addGlobalAttributes()`** เพราะประกาศ node types ที่ต้องการ (`table`, `tableRow`, `tableCell`, `tableHeader`, `heading`, `div` ที่จะเพิ่มใหม่) ไว้ในที่เดียว ลดโอกาสตกหล่น และเป็น API มาตรฐานของ TipTap ที่ออกแบบมาสำหรับ cross-cutting concern แบบนี้โดยเฉพาะ — ยังคงเรียกใช้ `keepStyleAttribute`-like logic (parseHTML/renderHTML) แบบเดียวกับที่มีอยู่ ไม่ได้เปลี่ยนกลไก แค่เปลี่ยนจุดประกาศ
- `StyledParagraph`/`StyledLink` ที่มีอยู่เดิม **ไม่ต้องแตะ** — ปล่อยไว้ตามเดิมเพื่อลดความเสี่ยงต่อพฤติกรรมปุ่ม CTA ที่ทำงานถูกต้องอยู่แล้ว extension ใหม่นี้เพิ่มเข้าไปเสริมเฉยๆ ไม่ทับซ้อนกับ 2 ตัวเดิม (คนละ node type)

**Decision: เพิ่ม `Div` เป็น custom node ใหม่ (ไม่มี official extension จาก TipTap)**

TipTap ไม่มี extension สำเร็จรูปชื่อ "Div" ให้ import ตรงๆ (มีแต่ `Paragraph` ซึ่งก็ render เป็น `<p>` ไม่ใช่ `<div>`) ต้องสร้างเป็น custom `Node.create()` เล็กๆ (คล้าย `Paragraph` แต่ render tag เป็น `div` แทน `p`, กำหนด `group: 'block'`, `content: 'inline*'` เพื่อให้ประกอบด้วย text/span ข้างในได้) แล้วใส่ `style` attribute ผ่าน `addGlobalAttributes()` เดียวกัน

- ทางเลือกที่พิจารณา: ไม่ทำเรื่อง `<div>` เลย ปล่อยให้ template-5/template-12 เสียวงกลมไอคอนไปเหมือนเดิม — ปฏิเสธ เพราะ proposal ระบุชัดว่าต้องการครอบคลุมกรณีนี้ด้วย (ข้อ 2 จากการคุยกับผู้ใช้)
- ความเสี่ยงของ custom node ใหม่: ต้องทดสอบว่า ProseMirror ไม่สับสนระหว่าง `<div>` ใหม่กับ `<p>` เดิมตอน parse (ทั้งคู่เป็น block-level) — ใช้ `parseHTML` ที่ระบุ tag `div` ชัดเจนแยกจาก `p` ของ `StyledParagraph` เพื่อไม่ให้ทับ priority กัน

**Decision: ไม่แตะ `api/email-utils.php` หรือ sanitization ใน change นี้**

ตามที่คุยกับผู้ใช้ไว้ — เรื่องนี้ถูกแยกเป็นงานต่างหาก (สร้าง background task suggestion ไว้แล้วนอก OpenSpec workflow) เพราะเป็นปัญหาคนละมิติ (security) ไม่ใช่ style fidelity การรวมสองเรื่องเข้าด้วยกันจะทำให้ scope ของ change นี้บวมเกินความจำเป็น

## Risks / Trade-offs

- [Risk] เพิ่ม `Div` node ใหม่อาจกระทบการ parse เนื้อหาบทความที่ใช้ `<div>` อยู่แล้วโดยไม่ตั้งใจ (เช่น เนื้อหาเก่าที่มี `<div>` ล้อมรอบจาก source ภายนอก) ทำให้พฤติกรรมการแสดงผลเปลี่ยนจากที่เคยถูก "แบน/ตัดทิ้ง" (unwrap เป็น text เปล่า) กลายเป็นคงโครงสร้าง `<div>` ไว้ → **การรับมือ**: เป็นการเปลี่ยนแปลงเชิงบวก (คง element ที่เคยหายไว้) ความเสี่ยงจึงเป็นแค่ "หน้าตาเปลี่ยนจากที่เคยชิน" ไม่ใช่ข้อมูลเสียหาย ควร spot-check หน้าบทความที่มีอยู่เดิมหลังแก้ไขเพื่อดูว่าไม่มี layout แปลกเกิดขึ้น
- [Risk] `addGlobalAttributes()` ใช้ `types` เป็น array ของชื่อ node/mark ตาม TipTap's internal name (เช่น `'tableCell'` ไม่ใช่ `'TableCell'`) — พิมพ์ชื่อผิดจะทำให้ patch เงียบๆ ไม่ error แต่ attribute ก็จะไม่ถูกเพิ่ม (fail silently) → **การรับมือ**: ทดสอบแบบ manual ทุก node type หลังแก้ (ดู Migration Plan) ไม่พึ่งแค่ type-check
- [Trade-off] ยังไม่ครอบคลุม CSS ที่ไม่ใช่ inline `style` (เช่นถ้า template ในอนาคตใช้ `<style>` block แทน inline style) — ยอมรับได้เพราะ template ทั้ง 20 แบบปัจจุบันใช้ inline style ล้วน ไม่มี `<style>` block เลย

## Migration Plan

1. แก้ [ArticleEditor.tsx](../../../src/components/content/ArticleEditor.tsx): เพิ่ม custom `Div` node, เพิ่ม `Extension.create({ addGlobalAttributes() {...} })` ครอบคลุม `table`, `tableRow`, `tableCell`, `tableHeader`, `heading`, `div` แล้วใส่เข้า `extensions` array ของ `useEditor()`
2. ทดสอบด้วยมือ: เลือก template ทั้ง 20 แบบทีละตัวในหน้าแคมเปญ → แก้ข้อความในแท็บ "แก้ไข" → ดูแท็บ "ตัวอย่าง" ว่าสี/วงกลมไอคอนยังอยู่ครบ (เร็วกว่าการส่งอีเมลจริงทุกตัว ใช้แท็บ "ตัวอย่าง" เป็นตัวเช็คหลัก แล้วสุ่มส่งจริง 2-3 template เพื่อยืนยันปลายทาง)
3. ทดสอบด้าน "ไม่กระทบของเดิม": เปิดหน้าบทความ ([ContentCardDialog.tsx](../../../src/components/content/ContentCardDialog.tsx)) สร้าง/แก้บทความที่มีอยู่แล้ว 2-3 ชิ้น ตรวจว่าไม่มี layout ผิดปกติจากการเพิ่ม `Div` node
4. รัน `pnpm lint` และ `pnpm build`

Rollback: การเปลี่ยนแปลงจำกัดอยู่ในไฟล์เดียว (`ArticleEditor.tsx`) ไม่มี migration ฐานข้อมูล ย้อนกลับได้ด้วยการ revert commit เดียว

## Open Questions

- ยังไม่ได้ทดสอบว่า `<div>` node ใหม่นี้จะส่งผลกับ toolbar ปุ่มอื่นๆ ที่อาจ assume ว่า block-level node มีแค่ paragraph/heading/table (เช่น ปุ่ม "แทรกปุ่มลิงก์ในอีเมล" ที่แทรก `<p>` ครอบ `<a>`) — ต้องตรวจตอน implement ว่าปุ่มเหล่านี้ยังทำงานถูกต้อง ไม่ได้เผลอไปแทรกเป็น `<div>` แทน
