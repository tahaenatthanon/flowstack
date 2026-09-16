## Why

เลือก email template ที่มีพื้นหลังสี (เช่น Elegant Purple, Business Pro) ในไดอะล็อกสร้าง/แก้ไขแคมเปญ แล้วสีพื้นหลังหายไปทันที ไม่ต้องพิมพ์อะไรเลย — ตรวจสอบพบว่าเป็นบั๊กจาก `ArticleEditor.tsx` เรียก `editor.commands.setContent(html, false)` ตาม API ของ Tiptap v2 (boolean parameter ตัวที่ 2 = emitUpdate) แต่โปรเจกต์ใช้ Tiptap v3 จริง ซึ่งเปลี่ยน parameter ตัวที่ 2 เป็น object `{ emitUpdate?: boolean }` (default `true`) การส่ง `false` (boolean) เข้าไปจึงไม่มีผล ทำให้ `emitUpdate` ใช้ค่า default คือ `true` และยิง `onUpdate` → `onChange(editor.getHTML())` เขียนทับเนื้อหาด้วย HTML ที่ผ่าน schema ของ Tiptap (ตัดสไตล์พื้นหลังที่ schema ไม่รู้จักทิ้ง) ทุกครั้งที่มีการ sync เนื้อหาแบบโปรแกรม ไม่ใช่แค่ตอนผู้ใช้พิมพ์แก้ไขเอง

ผลกระทบเกิดกับทุกจุดที่เรียก `setContent(x, false)`: เลือก template ใหม่, ออกจาก source mode (ปุ่มดู/แก้ HTML ดิบ), และ sync เนื้อหาหลัง AI generate เนื้อหาจริงที่บันทึก/ส่งไปยังผู้รับเสียหายถาวรตั้งแต่ตอนนั้น ไม่ใช่แค่ตัว editor แสดงผลผิด

## What Changes

- แก้ `editor.commands.setContent(html, false)` เป็น `editor.commands.setContent(html, { emitUpdate: false })` ให้ตรงกับ Tiptap v3 API (จุดที่ 1: sync เนื้อหาเมื่อ `html` prop เปลี่ยนจากภายนอก)
- แก้ `editor.commands.setContent(sourceHtml, false)` เป็น `editor.commands.setContent(sourceHtml, { emitUpdate: false })` เช่นกัน (จุดที่ 2: ออกจาก source mode)
- **เพิ่มเติมจากที่พบระหว่าง implement:** แก้ `enterSourceMode()` ให้ใช้ `html` (prop ต้นทางที่ยังไม่ผ่านการ round-trip เข้า schema ของ Tiptap) แทน `editor.getHTML()` — เพราะ `editor.getHTML()` เป็นการ serialize จาก schema ภายในของ Tiptap เอง (Table/TableCell) ซึ่งตัดทิ้ง inline style ที่ schema ไม่รู้จัก (เช่น `background:linear-gradient(...)`) อยู่แล้วตั้งแต่จุดนี้ ไม่เกี่ยวกับบั๊ก `emitUpdate` เลย — เป็นอีกจุดหนึ่งที่ทำให้สไตล์หายเมื่อกดปุ่มดู/แก้ HTML ดิบ (source mode) แล้วออกมา
- **เพิ่มเติมอีกจุด (พบระหว่างทดสอบสลับแท็บ "แก้ไข"/"ตัวอย่าง" ไปมา):** ใน `onUpdate` ของ `ArticleEditor` เพิ่มเงื่อนไขให้ทำงานเฉพาะตอน `editor.isFocused === true` เท่านั้น — Tiptap ยิง `onUpdate` หนึ่งครั้งให้กับ transaction ที่ตั้งค่า `content` เริ่มต้นตอนสร้าง/remount editor เสมอ (ถึงจะยังไม่มีใครแก้ไขอะไรเลย) ซึ่งเป็นคนละ code path จาก `commands.setContent` เลยไม่ถูกคุมด้วย `emitUpdate` — พอ dialog สร้างแคมเปญ (ใช้ Radix Tabs) unmount/remount `ArticleEditor` ทุกครั้งที่สลับแท็บ "แก้ไข"/"ตัวอย่าง" editor instance ใหม่จะสร้างพร้อม `content: html` ที่ยังคง pristine ทุกครั้ง แล้วยิง `onUpdate` ครั้งแรกนี้ *ก่อน* ผู้ใช้จะมีโอกาสคลิกเข้าไปในกล่องข้อความเลยด้วยซ้ำ (deferred ผ่าน `requestAnimationFrame` เลยไม่เห็นผลทันที) เขียนทับด้วย HTML ที่ผ่าน schema (ตัดสไตล์) กลับเข้า `campaignBody` โดยไม่มีใครแก้ไขอะไรจริงเลย — เช็ค `isFocused` แยกแยะ transaction สังเคราะห์นี้ (เกิดก่อนโฟกัส) จากการพิมพ์จริงของผู้ใช้ (ต้องโฟกัสก่อนถึงพิมพ์ได้) ได้ถูกต้องกว่าการเดา "ข้าม onUpdate ครั้งแรกเสมอ" ซึ่งพลาดกรณี editor เริ่มจากเนื้อหาว่างเปล่าแล้วผู้ใช้พิมพ์ทันที (ดู design.md decision 3 สำหรับรายละเอียดที่ลองผิดมาก่อนเจอวิธีนี้)
- ไม่เปลี่ยน logic อื่นใดของ `ArticleEditor` — เป็นการแก้ syntax parameter + จุดอ้างอิงข้อมูลต้นทางให้ถูกต้องเท่านั้น

## Capabilities

### New Capabilities

(ไม่มี)

### Modified Capabilities

- `email-campaign-template-picker`: เพิ่ม requirement ว่าการเลือก template ต้องไม่ทำให้เนื้อหา (`campaignBody`) ถูกแก้ไขเพิ่มเติมโดยอัตโนมัติหลังจากตั้งค่าเริ่มต้นแล้ว (เนื้อหาต้องตรงกับ HTML ต้นฉบับของ template จนกว่าผู้ใช้จะพิมพ์แก้ไขเอง)

## Impact

- **ไฟล์ที่แก้:** `src/components/content/ArticleEditor.tsx` (2 บรรทัด)
- **ผลกระทบ:** ทุกจุดที่ใช้ `ArticleEditor` — หน้าสร้าง/แก้ไขแคมเปญอีเมล (`CampaignsPage.tsx`) เป็นจุดที่กระทบชัดเจนที่สุด (email template ส่วนใหญ่มีพื้นหลังสี/สไตล์ที่ Tiptap schema ไม่รองรับ) และหน้าเขียนบทความคอนเทนต์ที่ใช้ `ArticleEditor` เดียวกัน (ผลกระทบน้อยกว่าเพราะเนื้อหาบทความมักไม่มีสไตล์พื้นหลังซับซ้อนแบบอีเมล)
- ไม่มี database migration, ไม่มี breaking change ต่อ API
