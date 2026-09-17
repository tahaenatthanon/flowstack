## Context

ไดอะล็อกสร้าง/แก้ไขแคมเปญ (`CampaignsPage.tsx`, section "เนื้อหาอีเมล") ใช้ Radix `Tabs` สองแท็บ "แก้ไข" (`ArticleEditor`) และ "ตัวอย่าง" (iframe) โดยไม่ได้ส่ง `forceMount` ให้ `TabsContent` — พฤติกรรม default ของ Radix คือ unmount panel ที่ไม่ active ออกจาก DOM ทันทีที่สลับแท็บ

`ArticleEditor` (`src/components/content/ArticleEditor.tsx`) ผูก Tiptap's `onUpdate` ไว้ดังนี้:

```ts
onUpdate({ editor }) {
  if (!editor.isFocused) return;
  requestAnimationFrame(() => onChange(editor.getHTML()));
},
```

การ defer ผ่าน `requestAnimationFrame` มีไว้เพื่อเลี่ยง React warning "setState-in-render" (ตามคอมเมนต์เดิมในไฟล์) แต่สร้างช่องว่างเวลาระหว่างคีย์สโตรกสุดท้ายกับตอนที่ `campaignBody` (state ของ parent) ถูกอัปเดตจริง ถ้าในช่วงเวลานั้นผู้ใช้คลิกแท็บ "ตัวอย่าง" — React unmount `TabsContent value="edit"` ทันทีแบบ synchronous ซึ่งทำให้ `ArticleEditor` unmount และ Tiptap `editor.destroy()` ถูกเรียกก่อนที่ `requestAnimationFrame` ที่ค้างอยู่จะทำงาน พอเฟรมถัดไปมาถึง callback ยังยิงอยู่ (เพราะ `requestAnimationFrame` เป็น browser-level ไม่ใช่ React effect) แต่ `editor.getHTML()` บน instance ที่ destroy แล้วคืนค่า HTML ว่าง/stale กลับมา → `onChange('')` เขียนทับ `campaignBody` เดิม เนื้อหาที่เพิ่งพิมพ์หายถาวร (ยืนยันจากการรีโปรดิวซ์จริง — ไม่มี error ใน console เพราะ `getHTML()` ไม่ throw)

บั๊กนี้เป็นคนละกลไกจากบั๊กที่เคยแก้ไปในการเปลี่ยนแปลงก่อนหน้า (`fix-article-editor-setcontent-bug`, เก็บถาวรแล้ว) ซึ่งแก้ทิศทาง prop `html` → editor (การ sync เข้า) ส่วนบั๊กนี้เป็นทิศทางตรงข้าม editor → `onChange` (parent state) ที่ถูก unmount แซงคิว

## Goals / Non-Goals

**Goals:**
- เนื้อหาที่พิมพ์ใน "เนื้อหาอีเมล" ต้องไม่สูญหายไม่ว่าจะสลับแท็บ "แก้ไข"/"ตัวอย่าง" เร็วแค่ไหน
- แก้ที่ต้นเหตุ (การ unmount กะทันหันระหว่างมี update ค้างอยู่) ไม่ใช่แค่ปิดอาการเฉพาะหน้า

**Non-Goals:**
- ไม่แก้บั๊ก double header/footer เมื่อเลือก template (`buildEmailPreviewHtml` ไม่มี guard เช็ค `<html>`) — เป็นบั๊กคนละจุด แยกเป็น change อื่น
- ไม่แก้ปัญหาเนื้อหาล้นขวาเมื่อกรอบ preview แคบกว่า 600px — เป็นเรื่อง responsive sizing แยกต่างหาก
- ไม่เปลี่ยนพฤติกรรม `isFocused` guard ที่มีอยู่แล้ว (กันไม่ให้ transaction เริ่มต้นของ Tiptap ยิง onChange ปลอมตอน remount) — ยังจำเป็นอยู่และไม่เกี่ยวกับบั๊กนี้โดยตรง

## Decisions

### Decision 1: ให้ `TabsContent` ทั้งสองแท็บใช้ `forceMount` แล้วซ่อนด้วย CSS แทนการ unmount
เปลี่ยนจาก Radix default (unmount panel ที่ไม่ active) เป็น mount ค้างไว้ทั้งคู่ตลอดเวลาที่ไดอะล็อกเปิดอยู่ แล้วซ่อน panel ที่ไม่ active ด้วย CSS (`data-[state=inactive]:hidden` ซึ่ง Radix ใส่ attribute `data-state` ให้อยู่แล้วโดยไม่ต้องเขียน state เพิ่มเอง)

**ผลคือ** `ArticleEditor` จะไม่ถูก destroy ระหว่างสลับแท็บอีกต่อไป — ตัดปัญหา race condition ที่ต้นเหตุโดยตรง ไม่ต้องพึ่งจังหวะของ `requestAnimationFrame` เทียบกับ unmount timing เลย

