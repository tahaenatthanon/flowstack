## 1. Quick Create confirmation

- [x] 1.1 ใน `QuickCreateDialog.tsx` import `useConfirm` จาก `@/hooks/useConfirm`
- [x] 1.2 เขียนฟังก์ชันสรุปข้อความยืนยัน (หัวข้อ, ประเภท, แพลตฟอร์มที่เลือก, สไตล์/รูปแบบตาม content type) จากค่า state ปัจจุบันของฟอร์ม
- [x] 1.3 เพิ่มฟังก์ชัน `handleConfirmAndCreate` ที่เรียก `confirm({ title, description, confirmLabel: 'ยืนยันและสร้าง' })` แล้วเรียก `handleCreate()` ต่อเมื่อผลลัพธ์เป็น `true`; ถ้า `false`/`undefined` ไม่ทำอะไรต่อ (ฟอร์มยังอยู่ที่ step 'form')
- [x] 1.4 เปลี่ยนปุ่ม "สร้าง{บทความ/วีดีโอสคริปต์}" ให้เรียก `handleConfirmAndCreate` แทน `handleCreate` ตรงๆ
- [x] 1.5 ตรวจว่า `handleCreate` เดิมไม่ถูกแก้ไข logic ภายใน (ยังทำงานเหมือนเดิมทุกจุดเมื่อถูกเรียกหลังยืนยัน)

## 2. Content Planner AI panel confirmation

- [x] 2.1 ใน `ContentPlannerPage.tsx` เขียนฟังก์ชันสรุปข้อความยืนยัน (คำสั่ง/หัวข้อ, ประเภทแผนแปลไทย, ช่วงวันที่เริ่ม-สิ้นสุด, แพลตฟอร์มที่เลือกหรือ "ทั้งหมด") จาก `params` ที่ `handleGenerate` รับเข้ามา
- [x] 2.2 เพิ่ม `if (!(await confirm({ title: 'ยืนยันสร้างแผนคอนเทนต์ด้วย AI', description, confirmLabel: 'ยืนยันและสร้างแผน' }))) return;` เป็นบรรทัดแรกสุดของ `handleGenerate` ก่อน `setGenerating(true)`
- [x] 2.3 ตรวจว่าเมื่อกดยกเลิก ไม่มีการเรียก `apiFetch('/brand-content.php?action=generate-plan', ...)` และไม่มีการตั้ง `generating`/`generatingArticles` เป็น true (ยืนยันด้วยเทสต์ในข้อ 4.2)

## 3. แก้เทสต์เดิมที่จะพังจากการเพิ่ม confirm gate (ต้องทำก่อนรัน pnpm test)

**เหตุผล**: เทสต์ปัจจุบันทั้งหมด mock `apiFetch` เต็มรูปแบบเพื่อ "ไม่เสีย credit" อยู่แล้ว (ดู docblock ของ `ContentPlannerPage.researchSeed.test.tsx`) — แต่หลังเพิ่ม confirm gate เทสต์เหล่านี้จะพัง 2 แบบถ้าไม่แก้ก่อน:

- [x] 3.1 `src/__tests__/content/ContentPlannerPage.researchSeed.test.tsx:29` — แก้ `vi.mock('@/hooks/useConfirm', ...)` จาก `confirm: vi.fn()` เป็น `confirm: vi.fn().mockResolvedValue(true)` ไม่งั้น `handleGenerate` (ถูกเรียกตรงๆ ที่บรรทัด 166, 197) จะ return ตั้งแต่ต้นเพราะ mock เดิมคืน `undefined`
- [x] 3.2 `src/__tests__/content/QuickCreateDialog.directMode.test.tsx`, `QuickCreateDialog.research.test.tsx`, `QuickCreateDialog.scheduleDate.test.tsx` — เพิ่ม `vi.mock('@/hooks/useConfirm', () => ({ useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true) }) }));` ในแต่ละไฟล์ (ทั้ง 3 ไฟล์ render `<QuickCreateDialog>` แบบไม่มี `<ConfirmProvider>` ครอบ — ถ้าไม่ mock ตัว hook จะ throw `useConfirm must be used within <ConfirmProvider>` ทันทีตอน render)
- [x] 3.3 รัน `pnpm test` ยืนยันว่าเทสต์เดิมทั้งหมดผ่านหลังแก้ 3.1-3.2 (29 test files / 198 tests ผ่านทั้งหมด)

