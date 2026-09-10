## Context

`QuickCreateDialog.tsx` (`handleCreate`) เรียก `generate-plan` (Direct mode) แล้วต่อด้วย `runResearch()` ทันที ไม่เคยเรียก `action=plan-item-date` เลย — item ที่สร้างจึงมี `scheduled_date=null` เสมอ (`content_plan_scheduled_date($isDirect=true, ...)` คืน `null` เป็นค่าปกติสำหรับ Direct mode ตาม `api/lib/content-plan-prompt.php`) `BatchGenerateDialog.tsx` มี pattern เดียวกันที่ต้องทำอยู่แล้ว แต่มีความต่างสำคัญ: Batch มี input "เริ่มวันที่" ที่ผู้ใช้เลือกเอง ส่วน QuickCreate ไม่มี date field ใดๆ ในฟอร์มเลย (ตัดสินใจแล้วในขั้น explore ว่าจะไม่เพิ่ม เพื่อรักษาความเร็ว/ความเรียบง่ายของ Quick Create)

เพิ่มเติม: ระหว่างสำรวจพบว่า `BatchGenerateDialog.tsx` เองมี inconsistency แฝง — comment บรรทัด 45 เตือนว่าห้ามใช้ `toISOString()` เพราะแปลงเป็น UTC ทำให้วันที่เพี้ยนถอยหลัง 1 วันในโซนเวลา ICT (UTC+7) แต่ `startDate` initializer (บรรทัด 57, 86) กลับใช้ `toISOString().split('T')[0]` อยู่ดี — ผลกระทบใน Batch ต่ำเพราะผู้ใช้เห็นวันที่ pre-fill ก่อนกดยืนยัน แต่ QuickCreate ไม่มีขั้นตอนให้เห็นวันที่เลย ต้องไม่ copy pattern ที่ผิดนี้มาใช้

Scope ของ change นี้จำกัดที่ `QuickCreateDialog.tsx` ไฟล์เดียว (ตัดสินใจไว้ในขั้น explore) — ไม่แตะ backend หรือ `BatchGenerateDialog.tsx`

## Goals / Non-Goals

**Goals:**
- Content item ที่สร้างผ่าน Quick Create ได้ `scheduled_date` เป็นวันปัจจุบัน (local date) โดยอัตโนมัติ ไม่ต้องให้ผู้ใช้เลือก
- การเรียก `plan-item-date` ต้องไม่ทำให้ทั้ง flow (generate → research → generate-article) ล้มเหลวถ้ามันเองล้มเหลว
- ผู้ใช้ต้องรู้ทันทีถ้าการตั้งวันที่ล้มเหลว (ไม่ใช่ silent failure) แต่ content ที่สร้างสำเร็จแล้วต้องไม่ถูกนับเป็นความล้มเหลวของทั้งการสร้าง
- ไม่กระทบพฤติกรรมเดิมของ Batch mode หรือ legacy Content Plan mode

**Non-Goals:**
- ไม่เพิ่ม date picker หรือ UI ใดๆ ให้ QuickCreateDialog (Option B จากขั้น explore)
- ไม่แก้ inconsistency ของ `toISOString()` ใน `BatchGenerateDialog.tsx` ที่พบระหว่างสำรวจ (นอก scope ของ change นี้ — เป็นไฟล์อื่น)
- ไม่แก้ backend `action=plan-item-date` (ใช้งานร่วมกับ Batch ได้อยู่แล้ว ไม่ต้องเปลี่ยน)
- ไม่ทำให้ผู้ใช้เลือกวันที่เองได้จาก QuickCreateDialog — ถ้าต้องการวันอื่น ต้องไปแก้ทีหลังผ่าน Calendar/List/ContentCardDialog ตามปกติ

## Decisions

### 1. คำนวณวันที่ปัจจุบันแบบ local-date-safe ไม่ใช้ `toISOString()`
ใช้ `getFullYear()/getMonth()/getDate()` ประกอบ string `YYYY-MM-DD` ตรงๆ (รูปแบบเดียวกับ `topicScheduledDateISO`/`toDateKey` ที่ใช้อยู่แล้วในไฟล์อื่นของโปรเจกต์) แทนการ copy `new Date().toISOString().split('T')[0]` จาก `BatchGenerateDialog.tsx` — เพราะ QuickCreate ไม่มีขั้นตอนให้ผู้ใช้เห็น/แก้วันที่ก่อนบันทึกเหมือน Batch ถ้าใช้ `toISOString()` แล้วเกิด off-by-one จะเป็น silent bug ที่ร้ายแรงกว่า

