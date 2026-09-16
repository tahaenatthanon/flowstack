## Context

`ArticleEditor.tsx` ใช้ Tiptap (`@tiptap/react@3.23.6`) เป็น rich-text editor เดียวกันทั้งสำหรับเขียนบทความคอนเทนต์และแก้ไขเนื้อหาแคมเปญอีเมล มี 2 จุดที่เรียก `editor.commands.setContent(x, false)` เพื่อ sync เนื้อหาเข้า editor แบบ "เงียบๆ" (ไม่ต้องการให้ยิง `onChange` กลับไปหา parent เพราะเนื้อหานั้นมาจาก parent เองอยู่แล้ว — sync กลับไปจะวนลูป/เขียนทับสิ่งที่ผู้ใช้เพิ่งเลือก):

1. [ArticleEditor.tsx:147](../../../src/components/content/ArticleEditor.tsx) — sync เมื่อ `html` prop เปลี่ยนจากภายนอก (เช่น หลังเลือก email template หรือหลัง AI generate เนื้อหาเสร็จ)
2. [ArticleEditor.tsx:206](../../../src/components/content/ArticleEditor.tsx) — sync เมื่อออกจาก source mode (โหมดแก้ HTML ดิบ)

Tiptap v2 ใช้ signature `setContent(content, emitUpdate?: boolean)` — `false` แปลว่าไม่ยิง `onUpdate`. Tiptap v3 เปลี่ยนเป็น `setContent(content, options?: { emitUpdate?: boolean })` โดย `emitUpdate` default เป็น `true` (ยืนยันจาก type declaration ในแพ็กเกจที่ติดตั้งจริง `node_modules/.pnpm/@tiptap+core@3.23.6.../dist/index.d.ts`) โค้ดปัจจุบันยังส่ง `false` (boolean) ตาม syntax เก่า ซึ่งไม่ตรงกับ signature ใหม่ (ไม่ error เพราะ TypeScript มองว่าเป็น `options` ที่เป็น falsy — runtime ไม่ throw แต่ destructure `emitUpdate` จาก `false` ได้ `undefined` แล้ว fallback เป็น default `true`) ผลคือ `onUpdate` ยิงทุกครั้งที่ไม่ตั้งใจ

## Goals / Non-Goals

**Goals:**
- แก้ให้ `setContent` ทั้ง 2 จุดไม่ยิง `onUpdate`/`onChange` เมื่อ sync เนื้อหาแบบโปรแกรม ตรงตาม intent เดิมของโค้ด
- เนื้อหาที่ตั้งค่าจากภายนอก (เลือก template, AI generate, ออกจาก source mode) ต้องอยู่ตรงกับที่ set ไว้ จนกว่าผู้ใช้จะแก้ไขเองจริงๆ ผ่านการพิมพ์ใน editor

**Non-Goals:**
- ไม่แก้ปัญหาที่ตัว editor (แท็บ "แก้ไข") **แสดงผล** พื้นหลังสีของ email template ไม่ได้ — เป็นข้อจำกัดของ Tiptap schema เอง (ไม่รองรับ `<body>`/`<td style="background-color">`) คนละปัญหากับบั๊กนี้ ไม่อยู่ใน scope ของการแก้ครั้งนี้
- ไม่เปลี่ยนพฤติกรรม toggle เลือก/ยกเลิก template ที่มีอยู่แล้ว (`email-campaign-template-picker` requirement เดิม)

## Decisions

### 1. แก้ตรงจุด: เปลี่ยน `false` → `{ emitUpdate: false }` ทั้ง 2 จุด
**ทำไม:** เป็น API migration mismatch ตรงไปตรงมา ไม่ต้องเปลี่ยน logic หรือ architecture ใดๆ — แค่ปรับ syntax ให้ตรงกับ `SetContentOptions` ของ Tiptap v3 ที่ติดตั้งอยู่จริง
**ทางเลือกที่ตัดออก:** เขียน wrapper function ครอบ `setContent` ทุกจุดในโปรเจกต์ที่อาจเรียกแบบเดียวกัน — เกินความจำเป็นเพราะ grep ทั้งโปรเจกต์แล้วมีแค่ 2 จุดนี้ที่เรียก `setContent` แบบ silent sync