## 4. เทสต์ใหม่สำหรับ confirm gate เอง (mock ทั้งหมด ไม่เสีย credit)

- [x] 4.1 เพิ่มเทสต์ใน `QuickCreateDialog.confirmGate.test.tsx` (ไฟล์ใหม่) ที่ **ไม่ mock** `useConfirm` แต่ครอบ render ด้วย `<ConfirmProvider>` จริง (ตามแบบ `WorkflowInstanceCard.test.tsx`) ยืนยันครบทั้ง 3 เคส: เห็นกล่องยืนยันก่อนยิง, ยกเลิกแล้วไม่เรียก `generate-plan` + ฟอร์มยังอยู่ครบ, ยืนยันแล้วเรียก `generate-plan` ตามปกติ
- [x] 4.2 เพิ่มเทสต์ใน `ContentPlannerPage.confirmGate.test.tsx` (ไฟล์ใหม่) ที่ไม่ mock `useConfirm` และไม่ mock `ContentPlannerAI` (ต่างจาก `.researchSeed.test.tsx`) ครอบด้วย `<ConfirmProvider>` จริง คลิกปุ่ม "สร้างแผนด้วย AI" จริงผ่าน UI ยืนยันครบทั้ง 3 เคสเดียวกัน
- [x] 4.3 ทั้งหมดในกลุ่มนี้ mock `@/lib/api` (`apiFetch`) เต็มรูปแบบ ไม่มี network request จริงหลุดออกไปแตะ backend/AI provider — ยืนยันด้วยการอ่าน mock implementation เอง (throw/return ไม่มี pass-through ไป fetch จริง)

## 5. Manual verification (จำกัดเฉพาะสิ่งที่ไม่มีต้นทุน — ห้ามคลิกยืนยันจริงเพื่อทดสอบซ้ำๆ)

**หลักการ**: การยืนยันว่า "หลังกดยืนยันแล้ว generation ทำงานตามปกติ" ครอบคลุมด้วยเทสต์ mock ในข้อ 4 แล้ว ไม่ต้องพิสูจน์ซ้ำด้วยมือแบบเสียเงินจริง — verification ด้วยมือทำแค่เส้นทาง "ยกเลิก" ซึ่งไม่ยิง request ใดๆ เลย

