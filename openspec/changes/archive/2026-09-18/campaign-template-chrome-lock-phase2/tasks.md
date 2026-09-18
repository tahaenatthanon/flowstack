## 1. Database migration

- [x] 1.1 สร้างไฟล์ migration [2026_09_18_142325_add_discount_promo_to_email_campaigns.sql](../../../database/migrations/2026_09_18_142325_add_discount_promo_to_email_campaigns.sql) เพิ่มคอลัมน์ `discount_percent VARCHAR(50) NULL`, `countdown_text VARCHAR(50) NULL` ต่อจาก `cta_url`
- [x] 1.2 รัน migration กับ MariaDB local แล้ว verify ด้วย `DESCRIBE email_campaigns` — ยืนยันคอลัมน์ครบถูกตำแหน่ง

## 2. ขยายโครงสร้างข้อมูล template + ฟังก์ชัน compose

- [x] 2.1 แก้ `EmailTemplate` interface ใน `emailTemplates.ts` เพิ่ม field `hasDiscountPromo?: boolean`, `defaultDiscountPercent?: string`, `defaultCountdown?: string` (ไม่เพิ่ม `defaultCtaUrl` requirement — CTA แบบ mailto ใช้ `hasCta`+`defaultCtaText` โดยไม่มี `defaultCtaUrl` ตามที่มีอยู่แล้ว)
- [x] 2.2 ขยาย `composeCampaignHtml()` ใน `src/lib/campaignTemplateCompose.ts` รับ parameter เสริม `discountPercent?`, `countdown?` แทนที่ `{{DISCOUNT_PERCENT}}`/`{{COUNTDOWN}}` เฉพาะเมื่อ template มี `hasDiscountPromo: true`

## 3. กำหนด marker ทีละ template (15 template ที่เหลือ)

