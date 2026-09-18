## Context

Change `campaign-template-chrome-lock` (archived) สร้างกลไก editable-region marker ไว้แล้ว (`{{EMAIL_CONTENT}}`, `{{CTA_TEXT}}`/`{{CTA_URL}}`, `composeCampaignHtml()`, คอลัมน์ `editable_content`/`cta_text`/`cta_url` ใน `email_campaigns`) และพิสูจน์แล้วว่าทำงานถูกต้องผ่านการส่งอีเมลจริง 2 template (template-3, template-5) แต่ทำ marker ไปแค่ 5 จาก 20 template

ตอนสำรวจ 15 template ที่เหลือ (อ่าน HTML จริงทุกไฟล์ ไม่ใช่เดา) พบว่าส่วนใหญ่ซ้ำ pattern ที่แก้ไปแล้ว แต่มี 2 รูปแบบใหม่ที่ 5 template แรกไม่ครอบคลุม:

1. **CTA แบบ mailto** — template-7 ("Contact Us"), template-17 ("RSVP Now") ปลายทางเป็น `mailto:{{company_email}}` ไม่ใช่ URL ที่ควรให้ผู้ใช้กำหนดเองต่อแคมเปญ
2. **ตัวเลขโปรโมชั่น hardcode** — template-20 "Flash Sale" มี `"50% OFF!"` และ `"24:00:00"` ฝังตรงเป็นข้อความตายตัวใน chrome ซึ่งขัดกับธรรมชาติของ template ประเภทนี้

การจัดกลุ่ม 15 template ตามโครงสร้างเนื้อหา (จากการอ่าน HTML จริง):

| Pattern | Template | ลักษณะ |
|---|---|---|
| A: เนื้อหาเดี่ยว ไม่มีกล่อง/CTA | 6, 8, 9, 13, 15, 19 | เหมือน template-1/2/3 |
| B: เนื้อหา + กล่องไฮไลท์/bullet ฝังในโซนเดียวกัน | 4, 10, 14 | เหมือน template-12 "VIP Box" |
| C: มี CTA ปกติ → `{{company_website}}` | 11, 14, 16, 18, 20 | เหมือน template-5 |
| D: มี CTA แบบ mailto (ใหม่) | 7, 17 | ต้องกฎเพิ่ม |
| E: มี dynamic field เฉพาะทางนอกเหนือ CTA (ใหม่) | 20 | ต้อง field ใหม่ |

*(template-14 และ template-20 เข้า 2 pattern พร้อมกัน — เนื้อหา+กล่อง กับ CTA/dynamic field เป็นคนละมิติ ไม่ขัดกัน)*

## Goals / Non-Goals

**Goals:**
- กำหนด marker ให้ครบทั้ง 20/20 template
- รองรับ CTA ที่ปลายทางล็อกตายตัว (mailto) โดยไม่เปิดช่องให้แก้ URL
- รองรับ template-20 ที่มีค่าตัวเลขต้องแก้ต่อแคมเปญ โดยยังคง chrome (โครงสร้าง/สี/ขนาด/ตำแหน่ง) ล็อกไว้เหมือนเดิม

**Non-Goals:**
- ไม่สร้างกลไก "dynamic field" แบบ generic (เช่น array ของ field ที่ config ได้อิสระ) — มีแค่ template เดียว (template-20) ที่ต้องการ ไม่คุ้มสร้างเครื่องยนต์ทั่วไปสำหรับ 1 use case (ตาม NO MAGIC / ไม่ออกแบบล่วงหน้าเผื่ออนาคตที่ยังไม่เกิด)
- ไม่แก้ปัญหาเรื่องลิงก์ tel:/mailto: ของเบอร์โทร/อีเมลใน footer, ไม่เติม footer ที่ขาดข้อมูลบริษัท, ไม่สลับ `{{company_name}}`→`{{company_name_en}}` — ทั้งหมดนี้เป็นงานคนละประเภท (markup/ภาษา ไม่ใช่ chrome-lock) แยกเป็น change ต่างหาก
- ไม่แตะ `ArticleEditor.tsx` แบบ global

## Decisions

### Decision 1: CTA แบบ mailto ใช้ marker `{{CTA_TEXT}}` เดี่ยว ไม่มี `{{CTA_URL}}`
สำหรับ template-7, 17: เขียน `href="mailto:{{company_email}}"` ตรงๆ ใน chrome ของ template (เป็นค่าคงที่ ไม่ใช่ marker) และใช้แค่ `{{CTA_TEXT}}` สำหรับข้อความปุ่ม — `hasCta: true`, `defaultCtaText` กำหนดไว้, **ไม่กำหนด** `defaultCtaUrl`

**ทำไมไม่สร้าง field `ctaUrlEditable` เพิ่ม:** UI ที่มีอยู่เดิมใน `CampaignsPage.tsx` ตัดสินใจแสดง field URL จาก `selectedTemplateObj?.defaultCtaUrl` อยู่แล้วโดยธรรมชาติ (`isChromeLocked && selectedTemplateObj?.hasCta` แสดง section, ถ้า `defaultCtaUrl` เป็น `undefined` ก็ไม่ render input URL) — ใช้ convention เดิมได้เลยไม่ต้องเพิ่ม flag ใหม่ในระบบ

**ทางเลือกที่ไม่เลือก:** เพิ่ม boolean `ctaUrlEditable?: boolean` แยกต่างหาก — ปฏิเสธเพราะซ้ำซ้อนกับสิ่งที่ `defaultCtaUrl` ตรวจสอบได้อยู่แล้ว (ไม่มี field ก็แปลว่าแก้ไม่ได้)

