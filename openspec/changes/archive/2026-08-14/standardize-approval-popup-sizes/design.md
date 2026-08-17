## Context

popup อนุมัติทั้งสาม ("ยืนยันการอนุมัติ", "ขอแก้ไขเนื้อหา", "ปฏิเสธเนื้อหา") ปรากฏในสองไฟล์:

- `src/components/content/tabs/ContentApprovalTab.tsx` (หน้า "รายการอนุมัติ"):
  - Approve confirm dialog: `<DialogContent>` — ไม่มี width class
  - Reason dialog (ใช้ร่วมกันระหว่าง "ขอแก้ไขเนื้อหา" และ "ปฏิเสธเนื้อหา"): `<DialogContent>` — ไม่มี width class
- `src/components/content/views/ContentDetailView.tsx` (หน้ารายละเอียด):
  - ทั้งสอง dialog ใช้ `<DialogContent className="w-full sm:max-w-md">` อยู่แล้ว

base `DialogContent` (shadcn) มี default `sm:max-w-[calc(100vw-2rem)]` — เมื่อไม่มี width class จะกว้างเกือบเต็มจอ

## Goals / Non-Goals

**Goals:**
- ทำให้ popup ทั้งสามใน `ContentApprovalTab.tsx` มีความกว้างมาตรฐาน `sm:max-w-md` (448px) เท่ากันกับ `ContentDetailView`
- รักษา Layout ภายในเดิม (header / textarea เหตุผล / footer)

**Non-Goals:**
- ไม่เปลี่ยน logic การอนุมัติ/ขอแก้ไข/ปฏิเสธ, hooks, API
- ไม่เปลี่ยนข้อความ description หรือ placeholder

## Decisions

**1. ความกว้างมาตรฐาน: `sm:max-w-md` (448px)**
- เป็นค่าเดียวกับ popup ชุดเดียวกันใน `ContentDetailView` และ dialog อื่นในระบบ
- เพียงพอสำหรับ description + textarea เหตุผล (rows=3) + footer โดยไม่กว้างเกิน
- ทางเลือกที่พิจารณา: `sm:max-w-sm` (384px) → แคบไปสำหรับ textarea; `sm:max-w-lg` (512px) → กว้างเกินสำหรับ dialog ยืนยันสั้น ๆ

**2. ใช้ `className="w-full sm:max-w-md"` บนทั้งสอง `DialogContent` ใน `ContentApprovalTab.tsx`**
- Approve confirm dialog และ reason dialog ใช้ค่าเดียวกัน เพื่อความสม่ำเสมอ
- `w-full` คงไว้เพื่อ full-width บนมือถือ

**3. ช่องกรอกเหตุผล auto-resize (grow/shrink ตามเนื้อหา)**
- ใช้ `useRef<HTMLTextAreaElement>` + ฟังก์ชัน resize ที่ตั้ง `el.style.height = 'auto'` แล้วตามด้วย `el.style.height = el.scrollHeight + 'px'` เพื่อให้ขยาย/หดตามจำนวนบรรทัดจริง
- เรียก resize เมื่อ value เปลี่ยน (ใน `onChange`) และหลัง dialog เปิด/reset (ใน `useEffect`) เพื่อให้ขนาดถูกต้องตั้งแต่เปิด
- เพิ่ม `resize-none` บน textarea เพื่อปิด manual resize ที่จะขัดกับ auto-resize
- คง `min-h-[80px]` จาก base `Textarea` เป็นความสูงขั้นต่ำ (แทน `rows={3}` เดิม)
- ใช้กับ reason dialog ทั้งสองจุด: `ContentApprovalTab.tsx` และ `ContentDetailView.tsx` เพื่อความสม่ำเสมอ (popup เดียวกันปรากฏในสองที่)
- ทางเลือกที่พิจารณา: สร้าง `AutoResizeTextarea` component แยก → ปัดตกเพื่อลด scope (มีใช้เพียง 2 จุด และ logic ~3 บรรทัด); ใช้ library ภายนอก → ไม่จำเป็น

## Risks / Trade-offs

- [description ยาว (ชื่อเนื้อหา) ใน reason dialog] → `DialogDescription` คง wrap ตามความกว้าง 448px ซึ่งพอเพียง; ชื่อยาวถูก wrap หลายบรรทัด ไม่ overflow
- [ความกว้างเปลี่ยนกระทบการจัดวางปุ่ม footer] → ใช้ `DialogFooter` (flex justify-end) เดิม ไม่ได้รับผลกระทบจากความกว้าง

## Migration Plan

- เปลี่ยนเฉพาะ `className` และ textarea auto-resize ใน `ContentApprovalTab.tsx` และ `ContentDetailView.tsx` (frontend เท่านั้น) — ไม่มี DB/API migration
- Rollback: revert `className` กลับเป็นไม่มี width class และ revert auto-resize handler กลับเป็น `rows={3}` คงที่