- [x] 3.1 template-4 "ธุรกิจโปร": กำหนด `{{EMAIL_CONTENT}}` ครอบคลุม heading ทักทาย + 2 ย่อหน้า + ข้อความลงท้าย "Best regards" ย้าย HTML เดิมไปเป็น `defaultContent` (ไม่มี CTA)
- [x] 3.2 template-6 "สดใสสีเขียว": กำหนด `{{EMAIL_CONTENT}}` ครอบคลุม heading ทักทาย + 2 ย่อหน้า (ไม่มี CTA — มีแค่กล่องข้อมูลติดต่อท้ายที่เป็น chrome คงที่)
- [x] 3.3 template-7 "กล้าหาญสีส้ม": กำหนด `{{EMAIL_CONTENT}}` สำหรับเนื้อหาหลัก และ `{{CTA_TEXT}}` สำหรับปุ่ม "📩 Contact Us" (`hasCta: true`, **ไม่มี** `{{CTA_URL}}` marker — href เขียนตรงเป็น `mailto:{{company_email}}` ค่าคงที่ใน chrome ตาม Decision 1 ของ design.md)
- [x] 3.4 template-8 "คอร์เปอเรตบลู": กำหนด `{{EMAIL_CONTENT}}` ครอบคลุม "To:/Company:" + 2 ย่อหน้า + ลายเซ็น "Sincerely" ทั้งก้อน (มี `{{company_tax_id}}` ใน footer คงเป็น chrome)
- [x] 3.5 template-9 "เป็นกันเองสีชมพู": กำหนด `{{EMAIL_CONTENT}}` ครอบคลุม heading ทักทาย + 2 ย่อหน้าภาษาไทย ("ขอบคุณมากๆ...", "ทีมงานของเรา...") ไม่รวมกล่อง "Cute Box" ท้าย (เป็น chrome คงที่ — เนื้อหาเดิมเป็นภาษาไทย ไม่ใช่อังกฤษ)
- [x] 3.6 template-10 "สไตล์จดหมายข่าว": กำหนด `{{EMAIL_CONTENT}}` ครอบคลุม heading + ย่อหน้าเปิด + "Article Box" (กล่องไฮไลท์ border-left) + ย่อหน้าปิด ทั้งก้อนเป็นโซนเดียว (เหมือน pattern ของ template-12 "VIP Box")
- [x] 3.7 template-11 "เทคสตาร์ทอัพ": กำหนด `{{EMAIL_CONTENT}}` ครอบคลุม heading + ย่อหน้าเปิด + "Feature Box" + ย่อหน้าปิด ทั้งก้อนเป็นโซนเดียว (พบว่ามีกล่องด้วย ต่างจากที่ประเมินไว้ตอน propose) และ `{{CTA_TEXT}}`/`{{CTA_URL}}` สำหรับปุ่ม "Explore Now →" (`hasCta: true`, `defaultCtaUrl: '{{company_website}}'`)
- [x] 3.8 template-13 "ฤดูกาลวันหยุด": กำหนด `{{EMAIL_CONTENT}}` ครอบคลุม greeting "Dear {{full_name}}..." (รวมแถว "Snow Effect" เดิมเข้าเป็นโซนเดียว) + 2 ย่อหน้า + "Gift Box" (พบว่ามีกล่องด้วย ต่างจากที่ประเมินไว้ตอน propose) — คงข้อความ static "Season's Greetings" ไว้เป็น chrome
- [x] 3.9 template-14 "ประกาศพิเศษ": กำหนด `{{EMAIL_CONTENT}}` ครอบคลุม heading + ย่อหน้าเปิด + "Notice Box" (bullet list "What's New") + ย่อหน้าปิด ทั้งก้อนเป็นโซนเดียว และ `{{CTA_TEXT}}`/`{{CTA_URL}}` สำหรับปุ่ม "Learn More" (`hasCta: true`, `defaultCtaUrl: '{{company_website}}'`) — คง badge "📢 ANNOUNCEMENT" และ "⚡ Important Update" เป็น chrome
- [x] 3.10 template-15 "ขอบคุณอย่างสูง": กำหนด `{{EMAIL_CONTENT}}` ครอบคลุม heading + 2 ย่อหน้าไทย/อังกฤษ + "Appreciation Box" + ย่อหน้าปิดสองภาษา ทั้งก้อนเป็นโซนเดียว (พบว่ามีกล่องด้วย) — คง header ผสมไทย/อังกฤษ "ขอบคุณอย่างสูง / Thank You So Much!" เป็น chrome
- [x] 3.11 template-16 "เปิดตัวสินค้า": กำหนด `{{EMAIL_CONTENT}}` ครอบคลุม heading + ย่อหน้าเปิด + "Features" (bullet list) ทั้งก้อนเป็นโซนเดียว และ `{{CTA_TEXT}}`/`{{CTA_URL}}` สำหรับปุ่ม "Explore Now →" (`hasCta: true`, `defaultCtaUrl: '{{company_website}}'`) — คง badge ตกแต่งเป็น chrome
- [x] 3.12 template-17 "เชิญงาน": กำหนด `{{EMAIL_CONTENT}}` ครอบคลุม greeting + ย่อหน้าเปิด + "Event Details" (Date/Time/Location) + ย่อหน้าปิด ทั้งก้อนเป็นโซนเดียว (พบว่ามีกล่องรายละเอียดงานด้วย) และ `{{CTA_TEXT}}` สำหรับปุ่ม "RSVP Now" (`hasCta: true`, **ไม่มี** `{{CTA_URL}}` marker — href เขียนตรงเป็น `mailto:{{company_email}}` ค่าคงที่ ตาม Decision 1) — คง header static "📅 Event Invitation" เป็น chrome
- [x] 3.13 template-18 "แบบสำรวจความคิดเห็น": กำหนด `{{EMAIL_CONTENT}}` ครอบคลุมเนื้อหาหลัก + "Survey Box" + ย่อหน้าปิด ทั้งก้อนเป็นโซนเดียว และ `{{CTA_TEXT}}`/`{{CTA_URL}}` สำหรับปุ่ม "Take Survey →" (`hasCta: true`, `defaultCtaUrl: '{{company_website}}'`) — คง header static "We Value Your Opinion" เป็น chrome
- [x] 3.14 template-19 "ต้อนรับสมาชิกใหม่": กำหนด `{{EMAIL_CONTENT}}` ครอบคลุม heading + 2 ย่อหน้าไทย + "Benefits Box" (bullet list) + ย่อหน้าปิด ทั้งก้อนเป็นโซนเดียว (พบว่ามีกล่องด้วย) — คง header ผสมไทย/อังกฤษ "ยินดีต้อนรับสู่ครอบครัว / Welcome to the Family!" เป็น chrome
- [x] 3.15 template-20 "ลดราคาด่วน": กำหนด `{{EMAIL_CONTENT}}` สำหรับย่อหน้าทักทาย+เกริ่นนำ, `{{CTA_TEXT}}`/`{{CTA_URL}}` สำหรับปุ่ม "Shop Now →" (`hasCta: true`, `defaultCtaUrl: '{{company_website}}'`), และ `{{DISCOUNT_PERCENT}}`/`{{COUNTDOWN}}` แทนที่ `"50"` (ใน `"50% OFF!"` — เก็บ "% OFF!" เป็น chrome คงที่) และ `"24:00:00"` (`hasDiscountPromo: true`, `defaultDiscountPercent: '50'`, `defaultCountdown: '24:00:00'`) — คงกล่อง "Timer Box" โครงสร้าง/สี/ขนาดเป็น chrome ล็อกตายตัว มีแค่ตัวเลขข้างในที่แก้ได้

