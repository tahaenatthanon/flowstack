# email-template-contact-info-quality Specification

## Purpose

กำหนดว่าข้อมูลติดต่อ (เบอร์โทร/อีเมล/เว็บไซต์/ชื่อบริษัท) ใน chrome ของ email template ต้องครบถ้วน คลิกได้ และใช้ภาษาให้ตรงกับเนื้อหาของ template นั้น — เพื่อให้ผู้รับอีเมลกดโทร/ส่งอีเมล/เปิดเว็บไซต์ได้ทันทีจากอุปกรณ์มือถือ โดยไม่ต้อง copy ข้อความเอง และรู้ว่าใครเป็นผู้ส่งเสมอ ไม่ว่าจะเปิดด้วย email client ใดก็ตาม (ต่างจากการพึ่งพา auto-link ของ client ซึ่งไม่สม่ำเสมอข้าม client)

## Requirements

### Requirement: เบอร์โทรใน chrome ของ template ต้องคลิกโทรออกได้
ทุกจุดที่ template แสดง `{{company_phone}}` เป็นข้อความ ระบบ SHALL ห่อด้วย `<a href="tel:{{company_phone}}">` เพื่อให้ผู้รับกดโทรออกได้ทันทีจากอุปกรณ์มือถือ โดยสไตล์ที่แสดง (สี, ไม่มีขีดเส้นใต้) ต้องเหมือนเดิมก่อนห่อลิงก์ทุกจุด

#### Scenario: Template แสดงเบอร์โทร
- **WHEN** ตรวจสอบ template ที่มี `{{company_phone}}` ปรากฏอยู่
- **THEN** `{{company_phone}}` ถูกห่อด้วย `<a href="tel:{{company_phone}}">` พร้อม inline style ที่คงสี/ไม่มีขีดเส้นใต้เหมือนก่อนแก้

### Requirement: อีเมลใน chrome ของ template ต้องคลิกส่งอีเมลได้
ทุกจุดที่ template แสดง `{{company_email}}` เป็นข้อความ (ไม่ใช่ปุ่ม CTA ที่เป็น mailto อยู่แล้ว) ระบบ SHALL ห่อด้วย `<a href="mailto:{{company_email}}">` เพื่อให้ผู้รับกดส่งอีเมลได้ทันที โดยสไตล์ที่แสดงต้องเหมือนเดิมก่อนห่อลิงก์

#### Scenario: Template แสดงอีเมลเป็นข้อความธรรมดา
- **WHEN** ตรวจสอบ template ที่มี `{{company_email}}` ปรากฏเป็นข้อความ (ไม่ใช่ในปุ่ม CTA ที่เป็น mailto อยู่แล้ว)
- **THEN** `{{company_email}}` ถูกห่อด้วย `<a href="mailto:{{company_email}}">` พร้อม inline style ที่คงสี/ไม่มีขีดเส้นใต้เหมือนก่อนแก้

### Requirement: เว็บไซต์ใน chrome ของ template ต้องคลิกเปิดได้ทุกจุด
ทุกจุดที่ template แสดง `{{company_website}}` เป็นข้อความ ระบบ SHALL ห่อด้วย `<a href="{{company_website}}">` แม้ template นั้นจะมีปุ่ม CTA ที่ลิงก์ไปเว็บไซต์อยู่แล้วในตำแหน่งอื่นก็ตาม

#### Scenario: Template มีข้อความ website ใน footer แยกจากปุ่ม CTA
- **WHEN** ตรวจสอบ template ที่มี `{{company_website}}` ปรากฏเป็นข้อความใน footer แยกจากปุ่ม CTA
- **THEN** ข้อความ `{{company_website}}` ใน footer ถูกห่อด้วย `<a href="{{company_website}}">` เช่นกัน ไม่ใช่แค่ปุ่ม CTA

### Requirement: Chrome ของทุก template ต้องแสดงชื่อบริษัทอย่างน้อยหนึ่งจุด
Chrome (ส่วนที่ล็อกตายตัว ไม่ใช่โซนเนื้อหาที่แก้ไขได้) ของทุก template SHALL มี `{{company_name}}` หรือ `{{company_name_en}}` ปรากฏอยู่อย่างน้อยหนึ่งจุด เพื่อให้ผู้รับอีเมลรู้ว่าใครเป็นผู้ส่ง

#### Scenario: Template ที่ chrome ไม่มีชื่อบริษัทเลย
- **WHEN** ตรวจสอบ chrome ของ template ใดๆ
- **THEN** พบ `{{company_name}}` หรือ `{{company_name_en}}` ปรากฏอยู่อย่างน้อยหนึ่งจุดในส่วน header หรือ footer

### Requirement: ภาษาของชื่อบริษัทต้องตรงกับภาษาของเนื้อหา template
เมื่อเนื้อหาหลักของ template (นอก merge tag) เขียนเป็นภาษาอังกฤษล้วน ระบบ SHALL ใช้ `{{company_name_en}}` แทน `{{company_name}}` ในตำแหน่งที่แสดงชื่อบริษัท เพื่อไม่ให้ชื่อบริษัทภาษาไทยแทรกอยู่กลางประโยคภาษาอังกฤษ — template ที่เนื้อหาเป็นภาษาไทยหรือผสมยังคงใช้ `{{company_name}}` ตามเดิม

#### Scenario: Template เนื้อหาอังกฤษล้วนแสดงชื่อบริษัท
- **WHEN** ตรวจสอบ template ที่ข้อความ chrome/เนื้อหาเริ่มต้นเขียนเป็นภาษาอังกฤษทั้งหมด และมีจุดแสดงชื่อบริษัท
- **THEN** จุดนั้นใช้ `{{company_name_en}}` ไม่ใช่ `{{company_name}}`

#### Scenario: Template เนื้อหาไทยหรือผสมยังใช้ชื่อไทย
- **WHEN** ตรวจสอบ template ที่ข้อความ chrome/เนื้อหาเริ่มต้นเป็นภาษาไทยหรือผสมไทย-อังกฤษ
- **THEN** จุดแสดงชื่อบริษัทยังคงใช้ `{{company_name}}` เหมือนเดิม ไม่เปลี่ยนเป็น `{{company_name_en}}`