- [x] 5.1 รัน `pnpm lint` และ `pnpm test` ให้ผ่านทั้งหมด (0 errors, 47 warning เดิมที่ไม่เกี่ยวกับไฟล์ที่แก้; 29 test files / 198 tests ผ่าน)
- [x] 5.2 Quick Create ด้วยมือ (ทำจริงบน `localhost:8080` ด้วย session ที่ผู้ใช้ล็อกอินให้): กรอกหัวข้อ "ทดสอบ confirm gate — ห้ามสร้างจริง" → กดปุ่ม "สร้างบทความ" → เห็นกล่องยืนยัน "ยืนยันสร้างบทความ" พร้อมสรุปหัวข้อ/แพลตฟอร์ม (Facebook)/สไตล์ (😊 กันเอง) ตรงกับฟอร์มเป๊ะ → เช็ค network requests ไม่มี `generate-plan` เลย → กด **ยกเลิก** → กล่องปิด ฟอร์มเดิมยังอยู่ครบ (topic input ยังมีข้อความเดิม, platform/tone ที่เลือกไว้ยังอยู่) → เช็ค network requests อีกครั้งหลังยกเลิก ยังคงไม่มี `generate-plan` เลยตลอดทั้งขั้นตอน
- [x] 5.3 Content Planner AI panel ด้วยมือ (ทำจริงบน `localhost:8080`): กรอกคำสั่ง "ทดสอบ confirm gate แผน — ห้ามสร้างจริง" → กดปุ่ม "สร้างแผนด้วย AI" → เห็นกล่องยืนยัน "ยืนยันสร้างแผนคอนเทนต์ด้วย AI" พร้อมสรุปคำสั่ง/ประเภทแผน (รายเดือน)/ช่วงวันที่ (2026-09-01 ถึง 2026-09-30)/แพลตฟอร์ม (ทั้งหมด) และข้อความเตือนเรื่อง AI กำหนดจำนวนโพสต์เอง ตรงกับที่ออกแบบไว้เป๊ะ → เช็ค network requests ไม่มี `generate-plan` → กด **ยกเลิก** → กล่องปิด ปุ่ม "สร้างแผนด้วย AI" กลับสู่สถานะปกติ (ไม่เข้า loading state) จำนวนแผนทั้งหมดยังเป็น 50 เท่าเดิม (ไม่มีแผนใหม่ถูกสร้าง) → เช็ค network requests อีกครั้ง ยังคงไม่มี `generate-plan` เลย
- [x] 5.4 สร้างจริง 1 ครั้งต่อจุด (ผู้ใช้อนุมัติให้เสีย credit จริงหลังถามราคาโดยประมาณแล้ว):
  - **Quick Create**: สร้างจริงสำเร็จสมบูรณ์ — หัวข้อ "ทดสอบ 5.4 sanity check QuickCreate - ลบได้" ผ่านครบทั้ง 3 step (ค้นข้อมูล → วิเคราะห์ → เขียนบทความ), `generate-article` ตอบ 200 OK, ได้ผลลัพธ์เป็นบทความจริง ("How is sanity testing different from regression testing?") ยืนยันว่า `handleCreate` เดิมทำงานถูกต้องสมบูรณ์หลังผ่าน confirm gate
  - **Content Planner AI panel**: ระหว่างรัน (สร้างแผนสำเร็จ + เริ่มเขียนบทความ 1/3) ผู้ใช้สั่งยกเลิกกลางคัน — เนื่องจาก **การยกเลิกจริงระหว่าง progress ไม่ได้อยู่ในขอบเขต change นี้** (ตามที่ระบุใน Non-Goals ของ [design.md](design.md)) จึงไม่มีปุ่ม/กลไกให้หยุดกลางคันได้จริง สิ่งที่ทำได้คือ navigate ออกจากหน้าทันทีเพื่อตัด client-side loop ไม่ให้เริ่ม item ที่ 2/3 ต่อ — ตรวจสอบใน DB แล้วพบว่า research job ของ item แรกทำเสร็จ (เสีย credit ส่วนนั้นไปแล้ว) แต่ `generate-article` ยังไม่ทันเริ่ม/เขียนผลลัพธ์ (content_items = 0 แถวสำหรับแผนนี้) — flow เดิมที่ทันได้รันจึงถือว่าทำงานถูกต้องเท่าที่มีโอกาสพิสูจน์ (สร้างแผน + เริ่ม research สำเร็จ)
  - **Cleanup**: ลบทั้ง 2 แผนทดสอบผ่านปุ่ม "ลบ" ในหน้าจริง (เรียก `DELETE /brand-content.php?action=plans&id=` ที่ cascade ลบ content_items + content_plan_items + content_plans) ยืนยันด้วย query DB โดยตรงว่าไม่เหลือร่องรอยทั้งสองแผนแล้ว (`SELECT ... WHERE title LIKE '%5.4 sanity%'` และ `content_items WHERE title LIKE '%sanity testing%'` คืนค่า 0 แถวทั้งคู่)
- [x] 5.5 ตรวจด้วยตาว่า Batch สร้างคอนเทนต์ (`BatchGenerateDialog`) และบันทึกการ์ดคอนเทนต์มือ (`ContentCardDialog`) ยังมีปุ่ม/พฤติกรรมเดิมทุกประการ — ยืนยันด้วย `git status` แล้วว่าทั้งสองไฟล์ไม่ถูกแก้ไขเลยในการเปลี่ยนแปลงนี้
