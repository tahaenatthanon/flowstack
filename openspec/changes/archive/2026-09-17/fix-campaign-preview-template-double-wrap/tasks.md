## 1. แก้ `buildEmailPreviewHtml()` ใน `CampaignsPage.tsx`

- [x] 1.1 เพิ่ม guard `if (/<html/i.test(html)) return html;` เป็นบรรทัดแรกสุดของฟังก์ชัน `buildEmailPreviewHtml()` ก่อนขั้นตอน rewrite `/uploads/` path และการครอบ header/footer/hero — ให้ตรงกับตำแหน่งและเงื่อนไขของ guard ใน `api/email-utils.php` (`wrapEmailHtml()`) เป๊ะๆ ([CampaignsPage.tsx:196](src/pages/CampaignsPage.tsx:196))
- [x] 1.2 ตรวจโค้ดรอบๆ ว่าไม่มีจุดอื่นที่เรียก `buildEmailPreviewHtml()` แล้วคาดหวัง (assume) ว่าจะได้ header/footer ของ wrapper กลับมาเสมอ — grep ยืนยันแล้วว่าฟังก์ชันนี้ถูกเรียกใช้แค่จุดเดียว (แท็บ "ตัวอย่าง" ใน section เนื้อหาอีเมล, [CampaignsPage.tsx:1282](src/pages/CampaignsPage.tsx:1282)) อีก 2 จุดที่มี iframe preview (Template Preview Dialog, Recipient Log preview) ใส่ `srcDoc` ตรงๆ ไม่ผ่านฟังก์ชันนี้ ไม่ได้รับผลกระทบ

## 2. ทดสอบ

- [x] 2.1 ทดสอบด้วยมือ: เปิดไดอะล็อกสร้างแคมเปญใหม่ → เลือก template ที่มี header/footer ชัดเจน → เปิดแท็บ "ตัวอย่าง" → ยืนยันเห็น header/footer แค่ชุดเดียว (ของ template) ไม่ซ้อนกัน — ทดสอบกับ "โปรเฟสชั่นแนลคลาสสิก" แล้ว เห็น header (แถบน้ำเงิน {{company_name}}) และ footer (แถบเทา {{company_address}}...) แค่ชุดเดียวจริง ไม่มี "support@ktnbs.com" ของ wrapper ซ้อนอีกต่อไป
- [x] 2.2 ทดสอบด้วยมือ: เทียบผลจาก 2.1 กับไดอะล็อก "ดู" ของแท็บเทมเพลตหลัก (แท็บ "เทมเพลต" → ปุ่ม "ดู") ว่าหน้าตาตรงกัน — เปรียบเทียบแล้ว header/เนื้อหาตรงกันทุกจุด
- [x] 2.3 ทดสอบด้วยมือ (กัน regression): พิมพ์เนื้อหาเองแบบไม่ใช้ template (ไม่มี `<html` ในเนื้อหา) → เปิดแท็บ "ตัวอย่าง" → ยืนยันยังเห็น header (ชื่อบริษัท) และ footer (ข้อความยินยอม) ของ wrapper ตามปกติเหมือนเดิม — ยืนยันแล้ว ไม่มี regression
- [x] 2.4 ทดสอบด้วยมือ: เลือก template หลายแบบสลับกัน (อย่างน้อย 3 แบบ) → ยืนยันไม่มี header/footer ซ้อนในทุกแบบ — ทดสอบ "โปรเฟสชั่นแนลคลาสสิก", "โมเดิร์นมินิมอล", "หรูหราสีม่วง" (มีพื้นหลังไล่สี) ครบทั้ง 3 ไม่มีการซ้อนเลย
- [x] 2.5 รัน `pnpm lint` และ `pnpm build` ให้ผ่านก่อนปิดงาน — `pnpm lint`: 0 errors (47 warning เดิมทั้งหมดเป็นไฟล์อื่นที่ไม่เกี่ยวกับการแก้ไขนี้), `pnpm build`: สำเร็จ

## 3. ปิดงาน

- [x] 3.1 อัปเดต `tasks.md` นี้ทำเครื่องหมายครบทุกข้อ
- [x] 3.2 รวม delta spec `email-campaign-template-picker` เข้า main specs (sync-specs) — แทนที่ scenario "แท็บตัวอย่างแสดงตรงกับ template ที่เลือก" ด้วยเวอร์ชันขยาย (ไม่มี header/footer ซ้อนกัน) และเพิ่ม scenario ใหม่กัน regression validate ผ่าน (หมายเหตุ: ทำก่อน commit ตามที่ user ยืนยันให้ทำตอนนี้เลย แทนที่จะรอ merge ตามแผนเดิม)
- [ ] 3.3 archive change นี้ด้วย `/opsx:archive` หลังยืนยันว่า deploy เรียบร้อย — **รอ**: ยังไม่ได้ deploy
