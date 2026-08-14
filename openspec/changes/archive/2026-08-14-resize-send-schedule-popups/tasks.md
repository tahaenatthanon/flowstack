## 1. ปรับขนาด DialogContent

- [x] 1.1 แก้ `className` ของ `DialogContent` ใน `SchedulePublishDialog.tsx` จาก `w-full sm:max-w-lg max-h-[90vh] overflow-y-auto` เป็น `w-full sm:max-w-xl`
- [x] 1.2 ยืนยันว่า dialog ยัง full-width บนมือถือ (base class `w-full` ของ shadcn คงอยู่)

## 2. ปรับ Layout และระยะห่างภายใน

- [x] 2.1 ปรับระยะห่างแนวตั้งระหว่าง section ของ content wrapper ให้สม่ำเสมอ (เช่น `space-y-4`)
- [x] 2.2 เพิ่ม padding ของแถว channel เป็น `px-4 py-2.5` เพื่อให้อ่านง่ายและแตะ/คลิกสะดวกขึ้น

## 3. ย้าย scroll ไปที่ส่วนเนื้อหากลาง

- [x] 3.1 ครอบส่วนเนื้อหา (channel list + textarea + ช่องวันที่/เวลา) ด้วย container ที่มี `max-h-[60vh] overflow-y-auto` (เช่น `<div className="max-h-[60vh] overflow-y-auto pr-1 space-y-4">`)
- [x] 3.2 ยืนยันว่า `DialogHeader` และ `DialogFooter` อยู่นอก container ที่เลื่อนได้

## 4. ตรวจสอบขนาดแยกตามโหมด

- [x] 4.1 ยืนยันว่าโหมด `send_now` ไม่แสดงช่องวันที่/เวลา และ dialog ย่อพอดีกับเนื้อหา
- [x] 4.2 ยืนยันว่าโหมด `schedule` แสดงช่องวันที่/เวลา และเนื้อหายังถูกจำกัดการเลื่อนภายใน container

## 5. ตรวจสอบและทดสอบ

- [x] 5.1 รัน `pnpm lint` และ `pnpm build` ให้ผ่าน
- [x] 5.2 ทดสอบบนเบราว์เซอร์: เปิดทั้งโหมด "ส่งเดี๋ยวนี้" และ "ตั้งเวลาโพสต์" ทั้งกรณี channel น้อยและมาก, มี/ไม่มี article/caption ที่เลือก
- [x] 5.3 ยืนยันว่าการส่งและตั้งเวลายังทำงานเหมือนเดิม (validation + toast)