### Decision 2: template-20 ใช้ field เฉพาะทาง ไม่ใช่กลไก generic
เพิ่ม field ใหม่ 2 ตัวใน `EmailTemplate` (เหมือนแบบ CTA): `hasDiscountPromo?: boolean`, `defaultDiscountPercent?: string`, `defaultCountdown?: string` และ marker ใหม่ `{{DISCOUNT_PERCENT}}`, `{{COUNTDOWN}}` ในเชิงเดียวกับ `{{CTA_TEXT}}`/`{{CTA_URL}}`

**ทำไมไม่ทำ generic mechanism:** สำรวจทั้ง 20 template แล้วพบว่ามีแค่ template-20 เดียวเท่านั้นที่มีตัวเลขโปรโมชั่น hardcode ลักษณะนี้ — การสร้าง `dynamicFields: Array<{key, label, defaultValue}>` + คอลัมน์ DB แบบ JSON + UI ที่ render input ตามจำนวน field แบบไดนามิก เป็นการลงทุนสร้างความซับซ้อนสำหรับ use case เดียวที่มีอยู่จริงตอนนี้ ขัดกับกฎ "ไม่ออกแบบล่วงหน้าเผื่ออนาคตที่ยังไม่เกิด" — ถ้าในอนาคตมี template ที่ 2-3 ต้องการรูปแบบเดียวกัน ค่อย refactor เป็น generic ตอนนั้น (ง่ายกว่าสร้างไว้ก่อนแล้วไม่มีใครใช้)

### Decision 3: DB เก็บ `discount_percent`/`countdown` เป็นคอลัมน์แยก ไม่ใช่ JSON
สอดคล้องกับ decision 2 — เพิ่ม `ALTER TABLE email_campaigns ADD COLUMN discount_percent VARCHAR(50) NULL, ADD COLUMN countdown_text VARCHAR(50) NULL` (คอลัมน์ธรรมดา เหมือน `cta_text`/`cta_url` เดิม) แทนคอลัมน์ JSON — ยึดหลัก "ADD COLUMN ที่ nullable" ตามมาตรฐานโปรเจกต์ ง่ายต่อการ query/debug กว่า JSON blob

### Decision 4: composeCampaignHtml() ขยาย signature เพิ่ม parameter ใหม่แบบ optional
เพิ่ม `discountPercent?: string`, `countdown?: string` เป็น parameter เสริมต่อจาก `ctaText`/`ctaUrl` เดิม — แทนที่ `{{DISCOUNT_PERCENT}}`/`{{COUNTDOWN}}` เฉพาะเมื่อ template มี `hasDiscountPromo: true` (เหมือน logic ของ `hasCta`)

## Risks / Trade-offs

- **[Risk]** template-14 และ template-20 มี 2 pattern ซ้อนกัน (เนื้อหา+กล่อง / CTA+dynamic field) เพิ่มโอกาสพลาดตอนกำหนดตำแหน่ง marker → **Mitigation:** ทดสอบ preview เทียบกับเวอร์ชันไม่แก้ไขทุก template ก่อนถือว่าเสร็จ เหมือน task 6.1 ของรอบแรก
- **[Risk]** เพิ่ม 2 คอลัมน์ DB ใหม่เฉพาะ template-20 เดียว อาจดูสิ้นเปลืองถ้ามองในระยะยาว → **Mitigation:** ยอมรับ trade-off นี้ตาม Decision 2/3 เพราะยังไม่มี use case ที่ 2 จริง ถ้าเกิดขึ้นอนาคตค่อยพิจารณา generic mechanism ใหม่
- **[Risk]** mailto CTA (template-7, 17) ถ้ามีคนเผลอเพิ่ม `defaultCtaUrl` ให้ template เหล่านี้ในอนาคต UI จะเปิด field URL ให้แก้ทั้งที่ href จริงยังล็อกเป็น mailto อยู่ (ไม่ sync กัน) → **Mitigation:** คอมเมนต์กำกับชัดเจนในโค้ดตรง `defaultCtaText` ของ 2 template นี้ว่าเป็น "mailto-locked CTA — ห้ามเพิ่ม defaultCtaUrl"

## Migration Plan

1. สร้าง migration `database/migrations/YYYY_MM_DD_HHMMSS_add_discount_promo_to_email_campaigns.sql` → รันกับ MariaDB local → verify ด้วย `DESCRIBE email_campaigns`
2. แก้ `EmailTemplate` interface + กำหนด marker ทีละ template (15 ตัว) ใน `emailTemplates.ts`
3. ขยาย `composeCampaignHtml()`
4. เชื่อม `CampaignsPage.tsx` (state ใหม่ + UI field discount/countdown เฉพาะ template-20)
5. แก้ backend persist field ใหม่ 2 ตัว
6. ทดสอบทีละ template ตาม pattern (preview เทียบต้นฉบับ, round-trip แก้ไขซ้ำ, ส่งจริงอย่างน้อยตัวแทนแต่ละ pattern)
7. `pnpm lint` + `pnpm build`

ไม่มี rollback plan พิเศษ — คอลัมน์ nullable ทั้งหมด ย้อนกลับได้ด้วยการไม่ใช้ field ใหม่ (ไม่กระทบแคมเปญเดิม)

## Open Questions
(ไม่มี — ตัดสินใจครบทุกจุดระหว่าง explore แล้ว)
