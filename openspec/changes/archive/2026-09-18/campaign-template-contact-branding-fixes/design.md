## Context

เดิม `emailTemplates.ts` ถูกเขียนขึ้นโดยไม่มีมาตรฐานเรื่องข้อมูลติดต่อ/แบรนด์ที่สม่ำเสมอ — บาง template ใส่ `{{company_website}}` เป็นลิงก์ บางอันไม่ใส่, บาง template มี footer ครบทุกช่องทาง บางอันไม่มีเลย, และไม่มีใครเคยใช้ `{{company_name_en}}` เลยตั้งแต่เพิ่ม merge tag นี้เข้าระบบ

Change `campaign-template-chrome-lock` และ `campaign-template-chrome-lock-phase2` (archived แล้วทั้งคู่) แยกส่วน chrome ออกจากเนื้อหาที่แก้ไขได้ครบทั้ง 20 template แล้ว — งานนี้เป็นคนละชั้นกัน: **แก้เนื้อหาข้างในของ chrome เอง** ให้ครบถ้วน/ใช้งานได้/ถูกภาษา ไม่เกี่ยวกับกลไกแยกเนื้อหา/marker ใดๆ เลย

ยืนยันแล้วว่า `tel:`/`mailto:` ปลอดภัยต่อระบบ click-tracking เดิม — `api/email-utils.php::processEmailHtml()` มีเงื่อนไขข้าม `mailto:`/`tel:`/`javascript:`/`#` จากการห่อ track-click.php อยู่แล้วตั้งแต่ก่อน change นี้:
```php
if (preg_match('/^(mailto:|tel:|javascript:|#)/i', $originalUrl)) {
    return $matches[0];
}
```

## Goals / Non-Goals

**Goals:**
- เบอร์โทร/อีเมล/เว็บไซต์ ใน chrome ของทุก template ต้องกดได้ (tel:/mailto:/href) ในทุกจุดที่แสดงเป็นข้อความ
- Footer ของทุก template ต้องมีชื่อบริษัทอย่างน้อย (ไม่บังคับให้ทุก template มีข้อมูลชุดเดียวกันทั้งหมด — แค่ต้องมี `{{company_name}}` เป็นขั้นต่ำ)
- Header ของ template ที่เนื้อหาเป็นภาษาอังกฤษล้วนต้องใช้ `{{company_name_en}}` แทน `{{company_name}}`

**Non-Goals:**
- ไม่บังคับให้ทุก template มี field ครบเหมือนกันทั้งหมด (address/tax_id ฯลฯ) — แค่เติมส่วนที่ขาดจริง (`company_name`) และห่อลิงก์ส่วนที่มีอยู่แล้ว
- ไม่เปลี่ยนดีไซน์/เลย์เอาต์ของ footer เดิม (สี, ตำแหน่ง, font-size) ยกเว้น template-18 ที่ต้อง**สร้าง**แถว footer ใหม่เพราะไม่มีอยู่เลย
- ไม่แตะ chrome-lock/marker/compose logic ใดๆ — งานนี้อยู่ใน `html`/`defaultContent` string เท่านั้น ไม่แตะ `CampaignsPage.tsx`/backend/DB

## Decisions

### Decision 1: ห่อลิงก์แบบ inline `style="color:inherit;text-decoration:none;"` ไม่ใช่ class
Email client ส่วนใหญ่ไม่รองรับ `<style>`/class-based CSS อย่างน่าเชื่อถือ (inline style เท่านั้นที่ปลอดภัยข้าม client) — ใช้รูปแบบเดียวกับที่ `{{company_website}}` เคยถูกห่อไปแล้วในอดีต (commit `13e9ae6`): กำหนดสีตรงตามสีเดิมของแต่ละจุด (ไม่ใช้ `color:inherit` เพราะบาง email client ไม่รองรับ `inherit` ใน `<a>` ได้ดีนัก — ใช้ hex สีเดิมของแต่ละจุดแทนตรงๆ)

### Decision 2: template-18 สร้าง footer ใหม่ด้วยโทนสี/ฟอนต์เดียวกับส่วนอื่นของ template
ไม่มี footer เดิมให้อ้างอิง จึงต้องออกแบบใหม่ให้เข้ากับธีมสีเขียว (`#16a34a`/`#f0fdf4`) ที่ใช้อยู่ทั้ง template — ใส่ `{{company_name}}`, `{{company_phone}}` (ห่อ tel:), `{{company_email}}` (ห่อ mailto:) ตามมาตรฐานเดียวกับ template อื่น ไม่ใส่ `{{company_website}}`/`{{company_address}}` เพิ่มเพราะไม่ใช่ scope ของ "เติมให้ครบขั้นต่ำ" (Non-Goal ข้างต้น)

