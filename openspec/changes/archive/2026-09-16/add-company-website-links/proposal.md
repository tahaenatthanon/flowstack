## Why

5 จาก 20 email template ในระบบ (`src/data/emailTemplates.ts`) มี merge tag `{{company_website}}` อยู่ในเนื้อหา แต่เป็นแค่ข้อความล้วน ไม่ได้ห่อด้วย `<a href>` — ผู้รับอีเมลกดไม่ได้เลย และระบบติดตามคลิก (`track-click.php`) ก็นับคลิกไม่ได้เพราะไม่มีลิงก์ให้ผ่านระบบ tracking ตั้งแต่ต้น (ยืนยันแล้วว่า `processEmailHtml()` ห่อลิงก์ติดตามเฉพาะ tag `<a href>` ที่มีอยู่แล้วเท่านั้น ไม่สแกนหาข้อความที่หน้าตาเหมือน URL) ทำให้ 5 template นี้ไม่มีทางวัด engagement ด้านคลิกได้เลย ต่างจาก 6 template อื่นที่มีปุ่ม CTA อยู่แล้ว

## What Changes

- ห่อ `{{company_website}}` ด้วย `<a href="{{company_website}}">` ใน 5 templates: **template-1 (Professional Classic), template-2 (Modern Minimal), template-4 (Business Pro), template-6 (Fresh Green), template-8 (Corporate Blue)**
- คงสไตล์เดิมทุกอย่าง (สี, ขนาด, ตำแหน่ง) ของข้อความนั้นไว้ — ใส่แค่ `href` ให้กดได้ ไม่เพิ่มปุ่ม CTA ใหม่ ไม่เปลี่ยนดีไซน์
- **ไม่แตะ** template อื่นนอกขอบเขตนี้: template-5, 11, 14, 16, 18, 20 (มีปุ่ม CTA อยู่แล้ว — footer text ซ้ำใน 11/16/20 ไม่ต้องห่อเพิ่ม), template-3, 7, 9, 10, 12, 13, 15, 17, 19 (ไม่มี `{{company_website}}` เลย อยู่นอกขอบเขต)

## Capabilities

### New Capabilities
- `email-template-website-link`: กำหนดว่า merge tag `{{company_website}}` ในเนื้อหา email template ต้องเป็นลิงก์ที่กดได้ (`<a href>`) เพื่อให้ระบบติดตามคลิกทำงานได้ ไม่ใช่ข้อความล้วน

### Modified Capabilities
(ไม่มี — ไม่กระทบ `email-campaign-template-picker` ซึ่งดูแลแค่ layout/พฤติกรรมของตัวเลือก template ใน dialog ไม่ใช่เนื้อหา HTML ภายใน template)

## Impact

- **ไฟล์ที่แก้:** `src/data/emailTemplates.ts` เท่านั้น (5 จุด, 1 บรรทัดต่อจุด)
- ไม่มี database migration, ไม่กระทบ API, ไม่กระทบ template อื่นที่ไม่อยู่ในขอบเขต
