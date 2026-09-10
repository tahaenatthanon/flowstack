## 1. เพิ่ม confirm gate ในปุ่ม "AI เขียนให้"

- [x] 1.1 ใน `ContentCardDialog.tsx` import `useConfirm` จาก `@/hooks/useConfirm`
- [x] 1.2 เขียนฟังก์ชันสรุปข้อความยืนยัน โดยใช้ `researchSeedTopic(existingItem.source_topic, topic)` เป็นหัวข้อที่แสดง (ต้องตรงกับ seed ที่ `handleAI` ใช้จริง ไม่ใช่ `topic` เฉยๆ) และ `platforms` ที่เลือกไว้
- [x] 1.3 เพิ่มฟังก์ชัน wrapper (เช่น `handleConfirmAndAI`) ที่เช็ค guard เดิม (`!topic.trim() || !existingItem?.id`) ก่อน แล้วเรียก `confirm({ title: 'ยืนยันให้ AI เขียนเนื้อหา', description, confirmLabel: 'ยืนยันและให้ AI เขียน' })` แล้วเรียก `handleAI()` ต่อเมื่อผลลัพธ์เป็น `true`; ถ้า `false`/`undefined` ไม่ทำอะไรต่อ
- [x] 1.4 เปลี่ยนปุ่ม "AI เขียนให้" ([ContentCardDialog.tsx:837](../../../src/components/content/ContentCardDialog.tsx)) ให้เรียก wrapper แทน `handleAI` ตรงๆ — `disabled={!topic.trim() || aiGenerating}` เดิมไม่เปลี่ยน
- [x] 1.5 ตรวจว่า `handleAI` เดิมไม่ถูกแก้ไข logic ภายในเลย (ยังทำงานเหมือนเดิมทุกจุดเมื่อถูกเรียกหลังยืนยัน)

## 2. แก้เทสต์เดิมที่จะพังจากการเพิ่ม confirm gate (ต้องทำก่อนรัน pnpm test)

**เหตุผล**: มี 3 ไฟล์เทสต์ที่ render `<ContentCardDialog>` จริงโดยไม่มี `<ConfirmProvider>` ครอบ — พอ component เรียก `useConfirm()` ตรงๆ จะ throw `useConfirm must be used within <ConfirmProvider>` ทันทีตอน render ทุกเทสต์ในไฟล์นั้นพังหมดทันที (ไม่ใช่แค่เทสต์ที่คลิกปุ่ม AI)

- [x] 2.1 `src/__tests__/content/ContentCardDialogResearch.test.tsx` — เพิ่ม `vi.mock('@/hooks/useConfirm', () => ({ useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true) }) }));` (ไฟล์นี้คลิก "AI เขียนให้" จริงในทุก `it()` ต้อง resolve `true` ให้ flow เดิมทำงานต่อ)
- [x] 2.2 `src/__tests__/content/ContentCardDialogScripts.test.tsx` — เพิ่ม mock เดียวกัน (ไฟล์นี้ไม่ได้คลิกปุ่ม AI แต่ยัง render dialog จริง ต้อง mock กันพังตอน render)
- [x] 2.3 `src/__tests__/content/ContentCardDialogPlatforms.test.tsx` — เพิ่ม mock เดียวกัน ด้วยเหตุผลเดียวกับ 2.2
- [x] 2.4 รัน `pnpm test` ยืนยันว่าเทสต์เดิมทั้งหมดผ่านหลังแก้ 2.1-2.3 (30 test files / 201 tests ผ่านหมด)

## 3. เทสต์ใหม่สำหรับ confirm gate เอง (mock apiFetch เต็มรูปแบบ ไม่เสีย credit)

- [x] 3.1 เพิ่มไฟล์เทสต์ใหม่ (เช่น `ContentCardDialogConfirmGate.test.tsx`) ที่ **ไม่ mock** `useConfirm` แต่ครอบ render ด้วย `<ConfirmProvider>` จริง (ตามแบบ `QuickCreateDialog.confirmGate.test.tsx` / `ContentPlannerPage.confirmGate.test.tsx` ในการเปลี่ยนแปลงก่อนหน้า) ยืนยันครบ:
  - กดปุ่ม "AI เขียนให้" → เห็นข้อความยืนยันที่มีหัวข้อ (research seed ที่ถูกต้อง ไม่ใช่ topic ที่แก้ในฟอร์ม) และแพลตฟอร์มตรงกับที่เลือก, `apiFetch` ยังไม่ถูกเรียกด้วย `action=fetch`
  - กดปุ่มยกเลิกในกล่องยืนยัน → `apiFetch` ไม่ถูกเรียกด้วย `content-research.php?action=fetch` เลย และ `aiGenerating` ไม่ถูกตั้งเป็น true (ปุ่ม "AI เขียนให้" ไม่เข้า loading state)
  - กดปุ่มยืนยันในกล่อง → `apiFetch` ถูกเรียกด้วย `action=fetch` ตามปกติ (ตรวจแค่ว่าเรียกถูก ไม่ต้องรอ mock ให้ resolve เป็นเนื้อหาจริงเกินความจำเป็น)
