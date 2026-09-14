## 1. ย้าย Template เริ่มต้น ออกเป็น section เดี่ยวเต็มความกว้าง

- [x] 1.1 ใน `src/pages/MarketingPage.tsx` ตัดบล็อก `<div className="grid gap-1.5">...Template เริ่มต้น...</div>` ออกจากการ์ด "ผู้รับ" (section ③)
- [x] 1.2 เพิ่ม section ใหม่เต็มความกว้าง ต่อจาก grid ผู้ส่ง/ผู้รับ (บรรทัดหลัง `</div>` ปิด grid 2 คอลัมน์) ครอบด้วย `rounded-lg border bg-muted/20 p-4 space-y-3` แบบเดียวกับ section อื่น พร้อม badge เลข `4`
- [x] 1.3 เปลี่ยน badge เลขของ section "เนื้อหาอีเมล" จาก `4` เป็น `5`

## 2. เปลี่ยนแถบเลือก template จาก scroll เป็น wrap

- [x] 2.1 แทนที่ `ScrollableKanban` ด้วย `<div className="flex flex-wrap gap-2">` (หรือเทียบเท่า) ครอบปุ่ม template ในตำแหน่งใหม่
- [x] 2.2 ลบ import `ScrollableKanban` ออกจาก `MarketingPage.tsx` หากไม่มีจุดอื่นในไฟล์ใช้งานแล้ว (เช็คด้วย grep ก่อนลบ)

## 3. Toggle การเลือก Template พร้อม confirm dialog ก่อนล้างเนื้อหา

- [x] 3.1 แก้ `onClick` ของปุ่ม template: ถ้าคลิก template ที่ยังไม่ถูกเลือก → `setSelectedTemplate(template.id); setCampaignBody(template.html)` เหมือนเดิม (ไม่ confirm)
- [x] 3.2 ถ้าคลิก template ที่กำลังถูกเลือกอยู่ (`selectedTemplate === template.id`) → เรียก `await confirm({ title: 'ยกเลิกการเลือก Template?', description: 'เนื้อหาอีเมลที่ใช้จาก Template นี้จะถูกล้างกลับเป็นค่าว่าง', variant: 'default' })` ก่อนเสมอ
- [x] 3.3 ถ้าผู้ใช้ยืนยัน → `setSelectedTemplate(''); setCampaignBody('')` ถ้ายกเลิก → ไม่ทำอะไรเพิ่ม (คงสถานะเดิม)

## 4. Verify

- [x] 4.1 `pnpm lint` ผ่านไม่มี error ใหม่จากไฟล์ที่แก้
- [x] 4.2 เปิดไดอะล็อกสร้างแคมเปญในเบราว์เซอร์ (localhost:8080) ตรวจว่า section Template เริ่มต้น แสดงครบ 20 ตัวไม่ต้อง scroll และไม่ล้นขอบไดอะล็อก ทั้งจอกว้างและจอแคบ (resize/mobile viewport)
- [x] 4.3 ทดสอบ toggle: เลือก template → คลิกซ้ำ → เห็น confirm dialog → กดยืนยัน → เนื้อหาว่างและไม่มี template ถูกเลือก
- [x] 4.4 ทดสอบ cancel ที่ confirm dialog: เลือก template → คลิกซ้ำ → กดยกเลิกใน dialog → template ยังถูกเลือกอยู่ เนื้อหาไม่เปลี่ยน
- [x] 4.5 ทดสอบสลับ template ปกติ (เลือก template A แล้วคลิก template B ทันที) → ไม่มี confirm dialog ขึ้น เนื้อหาเปลี่ยนเป็นของ B ทันที (regression check ตาม behavior เดิม)
