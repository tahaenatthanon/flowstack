## Context

`CampaignsPage.tsx` มีฟังก์ชัน `buildEmailPreviewHtml(html, subject, companyName)` ที่คอมเมนต์ระบุไว้ชัดว่า "mirrors PHP wrapEmailHtml" — มีไว้ render ตัวอย่างอีเมลฝั่ง client ให้ตรงกับสิ่งที่ backend จะสร้างจริงตอนส่ง ฟังก์ชันนี้เอา `html` (เนื้อหาปัจจุบันของ `campaignBody`) มาห่อด้วย header ("{{company_name}}") + footer ("คุณได้รับอีเมลนี้เพราะ...") ของตัวเองเสมอ โดยไม่เช็คก่อนว่าเนื้อหาที่ได้รับมาเป็นเอกสาร HTML เต็มอยู่แล้วหรือไม่

Template ทุกตัวใน `src/data/emailTemplates.ts` เก็บเป็นเอกสาร HTML แบบเต็ม (มี `<!DOCTYPE html><html><head>...</head><body>...</body></html>` และมี header/footer ของตัวเองอยู่ในนั้นแล้ว) เมื่อผู้ใช้เลือก template (`handleTemplateClick` เซ็ต `campaignBody = template.html` ตรงๆ) แล้วเปิดแท็บ "ตัวอย่าง" จึงเกิดการครอบซ้ำ: header/footer ของ `buildEmailPreviewHtml` + header/footer ของ template เอง แสดงต่อกันในหน้าเดียว

ฝั่ง backend จริง (`api/email-utils.php` ฟังก์ชัน `wrapEmailHtml()`) มี guard กันปัญหานี้อยู่แล้วตั้งแต่บรรทัดแรก:
```php
function wrapEmailHtml(string $html, string $subject = '', array $companySettings = []): string {
    if (stripos($html, '<html') !== false) {
        return $html;
    }
    ...
```
เนื้อหาที่มี `<html` อยู่แล้วจะถูกคืนค่าตรงๆ ไม่ครอบซ้ำ — อีเมลที่ส่งจริงจึงไม่มีปัญหานี้เลย มีแต่ `buildEmailPreviewHtml()` ฝั่ง client ที่ลืม copy guard ตัวนี้มาด้วยตอนที่เขียน mirror ขึ้นมา

## Goals / Non-Goals

**Goals:**
- แท็บ "ตัวอย่าง" ต้องแสดงผลตรงกับอีเมลที่จะถูกส่งจริงเสมอ (ซึ่ง backend guard ไว้แล้วว่าไม่ครอบซ้ำ) — ทำให้ client mirror ตรงกับพฤติกรรมจริงของ backend
- แก้ด้วยการเพิ่ม guard เดียวกับ PHP เท่านั้น ไม่เปลี่ยน logic อื่นของฟังก์ชัน

**Non-Goals:**
- ไม่แก้ปัญหาความกว้างกรอบ preview ที่แคบกว่า 600px (เนื้อหาฝั่งขวาถูกตัด) — เป็น change แยกต่างหาก
- ไม่แก้ปัญหาเนื้อหาหายเมื่อสลับแท็บเร็ว — แก้ไปแล้วใน change ก่อนหน้า (`fix-campaign-editor-content-loss`, archive แล้ว)
- ไม่เปลี่ยนโครงสร้างข้อมูล template ใน `emailTemplates.ts` หรือวิธีที่ template ถูกเก็บ (ยังคงเป็นเอกสาร HTML เต็มเหมือนเดิม)

## Decisions

### Decision: เพิ่ม early-return guard ที่ต้น `buildEmailPreviewHtml()` ให้ตรงกับ PHP `wrapEmailHtml()`
เพิ่มเงื่อนไขตรวจว่า `html` มี `<html` อยู่หรือไม่ (เช่น `if (/<html/i.test(html)) return html;`) ไว้เป็นบรรทัดแรกสุดของฟังก์ชัน ก่อนขั้นตอน rewrite `/uploads/` path และการครอบ header/footer/hero ทั้งหมด — ตรงกับตำแหน่งและเงื่อนไขของ guard ฝั่ง PHP เป๊ะๆ เพื่อให้พฤติกรรมทั้งสองฝั่งตรงกันแน่นอน ไม่ใช่แค่ "ใกล้เคียง"