- [x] 3.2 mock `@/lib/api` (`apiFetch`) เต็มรูปแบบตามแบบเทสต์เดิมในกลุ่มนี้ — ห้ามมี network request จริงหลุดออกไปแตะ backend/AI provider (เทสต์ใหม่ 3 เคสผ่านหมด รวมกับข้อ 2 เป็น 30 test files / 201 tests)

## 4. Manual verification (จำกัดเฉพาะสิ่งที่ไม่มีต้นทุน — ห้ามคลิกยืนยันจริงเพื่อทดสอบซ้ำๆ)

**หลักการ**: เหมือน change `confirm-before-content-create` — พิสูจน์ "หลังกดยืนยันแล้ว flow เดิมทำงานตามปกติ" ด้วยเทสต์ mock ในข้อ 3 พอ ไม่ต้องเสียเงินจริงซ้ำ; verification ด้วยมือทำแค่เส้นทางยกเลิกซึ่งไม่ยิง request ใดๆ

- [x] 4.1 รัน `pnpm lint` และ `pnpm test` ให้ผ่านทั้งหมด (0 errors, 47 warning เดิมที่ไม่เกี่ยวกับไฟล์ที่แก้; 30 test files / 201 tests ผ่าน)
- [x] 4.2 ทดสอบด้วยมือบน `localhost:8080` จริง `/content-planner` (คลิกวันที่ 9 ก.ย. ในปฏิทิน → เปิด ContentCardDialog ของ item ที่มีอยู่แล้ว) → กดปุ่ม "AI เขียนให้" → เห็นกล่องยืนยัน "ยืนยันให้ AI เขียนเนื้อหา" สรุปหัวข้อ (research seed) และแพลตฟอร์ม Facebook ตรงกับของจริง → เช็ค network requests ไม่มี `content-research.php` เลย → กด **ยกเลิก** → ปุ่มกลับสู่สถานะปกติ ("AI เขียนให้" ไม่ใช่ loading) → เช็ค network requests อีกครั้ง ยังคงไม่มี `content-research.php` เลยตลอดขั้นตอน
- [x] 4.3 ทดสอบด้วยมือบน `localhost:8080` จริง `/content` แท็บ "ผลงานทั้งหมด" (คลิกการ์ด "ก้าวล้ำไปอีกขั้น KTNBS DocCapture AI Auto-Labeling" → เปิด ContentCardDialog จาก `ContentListTab` — คนละ parent จาก 4.2) → ทำซ้ำเหมือน 4.2 ทุกขั้นตอน → ผลลัพธ์เหมือนกันเป๊ะ ไม่มี regression จาก parent ที่ต่างกัน
- [x] 4.4 (ไม่บังคับ ต้องขอ sign-off ก่อนเสมอเพราะเสีย credit จริง) — **ข้ามโดยเจตนาตามคำสั่งผู้ใช้** (ยอมรับ automated test coverage ในข้อ 3 + manual cancel-path verification ในข้อ 4.2/4.3 แทน ไม่ต้องเสีย credit AI จริงเพื่อพิสูจน์ซ้ำ): เส้นทาง "กดยกเลิก" พิสูจน์แล้วด้วยมือจริง (ไม่เสียเงิน); เส้นทาง "กดยืนยันแล้ว flow เดิมทำงานถูกต้อง" พิสูจน์แล้วด้วยเทสต์ mock ในข้อ 3.1 (ก็ไม่เสียเงิน) — ไม่มี live end-to-end sanity check แบบเสียเงินจริงเกิดขึ้นในการ apply นี้
- [x] 4.5 ตรวจด้วย `git status` แล้วว่า `ContentPlannerPage.tsx`, `ContentListTab.tsx`, `ContentDetailView.tsx` และปุ่ม "บันทึก" ของ `ContentCardDialog` ไม่ถูกแตะเลย — มีแค่ `ContentCardDialog.tsx` (ใส่ confirm gate) และไฟล์เทสต์ที่เกี่ยวข้องเปลี่ยนแปลง
