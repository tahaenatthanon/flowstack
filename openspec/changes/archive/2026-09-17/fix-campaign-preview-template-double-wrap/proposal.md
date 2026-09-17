## Why

ในไดอะล็อก "สร้าง/แก้ไขแคมเปญ" เมื่อผู้ใช้เลือก Template จากส่วน "Template เริ่มต้น" แล้วเปิดแท็บ "ตัวอย่าง" ของ section "เนื้อหาอีเมล" จะเห็น header และ footer ซ้อนกัน 2 ชั้น — ชั้นหนึ่งมาจาก wrapper ของฟังก์ชัน preview เอง อีกชั้นมาจาก header/footer ที่ template นั้นมีอยู่แล้วในตัว เพราะ template ทุกตัวใน `emailTemplates.ts` เก็บเป็นเอกสาร HTML แบบเต็ม (มี `<!DOCTYPE html><html>...<body>...</body></html>` ของตัวเอง) ไม่ใช่แค่ fragment เนื้อหา ยืนยันแล้วด้วยการรีโปรดิวซ์จริง: เลือก template "สไตล์จดหมายข่าว" แล้วเห็น header ปลอมจาก wrapper ตามด้วย header จริงของ template และ footer ซ้อนกันทำนองเดียวกันที่ท้ายเนื้อหา

จุดสำคัญคือฝั่ง backend (PHP) ที่ใช้ตอนส่งอีเมลจริง (`wrapEmailHtml()` ใน `api/email-utils.php`) มี guard ป้องกันกรณีนี้อยู่แล้ว (เช็คว่าเนื้อหามี `<html` อยู่แล้วหรือไม่ ถ้ามีคืนค่าตรงๆ ไม่ครอบซ้ำ) แต่ฟังก์ชัน mirror ฝั่ง client (`buildEmailPreviewHtml()` ใน `CampaignsPage.tsx`) ไม่มี guard นี้ ทำให้ **อีเมลที่ส่งจริงไม่มีปัญหา กระทบเฉพาะหน้าตัวอย่างเท่านั้น** — แต่ก็ยังทำให้ผู้ใช้เข้าใจผิดว่าอีเมลจะออกมาไม่สวย/ผิดรูปแบบตอนกำลังตรวจตัวอย่างก่อนส่งจริง

## What Changes

- แก้ `buildEmailPreviewHtml()` ใน `CampaignsPage.tsx` ให้มี guard เดียวกับฝั่ง PHP: ถ้าเนื้อหาที่ได้รับมาเป็นเอกสาร HTML เต็มอยู่แล้ว (มี `<html` อยู่ในเนื้อหา) ให้คืนค่าตรงๆ โดยไม่ครอบ wrapper (header/footer ของตัวเอง) ซ้ำอีกชั้น
- ผลคือแท็บ "ตัวอย่าง" หลังเลือก Template จะแสดงตรงกับสิ่งที่เห็นในไดอะล็อก "ดู" ของแท็บเทมเพลตหลัก (ซึ่งไม่มีปัญหานี้อยู่แล้ว เพราะ srcDoc ใส่ HTML ของ template ตรงๆ ไม่ผ่าน `buildEmailPreviewHtml()`)

## Capabilities

### New Capabilities

(ไม่มี)

### Modified Capabilities

- `email-campaign-template-picker`: เพิ่ม requirement ว่าแท็บ "ตัวอย่าง" ต้องไม่ครอบ header/footer ของตัวเองซ้ำกับ template ที่เนื้อหาเป็นเอกสาร HTML เต็มอยู่แล้ว (ขยายความจาก requirement เดิม "แท็บตัวอย่างแสดงตรงกับ template ที่เลือก" ให้ครอบคลุมกรณีนี้อย่างชัดเจน)

## Impact

- **ไฟล์ที่คาดว่าต้องแก้:** `src/pages/CampaignsPage.tsx` (ฟังก์ชัน `buildEmailPreviewHtml`)
- **ผลกระทบ:** เฉพาะการแสดงผลในแท็บ "ตัวอย่าง" ของไดอะล็อกสร้าง/แก้ไขแคมเปญเท่านั้น ไม่กระทบอีเมลจริงที่ส่งออกไป (ฝั่ง PHP ป้องกันไว้อยู่แล้ว) ไม่มี database migration ไม่มี breaking change ต่อ API
- **นอกสโคป:** ปัญหาความกว้างกรอบ preview ที่แคบกว่า 600px (ทำให้เนื้อหาฝั่งขวาถูกตัด) เป็นบั๊กแยกต่างหากที่ต้องแก้เป็น change อื่น — ไม่รวมอยู่ใน change นี้
