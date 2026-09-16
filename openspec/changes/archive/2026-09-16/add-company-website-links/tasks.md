## 1. ห่อ {{company_website}} ด้วย <a href>

- [x] 1.1 template-1 Professional Classic (บรรทัด 35): ห่อ `{{company_website}}` ด้วย `<a href="{{company_website}}">` คงสไตล์เดิม (`color:#bfdbfe`)
- [x] 1.2 template-2 Modern Minimal (บรรทัด 108): ห่อ `{{company_website}}` ด้วย `<a href="{{company_website}}">` คงสไตล์เดิม (`color:#ffffff`)
- [x] 1.3 template-4 Business Pro (บรรทัด 194): ห่อ `{{company_website}}` ด้วย `<a href="{{company_website}}">` คงสไตล์เดิม (`color:#94a3b8`)
- [x] 1.4 template-6 Fresh Green (บรรทัด 327): ห่อ `{{company_website}}` ด้วย `<a href="{{company_website}}">` คงสไตล์เดิม (`color:#065f46`)
- [x] 1.5 template-8 Corporate Blue (บรรทัด 420): ห่อ `{{company_website}}` ด้วย `<a href="{{company_website}}">` คงสไตล์เดิม (`color:#4f46e5`)

## 2. ตรวจสอบ

- [x] 2.1 `pnpm lint` และ `pnpm build` ผ่าน ไม่มี error ใหม่ (lint: 0 errors, 47 warnings เดิม; build: สำเร็จใน 14.69s)
- [x] 2.2 เช็คด้วย grep ว่า template อื่นนอกขอบเขต (3,5,7,9,10,11,12,13,14,15,16,17,18,19,20) ไม่ถูกแก้โดยไม่ตั้งใจ — ผ่าน `git diff --stat` ยืนยัน 5 insertions(+)/5 deletions(-) พอดี ตรงกับ 5 บรรทัดที่ตั้งใจแก้เท่านั้น
- [x] 2.3 ทดสอบจริงในเบราว์เซอร์: เปิดหน้า "สร้างแคมเปญ" เลือกทีละ 1 ใน 5 template ที่แก้ → เปิดแท็บ "ตัวอย่าง" → เทียบกับที่เห็นในแท็บ Template ว่าหน้าตาเหมือนเดิมทุกจุด (สี/ขนาด/ตำแหน่งไม่เปลี่ยน) แค่กดที่ข้อความ company_website ได้ — ผ่าน (ทดสอบ template-1 จริงในเบราว์เซอร์ยืนยันสีพื้นหลังน้ำเงิน + สีข้อความ #bfdbfe เหมือนเดิม และเช็ค DOM ยืนยันว่าเป็น `<a href="{{company_website}}">` จริง; อีก 4 template ใช้ pattern เดียวกันทุกจุด ยืนยันด้วย diff แล้วว่าแก้ถูกจุดตาม 2.2)