## 4. เชื่อม CampaignsPage.tsx เข้ากับระบบใหม่

- [x] 4.1 เพิ่ม state `discountPercent`, `countdown` — เพิ่ม derived logic ตรวจ `selectedTemplateObj?.hasDiscountPromo`
- [x] 4.2 ขยาย `applyTemplateSelection()` ให้โหลด `defaultDiscountPercent`/`defaultCountdown` เมื่อ template รองรับ (เหมือน logic ของ CTA) — และเพิ่ม reset ที่จุดอื่นทั้งหมดที่เคย reset `ctaText`/`ctaUrl` (deselect toggle, dialog close, `fromContent` useEffect, `openCreateCampaign`)
- [x] 4.3 เพิ่ม UI field ตัวเลขส่วนลด/countdown แสดงเฉพาะเมื่อ `isChromeLocked && selectedTemplateObj?.hasDiscountPromo`
- [x] 4.4 ตรวจสอบ UI field ของ CTA: เมื่อ `selectedTemplateObj?.hasCta` เป็นจริงแต่ `defaultCtaUrl` เป็น `undefined` (กรณี mailto-locked เช่น template-7, 17) ต้องแสดงเฉพาะ field ข้อความปุ่ม ไม่แสดง field URL — แก้เป็นเช็ค `selectedTemplateObj?.defaultCtaUrl !== undefined` ก่อน render input URL
- [x] 4.5 `buildFinalBodyHtml()`/`handleSubmitCampaign`/`handleSubmitAndSend`: ส่ง `discount_percent`/`countdown` เข้า payload ทั้ง 2 จุด (null เมื่อไม่ใช่ template ที่รองรับ) เหมือนที่ทำกับ `cta_text`/`cta_url`
- [x] 4.6 `openEditCampaign()`: โหลด `c.discount_percent`/`c.countdown` กลับเข้า state ทั้ง 2 branch (try/catch) เหมือน `cta_text`/`cta_url` — ขยาย `EmailCampaign` interface ใน `useMarketing.ts` เพิ่ม field ใหม่ 2 ตัวด้วย

## 5. Backend: persist field ใหม่

- [x] 5.1 `createEmailCampaign()` และ handler แก้ไข: รับ/บันทึก `discount_percent`, `countdown_text` เพิ่ม (persist ตรงๆ ไม่มี logic ประมวลผลเพิ่มเติม เหมือน `cta_text`/`cta_url`) — พบว่าคอลัมน์ DB ชื่อ `countdown_text` (ตามไฟล์ migration) เลยใช้ key `countdown_text` ในทุก payload/response ให้ตรงกับคอลัมน์จริง ไม่ใช้ `countdown` เฉยๆ ตามที่ระบุไว้ตอน propose

## 6. ทดสอบ

