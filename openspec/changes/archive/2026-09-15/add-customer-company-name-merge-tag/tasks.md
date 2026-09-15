## 1. Backend — เพิ่ม merge tag ใหม่

- [x] 1.1 ใน `api/email-utils.php` ลบบรรทัด `'{{company_name}}' => $company['name'] ?? ($companySettings['company_name'] ?? ''),` ออกจาก `$replacements` (dead code เพราะถูกทับด้วย `$companyReplacements` เสมอ)
- [x] 1.2 เพิ่มบรรทัดใหม่แทนที่ `'{{customer_company_name}}' => $company['name'] ?? '',` เข้า `$replacements` ในตำแหน่งเดียวกัน

## 2. เทมเพลตภาษาไทย — เพิ่ม "จาก {{customer_company_name}}"

- [x] 2.1 template-1 (บรรทัด ~41): `สวัสดีคุณ {{first_name}} {{last_name}}` → `สวัสดีคุณ {{first_name}} {{last_name}} จาก {{customer_company_name}}`
- [x] 2.2 template-2 (บรรทัด ~92): `สวัสดีคุณ {{full_name}}` → `สวัสดีคุณ {{full_name}} จาก {{customer_company_name}}`
- [x] 2.3 template-3 (บรรทัด ~146): `👋 สวัสดีคุณ {{first_name}}!` → `👋 สวัสดีคุณ {{first_name}} จาก {{customer_company_name}}!`
- [x] 2.4 template-19 (บรรทัด ~1166): `สวัสดีคุณ {{first_name}} {{last_name}} 🎉` → `สวัสดีคุณ {{first_name}} {{last_name}} จาก {{customer_company_name}} 🎉`

## 3. เทมเพลตภาษาอังกฤษ — เพิ่ม "from {{customer_company_name}}"

- [x] 3.1 template-4 (บรรทัด ~201): `Dear {{full_name}}` → `Dear {{full_name}} from {{customer_company_name}}`
- [x] 3.2 template-5 (บรรทัด ~262): `Hello <span ...>{{first_name}}</span>` → เพิ่ม `from {{customer_company_name}}` ต่อท้ายภายใน/หลัง span เดิม
- [x] 3.3 template-6 (บรรทัด ~315): `Hi {{first_name}}!` → `Hi {{first_name}} from {{customer_company_name}}!`
- [x] 3.4 template-7 (บรรทัด ~367): `Hello {{full_name}}!` → `Hello {{full_name}} from {{customer_company_name}}!`
- [x] 3.5 template-9 (บรรทัด ~492): `Hi {{first_name}}! 👋` → `Hi {{first_name}} from {{customer_company_name}}! 👋`
- [x] 3.6 template-10 (บรรทัด ~557): `Hello, {{first_name}}!` → `Hello, {{first_name}} from {{customer_company_name}}!`
- [x] 3.7 template-11 (บรรทัด ~629): `Hello {{first_name}}! 👋` → `Hello {{first_name}} from {{customer_company_name}}! 👋`
- [x] 3.8 template-12 (บรรทัด ~699): `Dear {{full_name}}` → `Dear {{full_name}} from {{customer_company_name}}`
- [x] 3.9 template-13 (บรรทัด ~760): `Dear {{full_name}} 🌟` → `Dear {{full_name}} from {{customer_company_name}} 🌟`
- [x] 3.10 template-14 (บรรทัด ~834): `Hello {{first_name}}!` → `Hello {{first_name}} from {{customer_company_name}}!`
- [x] 3.11 template-15 (บรรทัด ~901): `Dear {{full_name}}` → `Dear {{full_name}} from {{customer_company_name}}`
- [x] 3.12 template-17 (บรรทัด ~1038): `Dear {{full_name}}` → `Dear {{full_name}} from {{customer_company_name}}`
- [x] 3.13 template-18 (บรรทัด ~1103): `Hi {{first_name}}!` → `Hi {{first_name}} from {{customer_company_name}}!`
- [x] 3.14 template-20 (บรรทัด ~1242): `Hi {{first_name}}!` → `Hi {{first_name}} from {{customer_company_name}}!`

## 4. Template-8 — แก้บั๊ก (แทนที่ ไม่ใช่เพิ่ม)

- [x] 4.1 template-8 (บรรทัด ~432): `<strong>Company:</strong> {{company_name}}` → `<strong>Company:</strong> {{customer_company_name}}` (ไม่แตะบรรทัด ~442 `{{company_name}}` ในส่วนลงชื่อท้าย "Sincerely,")

## 5. เอกสาร

- [x] 5.1 อัปเดตคอมเมนต์หัวไฟล์ `src/data/emailTemplates.ts` บรรทัด 2-3 ให้เพิ่ม `{{customer_company_name}}` เข้า list ของ merge tag ที่รองรับ

## 6. ตรวจสอบ

- [x] 6.1 รัน `pnpm lint` — ต้องไม่มี error ใหม่เพิ่มขึ้น
- [x] 6.2 รัน `pnpm build` — ต้องผ่าน
- [x] 6.3 รัน `pnpm test` — ต้องผ่าน
- [x] 6.4 รัน `php -r` ทดสอบ `processMergeTags()` ตรงๆ ด้วยข้อมูลลูกค้าที่มี `company_name` — ยืนยันว่า `{{customer_company_name}}` ถูกแทนที่ถูกต้อง และ `{{company_name}}` ยังคงเป็นบริษัทผู้ส่งเหมือนเดิม ไม่ปนกัน
- [x] 6.5 เช็คว่า template-16 ไม่ถูกแก้ไข (grep ยืนยันว่ายังไม่มี `{{customer_company_name}}` ในเทมเพลตนี้)
- [x] 6.6 grep นับจำนวน `{{customer_company_name}}` ทั้งไฟล์ — ต้องได้ 19 จุด (ตรงกับ 19 เทมเพลตที่แก้ ไม่รวม comment หัวไฟล์ที่เพิ่มอีก 1 จุด)