### 2. `enterSourceMode()`: ใช้ `html` (prop) แทน `editor.getHTML()` เป็นค่าเริ่มต้นของ source view
**พบระหว่าง implement:** ทดสอบเลือก template ที่มีพื้นหลังสี (Elegant Purple) แล้วกดปุ่ม "HTML Source" (`</>`) เข้า/ออก โดยไม่แก้ไขอะไร — สีพื้นหลังหายไปจริง ทั้งที่แก้บั๊ก #1 แล้ว
**สาเหตุ:** `enterSourceMode()` เดิมเรียก `setSourceHtml(editor.getHTML())` — `editor.getHTML()` serialize จาก schema ภายในของ Tiptap (Table/TableCell extension) ซึ่งไม่เก็บ inline `style` ที่ schema ไม่รู้จัก (เช่น `background:linear-gradient(...)`) อยู่แล้ว **ก่อน** ที่ `exitSourceMode()` จะเขียนกลับ (`exitSourceMode` เรียก `onChange(sourceHtml)` ตรงๆ ไม่ผ่าน `onUpdate` เลย จึงไม่เกี่ยวกับบั๊ก emitUpdate) — ข้อมูลเสียหายตั้งแต่ตอน "เข้า" source mode ไม่ใช่ตอน "ออก"
**ทางแก้:** เปลี่ยนเป็น `setSourceHtml(html)` (ใช้ prop `html` ที่รับมาจาก parent ตรงๆ) เพราะ:
- ถ้าผู้ใช้ยังไม่เคยพิมพ์แก้ไขอะไรใน editor เลย (กรณีตรงบั๊กนี้) — `html` prop ยังคงเป็นต้นฉบับที่ไม่ผ่าน schema ของ Tiptap เลย ไม่มีการสูญเสียสไตล์
- ถ้าผู้ใช้พิมพ์แก้ไขจริงมาก่อนแล้ว — `onUpdate` จะ sync `html` prop ให้ตรงกับ `editor.getHTML()` อยู่แล้วผ่าน `onChange` (ดู `onUpdate` callback บรรทัด 136-139) ทำให้ `html === editor.getHTML()` ในเคสนี้ การเปลี่ยนมาใช้ `html` จึงให้ผลเหมือนเดิมทุกประการ ไม่ใช่ behavior change สำหรับกรณีที่มีการแก้ไขจริง
**ทางเลือกที่ตัดออก:** ขยาย Tiptap TableCell/Table extension ให้เก็บ arbitrary `style` attribute ทุกตัว (parseHTML/renderHTML ครอบ) — แก้ปัญหาได้กว้างกว่า (จะช่วยเรื่องแสดงผลในแท็บ "แก้ไข" ด้วย) แต่เป็นการเปลี่ยน schema ระดับ extension ที่กระทบทุกที่ที่ใช้ตาราง เสี่ยงสูงกว่ามาก และไม่จำเป็นสำหรับเป้าหมายของ change นี้ (แค่ไม่ให้ข้อมูลเสียหาย ไม่ใช่ทำให้แท็บ "แก้ไข" แสดงสีได้)

### 3. เช็ค `editor.isFocused` ใน `onUpdate` แทนที่จะยิง `onChange` ทุกครั้ง
**พบระหว่าง implement:** ทดสอบสลับแท็บ "แก้ไข" ↔ "ตัวอย่าง" ไปมาหลายรอบ (ไม่แตะ source mode เลย) แล้วสีพื้นหลังหายไปเองหลังสลับไปมาสักพัก — เกิดเป็นระยะ (intermittent) ไม่ใช่ทุกครั้ง ทำให้วินิจฉัยยากกว่าจุดอื่น
**สาเหตุ:** ไดอะล็อกสร้างแคมเปญใช้ Radix `Tabs` ซึ่ง **unmount เนื้อหาของแท็บที่ไม่ active ออกจริง** (ยืนยันด้วย `childCount: 0` ตอนเช็ค DOM) ไม่ใช่แค่ซ่อนด้วย CSS — พอสลับกลับไปแท็บ "แก้ไข" `ArticleEditor` (และ `useEditor` ข้างใน) จะ**สร้าง editor instance ใหม่ทุกครั้ง** ด้วย `content: html` (ค่า pristine ณ ขณะนั้น) Tiptap จะยิง `onUpdate` ให้กับ transaction ที่ตั้งค่า content เริ่มต้นนี้เสมอ (คนละ code path จาก `commands.setContent` เลยไม่ถูกคุมด้วย `emitUpdate` ที่แก้ไปแล้วในข้อ 1) แต่ callback ถูก defer ด้วย `requestAnimationFrame` จึงไม่เห็นผลทันทีในการเช็คแบบเร่งรีบ (คลิกสลับแท็บเร็วๆ ต่อกันโดยไม่รอ paint จริงจะไม่เจอบั๊กนี้ — เป็นเหตุผลที่การ reproduce ครั้งแรกๆ ไม่คงเส้นคงวา)