**ทางเลือกที่พิจารณาแล้วไม่เลือก:**
- *ตรวจจับและ "แกะ" เอาเฉพาะ body content ออกจากเอกสารเต็มของ template ก่อนส่งเข้า `buildEmailPreviewHtml`* — จะทำให้ preview เห็น header/footer ของ `buildEmailPreviewHtml` เองแทน (ไม่ใช่ของ template) ซึ่งไม่ตรงกับพฤติกรรมจริงของ backend ที่คืนค่า template เดิมตรงๆ โดยไม่แตะต้องอะไรเลย จึงไม่เลือกวิธีนี้
- *แก้ที่จุดเลือก template แทน (บังคับให้ดึงเฉพาะ body content ออกมาเก็บใน `campaignBody`)* — กระทบ requirement เดิมของ `email-campaign-template-picker` ที่บอกว่า "เนื้อหาที่ตั้งค่าจาก Template ต้องไม่ถูกแก้ไขเพิ่มเติมโดยอัตโนมัติ...คงเนื้อหานั้นไว้ตรงตามต้นฉบับ" การแกะ/แก้ไขเนื้อหาตอนเลือก template จะขัดกับ requirement นี้โดยตรง จึงไม่เลือก — การแก้ที่ layer การ "แสดงผล preview" เท่านั้น ปลอดภัยกว่าและตรงประเด็นกว่า

## Risks / Trade-offs

- **[Risk]** ถ้าในอนาคตมีการสร้างเนื้อหาแบบพิมพ์เอง (ไม่ใช่ template) ที่บังเอิญมีคำว่า `<html` ปนอยู่ในข้อความ (ไม่น่าเกิดขึ้นจริงเพราะ `<html` เป็น HTML tag ไม่ใช่ข้อความปกติ) จะถูกตีความผิดว่าเป็นเอกสารเต็มแล้วไม่ครอบ wrapper ให้ **[Mitigation]** ใช้ logic เดียวกันกับ PHP เป๊ะๆ (ซึ่งพิสูจน์แล้วว่าทำงานถูกต้องกับอีเมลจริงที่ส่งไปแล้วจำนวนมาก) ความเสี่ยงนี้มีอยู่แล้วในฝั่ง backend เช่นกัน ไม่ใช่ความเสี่ยงใหม่ที่เกิดจากการแก้นี้
- **[Risk]** หลังแก้แล้ว preview ของ template จะไม่มี merge tag ของ `senderName`/`smtpFromName` (parameter `companyName` ที่เคยถูกส่งเข้าไปสร้าง header) ปรากฏใน UI อีกต่อไปเมื่อเนื้อหาเป็น template เต็ม (เพราะ header ของ wrapper ไม่ถูกสร้างแล้ว) **[Mitigation]** นี่คือพฤติกรรมที่ถูกต้องตามที่ตั้งใจ — template มี header ของตัวเองอยู่แล้ว (มักใช้ `{{company_name}}` merge tag) ไม่จำเป็นต้องมี header ซ้อนจาก wrapper อีกชั้น ตรงกับสิ่งที่อีเมลจริงจะเป็น

## Migration Plan

- เป็นการแก้โค้ด frontend ล้วน (1 ฟังก์ชัน, เพิ่ม guard 1 เงื่อนไข) ไม่มี database migration ไม่มี breaking change ต่อ API
- Deploy ตามรอบ build ปกติ (`pnpm build`)
- ทดสอบด้วยมือก่อนปิดงาน: เลือก template ที่มี header/footer ชัดเจน (เช่น "สไตล์จดหมายข่าว") → เปิดแท็บ "ตัวอย่าง" → ยืนยันเห็น header/footer แค่ชุดเดียว (ของ template) ไม่ซ้อนกัน → เทียบกับไดอะล็อก "ดู" ของแท็บเทมเพลตหลักว่าหน้าตาตรงกัน
- ทดสอบเพิ่ม: พิมพ์เนื้อหาเองแบบไม่ใช้ template (fragment ธรรมดา ไม่มี `<html`) → ยืนยันแท็บ "ตัวอย่าง" ยังคงมี header/footer ของ wrapper ตามปกติเหมือนเดิม (ไม่ regression)
- Rollback: revert commit เดียว ไม่มี state เปลี่ยนแปลงถาวรฝั่ง backend/DB ให้ต้อง rollback เพิ่ม

## Open Questions

(ไม่มี — ขอบเขตชัดเจน แก้จุดเดียวตรงไปตรงมา)
