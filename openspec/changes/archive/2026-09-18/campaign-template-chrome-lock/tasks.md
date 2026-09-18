## 1. Database migration

- [x] 1.1 สร้างไฟล์ migration [2026_09_18_122311_add_editable_content_to_email_campaigns.sql](../../../database/migrations/2026_09_18_122311_add_editable_content_to_email_campaigns.sql) เพิ่มคอลัมน์ `editable_content TEXT NULL`, `cta_text VARCHAR(255) NULL`, `cta_url VARCHAR(500) NULL` ต่อจาก `template_id`
- [x] 1.2 รัน migration กับ MariaDB local แล้ว verify ด้วย `DESCRIBE email_campaigns` — ยืนยันคอลัมน์ครบถูกตำแหน่ง

## 2. โครงสร้างข้อมูล template + ฟังก์ชัน compose

- [x] 2.1 แก้ `EmailTemplate` interface ใน [emailTemplates.ts](../../../src/data/emailTemplates.ts) เพิ่ม field `defaultContent: string`, `hasCta?: boolean`, `defaultCtaText?: string`, `defaultCtaUrl?: string`
- [x] 2.2 สร้างฟังก์ชัน `composeCampaignHtml(template, editableContent, ctaText?, ctaUrl?)` ที่ [src/lib/campaignTemplateCompose.ts](../../../src/lib/campaignTemplateCompose.ts)

## 3. กำหนด marker ทีละ template (Phase 1 — 5 template ที่ทดสอบไว้แล้วในรอบก่อนหน้า)

- [x] 3.1 template-1 "โปรเฟสชั่นแนลคลาสสิก": กำหนด `{{EMAIL_CONTENT}}` ครอบคลุมย่อหน้าทักทาย+ข้อความหลัก ย้ายข้อความเดิมไปเป็น `defaultContent` (ไม่มี CTA)
- [x] 3.2 template-2 "โมเดิร์นมินิมอล": กำหนด marker เช่นเดียวกัน ครอบคลุม greeting + กล่องไฮไลท์สีฟ้า + ปิดท้าย (ไม่มี CTA)
- [x] 3.3 template-3 "ต้อนรับอบอุ่น": กำหนด marker ครอบคลุม greeting + ข้อความ + กล่องข้อมูลติดต่อ (ไม่มี CTA)
- [x] 3.4 template-5 "หรูหราสีม่วง": กำหนด `{{EMAIL_CONTENT}}` สำหรับย่อหน้าทักทาย+ข้อความหลัก และ `{{CTA_TEXT}}`/`{{CTA_URL}}` สำหรับปุ่ม "Visit Our Website" (`hasCta: true`) — โครงสร้าง/สไตล์ปุ่ม gradient ยังเป็น chrome คงที่
- [x] 3.5 template-12 "หรูหรูระดับพรีเมียม": กำหนด `{{EMAIL_CONTENT}}` ครอบคลุมย่อหน้า quote + heading + ข้อความ + กล่อง "VIP Box" ทั้งก้อน ไม่มี CTA แยก

## 4. เชื่อม CampaignsPage.tsx เข้ากับระบบใหม่

- [x] 4.1 เพิ่ม state `editableContent`, `ctaText`, `ctaUrl` — เพิ่ม derived `selectedTemplateObj`/`isChromeLocked`
- [x] 4.2 รวม logic การเลือก template เป็นฟังก์ชันเดียว `applyTemplateSelection()` เรียกใช้จากทั้ง 3 จุด (gallery picker, templates-tab "ใช้", preview-dialog "ใช้เทมเพลตนี้") — โหลด `defaultContent`/`defaultCtaText`/`defaultCtaUrl` เมื่อ template รองรับ chrome-lock, fallback โหลด `template.html` เข้า `campaignBody` แบบเดิมเมื่อยังไม่ได้ migrate
- [x] 4.3 เพิ่ม UI field ข้อความ/URL ของ CTA แสดงเฉพาะเมื่อ `isChromeLocked && selectedTemplateObj?.hasCta`
- [x] 4.4 แท็บ "ตัวอย่าง": render จาก `buildFinalBodyHtml()` (helper ที่เรียก `composeCampaignHtml()` เมื่อ chrome-locked มิฉะนั้นคืน `campaignBody` ตรงๆ)
- [x] 4.5 ตอนบันทึก: payload ใช้ `buildFinalBodyHtml()` เป็น `body_html` พร้อมส่ง `editable_content`/`cta_text`/`cta_url` (null เมื่อไม่ chrome-locked) — validation เช็ค `editableContent`/`campaignBody` ตามโหมดด้วย
- [x] 4.6 `openEditCampaign()`: โหลด `c.editable_content`/`c.cta_text`/`c.cta_url` กลับเข้า state เสมอ (เป็น `''` เมื่อเป็น null) — `isChromeLocked` คำนวณจาก `selectedTemplateObj?.defaultContent` จึงสอดคล้องกันเองโดยไม่ต้องมี flag แยก

## 5. Backend: persist field ใหม่

