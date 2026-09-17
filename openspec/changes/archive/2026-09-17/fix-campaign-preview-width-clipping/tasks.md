## 1. แก้ `buildEmailPreviewHtml()` — ห้ามตัดเนื้อหาทิ้งแบบมองไม่เห็น

- [x] 1.1 แก้ inline style ของ div การ์ดใน `buildEmailPreviewHtml()` เปลี่ยน `overflow:hidden` เป็น `overflow-x:auto` ([CampaignsPage.tsx:223](src/pages/CampaignsPage.tsx:223))
- [x] 1.2 ตรวจว่า `border-radius:8px` ของการ์ดยังดูปกติหลังเปลี่ยนเป็น `overflow-x:auto` — `overflow-x:auto` ยังคง clip เนื้อหาตามขอบมุมโค้งเหมือน `hidden` ทุกประการเมื่อไม่มี overflow จริง (สร้าง scrollbar เฉพาะตอนจำเป็นเท่านั้น) ยืนยันเพิ่มเติมด้วยการทดสอบจริงในหัวข้อ 3

## 2. ขยายความกว้างไดอะล็อก "ดู" ของแท็บเทมเพลตหลัก

- [x] 2.1 เปลี่ยน `className` ของ `DialogContent` ในไดอะล็อก "ดู" template จาก `sm:max-w-3xl` เป็น `sm:max-w-4xl` ([CampaignsPage.tsx:1087](src/pages/CampaignsPage.tsx:1087))

## 3. ทดสอบ

- [x] 3.1 ทดสอบด้วยมือ: เปิดไดอะล็อกสร้างแคมเปญใหม่ → แทรกตารางหลายคอลัมน์ที่กว้างเกิน 600px ในตัวแก้ไข (ผ่าน HTML Source: table width 900px) → เปิดแท็บ "ตัวอย่าง" → ยืนยันเลื่อนแนวนอนเห็นคอลัมน์ท้ายๆ ได้ (ตรวจ DOM: overflow="auto", scrollWidth 932 vs clientWidth 518 แล้วเลื่อนขวาจริงเห็น "คอลัมน์ 3 กว้างมาก")
- [x] 3.2 ทดสอบด้วยมือ: เปิดไดอะล็อก "ดู" ของ template บนวิวพอร์ตเดสก์ท็อปทั่วไป (1280px) → ยืนยันเห็นเนื้อหาครบไม่ต้องเลื่อน (ตรวจ DOM: wrapClientWidth 845, needsScroll: false)
- [x] 3.3 ทดสอบด้วยมือ: ปรับวิวพอร์ตให้แคบกว่า 600px+padding (650px) → เปิดไดอะล็อก "ดู" template → ยืนยันยังเลื่อนแนวนอนดูเนื้อหาที่เกินกรอบได้ตามปกติ (ตรวจ DOM: overflow="auto", needsScroll: true — ไม่ regression)
- [x] 3.4 ทดสอบด้วยมือ (กัน regression): เลือก template ปกติ (ไม่มีตารางกว้าง) → เปิดแท็บ "ตัวอย่าง" บนวิวพอร์ต 1280px → ยืนยันหน้าตาเหมือนเดิมทุกประการ ไม่มี scrollbar โผล่มาโดยไม่จำเป็น (ตรวจ DOM: needsScroll: false ที่ 1280px)
- [x] 3.5 รัน `pnpm lint` และ `pnpm build` ให้ผ่านก่อนปิดงาน — `pnpm lint`: 0 errors (47 warning เดิมทั้งหมดเป็นไฟล์อื่นที่ไม่เกี่ยวกับการแก้ไขนี้), `pnpm build`: สำเร็จ

## 4. ปิดงาน

- [x] 4.1 อัปเดต `tasks.md` นี้ทำเครื่องหมายครบทุกข้อ
- [x] 4.2 sync-specs รวม capability ใหม่ `email-campaign-preview-overflow` เข้า main specs — สร้าง `openspec/specs/email-campaign-preview-overflow/spec.md` แล้ว validate ผ่าน (หมายเหตุ: ทำก่อน commit ตามที่ user ยืนยันให้ทำตอนนี้เลย แทนที่จะรอ merge ตามแผนเดิม)
- [ ] 4.3 archive change นี้ด้วย `/opsx:archive` หลังยืนยันว่า deploy เรียบร้อย — **รอ**: ยังไม่ได้ deploy
