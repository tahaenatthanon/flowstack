## 1. แก้ type CustomerStats

- [x] 1.1 ใน `src/hooks/useMarketing.ts` เขียน interface `CustomerStats.customers[]` ใหม่ทั้งหมด: ลบ `total_delivered`, `total_opens`, `total_clicks`, `last_open_at`, `last_click_at` ออก แล้วเพิ่ม `total_emails: number`, `delivered: number`, `opened: number`, `clicked: number`, `bounced: number`, `open_rate: number`, `click_rate: number`, `last_sent: string | null`, `last_opened: string | null`, `last_clicked: string | null`
- [x] 1.2 รัน `npx tsc --noEmit -p tsconfig.app.json` แล้ว grep หา error ที่เกี่ยวกับ `MarketingPage.tsx` และ `CustomerStats` — ยืนยันว่า TS2339 error 22 จุดที่เคยเจอ (เกี่ยวกับ field ของ customer stats) หายไปแล้ว

## 2. เพิ่ม {{subject}} merge tag

- [x] 2.1 ใน `api/email-utils.php` เพิ่ม parameter `$subject = ''` เข้า signature ของ `processMergeTags()` และเพิ่ม `'{{subject}}' => $subject` เข้า `$replacements` (หรือ `$companyReplacements`) array
- [x] 2.2 ใน `api/email-campaigns.php` (`sendCampaign()`) แก้ 2 จุดที่เรียก `processMergeTags()` สำหรับ `$rawHtml` และ `$campaign['body_text']` ให้ส่ง `$subject` เป็น parameter ที่ 5 — จุดที่คำนวณ `$subject` เอง (จาก `$campaign['subject']`) ไม่ต้องแก้ (ไม่ส่ง parameter ที่ 5)
- [x] 2.3 อัปเดตคอมเมนต์ "Merge tags: ..." ที่หัวไฟล์ `src/data/emailTemplates.ts` ให้รวม `{{subject}}` เข้าไปด้วย

## 3. ตรวจสอบ

- [x] 3.1 รัน `php -l api/email-utils.php` และ `php -l api/email-campaigns.php` — ต้องไม่มี syntax error
- [x] 3.2 รัน `pnpm lint` — ต้องไม่มี error ใหม่เพิ่มขึ้น
- [x] 3.3 รัน `pnpm build` — ต้องผ่าน
- [x] 3.4 รัน `pnpm test` — ต้องผ่าน
- [x] 3.5 ทดสอบส่งแคมเปญจริง (หรือจำลองผ่านการเรียก `processMergeTags()` ตรงๆ ถ้าไม่สะดวกส่งอีเมลจริง) ด้วยเทมเพลตที่มี `<title>{{subject}}</title>` — ยืนยันว่า `{{subject}}` ถูกแทนที่ด้วยหัวข้อแคมเปญจริง ไม่เหลือ literal text
- [x] 3.6 ยืนยันว่าการส่งแคมเปญแบบเดิม (เทมเพลตที่ไม่มี `{{subject}}`) ยังทำงานถูกต้องเหมือนเดิม ไม่ได้รับผลกระทบจากการเพิ่ม parameter
