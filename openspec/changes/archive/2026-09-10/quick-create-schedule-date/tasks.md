## 1. Schedule date after generate-plan

- [x] 1.1 แก้ `src/components/content/dialogs/QuickCreateDialog.tsx` — เพิ่ม helper คำนวณวันที่ปัจจุบันแบบ local-date-safe (`YYYY-MM-DD` จาก `getFullYear()/getMonth()/getDate()` ตรงๆ ไม่ใช้ `toISOString()`)
- [x] 1.2 ใน `handleCreate`: หลัง `generate-plan` สำเร็จและได้ `item.id` แล้ว เรียก `apiFetch('/brand-content.php?action=plan-item-date', { method: 'PUT', body: { item_id: item.id, scheduled_date: <วันนี้> } })` ก่อนเรียก `runResearch()`
- [x] 1.3 ห่อการเรียกนี้ด้วย try/catch แยกของตัวเอง — catch แล้วไม่ throw ต่อ ไม่เปลี่ยน `step` กลับ `'form'` ปล่อยให้ flow ไปต่อที่ `runResearch()` ตามปกติ
- [x] 1.4 ถ้า `plan-item-date` catch error: แสดง toast แจ้งผู้ใช้ทันที (แยกจาก toast สำเร็จ/ล้มเหลวหลักของการสร้าง content) ว่าสร้าง content สำเร็จแต่ยังไม่ได้กำหนดวันที่ ให้ไปตั้งเองภายหลังได้

## 2. Tests

- [x] 2.1 เพิ่ม test case ใน `src/__tests__/content/QuickCreateDialog.scheduleDate.test.tsx` (ไฟล์ใหม่ — มี `mockApi` ของตัวเองต่างจาก `.directMode.test.tsx`) ครอบคลุม: (a) generate-plan สำเร็จ → เรียก `plan-item-date` ด้วย `item_id` ถูกต้องและ `scheduled_date` เป็นวันปัจจุบัน ยืนยันด้วย spy ว่า `toISOString()` ไม่ถูกเรียกเลย (ไม่ใช้ fake timers เพราะชนกับ RTL `waitFor`) (b) เรียก `plan-item-date` ก่อน `action=fetch` (research) เสมอ (c) `plan-item-date` ล้มเหลว → `runResearch`/generate ยังถูกเรียกต่อตามปกติ ไม่ throw ทำให้ step กลับไป form (d) `plan-item-date` ล้มเหลว → มี toast แจ้งเตือนเฉพาะเรื่องวันที่แยกออกมา ไม่ใช่ toast ล้มเหลวหลัก (e) `plan-item-date` สำเร็จ → ไม่มี toast แจ้งเตือนเรื่องวันที่ — เพิ่ม `if (u.includes('action=plan-item-date')) return { updated: true };` ใน `mockApi()` ของ `.directMode.test.tsx` และ `.research.test.tsx` ที่มีอยู่แล้ว เพื่อไม่ให้ path ใหม่ตกไป error path เงียบๆ ในการรันปกติ
- [x] 2.2 รัน `pnpm lint` ให้ผ่าน
- [x] 2.3 รัน `pnpm test` ให้ผ่านทั้งหมด (รวม test ใหม่และ regression suite เดิม โดยเฉพาะ `QuickCreateDialog.*.test.tsx` ทั้งสองไฟล์ที่มีอยู่แล้ว)

## 3. Verification

- [x] 3.1 เปิด dev server จริง สร้าง content ผ่าน Quick Create แล้วตรวจสอบด้วย DB query และเปิด ContentPlannerCalendar — ยืนยันแล้ว: `plan-item-date` ยิงสำเร็จ (200 OK) ทันทีหลัง `generate-plan`, DB แสดง `scheduled_date = 2026-09-10` (วันที่ทดสอบจริง), item ปรากฏในวันที่ 10 บน Calendar grid ไม่ตกไปอยู่ใน unscheduled bucket, dialog จบด้วย "สร้างสำเร็จ!" ไม่มี toast แจ้งปัญหาเรื่องวันที่ (เพราะสำเร็จ), ไม่มี PHP error ใหม่ในช่วงเวลาทดสอบ
- [x] 3.2 ตรวจสอบว่า Batch mode และ legacy Content Plan mode ไม่ได้รับผลกระทบ — ยืนยันด้วย `git status`/diff ว่าไม่มีการแก้ไฟล์อื่นนอกเหนือ `QuickCreateDialog.tsx` และไฟล์ test ใหม่/ที่แก้เพิ่ม
