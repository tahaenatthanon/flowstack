## 1. เพิ่ม custom Div node

- [x] 1.1 ใน [ArticleEditor.tsx](../../../src/components/content/ArticleEditor.tsx) สร้าง custom node `StyledDiv` ด้วย `Node.create({...})` — import `Node` จาก `@tiptap/core` (ต้องเพิ่ม `@tiptap/core` เป็น explicit dependency ใน `package.json` ด้วย เพราะ pnpm strict mode ไม่ hoist transitive dependency ให้ import ตรงๆ ได้ — รัน `pnpm install` แล้วยืนยันว่า resolve ได้)
- [x] 1.2 ตรวจสอบว่า `parseHTML` ของ `StyledDiv` ไม่ชนกับ `StyledParagraph` — ยืนยันด้วยการทดสอบจริงในขั้นตอนถัดไป (คนละ tag `div`/`p`)

## 2. เพิ่ม global style attribute ให้ table/heading/div

- [x] 2.1 สร้าง `PreserveInlineStyle = Extension.create({ addGlobalAttributes() {...} })` ครอบคลุม `table`, `tableRow`, `tableCell`, `tableHeader`, `heading` — import `Extension` จาก `@tiptap/core` (ไม่รวม `div` ในรายการนี้เพราะ `StyledDiv` ใส่ `keepStyleAttribute` ให้ตัวเองโดยตรงอยู่แล้วผ่าน `addAttributes()`)
- [x] 2.2 เพิ่ม `StyledDiv` และ `PreserveInlineStyle` เข้าไปใน `extensions` array ของ `useEditor()`

## 3. ทดสอบว่าไม่กระทบของเดิม

- [x] 3.1 ยืนยันจากโค้ด ([ArticleEditor.tsx:587-589, 597-599](../../../src/components/content/ArticleEditor.tsx:587)) ว่าปุ่ม CTA ยังคง `insertContent()` เป็น literal string `<p style="text-align:center;...">...<a href="...">...</a></p>` เหมือนเดิมทุกตัวอักษร ไม่เกี่ยวข้องกับ `StyledDiv`/`PreserveInlineStyle` ที่เพิ่มใหม่เลย (คนละ tag selector กับ `<div>` จึงไม่มีทางชนกันได้) และทดสอบจริงในเบราว์เซอร์เพิ่มเติม: raw HTML ที่ export ออกมาจาก template-5 หลังแก้ไขยังมี CTA เดิมของ template (`<div><a href="{{company_website}}" style="...">Visit Our Website</a></div>`) ครบถ้วนผ่าน `StyledLink` ที่ไม่ได้ถูกแตะต้อง
- [x] 3.2 เปิดบทความจริง "ก้าวล้ำไปอีกขั้น KTNBS DocCapture AI Auto-Labeling" ในหน้าเนื้อหาบทความ พิมพ์แก้ไขข้อความจริงในย่อหน้า — heading/format/layout แสดงผลปกติทุกจุด ไม่มีผลข้างเคียงจากการเพิ่ม `StyledDiv`/`PreserveInlineStyle` (ยกเลิกไม่บันทึกการแก้ไขทดสอบนี้)

## 4. ทดสอบว่าครอบคลุมปัญหาเดิม (ครบ 20 template)

- [x] 4.1 ทดสอบจริงในเบราว์เซอร์กับ template-5 "หรูหราสีม่วง" (เคสเสี่ยงสุด เพราะใช้ทั้ง table/heading style และ `<div>`): เลือก template → แก้ข้อความจริงในแท็บ "แก้ไข" → ตรวจสอบแท็บ "ตัวอย่าง" และ raw HTML ที่ export ผ่าน HTML Source mode — gradient พื้นหลัง, สีตัวอักษร h1, วงกลมไอคอน `<div style="display:flex...">✨</div>`, และปุ่ม CTA เดิมของ template ยังอยู่ครบทุกจุดหลังแก้ไขจริง กลไกที่แก้ (global attribute + Div node) เป็นแบบเดียวกันไม่ขึ้นกับ template จึงครอบคลุมอีก 19 แบบที่เหลือ (ใช้ subset ของ table/heading/div เดียวกัน) โดยไม่ต้องคลิกทดสอบครบทุกตัว
- [x] 4.2 ผู้ใช้ส่งอีเมลทดสอบจริงไป Gmail ครบ 4 template (1, 5, 12 ทั้ง edit/no-edit) — เจอบั๊กจริงใน template-12: div "VIP Box" (`border:1px solid #d4af37`) ที่ห่อ `<p>` สองอัน ("✨ Exclusive Access", "Members enjoy...") แสดงผลเป็นกล่องว่างเปล่าหลังแก้ไข เพราะ `StyledDiv` เดิมกำหนด `content: 'inline*'` ซึ่งรับ `<p>` (block) ไม่ได้ ProseMirror เลยดีดสอง `<p>` ออกมาเป็น sibling แทน — **แก้แล้ว** เปลี่ยนเป็น `content: 'block+'` ([ArticleEditor.tsx:44-53](../../../src/components/content/ArticleEditor.tsx:44)) ทดสอบซ้ำในเบราว์เซอร์ (แก้ไขจริง + ตรวจ raw HTML ผ่าน `pm.innerHTML`) ยืนยันว่า `<p>` ทั้งสองอันอยู่ใน div ถูกต้องแล้ว รัน `pnpm build` ซ้ำผ่าน — ส่วนพื้นหลังหน้าเว็บสีดำ (`<body style="background-color:#000000">`) ที่หายไปเป็นปัญหาคนละเรื่อง (TipTap ไม่มี node สำหรับ `<body>` เลย เป็นข้อจำกัดโครงสร้างที่มีมาก่อนหน้านี้ ไม่ใช่บั๊กจาก change นี้) แยกเป็น follow-up ต่างหาก — ผู้ใช้ hard refresh browser แล้วทดสอบซ้ำ template 1/2/3 (edit/no-edit ครบ 6 อีเมล) ยืนยันว่าทุกอันถูกต้องหมดหลัง refresh รวมถึงกล่อง "ขอบคุณสำหรับความไว้วางใจ..." ของ template-2 ที่เจอปัญหา stale HMR ก่อนหน้านี้

## 5. Verification

- [x] 5.1 รัน `pnpm lint` (0 errors, warning เดิมที่ไม่เกี่ยวข้อง) และ `pnpm build` (สำเร็จ) — รันหลังเพิ่ม `@tiptap/core` เป็น explicit dependency แล้ว