**ลองผิดมาก่อน (ถูก revert):** ครั้งแรกลองเพิ่ม `skipNextUpdateRef` ข้าม `onUpdate` "ครั้งแรกหลังสร้าง editor" แบบไม่มีเงื่อนไข — พังคนละเคส: ถ้า editor เริ่มจากเนื้อหาว่างเปล่า (`html=''`, กรณี dialog เพิ่งเปิดยังไม่เลือก template) Tiptap **ไม่ยิง** synthetic update ตัวนี้เลย (ไม่มีอะไรต้อง normalize) ทำให้ `onUpdate` ครั้งแรกที่แท้จริงคือคีย์บอร์ดตัวแรกที่ผู้ใช้พิมพ์เอง — โดน guard นี้กินไปด้วย เท่ากับตัวอักษรแรกที่พิมพ์หายไปเงียบๆ (ทดสอบยืนยันจริงว่าเกิดปัญหานี้ก่อนแก้) ลองต่อด้วยการเทียบ `editor.getText()` ที่จับไว้ตอน `onCreate` กับตอน `onUpdate` (ข้อความเหมือนกัน = แค่ normalize, ไม่เหมือนกัน = แก้ไขจริง) แต่การเรียก `editor.getText()` ข้างใน `onCreate` กลับทำให้ทั้ง editor พังจริง (`TypeError: Cannot read properties of null (reading 'cached')` จาก internal ของ Tiptap/ProseMirror) — เข้าใจว่า schema ยังไม่ finalize พอให้เรียกใช้งานได้ตอนนั้น

**ทางแก้ (ใช้จริง):** เช็ค `editor.isFocused` ใน `onUpdate` แทน — ถ้ายังไม่ focus ให้ `return` ทันทีโดยไม่เรียก `onChange` เพราะ transaction สังเคราะห์ที่ตั้งค่า content เริ่มต้นเกิด**ก่อน**ที่ผู้ใช้จะมีโอกาสคลิกเข้าไปในกล่องข้อความด้วยซ้ำ (ไม่มี `autofocus` ตั้งไว้ใน extensions) ในขณะที่การพิมพ์จริงทุกครั้งต้อง focus ก่อนเสมอ — ไม่ต้องเก็บ ref หรือเรียก editor method ใดๆ ก่อน schema พร้อม ปลอดภัยกว่าทั้ง 2 วิธีที่ลองมาก่อน ทดสอบยืนยันแล้วว่าแก้ทั้ง 2 เคส (พิมพ์ทันทีในกล่องว่าง ↔ สลับแท็บไปมาโดยไม่แก้ไขอะไร)
**ทางเลือกที่ตัดออก:** บังคับให้ Radix Tabs ไม่ unmount แท็บที่ไม่ active (`forceMount` + ซ่อนด้วย CSS เอง) — แก้ที่ต้นเหตุ (ป้องกันการสร้าง editor ใหม่ไปเลย) แต่ต้องแก้ที่ `CampaignsPage.tsx` เฉพาะจุดที่ใช้ Tabs คู่นี้ ไม่ครอบคลุมกรณีอื่นที่อาจ mount/unmount `ArticleEditor` ซ้ำในอนาคต (เช่นถ้ามีหน้าอื่นทำ conditional render) เลือก fix ที่ตัว `ArticleEditor` เองเพราะป้องกันปัญหาเดียวกันได้ทุกจุดที่ใช้ component นี้ ไม่ผูกกับวิธีที่ parent จัดการการแสดงผล

## Risks / Trade-offs

- **[Risk]** อาจมีโค้ดที่อื่นในโปรเจกต์เรียก Tiptap command แบบ v2 syntax คล้ายกันที่ยังไม่เจอ → **Mitigation**: grep `\.setContent\(` ทั้ง `src/` พบ 3 จุด — 2 จุดใน `ArticleEditor.tsx` ที่มีบั๊กนี้ (ตั้งใจส่ง `false` เพื่อ suppress update แต่ syntax ผิด) และอีก 1 จุดใน `RichTextEditor.tsx:76` (`setContent(value)` ไม่ส่ง options เลย ไม่ได้ตั้งใจ suppress update ตั้งแต่ต้น จึงไม่ใช่บั๊กแบบเดียวกัน ไม่อยู่ใน scope การแก้ครั้งนี้)
- **[Risk]** การแก้นี้แก้ได้แค่ "ข้อมูลไม่ถูกเขียนทับ" แต่แท็บ "แก้ไข" ยังโชว์พื้นขาวระหว่างแก้ไข อาจทำให้ผู้ใช้เข้าใจผิดว่ายังไม่ได้แก้ → **Mitigation**: สื่อสารกับผู้ใช้ชัดเจนว่าให้ดูสีจริงผ่านแท็บ "ตัวอย่าง" ระหว่างที่ยังไม่ได้ทำเรื่องแสดงผลของ editor เอง (แยก scope)

## Migration Plan

ไม่มี — เป็นการแก้โค้ด frontend ล้วนๆ ไม่มี database migration ไม่ต้อง deploy พิเศษ deploy พร้อม build ปกติได้เลย
