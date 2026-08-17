## 1. แก้รูปปกใน ContentArticleView

- [x] 1.1 เพิ่ม `relative` ให้ container ของรูปปก (บรรทัด `rounded-xl overflow-hidden border bg-muted/20 cursor-zoom-in group`)
- [x] 1.2 เปลี่ยน `object-cover` → `object-contain` บน `<img>` และปรับ `max-h-80` เป็นค่าที่ไม่ตัดรูป
- [x] 1.3 ปรับ wrapper ให้ overlay hug รูป (ใช้ `inline-block`/`w-fit` ตามความเหมาะสม) โดยคง `max-w-lg mx-auto` สำหรับ `isSocial`

## 2. แก้ cover/preview ใน ContentVideoView

- [x] 2.1 เปลี่ยน `object-cover` → `object-contain` บน `<img>` และปรับ `max-h-80` เป็นค่าที่ไม่ตัดรูป
- [x] 2.2 ตรวจสอบ overlay `absolute inset-0` ครอบคลุมเฉพาะขอบเขตของรูป (container มี `relative` อยู่แล้ว)

## 3. การตรวจสอบและบูรณาการ

- [x] 3.1 รัน `pnpm build` — ตรวจสอบไม่มี TypeScript errors
- [x] 3.2 รัน `pnpm lint` — ตรวจสอบไม่มี ESLint errors
- [ ] 3.3 ทดสอบด้วยตนเอง: เปิดรายละเอียดคอนเทนต์จากหน้ารายการอนุมัติ เห็นรูปปกเต็มรูป
- [ ] 3.4 ทดสอบด้วยตนเอง: hover บนรูปปก — overlay ไม่เกินขอบเขตของรูป