**ทางเลือกที่พิจารณาแล้วไม่เลือกเป็นทางหลัก:**
- *เปลี่ยน `onChange` ใน `onUpdate` จาก deferred (`requestAnimationFrame`) เป็น sync ตรงๆ* — แก้ที่อาการได้เหมือนกัน แต่คอมเมนต์เดิมในไฟล์ระบุว่า defer ไว้เพื่อเลี่ยง "setState-in-render" warning จาก React โดยเฉพาะ การเอาออกตรงๆ เสี่ยงเอา warning class เดิมกลับมาในบางเส้นทาง (เช่น `onUpdate` ที่ยิงระหว่าง React กำลัง render parent) จึงเก็บไว้เป็นการเสริมความทนทาน (Decision 2) แทนที่จะเป็นทางแก้หลัก
- *เพิ่ม cleanup effect ใน `ArticleEditor` ให้ flush `onChange(editor.getHTML())` ก่อน `editor.destroy()`* — ช่วยกรณี unmount ทั่วไปได้ แต่ลำดับการทำงานระหว่าง React cleanup effect กับ `requestAnimationFrame` ที่ค้างอยู่ไม่การันตี 100% ข้ามเบราว์เซอร์/เวอร์ชัน React จึงเลือกเป็นมาตรการเสริม ไม่ใช่ทางแก้หลัก

### Decision 2: เสริมความทนทาน — flush เนื้อหาก่อน `editor.destroy()` ใน cleanup effect
นอกจาก Decision 1 (ตัดการ unmount จาก Tabs) ให้เพิ่ม cleanup ใน `ArticleEditor` ที่ unmount ทุกกรณี (เช่น ปิดไดอะล็อกทั้งบานกะทันหันระหว่างพิมพ์ ซึ่ง Decision 1 ไม่ได้ครอบคลุม) ให้เรียก `onChange(editor.getHTML())` แบบ sync ก่อน `editor.destroy()` เพื่อไม่ให้มี update ค้างหายไปเงียบๆ ในกรณีอื่นนอกเหนือจากสลับแท็บ

## Risks / Trade-offs

- **[Risk]** `forceMount` ทำให้ทั้ง editor และ iframe preview mount พร้อมกันตลอดเวลาที่ไดอะล็อกเปิด (ไม่ใช่แค่ตอน active) → เพิ่ม DOM/งานเรนเดอร์เล็กน้อย **[Mitigation]** ไดอะล็อกนี้เปิดครั้งละไม่นานและมีแค่ 2 แท็บเสมอ ผลกระทบด้าน performance ไม่มีนัยสำคัญ
- **[Risk]** เพิ่ม flush-on-unmount (Decision 2) อาจเรียก `onChange` (ซึ่งคือ `setCampaignBody` ของ parent) หลังจาก parent component เองก็กำลังจะ unmount ไปด้วย (เช่น ปิดทั้งไดอะล็อก) → เสี่ยง React warning เรื่อง setState หลัง unmount **[Mitigation]** React 18+ ไม่ throw ให้กรณีนี้ (แค่ no-op เงียบๆ) และ Decision 1 ลดความถี่ที่ cleanup effect นี้จะถูกเรียกระหว่างพิมพ์อยู่ไปมากแล้ว (เหลือแค่กรณีปิดไดอะล็อกทั้งบาน ซึ่งไม่ใช่ path หลักที่ผู้ใช้เจอบั๊กนี้)
- **[Risk]** การเปลี่ยน `TabsContent` เป็น `forceMount` ต้องตรวจสอบว่าไม่กระทบ layout/style อื่นที่พึ่งพาว่า panel ที่ไม่ active จะไม่อยู่ใน DOM (เช่น CSS selector บางตัว หรือ event listener ที่ query DOM แบบกว้าง) **[Mitigation]** ตรวจโค้ดใน section นี้ระหว่าง implement ว่าไม่มี logic อื่นสมมติฐานแบบนั้นอยู่ก่อนเปลี่ยน

## Migration Plan

- เป็นการแก้โค้ด frontend ล้วน ไม่มี database migration ไม่มี breaking change ต่อ API
- Deploy ตามรอบ build ปกติ (`pnpm build`)
- ทดสอบด้วยมือก่อนปิดงาน: เปิดไดอะล็อกสร้างแคมเปญ → พิมพ์เนื้อหา → คลิกแท็บ "ตัวอย่าง" ทันที (ไม่รอ) → สลับกลับแท็บ "แก้ไข" → ยืนยันเนื้อหายังอยู่ครบ ทำซ้ำหลายรอบติดกัน
- Rollback: revert commit เดียว ไม่มี state เปลี่ยนแปลงถาวรฝั่ง backend/DB ให้ต้อง rollback เพิ่ม

## Open Questions

- มีหน้าอื่นที่ใช้ `ArticleEditor` ร่วมกับ `Tabs` แบบเดียวกันหรือไม่ (นอกจาก `CampaignsPage.tsx`) — ถ้ามีควรพิจารณาว่า fix เดียวกันควรครอบคลุมด้วยหรือแยก change ใหม่ (ต้องสำรวจระหว่าง implement ตาม tasks.md)