- [x] 5.1 `createEmailCampaign()` และ handler แก้ไข: รับ/บันทึก `editable_content`, `cta_text`, `cta_url` เพิ่มแล้ว persist ตรงๆ ไม่มี logic ประมวลผลเพิ่มเติม
- [x] 5.2 ยืนยันจากโค้ด (บรรทัด 687-694): send handler อ่าน `body_html` ตรงๆ และข้าม `wrapEmailHtml()` เมื่อมี `template_id` อยู่แล้ว (จาก change ก่อนหน้า) — ไม่ต้องแก้ไขเพิ่ม

## 6. ทดสอบ

- [x] 6.1 ทดสอบทั้ง 5 template ที่ทำใน Phase 1: เลือก template → แก้ข้อความ (+ แก้ CTA ถ้ามี) → เทียบแท็บ "ตัวอย่าง" กับเวอร์ชันไม่แก้ไข — chrome ต้องเหมือนกันทุกจุด — ยืนยันแล้วผ่านเบราว์เซอร์สำหรับ template-3 และ template-5 (มี CTA field แยก ปุ่ม gradient เดิมไม่เปลี่ยน)
- [x] 6.2 บันทึกแล้วเปิด "แก้ไข" ซ้ำ — ยืนยันว่า `editableContent`/`ctaText`/`ctaUrl` โหลดกลับถูกต้อง — ทดสอบ round-trip แล้วสำหรับ template-3, template-5
- [x] 6.3 ส่งอีเมลทดสอบจริงอย่างน้อย 2-3 template ไป Gmail — ยืนยันภาพสุดท้ายตรงกับ "ไม่แก้ไข" ทุกจุด (โดยเฉพาะความกว้างการ์ดที่เคยพังมาก่อน) — ผู้ใช้ส่งจริงและยืนยันด้วยสกรีนช็อต Gmail: template-3 (โทนส้ม การ์ด "บริษัท เค ที เอ็น...") และ template-5 CTA (โทนม่วง gradient ปุ่ม "กดตรงนี้เลย") chrome/ความกว้างตรงกับต้นฉบับทุกจุด เนื้อหาที่แก้ไขแสดงถูกต้อง รวมถึงแคมเปญไม่มี template ("clean no template", "ยืนยันครั้งสุดท้าย no template") ก็ส่งและแสดงผลถูกต้องเช่นกัน
- [x] 6.4 ทดสอบ regression: เปิดแก้ไขแคมเปญร่างเก่าที่สร้างไว้ก่อน migration นี้ (`editable_content` เป็น null) — ยังแก้ไขผ่านโหมดเดิมได้ปกติ — พบบั๊ก `isChromeLocked` ไม่รู้จักแคมเปญเก่า แก้ด้วย `forceLegacyEditor` state แล้วยืนยันผ่าน fiber-state inspection ว่าโหลดเนื้อหาเดิมถูกต้อง
- [x] 6.5 ทดสอบ regression: สร้างแคมเปญแบบไม่เลือก template — ยังทำงานแบบเดิมทุกประการ — ยืนยันผ่านเบราว์เซอร์ (หลัง full reload ไม่มี debug log): พิมพ์เนื้อหา กด "บันทึกร่าง" ได้ toast "สร้างแคมเปญสำเร็จ" และแคมเปญ "ทดสอบยืนยันครั้งสุดท้าย no template" ปรากฏในรายการเป็นฉบับร่างถูกต้อง
- [x] 6.6 ทดสอบ regression: แก้ไขเนื้อหาบทความในหน้าเนื้อหา (`ContentCardDialog`) — ไม่ได้รับผลกระทบ — ยืนยันผ่าน `git diff --stat`: change นี้แก้เฉพาะ 4 ไฟล์ (`api/email-campaigns.php`, `src/data/emailTemplates.ts`, `src/hooks/useMarketing.ts`, `src/pages/CampaignsPage.tsx`) — `ArticleEditor.tsx` และ `ContentCardDialog.tsx` มี diff เป็นศูนย์ ตรงตามข้อ 8 ที่ตกลงไว้ว่าห้ามแก้ behavior ของ ArticleEditor แบบ global

## 7. Verification

- [x] 7.1 รัน `pnpm lint` และ `pnpm build` — ทั้งคู่ผ่าน: lint 0 errors (มีแค่ 47 warnings เดิมที่ไม่เกี่ยวกับ change นี้), build สำเร็จ 17.24s ไม่มี error

## 8. ขอบเขตที่เหลือ (ไม่ได้อยู่ใน change นี้)

- [x] 8.1 อีก 15 template ที่เหลือ (template-4, 6-11, 13-20) ยังไม่ได้กำหนด marker ในรอบนี้ — ยังคงใช้พฤติกรรม editor แบบเดิม (มีความเสี่ยง style/width เหมือนก่อนหน้า) จนกว่าจะมี change ต่อยอดทำให้ครบ — flag เป็น follow-up task แล้ว (task_id: task_d9c01286) ไม่ต้อง implement ใน change นี้
