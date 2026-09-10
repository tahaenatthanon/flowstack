## Why

การสร้างคอนเทนต์ด้วย AI ผ่าน "สร้างคอนเทนต์" (Quick Create, หน้า `/content`) และ "สร้างแผนด้วย AI" (Content Planner panel, หน้า `/content-planner`) ยิงคำขอสร้างจริงทันทีที่กดปุ่ม โดยไม่มีจังหวะให้ผู้ใช้ตรวจสอบหัวข้อ/แพลตฟอร์ม/ช่วงวันที่ก่อน — พิมพ์หัวข้อผิดหรือกดพลาดจะเสียรอบ AI generation ไปฟรีๆ (Quick Create ใช้เวลา 30-60 วินาทีต่อครั้ง) ส่วน "สร้างแผนด้วย AI" เสี่ยงกว่านั้นเพราะ AI เป็นคนกำหนดจำนวนโพสต์เอง ช่วงวันที่กว้าง (เช่น รายปี) อาจสร้างได้หลายสิบรายการโดยไม่มีจังหวะเบรก

ในระบบมี pattern นี้อยู่แล้วใน Batch สร้างคอนเทนต์ (`BatchGenerateDialog`) ซึ่งมีหน้าจอสรุป + ปุ่ม "ยืนยันและเริ่มสร้าง" ก่อนยิงจริง — Quick Create และ Content Planner AI panel ควรมีจังหวะเดียวกันเพื่อความสม่ำเสมอและป้องกันการกดพลาด

## What Changes

- เพิ่มขั้นตอนยืนยัน (confirmation) ก่อนเริ่ม generation จริงใน 2 จุด:
  - **Quick Create** (`QuickCreateDialog`): ก่อนเรียก `handleCreate()` แสดงกล่องยืนยันสรุปหัวข้อ/ประเภท/แพลตฟอร์ม/สไตล์ที่เลือกไว้ ผ่าน `useConfirm()` ที่มีอยู่แล้วในระบบ
  - **Content Planner AI panel** (`ContentPlannerAI` → `handleGenerate` ใน `ContentPlannerPage`): ก่อนเรียก `generate-plan` แสดงกล่องยืนยันสรุปคำสั่ง/ประเภทแผน/ช่วงวันที่/แพลตฟอร์ม พร้อมข้อความเตือนว่า AI จะกำหนดจำนวนโพสต์เอง
- กดยกเลิกที่กล่องยืนยัน = ไม่ยิง generation ใดๆ ทั้งสิ้น ฟอร์มเดิมยังอยู่ครบให้แก้ไขต่อได้
- ไม่แตะ `BatchGenerateDialog` (มีกล่องยืนยันอยู่แล้ว) และไม่แตะ `ContentCardDialog` (บันทึกมือ ไม่ใช้ AI — อยู่นอกขอบเขตนี้)

## Capabilities

### New Capabilities
- `content-generation-confirmation`: ผู้ใช้ต้องกดยืนยันในกล่องสรุปก่อนที่ระบบจะเริ่มเรียก AI generation จริง ครอบคลุมทั้ง Quick Create (สร้างเดี่ยว) และ Content Planner AI panel (สร้างแผน)

### Modified Capabilities
(ไม่มี — ไม่มี requirement ของ spec ที่มีอยู่แล้วเปลี่ยนแปลง)

## Impact

- **Affected files**:
  - `src/components/content/dialogs/QuickCreateDialog.tsx` — เพิ่ม `useConfirm()` คั่นก่อน `handleCreate()`
  - `src/pages/ContentPlannerPage.tsx` — เพิ่ม `confirm()` guard ต้น `handleGenerate` (ใช้ `useConfirm` hook ที่ import ไว้แล้วสำหรับ `handleDeletePlan`)
- **ไม่แตะ backend/API** — เป็น frontend-only change ไม่มี migration ไม่มี endpoint ใหม่
- **ไม่กระทบ** `BatchGenerateDialog.tsx`, `ContentCardDialog.tsx`
- ขอบเขตนี้ไม่รวมการทำให้ "ยกเลิกระหว่างกำลังสร้าง" (หลังกดยืนยันแล้ว) ทำงานได้จริง/rollback ข้อมูล — เป็นปัญหาคนละชั้น (ต้องแก้ backend + migration เพิ่ม `cancel_requested`) ที่ควรแยกเป็น change ถัดไป
