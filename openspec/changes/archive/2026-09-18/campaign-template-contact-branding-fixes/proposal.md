## Why

ระหว่างสำรวจ 20 template อีเมลแคมเปญ (เพื่อทำ chrome-lock ให้ครบ) พบจุดบกพร่องด้านข้อมูลติดต่อ/แบรนด์ 3 เรื่องที่ตกค้างมานาน ไม่เกี่ยวกับเรื่อง chrome-lock เลย:

1. **เบอร์โทร/อีเมล กดไม่ได้** — `{{company_phone}}` ไม่เคยถูกห่อด้วย `tel:` เลยสักจุดใน 20 template และ `{{company_email}}` ส่วนใหญ่เป็น plain text ไม่ใช่ `mailto:` (มีแค่ 2 ปุ่ม CTA เท่านั้นที่เป็น mailto) ผู้รับอีเมลบนมือถือต้อง copy เลขเอง กดโทร/ส่งอีเมลไม่ได้ทันที — ต่างจาก `{{company_website}}` ที่เคยถูกแก้ไปแล้วบางส่วนในอดีต (commit `13e9ae6`) แต่ก็ยังไม่ครบทุก template
2. **Footer ข้อมูลบริษัทไม่ครบ/ไม่สม่ำเสมอ** — 4 template (15, 17, 18, 19) ไม่มีชื่อบริษัท (`{{company_name}}`) ปรากฏใน chrome เลย โดยเฉพาะ template-18 "แบบสำรวจความคิดเห็น" แทบไม่มีข้อมูลบริษัทใดๆ เลยทั้งฉบับ (จบด้วยแค่ "Thank you for your time! 🙏") ผู้รับไม่รู้ว่าใครส่งมา
3. **ชื่อบริษัทผิดภาษา** — 11 template ที่เนื้อหาเขียนเป็นภาษาอังกฤษล้วน แต่หัวเรื่องกลับใช้ `{{company_name}}` (ชื่อไทย) แทรกอยู่กลางประโยคอังกฤษ ควรใช้ `{{company_name_en}}` ที่มีอยู่ในระบบ merge tag แล้วแต่ไม่เคยถูกใช้จริงเลยสักครั้ง

ทั้ง 3 เรื่องนี้แก้ไฟล์เดียวกัน (`src/data/emailTemplates.ts`) และหลายจุดทับซ้อนกัน (footer เดียวกันอาจต้องแก้ทั้งลิงก์และความครบถ้วน) จึงรวมเป็น change เดียวเพื่อลดรอบเปิด-รีวิวไฟล์ซ้ำ — แยกจาก `campaign-template-chrome-lock`/`campaign-template-chrome-lock-phase2` เพราะเป็นคนละโจทย์กันสิ้นเชิง (นี่คือความครบถ้วน/ใช้งานได้ของ "chrome" เอง ไม่ใช่การแยกเนื้อหาที่แก้ไขได้ออกจาก chrome)

## What Changes

- ห่อ `{{company_phone}}` ด้วย `<a href="tel:{{company_phone}}">` ในทุกจุดที่เป็น plain text (18 template — ทุกอันที่มีเบอร์โทร ยกเว้น template-17, 18 ที่ไม่มีเบอร์โทรอยู่แล้ว)
- ห่อ `{{company_email}}` ด้วย `<a href="mailto:{{company_email}}">` ในทุกจุดที่ยังเป็น plain text (18 template — ไม่รวม template-7 ที่มีแค่ปุ่ม CTA mailto อยู่แล้ว, ไม่รวม template-18 ที่ไม่มีอีเมลอยู่แล้ว)
- เติม `<a href="{{company_website}}">` ให้ `{{company_website}}` ที่ยังเหลือเป็น plain text ใน footer (template-11, 16, 20 — ทั้ง 3 นี้มีปุ่ม CTA ลิงก์ website แยกอยู่แล้ว แต่ใน footer มีอีกจุดที่ยังไม่ได้ห่อ)
- เติม `{{company_name}}` เข้า footer ของ 4 template ที่ขาด (15, 17, 19 — เติมแค่ชื่อบริษัท) และสร้าง footer ใหม่ทั้งหมดให้ template-18 (ปัจจุบันไม่มีข้อมูลบริษัทเลย)
- สลับ `{{company_name}}` → `{{company_name_en}}` ในหัวเรื่องของ 11 template ที่เนื้อหาเป็นภาษาอังกฤษล้วน (4, 5, 6, 7, 8, 10, 11, 12, 14, 16, 20) — คงไว้เป็น `{{company_name}}` สำหรับ 6 template ที่เนื้อหาเป็นภาษาไทย/ผสม (1, 2, 3, 9, 15, 19) และไม่แตะ 3 template ที่ไม่ใช้ `{{company_name}}` ใน header อยู่แล้ว (13, 17, 18)
- ทุกจุดที่แก้ต้องคง `text-decoration:none` และสีตัวอักษรเดิมไว้ (ไม่ให้ลิงก์กลายเป็นสีน้ำเงินขีดเส้นใต้ตาม default ของ browser ต่างจาก chrome เดิม)

## Capabilities

### New Capabilities
- `email-template-contact-info-quality`: กำหนดว่าข้อมูลติดต่อ (เบอร์โทร/อีเมล/เว็บไซต์/ชื่อบริษัท) ใน chrome ของ email template ต้องครบถ้วน คลิกได้ และใช้ภาษาให้ตรงกับเนื้อหาของ template นั้น

### Modified Capabilities
(ไม่มี — ไม่กระทบ `campaign-template-content-composition` เพราะแก้เฉพาะส่วน chrome ที่ล็อกตายตัวอยู่แล้ว ไม่แตะ marker/compose logic ใดๆ, ไม่กระทบ `campaign-email-rendering` เพราะ backend ไม่ต้องแก้)

## Impact

- **Frontend**: `src/data/emailTemplates.ts` เท่านั้น (แก้ markup ใน `html` string ของแต่ละ template — บาง template แก้ใน `defaultContent` ด้วยถ้าจุดที่ต้องแก้ตกอยู่ในโซนเนื้อหาที่แก้ไขได้)
- **ไม่แตะ**: `CampaignsPage.tsx`, backend, ฐานข้อมูล, `composeCampaignHtml()` — ไม่มี logic ใหม่ ไม่มี field ใหม่ เป็นการแก้ markup ล้วนๆ
- ไม่มีความเสี่ยงต่อ click-tracking เพราะ `tel:`/`mailto:` ถูกข้ามจากการห่อ track-click.php อยู่แล้ว (ยืนยันจากโค้ด `api/email-utils.php`)
- งานส่วนใหญ่เป็นแรงงานคนแก้ทีละ template เหมือน change ก่อนหน้า ไม่ใช่ auto-detect ได้
