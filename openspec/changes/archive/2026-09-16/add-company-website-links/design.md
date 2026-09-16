## Context

`src/data/emailTemplates.ts` เก็บ 20 email template แบบ HTML string คงที่ ไม่มี logic ประมวลผลเพิ่มเติม — การ "เพิ่มลิงก์" คือแค่แก้ HTML string ตรงๆ ไม่มี state หรือ component เกี่ยวข้อง

5 templates ที่ต้องแก้ (ยืนยันเลขบรรทัดจากไฟล์จริงแล้ว):
- template-1 Professional Classic — บรรทัด 35 (header)
- template-2 Modern Minimal — บรรทัด 108 (footer)
- template-4 Business Pro — บรรทัด 194 (header)
- template-6 Fresh Green — บรรทัด 327 (contact box)
- template-8 Corporate Blue — บรรทัด 420 (header)

## Goals / Non-Goals

**Goals:**
- ทำให้ `{{company_website}}` ใน 5 template นี้กดได้ (`<a href>`) เพื่อให้ `processEmailHtml()` ห่อลิงก์ติดตามคลิกให้อัตโนมัติตอนส่งจริง
- คงหน้าตา/สไตล์เดิมทุกอย่างไว้ 100% — ผู้ใช้ที่เคยเห็น template นี้มาก่อนต้องไม่รู้สึกว่าดีไซน์เปลี่ยน

**Non-Goals:**
- ไม่เพิ่มปุ่ม CTA ใหม่ ไม่เปลี่ยน layout
- ไม่แตะ 15 template อื่นที่อยู่นอกขอบเขต (มีปุ่มอยู่แล้ว หรือไม่มี `{{company_website}}` เลย)
- ไม่แก้ logic การห่อลิงก์ (`processEmailHtml()` ใน `api/email-utils.php`) — ของเดิมรองรับ `<a href>` อยู่แล้ว ไม่ต้องแก้อะไรฝั่ง backend

## Decisions

### ห่อด้วย `<a href="{{company_website}}" style="...">` โดยคัดลอกสไตล์จาก `<p>`/element เดิมมาใส่ใน `<a>` ตรงๆ
**ทำไม:** วิธีเดียวกับที่ทำสำเร็จแล้วกับ template-1/2 ในรอบทดลองก่อนหน้า (ตรวจสอบผ่านแท็บ "ตัวอย่าง" แล้วว่าหน้าตาเหมือนเดิมทุกจุด) — เพราะ `<a>` ที่ไม่ตั้ง `text-decoration`/`color` เองจะถูก default style ของ email client ทับ (ขีดเส้นใต้/เปลี่ยนสีน้ำเงิน) ต้องกำหนดสไตล์ให้ `<a>` ตรงๆ ให้เหมือนกับ `<p>` เดิมเพื่อไม่ให้หน้าตาเปลี่ยน
**ทางเลือกที่ตัดออก:** เพิ่ม CSS class/`<style>` กลางแทนการ inline — เกินความจำเป็นสำหรับ 5 บรรทัด และ email client จำนวนมากไม่รองรับ `<style>` block แบบเชื่อถือได้ (inline style ปลอดภัยกว่าสำหรับอีเมล)

## Risks / Trade-offs

- **[Risk]** ถ้า email client บางตัว auto-underline/เปลี่ยนสีลิงก์ทับสไตล์ inline ที่ตั้งไว้ (บาง client มี default agent style ที่ specificity สูงกว่า) → **Mitigation**: ยอมรับความเสี่ยงนี้ เพราะเป็นความเสี่ยงเดียวกับ 6 template ที่มีปุ่ม CTA อยู่แล้วในระบบ (ใช้ inline style แบบเดียวกัน ยังไม่มีรายงานปัญหานี้)
