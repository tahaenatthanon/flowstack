## Why

สองบั๊กเล็กที่พบระหว่างสำรวจหน้าแคมเปญอีเมล ไม่เกี่ยวข้องกัน แต่รวมไว้ใน change เดียวตามที่ตกลงกัน:

1. **Type `CustomerStats` ผิด** — `useMarketing.ts:53-67` ประกาศ field ของ `customers[]` ไม่ตรงกับที่ `api/customer-email-stats.php:206-220` ส่งจริงเลยสักตัว (`total_delivered`/`total_opens`/`total_clicks`/`last_open_at`/`last_click_at` ที่ประกาศไว้ ไม่มีอยู่จริงใน response; ส่วน `delivered`/`opened`/`clicked`/`bounced`/`open_rate`/`click_rate`/`last_sent`/`last_opened`/`last_clicked`/`total_emails` ที่ส่งจริง ไม่มีอยู่ใน type เลย) `MarketingPage.tsx` ใช้ field ที่ถูกต้อง (ของจริง) อยู่แล้วจึงไม่มีบั๊ก runtime แต่ type ที่ผิดทำให้ TypeScript ช่วยจับความผิดพลาดในอนาคตไม่ได้เลย

2. **Merge tag `{{subject}}` ใช้ไม่ได้จริง** — ทุกเทมเพลตอีเมลสำเร็จรูปทั้ง 20 แบบใน `emailTemplates.ts` มี `<title>{{subject}}</title>` แต่ `processMergeTags()` ใน `email-utils.php` ไม่รู้จักแท็กนี้ ทำให้อีเมลที่ส่งจริงมีคำว่า `{{subject}}` ค้างอยู่ในหัวข้อหน้าต่าง/แท็บของอีเมล แทนที่จะเป็นหัวข้ออีเมลจริงที่ผู้ส่งตั้งไว้ (ผลกระทบต่ำ เพราะไม่กระทบเนื้อหาที่ผู้รับอ่านเห็นในตัวอีเมล)

## What Changes

- **`useMarketing.ts`:** เขียน interface `CustomerStats.customers[]` ใหม่ทั้งหมดให้ตรงกับ response จริงของ `customer-email-stats.php` (`total_emails`, `delivered`, `opened`, `clicked`, `bounced`, `open_rate`, `click_rate`, `last_sent`, `last_opened`, `last_clicked` — `last_*` เป็น `string | null` เพราะ `MAX()` บน LEFT JOIN คืน NULL ได้เมื่อลูกค้าไม่เคยถูกส่งอีเมลเลย) — ไม่กระทบ runtime behavior ใดๆ เพราะโค้ดที่ใช้ type นี้อยู่แล้วอ้างอิงชื่อ field ที่ถูกต้องอยู่ก่อนแล้ว
- **`email-utils.php`:** เพิ่ม `{{subject}}` เข้าไปใน `processMergeTags()` เป็น merge tag ที่รองรับจริง (เพิ่ม parameter `$subject` และเพิ่มเข้า replacements dict) — เลือกทางนี้ (ไม่ใช่ patch แยกนอกฟังก์ชัน) เพราะทำให้ `{{subject}}` กลายเป็น tag ที่มีเอกสารรองรับสอดคล้องกับ tag อื่นทั้งหมด ค้นเจอได้จากจุดเดียว
- **`email-campaigns.php`:** อัปเดตจุดเรียก `processMergeTags()` สำหรับ `body_html` และ `body_text` ให้ส่ง `$subject` (ที่คำนวณ merge tag เสร็จแล้ว) เข้าไปด้วย
- **`emailTemplates.ts`:** อัปเดตคอมเมนต์ "Merge tags: ..." ที่หัวไฟล์ให้รวม `{{subject}}` เข้าไปด้วย (เอกสารอย่างเดียว ไม่กระทบโค้ด)
- ไม่มี **BREAKING** change ใดๆ — ทั้งสองจุดเป็นการแก้ให้ตรงกับพฤติกรรมที่ตั้งใจไว้แต่แรก

## Capabilities

### New Capabilities
- `email-campaign-customer-stats-type-accuracy`: กำหนดว่า type `CustomerStats` ต้องตรงกับ response จริงของ `customer-email-stats.php` ทุก field
- `email-campaign-subject-merge-tag`: กำหนดว่า `{{subject}}` ต้องเป็น merge tag ที่ใช้งานได้จริงเหมือน tag อื่น (`{{first_name}}`, `{{company_name}}` ฯลฯ)

### Modified Capabilities
(ไม่มี — ยังไม่มี spec เดิมครอบคลุมสองเรื่องนี้)

## Impact

- **Frontend:** `src/hooks/useMarketing.ts` (แก้ type ล้วนๆ ไม่กระทบ runtime)
- **Backend:** `api/email-utils.php` (เพิ่ม parameter ให้ `processMergeTags()`), `api/email-campaigns.php` (อัปเดต call site 2 จุด)
- **Docs/data:** `src/data/emailTemplates.ts` (แก้คอมเมนต์ documentation เท่านั้น)
- **ไม่มีการเปลี่ยนแปลง database schema, ไม่มีการเปลี่ยนแปลง API response shape ที่ frontend เห็น**
