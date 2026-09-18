## Why

อีเมลแคมเปญที่สร้างจาก template สำเร็จรูป (`src/data/emailTemplates.ts`) จะแสดงผล **header และ footer ซ้อนกัน** ทันทีที่ผู้ใช้เปิดแท็บ "แก้ไข" ในหน้าต่างสร้างแคมเปญ สาเหตุคือ rich-text editor (TipTap ผ่าน `ArticleEditor`) จะตัด `<!DOCTYPE html><html><head><body>` ของ template ทิ้งเหลือแค่เนื้อหาข้างในทันทีที่ผู้ใช้แตะ/แก้ไข ส่วน backend ตอนส่งจริง (`api/email-utils.php:wrapEmailHtml`) ใช้การเช็คว่ามีคำว่า `<html` หลงเหลืออยู่หรือไม่เป็นตัวตัดสินว่าเนื้อหามี header/footer ของตัวเองอยู่แล้วหรือเปล่า พอ marker นี้หายไป backend จะห่อ header/footer แบบทั่วไปทับซ้อนเข้าไปอีกชั้น กลายเป็นอีเมลที่มี 2 header 2 footer (ยืนยันจากภาพหน้าจอ Gmail จริง และเทียบ `body_html` ที่บันทึกไว้ของ 2 แคมเปญทดสอบ: `ทดสอบ 10` ที่ไม่ได้แก้ไข/ปกติดี เทียบกับ `ทดสอบ 11` ที่แก้ไขแล้ว/ซ้อนกัน)

## What Changes

- บันทึกไว้ว่าแคมเปญนั้นสร้างจาก template สำเร็จรูปตัวไหน (ถ้ามี) โดยเพิ่มคอลัมน์ `template_id` ในตาราง `email_campaigns`
- เมื่อแคมเปญมี `template_id` ระบบส่งอีเมลจะ**ข้ามการห่อ header/footer แบบทั่วไป** (`wrapEmailHtml()`) ไปเลย — ใช้ header/footer ของ template เดิม (ที่ผู้ใช้แก้ไขแล้ว) ส่งตรงๆ
- แคมเปญที่ไม่มี `template_id` (เขียนขึ้นเองตั้งแต่ต้น) ยังคงพฤติกรรมเดิม — `wrapEmailHtml()` ยังคงห่อ header/footer แบบทั่วไปให้เหมือนเดิม เพราะไม่มี chrome ของ template ให้รักษาไว้
- Frontend (`CampaignsPage.tsx`) ส่งค่า template ที่เลือกไว้ (`template_id` หรือ null) ไปพร้อมตอนสร้าง/แก้ไขแคมเปญ

ไม่มีการแก้ไขเนื้อหา template, ตัว editor เอง, หรือ logic แสดงตัวอย่างฝั่ง frontend (`buildEmailPreviewHtml()`) — การแก้ครั้งนี้แก้เฉพาะจุดที่ backend เข้าใจผิดเกี่ยวกับเนื้อหาที่ editor สร้างออกมาตอนส่งจริงเท่านั้น

## Capabilities

### New Capabilities
- `campaign-email-rendering`: ควบคุมว่า body HTML ที่บันทึกไว้ของแคมเปญจะถูกแปลงเป็น HTML สุดท้ายที่ส่งถึงผู้รับอย่างไร โดยเฉพาะเรื่องว่าจะห่อ header/footer แบบทั่วไปเพิ่มหรือไม่

### Modified Capabilities
(ไม่มี — ยังไม่มี spec เดิมอยู่ในโปรเจกต์นี้)

## Impact

- **Database**: migration ใหม่เพิ่ม `email_campaigns.template_id` (nullable, ไม่บังคับ FK เพราะ template ใน `emailTemplates.ts` เป็นข้อมูล static ฝั่ง frontend ไม่ได้เก็บในตาราง DB)
- **Backend**: `api/email-campaigns.php` (รับ/บันทึก `template_id` ตอนสร้าง/แก้ไข, อ่านค่ากลับมาใช้ตอนส่ง), `api/email-utils.php` (`wrapEmailHtml` เพิ่มทางข้าม หรือให้ฝั่งเรียกใช้ส่ง flag มา)
- **Frontend**: `src/pages/CampaignsPage.tsx` (ส่ง `selectedTemplate` เป็น `template_id` ใน payload ตอนสร้าง/แก้ไข)
- ไม่กระทบแคมเปญที่ส่งไปแล้วในอดีต (แถวเดิมจะได้ `template_id = NULL` ทำให้ยังคงพฤติกรรมห่อแบบเดิมสำหรับแคมเปญเหล่านั้น)
