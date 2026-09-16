# email-template-website-link Specification

## Purpose

กำหนดว่า merge tag `{{company_website}}` ในเนื้อหา email template ต้องเป็นลิงก์ที่กดได้ (`<a href>`) เพื่อให้ระบบติดตามคลิก (`track-click.php`) ทำงานได้ ไม่ใช่ข้อความล้วนที่กดไม่ได้และวัดผลไม่ได้

## Requirements

### Requirement: Merge tag `{{company_website}}` ต้องเป็นลิงก์ที่กดได้ในทุก template ที่มี tag นี้
ทุก email template ใน `src/data/emailTemplates.ts` ที่มี merge tag `{{company_website}}` อยู่ในเนื้อหา SHALL ห่อ tag นั้นด้วย `<a href="{{company_website}}">` เพื่อให้ผู้รับอีเมลกดได้ และให้ `processEmailHtml()` ห่อลิงก์ติดตามคลิกให้ได้ตอนส่งจริง — ไม่ใช่แสดงเป็นข้อความล้วนที่กดไม่ได้

#### Scenario: Template ที่ไม่มีปุ่ม CTA อยู่แล้ว มี company_website เป็นลิงก์
- **WHEN** ผู้ใช้เลือก template-1, template-2, template-4, template-6 หรือ template-8 ในหน้าสร้าง/แก้ไขแคมเปญ
- **THEN** ข้อความ `{{company_website}}` ในเนื้อหาที่ได้ถูกห่อด้วย `<a href="{{company_website}}">` และแสดงผลด้วยสไตล์ (สี, ขนาด, ตำแหน่ง) เดิมทุกประการเมื่อดูในแท็บ "ตัวอย่าง"

#### Scenario: Template ที่มีปุ่ม CTA อยู่แล้วไม่ถูกแก้ไขซ้ำ
- **WHEN** ผู้ใช้เลือก template-5, 11, 14, 16, 18, หรือ 20 (มีปุ่ม `<a href="{{company_website}}">` เป็น CTA อยู่แล้ว)
- **THEN** เนื้อหาของ template เหล่านี้ไม่เปลี่ยนแปลงจากเดิม — ข้อความ `{{company_website}}` ที่ปรากฏซ้ำใน footer ของ template-11, 16, 20 (นอกเหนือจากปุ่ม CTA) ยังคงเป็นข้อความล้วนเหมือนเดิม ไม่ถูกห่อเพิ่ม

#### Scenario: Template ที่ไม่มี company_website เลยไม่ถูกแก้ไข
- **WHEN** ผู้ใช้เลือก template ที่ไม่มี merge tag `{{company_website}}` อยู่ในเนื้อหาเลย (template-3, 7, 9, 10, 12, 13, 15, 17, 19)
- **THEN** เนื้อหาของ template เหล่านี้ไม่เปลี่ยนแปลงจากเดิม