### Decision 3: ตำแหน่งที่แก้อาจอยู่ใน `html` (chrome) หรือ `defaultContent` (เนื้อหาที่แก้ไขได้) แล้วแต่ template
หลัง chrome-lock migration บาง footer/header ยังอยู่ใน `html` (เพราะไม่เคยถูกรวมเข้า `{{EMAIL_CONTENT}}` zone) แต่บางจุดที่เกี่ยวกับ contact info อาจตกอยู่ใน `defaultContent` โดยบังเอิญถ้า template นั้นรวม footer เข้าไปในโซนเนื้อหาตอน migration (ต้องตรวจสอบทีละ template ตอน apply ว่าจุดที่จะแก้อยู่ใน `html` หรือ `defaultContent` แล้วแก้ให้ถูกจุด — ถ้าอยู่ใน `defaultContent` แปลว่าผู้ใช้แก้ไขทับได้ ซึ่งยอมรับได้เพราะเป็นพฤติกรรมเดิมของ chrome-lock อยู่แล้ว ไม่ใช่ bug ใหม่)

## Risks / Trade-offs

- **[Risk]** เผลอห่อ `tel:`/`mailto:` ในจุดที่อยู่ใน `defaultContent` ของ template ที่ chrome-lock แล้ว จะทำให้ผู้ใช้เผลอลบลิงก์ทิ้งตอนแก้ไขเนื้อหาได้ (เพราะเป็นส่วนที่แก้ไขได้) → **Mitigation:** ยอมรับความเสี่ยงนี้เพราะเป็นพฤติกรรมเดิมของระบบ chrome-lock (เนื้อหาในโซนแก้ไขได้แก้ไขได้อิสระอยู่แล้วตามดีไซน์) ไม่ใช่จุดบกพร่องใหม่จาก change นี้
- **[Risk]** สีลิงก์/`text-decoration` ผิดพลาดทำให้หน้าตาต่างจากเดิม (ไม่ตรง Requirement "chrome ต้องเหมือนเดิมทุกจุด" ของ change ก่อนหน้า) → **Mitigation:** ทดสอบ preview เทียบสีก่อน-หลังทุก template ที่แก้ ก่อนถือว่าเสร็จ
- **[Risk]** การสลับ `{{company_name}}`→`{{company_name_en}}` ถ้า `company_name_en` ใน DB ยังไม่ได้ตั้งค่าไว้ (ค่าว่าง) จะทำให้ header ของ 11 template โชว์ช่องว่างแทนชื่อบริษัท → **Mitigation:** ตรวจสอบค่า `company_name_en` ใน `company_settings` ก่อนเริ่ม apply — ถ้าว่างต้องแจ้งผู้ใช้ให้ตั้งค่าก่อน หรือ fallback เป็น `{{company_name}}` ชั่วคราว (ตัดสินใจตอน apply)

## Migration Plan

1. ตรวจสอบค่า `company_name_en` ปัจจุบันใน `company_settings` ก่อนเริ่ม (ป้องกัน Risk ข้อ 3)
2. แก้ทีละ template ตาม `tasks.md` — ตรวจก่อนว่าจุดที่จะแก้อยู่ใน `html` หรือ `defaultContent`
3. ทดสอบ preview เทียบก่อน-หลังทุก template ที่แก้ (สี, ตำแหน่ง, ขนาดต้องเหมือนเดิม ต่างแค่ตรงคลิกได้/ครบถ้วน/ภาษา)
4. ทดสอบคลิกลิงก์ tel:/mailto: จริงในอีเมลที่ส่งออก (ยืนยัน href ถูกต้อง ไม่ถูก track-click.php ห่อทับ)
5. `pnpm lint` + `pnpm build`

ไม่มี DB migration ในงานนี้ — แก้ markup ล้วนๆ ย้อนกลับได้ด้วย git revert ไฟล์เดียว ไม่กระทบข้อมูลแคมเปญที่มีอยู่

## Open Questions

(ไม่มี — ตรวจสอบแล้ว `company_settings.company_name_en` ตั้งค่าไว้แล้วเป็น "KTN BUSINESS SOLUTIONS CO.,LTD." ไม่ต้องทำ fallback)
