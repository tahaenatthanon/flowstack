## Why

Change `campaign-template-chrome-lock` (archived) แก้ปัญหา chrome เสียหายตอนแก้ไขเนื้อหาแคมเปญไปแล้ว แต่ทำ marker ให้แค่ 5 จาก 20 template (template-1, 2, 3, 5, 12) เพราะต้องกำหนดทีละ template ด้วยมือตามที่ตกลงกันไว้ อีก 15 template ที่เหลือ (4, 6-11, 13-20) ยังใช้ตัวแก้ไขแบบทั้งเอกสารแบบเดิม — ถ้าผู้ใช้เลือก template เหล่านี้แล้วแก้ข้อความ ยังมีความเสี่ยงดีไซน์พังเหมือนปัญหาเดิมที่เคยแก้ไปแล้วในรอบแรก

ระหว่างสำรวจ 15 template ที่เหลือ พบ 2 รูปแบบใหม่ที่ 5 template แรกไม่เคยเจอ ต้องขยายกฎเพิ่มจากรอบก่อน:
- ปุ่ม CTA บางอันปลายทางเป็น `mailto:{{company_email}}` ไม่ใช่ URL ที่ผู้ใช้ควรกำหนดเอง (template-7, 17)
- template-20 "Flash Sale" มีตัวเลขโปรโมชั่น ("50% OFF!", "24:00:00") ฝัง hardcode อยู่ใน chrome ซึ่งขัดกับธรรมชาติของ template ประเภทนี้ที่ตัวเลขต้องเปลี่ยนทุกครั้งที่จัดโปร

## What Changes

- กำหนด `{{EMAIL_CONTENT}}` (และ `{{CTA_TEXT}}`/`{{CTA_URL}}` ถ้ามีปุ่ม) ให้ครบทั้ง 15 template ที่เหลือ ตามรูปแบบเดียวกับ 5 template แรก
- CTA ที่ปลายทางเป็น `mailto:{{company_email}}` (template-7, 17): นับเป็น CTA ที่แก้ได้เฉพาะข้อความปุ่ม (`{{CTA_TEXT}}`) — ไม่มี `{{CTA_URL}}` marker เพราะ URL ล็อกเป็น mailto ของบริษัทตายตัว ไม่ให้ผู้ใช้กำหนดเอง
- template-20 "Flash Sale": เพิ่ม field เฉพาะทาง `discount_percent` และ `countdown` แยกจากกลไก CTA — ผู้ใช้แก้ค่าตัวเลขได้ แต่โครงสร้าง/สี/ขนาด/ตำแหน่งของส่วนนี้ยังเป็น chrome ล็อกตายตัว (ไม่สร้างกลไก generic เพราะมีแค่ template เดียวที่ต้องการรูปแบบนี้ในชุด 20 template)
- ขยาย `EmailTemplate` interface และ `composeCampaignHtml()` ให้รองรับ field เฉพาะทางของ template-20 เพิ่มจากที่มีอยู่ (`defaultContent`, `hasCta`, `defaultCtaText`, `defaultCtaUrl`)
- เพิ่มคอลัมน์ DB สำหรับ `discount_percent`, `countdown` ใน `email_campaigns` (ตามแบบ `cta_text`/`cta_url` เดิม)
- เพิ่ม UI field ใน `CampaignsPage.tsx` สำหรับกรอกค่า `discount_percent`/`countdown` เฉพาะเมื่อเลือก template-20
- ไม่แตะ `ArticleEditor.tsx` แบบ global เหมือนเดิม — logic จำกัดอยู่แค่ฝั่ง `CampaignsPage.tsx`

## Capabilities

### New Capabilities
(ไม่มี)

### Modified Capabilities
- `campaign-template-content-composition`: ขยาย requirement เดิมให้ครอบคลุมกรณีใหม่ 2 อย่าง — (1) CTA ที่ปลายทางล็อกเป็น mailto ไม่มี URL field ให้แก้, (2) template ที่มี dynamic content field เฉพาะทางนอกเหนือจาก EMAIL_CONTENT/CTA (กรณี template-20) — และขยายจำนวน template ที่ต้องกำหนด marker ให้ครบ 20/20

## Impact

- **Frontend**: `src/data/emailTemplates.ts` (กำหนด marker ให้ 15 template ที่เหลือ), `src/pages/CampaignsPage.tsx` (state + UI field สำหรับ discount_percent/countdown), `src/lib/campaignTemplateCompose.ts` (ขยาย compose function)
- **Backend**: `api/email-campaigns.php` (รับ/บันทึก field ใหม่ 2 ตัว ตามแบบ cta_text/cta_url)
- **Database**: migration เพิ่ม 2 คอลัมน์ใน `email_campaigns`
- **ไม่แตะ**: `ArticleEditor.tsx`, แคมเปญเก่า/ร่างเก่าที่ไม่มี `editable_content`, เนื้อหาบทความ (`ContentCardDialog.tsx`)
- งานส่วนใหญ่เป็นแรงงานคนกำหนด marker ทีละ 1 ใน 15 template เหมือนรอบก่อน ไม่ใช่ auto-detect ได้
