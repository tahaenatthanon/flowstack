## Context

ระบบมีจุดสร้างคอนเทนต์ด้วย AI 3 จุด: `QuickCreateDialog` (สร้างเดี่ยว), `ContentPlannerAI` panel (สร้างแผนหลายรายการ), และ `BatchGenerateDialog` (สร้างหลายหัวข้อพร้อมกัน) มีเพียง `BatchGenerateDialog` ที่มีกล่องยืนยันสรุปก่อนเริ่มสร้างจริง (custom `AlertDialog` ภายในไฟล์เดียวกัน, ดู `showConfirm` state) ส่วนอีกสองจุดกดปุ่มแล้วยิง API ทันที

ระบบมี `useConfirm()` (`src/hooks/useConfirm.tsx`) เป็น global confirm dialog ที่ครอบด้วย `<ConfirmProvider>` ที่ระดับ `App.tsx` อยู่แล้ว ใช้งานอยู่แล้วหลายจุดในโค้ดเบส (เช่น `ContentPlannerPage.handleDeletePlan`) — เป็น mechanism ที่มีอยู่แล้ว ไม่ต้องสร้างใหม่

## Goals / Non-Goals

**Goals:**
- เพิ่มจังหวะยืนยันก่อนเริ่ม generation จริงใน `QuickCreateDialog` และ `ContentPlannerAI` panel (ผ่าน `ContentPlannerPage.handleGenerate`)
- ข้อความยืนยันต้องสรุปพอให้ตรวจสอบก่อนยิงจริงได้ (หัวข้อ/ประเภท/แพลตฟอร์ม สำหรับ Quick Create; คำสั่ง/ประเภทแผน/ช่วงวันที่/แพลตฟอร์ม สำหรับ Content Planner AI พร้อมคำเตือนว่า AI กำหนดจำนวนโพสต์เอง)
- กดยกเลิกที่กล่องยืนยันต้องไม่มี side effect ใดๆ (ไม่ยิง API ไม่เปลี่ยน state ฟอร์ม)

**Non-Goals:**
- ไม่ทำให้ "ยกเลิกระหว่างกำลังสร้าง" (หลังกดยืนยันแล้ว, อยู่ใน step 'progress') ทำงานได้จริงหรือ rollback ข้อมูล — เป็น change แยกในอนาคต ต้องแก้ backend + migration
- ไม่แตะพฤติกรรมของ `BatchGenerateDialog` ที่มีกล่องยืนยันอยู่แล้ว
- ไม่แตะ `ContentCardDialog` (บันทึกมือ ไม่ใช้ AI)

## Decisions

### ใช้ `useConfirm()` แทนการสร้าง custom `AlertDialog` ใหม่
`useConfirm()` รองรับ `title`/`description` (string) + ปุ่มยืนยัน/ยกเลิก ซึ่งพอสำหรับเนื้อหาที่ต้องสรุป (ประกอบเป็น string เดียวจากค่าที่กรอกในฟอร์มอยู่แล้ว) ไม่จำเป็นต้องมี custom JSX แบบ `BatchGenerateDialog` เพราะ Quick Create มีแค่ 1 รายการ และ Content Planner AI ไม่รู้จำนวนรายการล่วงหน้าอยู่แล้ว (ไม่มีอะไรจะ list แสดงทีละแถวเหมือน Batch)

**ทางเลือกที่พิจารณาแล้วไม่เลือก**: ทำ custom `AlertDialog` สรุปแบบ `BatchGenerateDialog` ให้ทั้งสองจุด — ปัดตกเพราะเพิ่มโค้ดซ้ำซ้อนโดยไม่ได้ประโยชน์เพิ่ม (ไม่มี list ของหลายหัวข้อให้แสดง)

### วางจุด confirm ที่ `ContentPlannerPage.handleGenerate` ไม่ใช่ใน `ContentPlannerAI.tsx`
`ContentPlannerAI` เป็น presentational component (รับ `onGenerate` prop) ส่วน `ContentPlannerPage` ถือ `useConfirm()` อยู่แล้วและมี pattern เดียวกันนี้ใน `handleDeletePlan` (`if (await confirm({...})) { ... }`) — ทำตาม pattern เดิมของหน้านี้เพื่อความสม่ำเสมอ ไม่ต้อง import hook ใหม่เข้า presentational component

### Quick Create: ครอบ `handleCreate` ด้วยฟังก์ชันใหม่ที่เรียก confirm ก่อน
ปุ่ม "สร้าง{ประเภท}" เปลี่ยนจากเรียก `handleCreate` ตรงๆ เป็นเรียกฟังก์ชันใหม่ (เช่น `handleConfirmAndCreate`) ที่เรียก `confirm()` ก่อน แล้วค่อยเรียก `handleCreate()` เมื่อผลลัพธ์เป็น `true` — ไม่แก้ logic ภายใน `handleCreate` เดิมเลย

## Risks / Trade-offs

- **[Risk]** ผู้ใช้ที่คุ้นเคยกับ flow เดิม (กดสร้างแล้วรอผลทันที) อาจรู้สึกว่าต้องกดเพิ่มขึ้นหนึ่งครั้งโดยไม่คาดคิด → **Mitigation**: ข้อความยืนยันกระชับ ปุ่ม "ยืนยันและสร้าง" ชัดเจน ไม่ต้องกรอกอะไรเพิ่มในกล่องยืนยัน แค่กดยืนยัน
- **[Risk]** ถ้า `ContentPlannerAI` panel ในอนาคตถูกแยกออกไปใช้นอก `ContentPlannerPage` (ไม่มี `useConfirm` context ของหน้านั้น) การยืนยันจะหายไปเงียบๆ ถ้าไม่ย้าย logic ตาม → **Mitigation**: ไม่ใช่ความเสี่ยงในขอบเขต change นี้ (ไม่มีแผนย้ายตอนนี้) แต่บันทึกไว้เป็นข้อสังเกต

## Migration Plan

Frontend-only change ไม่มี migration/backend/API — deploy พร้อม build ปกติ ไม่ต้องมีขั้นตอน rollback พิเศษ (revert commit ได้ตรงๆ ถ้าจำเป็น)

## Open Questions

(ไม่มี — ขอบเขตและพฤติกรรมชัดเจนจากการ explore ก่อนหน้าแล้ว)
