## Why

หน้าแก้ไขแคมเปญอีเมลบังคับเลือก "กลุ่มผู้รับ" ได้ทีละกลุ่มเท่านั้น (dropdown แบบ single-select) ทั้งที่ schema, backend query, และ state (`selectedCampaignGroups: string[]`) รองรับหลายกลุ่มต่อแคมเปญอยู่แล้ว — ผู้ใช้ที่ต้องการส่งถึงหลายกลุ่มพร้อมกันต้องสร้างแคมเปญซ้ำหลายฉบับ ระหว่างตรวจสอบพบว่าตัวนับ `total_recipients` ตอนสร้าง/แก้ไขแคมเปญยังนับ "สมาชิกภาพ" (`COUNT(*) FROM email_group_members`) ไม่ใช่ "คนไม่ซ้ำ" ซึ่งจะแสดงตัวเลขเกินจริงทันทีที่เปิดใช้ multi-group และ `customers` มี unique key เป็น `(company_id, email)` — อีเมลเดียวกันสามารถเป็น contact ของหลายบริษัทได้ (คนละ `customer_id`) ทำให้แม้แก้ตัวนับด้วย `DISTINCT customer_id` ก็ยังส่งซ้ำถึงกล่องเมลเดียวกันได้เมื่อผู้รับข้ามบริษัทถูกเลือกพร้อมกัน

## What Changes

- เปลี่ยน UI เลือกกลุ่มผู้รับจาก dropdown (single-select) เป็น checkbox list — แสดงทุกกลุ่มพร้อมจำนวนสมาชิก เลือกได้พร้อมกันหลายกลุ่ม
- เพิ่มตัวเลข "จะส่งถึง N คน" แบบ live preview ที่ยิง endpoint ใหม่ทุกครั้งที่ผู้ใช้ติ๊ก/ยกเลิกกลุ่ม (ไม่ใช่บวก `member_count` ดิบๆ ฝั่ง client ซึ่งนับซ้ำเมื่อมีคนอยู่หลายกลุ่ม)
- สร้าง shared recipient-resolution helper ที่ dedupe ผู้รับ **ตามอีเมล** (ไม่ใช่ `customer_id`) ครอบคลุมกรณีอีเมลเดียวกันเป็น contact ของหลายบริษัท — ใช้ร่วมกัน 3 จุด: ส่งจริง (`sendCampaign`), นับตอนสร้าง/แก้ไข (`total_recipients`), และ preview endpoint ใหม่ เพื่อไม่ให้ตัวเลขสามจุดนี้ขัดแย้งกันอีก (ต้นตอของบั๊กเดิม)
- เมื่อมีหลาย `customer` row ใช้อีเมลเดียวกัน (ข้ามบริษัท) เลือกแถวสำหรับ personalization ด้วยกติกา: `is_primary_contact=1` ก่อน ถ้าไม่มีให้ใช้แถวที่ `updated_at` ล่าสุด
- ผู้รับที่มีอีเมลซ้ำกันข้ามกลุ่ม/บริษัท ได้รับอีเมลแคมเปญนั้น **ครั้งเดียว** ไม่ว่าจะเป็น contact ของกี่บริษัทหรืออยู่กี่กลุ่มที่ถูกเลือก
- ไม่เปลี่ยน personalization merge tags ที่มีอยู่แล้ว (`{{first_name}}`, `{{last_name}}`, `{{company_name}}` ฯลฯ) — ยังคงทำงานเหมือนเดิม เพียงเปลี่ยนว่า "ข้อมูลของใคร" ถูกนำมาแทนที่เมื่อมีความกำกวมข้ามบริษัท

## Capabilities

### New Capabilities
- `email-campaign-recipient-resolution`: การ resolve รายชื่อผู้รับแคมเปญจากหลายกลุ่มที่เลือก (multi-group), การ dedupe ตามอีเมลข้ามบริษัทด้วยกติกา tiebreak, endpoint preview จำนวนผู้รับแบบ live, และ UI checkbox list สำหรับเลือกหลายกลุ่ม

## Impact

- **Backend**: `api/email-campaigns.php` — เพิ่มฟังก์ชัน resolve ผู้รับที่ใช้ร่วมกัน (เรียกจาก `createEmailCampaign`, `updateEmailCampaign`, `sendCampaign` และ action ใหม่สำหรับ preview) ไม่มี migration (ใช้ column/index ที่มีอยู่แล้ว: `customers.email`, `customers.is_primary_contact`, `customers.updated_at`)
- **Frontend**: `src/pages/MarketingPage.tsx` (เปลี่ยน group picker เป็น checkbox list + เรียก preview endpoint), `src/hooks/useMarketing.ts` (hook สำหรับ preview endpoint ใหม่)
- **ไม่กระทบ**: โครงสร้าง `email_campaigns`/`email_campaign_recipients`/`email_group_members` เดิม, merge tags ที่มีอยู่ใน `api/email-utils.php`, การ track open/click
