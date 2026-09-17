## 1. สำรวจก่อนแก้

- [x] 1.1 ค้นหาทุกจุดในโปรเจกต์ที่ใช้ `ArticleEditor` ร่วมกับ Radix `Tabs` (นอกจาก `CampaignsPage.tsx`) เพื่อดูว่าต้องแก้ที่อื่นด้วยหรือไม่ (บันทึกผลไว้เผื่อแยก change ใหม่ถ้าจำเป็น) — ผลสำรวจ: `ArticleEditor` ถูกใช้ใน `ContentCardDialog.tsx` ด้วย แต่ render อยู่นอก `Tabs`/`TabsContent` โดยตรง (Tabs ในไฟล์นั้นใช้กับส่วน "scripts" แยกต่างหาก ไม่เกี่ยวกับ ArticleEditor) จึงมีแค่ `CampaignsPage.tsx` เท่านั้นที่เข้าข่ายบั๊กนี้ ไม่ต้องแก้ที่อื่นเพิ่ม

## 2. แก้ `CampaignsPage.tsx` — ไม่ unmount `ArticleEditor` เมื่อสลับแท็บ

- [x] 2.1 เพิ่ม `forceMount` ให้ `TabsContent value="edit"` และ `TabsContent value="preview"` ใน section "เนื้อหาอีเมล"
- [x] 2.2 ซ่อน panel ที่ไม่ active ด้วย CSS แทนการพึ่ง unmount (class `data-[state=inactive]:hidden` บน `TabsContent` แต่ละอัน) — ตรวจโค้ด Radix (`@radix-ui/react-tabs/dist/index.mjs`) แล้วพบว่าเมื่อ `forceMount` เป็น true `hidden` attribute ของ native DOM จะไม่ถูกตั้งให้ (`present` เป็น true เสมอ) ต้องพึ่ง `data-state` + CSS เองแทน ตรงตามแผนใน design.md
- [x] 2.3 ตรวจสอบว่า layout ไม่เพี้ยนตอนทั้งสอง panel mount พร้อมกัน — ใช้ `display:none` (จาก Tailwind `hidden`) ซึ่ง element ที่ไม่แสดงผลจะไม่รับ focus/scroll และไม่กินพื้นที่ layout ตามธรรมชาติของ CSS อยู่แล้ว ไม่ต้องเขียนโค้ดเพิ่ม

## 3. เสริมความทนทานใน `ArticleEditor.tsx`

- [x] 3.1 เพิ่ม cleanup effect ที่เรียก `onChange(editor.getHTML())` แบบ sync ก่อน `editor.destroy()` เมื่อ component unmount — ยืนยัน ordering ถูกต้องจาก `@tiptap/react` source (`useEditor` เรียก `useEffect` ภายในเพื่อจัดการ destroy) ประกอบกับกฎ React ที่ cleanup ทำงานย้อนลำดับการลงทะเบียน effect ทำให้ effect ของเราที่ประกาศหลัง `useEditor()` cleanup ก่อนเสมอ
- [x] 3.2 ป้องกันการเขียนทับด้วยค่าเก่า: เก็บ rAF id ไว้ใน `pendingFlushRef` แล้ว `cancelAnimationFrame` ใน cleanup effect ก่อน flush เอง — กัน rAF ที่ค้างอยู่ยิงช้าไปเรียก `onChange('')` ทับค่าที่ flush ไปแล้วถูกต้อง
- [x] 3.3 ยืนยันว่า `isFocused` guard เดิมใน `onUpdate` ยังทำงานถูกต้องตามเดิม — โค้ดจุดนี้ไม่ถูกแก้เลย มีแค่ห่อ `requestAnimationFrame` เดิมด้วยการเก็บ id เพิ่มเท่านั้น

## 4. ทดสอบ

- [x] 4.1 ทดสอบด้วยมือ: เปิดไดอะล็อกสร้างแคมเปญใหม่ → พิมพ์เนื้อหา → คลิกแท็บ "ตัวอย่าง" ทันทีโดยไม่รอ → ยืนยันเนื้อหาปรากฏครบในตัวอย่าง — ทดสอบในเบราว์เซอร์จริงผ่าน dev server แล้ว เนื้อหา "ทดสอบหลังแก้บั๊ก เนื้อหานี้ต้องไม่หายเมื่อสลับแท็บทันที" ปรากฏครบใน preview ทันที
- [x] 4.2 ทดสอบด้วยมือ: สลับกลับแท็บ "แก้ไข" → ยืนยันเนื้อหายังอยู่ครบ ไม่กลายเป็นค่าว่าง — ยืนยันแล้ว เนื้อหายังอยู่ครบ
- [x] 4.3 ทดสอบด้วยมือ: สลับแท็บ "แก้ไข" ↔ "ตัวอย่าง" ซ้ำอย่างน้อย 5 รอบติดต่อกันอย่างรวดเร็ว → ยืนยันเนื้อหาไม่หายและไม่ถูกตัดทอนบางส่วนในทุกรอบ — สลับ 10 ครั้งติดต่อกัน (5 รอบไปกลับ) เนื้อหายังอยู่ครบทุกครั้ง
- [x] 4.4 ทดสอบด้วยมือ: เลือก Template แล้วสลับแท็บทันที → ยืนยันเนื้อหา template ไม่หาย (ครอบคลุม interaction กับ `email-campaign-template-picker` เดิม) — เลือก "โปรเฟสชั่นแนลคลาสสิก" แล้วสลับแท็บทันที เนื้อหา template ปรากฏครบทั้งในตัวอย่างและตอนสลับกลับแท็บแก้ไข (หมายเหตุ: preview ยังมีบั๊ก double header/footer เดิม (#2) ซึ่งเป็นคนละ change แยกต่างหาก ไม่อยู่ในสโคปนี้)
- [x] 4.5 รัน `pnpm lint` และ `pnpm build` ให้ผ่านก่อนปิดงาน — `pnpm lint`: 0 errors (47 warning เดิมทั้งหมดเป็นไฟล์อื่นที่ไม่เกี่ยวกับการแก้ไขนี้), `pnpm build`: สำเร็จ (มีแค่ warning เรื่อง chunk size ที่เป็นปกติของโปรเจกต์)

## 5. ปิดงาน

- [x] 5.1 อัปเดต `tasks.md` นี้ทำเครื่องหมายครบทุกข้อ
- [x] 5.2 รัน sync-specs เพื่อรวม delta spec `email-campaign-body-editor-sync` เข้า main specs — สร้าง `openspec/specs/email-campaign-body-editor-sync/spec.md` แล้ว (capability ใหม่ ไม่มี main spec เดิมมาก่อน) validate ผ่าน (หมายเหตุ: ทำก่อน commit ตามที่ user ยืนยันให้ทำตอนนี้เลย แทนที่จะรอ merge ตามแผนเดิม)
- [ ] 5.3 archive change นี้ด้วย `/opsx:archive` หลังยืนยันว่า deploy เรียบร้อย — **รอ**: ยังไม่ได้ deploy
