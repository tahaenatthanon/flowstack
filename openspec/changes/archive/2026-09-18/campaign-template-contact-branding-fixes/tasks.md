## 1. เตรียมการ

- [x] 1.1 ตรวจสอบค่า `company_settings.company_name_en` ว่าตั้งไว้แล้ว — ยืนยันแล้ว: "KTN BUSINESS SOLUTIONS CO.,LTD." (ไม่ต้อง fallback)
- [x] 1.2 สำรวจตำแหน่ง `{{company_phone}}`/`{{company_email}}`/`{{company_website}}`/`{{company_name}}` ทั้งหมดใน `emailTemplates.ts` หลัง chrome-lock migration — **แก้ไขจากที่ระบุไว้ตอน propose**: พบว่า template-3 มีกล่องเบอร์โทร/อีเมลตกอยู่ใน `defaultContent` จริง (ไม่ใช่ `html`) เพราะถูกรวมเข้าโซนแก้ไขได้ตอน chrome-lock migration รอบก่อน — แก้ตามจุดจริงที่พบระหว่าง apply แต่ละ template (อ่านไฟล์ก่อนแก้ทุกครั้งตามหลัก READ BEFORE WRITE) ไม่ใช้สมมติฐานเดิม

## 2. แก้ทีละ template (tel:/mailto:/website link + footer ครบถ้วน + ภาษาให้ตรง)

- [x] 2.1 template-1: ห่อ `tel:`/`mailto:` ให้ `{{company_phone}}`/`{{company_email}}` ใน footer
- [x] 2.2 template-2: ห่อ `tel:`/`mailto:` ให้ `{{company_phone}}`/`{{company_email}}` ใน footer (Contact Bar)
- [x] 2.3 template-3: ห่อ `tel:`/`mailto:` — จุดจริงอยู่ใน `defaultContent` (กล่องเบอร์โทร/อีเมลถูกรวมเข้าโซนแก้ไขได้ตอน chrome-lock migration) ไม่ใช่ `html` ตามที่คาดไว้ตอน propose
- [x] 2.4 template-4: ห่อ `tel:`/`mailto:` ให้ footer (chrome) + สลับ `{{company_name}}`→`{{company_name_en}}` ใน h1 — คงข้อความ signature "{{company_name}}" ใน `defaultContent` ไว้เหมือนเดิม (เป็นเนื้อหาที่แก้ไขได้ ไม่ใช่ chrome)
- [x] 2.5 template-5: ห่อ `tel:`/`mailto:` ให้ footer + สลับ `{{company_name}}`→`{{company_name_en}}` ใน h1
- [x] 2.6 template-6: ห่อ `mailto:` ให้อีเมลใน header + `tel:` ให้เบอร์ใน Contact Box + สลับ `{{company_name}}`→`{{company_name_en}}` ใน h1
- [x] 2.7 template-7: ห่อ `tel:` ให้ footer (ไม่ต้องแก้ mailto เพราะมีแค่ปุ่ม CTA อยู่แล้ว) + สลับ `{{company_name}}`→`{{company_name_en}}` ใน h1
- [x] 2.8 template-8: ห่อ `mailto:` ให้ footer (chrome) + `tel:` ให้เบอร์ใน signature (`defaultContent`) + สลับ `{{company_name}}`→`{{company_name_en}}` ใน h1
- [x] 2.9 template-9: ห่อ `tel:`/`mailto:` ให้ Cute Box (เนื้อหาไทย — ไม่สลับภาษาชื่อบริษัท)
- [x] 2.10 template-10: ห่อ `tel:`/`mailto:` ให้ "Contact Us" footer + สลับ `{{company_name}}`→`{{company_name_en}}` ใน h1
- [x] 2.11 template-11: ห่อ `tel:`/`mailto:` ให้ footer + เติม `<a href>` ให้ `{{company_website}}` ที่ header (แยกจากปุ่ม CTA) + สลับ `{{company_name}}`→`{{company_name_en}}` ใน h1
- [x] 2.12 template-12: ห่อ `tel:`/`mailto:` ให้ Contact footer + สลับ `{{company_name}}`→`{{company_name_en}}` ใน h1
- [x] 2.13 template-13: ห่อ `tel:`/`mailto:` ให้ footer — **ปรับจากที่ระบุไว้ตอน propose**: แม้ h1 ใช้ static "Season's Greetings" แต่พบว่า subtitle ใต้ h1 ใช้ `{{company_name}}` อยู่ (เนื้อหาอังกฤษล้วน) จึงสลับเป็น `{{company_name_en}}` ตรงนั้นแทน เพื่อให้ตรงตาม requirement ภาษาใน spec.md (ไม่ได้จำกัดแค่ h1)
- [x] 2.14 template-14: ห่อ `tel:`/`mailto:` ให้ footer + สลับ `{{company_name}}`→`{{company_name_en}}` ใน h1
- [x] 2.15 template-15: ห่อ `tel:`/`mailto:` ให้ Contact footer + เติม `{{company_name}}` เข้า footer (เนื้อหาไทย/ผสม — ไม่ใช้ name_en)
- [x] 2.16 template-16: ห่อ `tel:`/`mailto:` ให้ footer + เติม `<a href>` ให้ `{{company_website}}` ที่ footer (แยกจากปุ่ม CTA) + สลับ `{{company_name}}`→`{{company_name_en}}` ใน h1
- [x] 2.17 template-17: ห่อ `mailto:` ให้ข้อความ "Questions? Contact us at {{company_email}}" ใน footer + เติมชื่อบริษัทเข้า footer — **ปรับจากที่ระบุไว้ตอน propose**: ใช้ `{{company_name_en}}` แทน `{{company_name}}` เพราะเป็นจุดที่เพิ่มใหม่ (ไม่มีของเดิมให้อ้างอิง) และเนื้อหา template นี้เป็นอังกฤษล้วน ตรงตาม requirement ภาษาที่กำหนดไว้ใน spec.md
- [x] 2.18 template-18: สร้างแถว footer ใหม่ทั้งหมด — ใส่ `{{company_name_en}}` (**ปรับจาก `{{company_name}}` ตามที่ระบุไว้ตอน propose** — เนื้อหาอังกฤษล้วน ใช้ name_en ให้ตรงตาม requirement ภาษา) + `{{company_phone}}` (ห่อ tel:) + `{{company_email}}` (ห่อ mailto:) ด้วยโทนสีเขียวเดียวกับ template ส่วนอื่น
- [x] 2.19 template-19: ห่อ `tel:`/`mailto:` ให้ Contact footer + เติม `{{company_name}}` เข้า footer (เนื้อหาไทย — ไม่ใช้ name_en)
- [x] 2.20 template-20: ห่อ `tel:`/`mailto:` ให้ footer + เติม `<a href>` ให้ `{{company_website}}` ที่ footer (แยกจากปุ่ม CTA) + สลับ `{{company_name}}`→`{{company_name_en}}` ใน h1