### 2. ลำดับ: เรียก `plan-item-date` ก่อน `runResearch()`
วางการเรียกทันทีหลัง `generate-plan` สำเร็จและได้ `item.id` แล้ว ก่อนเรียก `runResearch()` — เหตุผลเดียวกับที่ `BatchGenerateDialog.tsx` ทำ (comment บรรทัด 187-188): ถ้า Research/Generate ล้มเหลวทีหลัง item ยังมี `scheduled_date` ที่ถูกต้องอยู่ ไม่ตกไปเป็น unscheduled ซ้อนกับความล้มเหลวอื่น

### 3. try/catch แยกสำหรับ `plan-item-date` + toast แจ้งทันทีเมื่อล้มเหลว
ห่อการเรียก `plan-item-date` ด้วย try/catch ของตัวเอง แยกจาก try/catch หลักของ `handleCreate` — ถ้าล้มเหลว ไม่ throw ต่อ (ไม่ทำให้ `runResearch()` ไม่ถูกเรียก) และไม่เปลี่ยน `step` กลับไป `'form'`
ต่างจาก Batch ตรงการแจ้งเตือน: Batch สร้างหลายหัวข้อ จึงรวบ `dateErrors` ไว้ toast รวมท้าย batch ครั้งเดียว — QuickCreate สร้างทีละ 1 ชิ้น ไม่มี "ท้ายรอบ" ให้รวบ จึง toast แจ้งทันที ณ จุดที่ล้มเหลว (ข้อความบอกว่า content สร้างสำเร็จแต่ยังไม่ได้กำหนดวันที่ ให้ไปแก้เองทีหลังได้)

### 4. ไม่เปลี่ยน error handling ของ `runResearch()` ที่มีอยู่แล้ว
การเรียก `plan-item-date` เป็นขั้นตอนเพิ่มเข้ามาก่อนหน้า `runResearch()` เท่านั้น ไม่แตะ logic ของ research/generate-article ที่มีอยู่แล้ว (บล็อก `if (art?.generation_status === 'failed')` เดิมยังทำงานเหมือนเดิมทุกประการ)

## Risks / Trade-offs

- **[Risk]** ผู้ใช้อาจไม่ต้องการให้ item ถูกกำหนดวันที่เป็นวันนี้โดยอัตโนมัติ (เช่น สร้างคอนเทนต์ไว้ล่วงหน้าโดยตั้งใจไม่ให้มีวันที่) → **Mitigation**: นี่คือการตัดสินใจที่ยืนยันแล้วในขั้น explore (Option B) — ผู้ใช้ยังแก้ `scheduled_date` ออกหรือเปลี่ยนได้ทีหลังผ่าน `ContentCardDialog` (ช่อง "วันที่โพสต์") หรือ Calendar ปกติ ไม่ใช่ค่าที่ lock ตายตัว
- **[Risk]** `plan-item-date` ล้มเหลวบ่อยๆ (เช่น network ไม่เสถียร) อาจทำให้ toast รบกวนผู้ใช้ทุกครั้ง → **Mitigation**: เป็น error path ที่ไม่ควรเกิดบ่อยในทางปฏิบัติ (endpoint เดียวกับที่ Batch ใช้งานจริงมาก่อนแล้วโดยไม่มีปัญหา) และ toast นี้ให้ข้อมูลที่ผู้ใช้ต้องรู้จริง (content สร้างสำเร็จแต่ยังไม่ตั้งวันที่) ไม่ใช่ noise
- **[Risk]** `content-generation-single-item` spec เดิมเขียนว่า direct item `MAY` เก็บ `scheduled_date=null` ไว้เพื่อ compatibility — เปลี่ยนเป็น best-effort ตั้งค่าเสมอ อาจดูขัดกับ "MAY" เดิม → **Mitigation**: ปรับ requirement ให้ชัดว่า backend ยังอนุญาต `null` ได้ (กรณี `plan-item-date` ล้มเหลวจริง) แต่ QuickCreate UI จะพยายามตั้งค่าเสมอเป็นพฤติกรรมมาตรฐานใหม่ — ไม่ใช่การขัดแย้งกัน แค่ทำให้ชัดเจนขึ้นว่า "MAY" คือ fallback ไม่ใช่ default ที่ตั้งใจ

## Migration Plan

ไม่มี schema/data migration — เป็นการเพิ่ม API call ฝั่ง frontend เท่านั้น ไม่มี state เดิมที่ต้อง migrate item เก่าที่สร้างไปแล้วก่อน change นี้ (unscheduled อยู่แล้ว) ยังคงแสดงผ่าน `calendar-unscheduled-item-bucket` ตามปกติ ไม่ได้รับผลกระทบย้อนหลัง