- [x] 6.1 ทดสอบตัวแทนแต่ละ pattern อย่างน้อย 1 template: เลือก template → แก้ข้อความ (+ CTA/discount ถ้ามี) → เทียบแท็บ "ตัวอย่าง" กับเวอร์ชันไม่แก้ไข — ทดสอบผ่านเบราว์เซอร์แล้ว: template-4 (เนื้อหาเดี่ยว), template-11 (เนื้อหา+Feature Box+CTA ปกติ — ยืนยัน chrome/CTA gradient เหมือนเดิม), template-13 (กรณีผสาน "Snow Effect" row เข้าเป็นโซนเดียว — ยืนยันผ่าน DOM inspection ว่าเนื้อหาเรียงถูกต้องครบ ไม่มีอะไรหาย) — chrome ตรงกับต้นฉบับทุกจุด
- [x] 6.2 ทดสอบเฉพาะ template-7 (CTA แบบ mailto): ยืนยันผ่าน `javascript_tool` ตรวจ DOM ของ iframe preview — ไม่มี field URL ให้แก้ (มีแค่ field ข้อความปุ่ม), href ที่ประกอบออกมาคือ `mailto:{{company_email}}` เสมอ แม้แก้ข้อความปุ่มเป็น "ติดต่อเราเลย" ก็ยัง mailto เดิม
- [x] 6.3 ทดสอบเฉพาะ template-20: แก้ discount_percent จาก 50→30 และ countdown จาก 24:00:00→12:00:00 แล้วตรวจ DOM ของ preview — h2 เปลี่ยนเป็น "30% OFF!", timer text เปลี่ยนเป็น "12:00:00" ถูกต้อง ส่วน Timer Box style (`background-color:#1f2937;border-radius:12px;padding:20px;margin:25px 0;text-align:center;`) ไม่เปลี่ยนแปลงเลย
- [x] 6.4 บันทึกแล้วเปิด "แก้ไข" ซ้ำสำหรับ template-20 — ยืนยันผ่านเบราว์เซอร์ว่า `discountPercent`/`countdown` โหลดค่ากลับมาถูกต้อง (30, 12:00:00) ตรงกับที่บันทึกไว้
- [x] 6.5 ส่งอีเมลทดสอบจริง 4 template (ครอบคลุมทุก pattern) ไป Gmail — ผู้ใช้ส่งจริงและยืนยันด้วยสกรีนช็อต Gmail ทั้ง 4 ฉบับ: template-9 (เนื้อหาไทยล้วน, Cute Box + footer ถูกต้อง), template-11 (Feature Box gradient + ปุ่ม "Explore Now →" ครบ), template-7 (ปุ่ม "Contact Us" mailto CTA ถูกต้อง), template-20 (แสดง "30% OFF!"/"12:00:00" ตรงกับค่าที่แก้ไว้ ไม่ใช่ default — ยืนยัน dynamic field ทำงานถูกต้องตลอดทาง compose→save→send จริง) — chrome ทุกจุดตรงกับต้นฉบับ ไม่มีจุดไหนเพี้ยน
- [x] 6.6 ทดสอบ regression: เปิดแก้ไขแคมเปญร่างเก่าที่ใช้ template ใดๆ ใน 15 ตัวนี้ก่อน migration นี้ (`editable_content` เป็น null) — สร้าง fixture จำลอง (draft, `template_id='template-11'`, `editable_content=NULL`, `body_html` เป็นเอกสารเต็ม) เปิดแก้ไขผ่านเบราว์เซอร์แล้วตรวจ DOM ของ ProseMirror ตรงๆ ว่าโหลด `body_html` เต็มก้อนเข้ามา (`<h1>legacy full doc test</h1>`) ไม่ใช่ content fragment — ยืนยันว่า `forceLegacyEditor` ยังทำงานถูกต้องแม้ template จะถูก migrate เป็น chrome-lock แล้วก็ตาม (ลบ fixture ออกหลังทดสอบเสร็จ)
- [x] 6.7 ทดสอบ regression: แก้ไขเนื้อหาบทความในหน้าเนื้อหา (`ContentCardDialog`) — ไม่ได้รับผลกระทบ ยืนยันผ่าน `git diff --stat`: change นี้แก้เฉพาะ 5 ไฟล์ (`api/email-campaigns.php`, `src/data/emailTemplates.ts`, `src/hooks/useMarketing.ts`, `src/lib/campaignTemplateCompose.ts`, `src/pages/CampaignsPage.tsx`) — `ArticleEditor.tsx` และ `ContentCardDialog.tsx` มี diff เป็นศูนย์

## 7. Verification

- [x] 7.1 รัน `pnpm lint` และ `pnpm build` — ทั้งคู่ผ่าน: lint 0 errors (มีแค่ 47 warnings เดิมที่ไม่เกี่ยวกับ change นี้), build สำเร็จ 22.58s ไม่มี error