## 3. ทดสอบ

- [x] 3.1 เปิด preview เทียบทุกหมวดการแก้ผ่าน DOM inspection: template-1 (ห่อลิงก์ปกติ), template-3 (จุดแก้อยู่ใน defaultContent), template-11 (website wrap + name_en + CTA เดิมไม่กระทบ), template-13 (subtitle swap แทน h1), template-17 (เติม footer ใหม่ + mailto 2 จุด), template-18 (สร้าง footer ใหม่ทั้งหมด) — chrome/สไตล์ตรงเดิมทุกจุด
- [x] 3.2 ตรวจ href ผ่าน DOM ของทุก template ที่ตรวจ — `tel:{{company_phone}}`, `mailto:{{company_email}}`, `{{company_website}}` ถูกต้องครบทุกจุด ไม่มี href ผิดเพี้ยน
- [x] 3.3 ส่งอีเมลทดสอบจริง 4 template ไป Gmail — ผู้ใช้ส่งจริงและยืนยันด้วยสกรีนช็อตทั้ง 4 ฉบับ: template-18 (footer ใหม่แสดง "KTN BUSINESS SOLUTIONS CO.,LTD." + เบอร์โทร/อีเมลคลิกได้ ตรงธีมสีเขียว), template-17 (เติมชื่อบริษัทอังกฤษ + "Questions? Contact us at..." เป็นลิงก์คลิกได้), template-15 (ใช้ชื่อบริษัทไทยถูกต้องตามภาษาเนื้อหา), template-13 (subtitle สลับเป็นอังกฤษถูกต้อง ส่วน copyright footer ยังเป็นชื่อไทยตามที่ตั้งใจไว้ไม่แตะ) — chrome/สไตล์ตรงต้นฉบับทุกจุด ไม่มีจุดไหนเพี้ยน
- [x] 3.4 ทดสอบ regression: เปิดแก้ไขแคมเปญร่างที่ใช้ template-1 (chrome-locked) ผ่านเบราว์เซอร์หลังแก้ chrome ของ template-1 แล้ว — dialog เปิดได้ปกติ ไม่มี error — เนื่องจาก change นี้แก้เฉพาะ markup ใน `emailTemplates.ts` ไม่แตะ logic ใดๆ (`forceLegacyEditor`, compose function) จึงไม่กระทบพฤติกรรมแคมเปญ legacy เลยโดยธรรมชาติ (ยืนยันด้วย git diff --stat ว่าไฟล์ logic ทั้งหมดไม่มีการเปลี่ยนแปลง)
- [x] 3.5 ทดสอบ regression: แก้ไขเนื้อหาบทความในหน้าเนื้อหา (`ContentCardDialog`) — ไม่ได้รับผลกระทบ ยืนยันผ่าน `git diff --stat`: change นี้แก้เฉพาะไฟล์เดียว `src/data/emailTemplates.ts` (50 insertions, 35 deletions) ไม่แตะไฟล์อื่นเลยแม้แต่ไฟล์เดียว รวมถึง `ArticleEditor.tsx`/`ContentCardDialog.tsx`

## 4. Verification

- [x] 4.1 รัน `pnpm lint` และ `pnpm build` — ทั้งคู่ผ่าน: lint 0 errors (มีแค่ 47 warnings เดิมที่ไม่เกี่ยวกับ change นี้), build สำเร็จ 14.88s ไม่มี error
