## Context

`api/email-campaigns.php` มี 3 จุดที่คำนวณ/ใช้รายชื่อผู้รับของแคมเปญ แต่ละจุดเขียน query แยกกันเองมาตั้งแต่แรก:

1. `createEmailCampaign()` / `updateEmailCampaign()` — นับ `total_recipients` ตอนบันทึกแคมเปญ (ปัจจุบัน `COUNT(*) FROM email_group_members WHERE group_id IN (...)`)
2. `sendCampaign()` — ดึงรายชื่อจริงตอนส่ง (ปัจจุบัน `SELECT DISTINCT c.* ... JOIN email_group_members ... JOIN email_campaign_recipients ...`)
3. (ใหม่ในเปลี่ยนแปลงนี้) preview endpoint ที่ต้องคำนวณระหว่างผู้ใช้กำลังติ๊กเลือกกลุ่ม ก่อนกดบันทึก

การที่ 3 จุดนี้ไม่ได้ใช้สูตรเดียวกันคือต้นตอของบั๊กที่เจอระหว่าง explore: จุด (1) นับ "สมาชิกภาพ" ไม่ใช่ "คนไม่ซ้ำ" ทำให้เกินจริงเมื่อมีคนซ้ำกันหลายกลุ่ม ส่วนจุด (2) ใช้ `DISTINCT c.*` ซึ่ง dedupe ตาม `customer_id` เท่านั้น — แต่ `customers` มี unique key เป็น `(company_id, email)` (ดู `database/…: ALTER TABLE customers ADD UNIQUE KEY uq_customer_company_email`) หมายความว่าอีเมลเดียวกันสามารถเป็น `customer_id` คนละแถวได้ถ้าเป็น contact ของคนละบริษัท — `DISTINCT c.*` จึงไม่กันการส่งซ้ำถึงกล่องเมลเดียวกันในกรณีข้ามบริษัท

โค้ดในไฟล์นี้มีแบบแผนอยู่แล้วสำหรับเลี่ยงความเสี่ยงเรื่องเวอร์ชัน MariaDB — `api/content-analytics.php` คำนวณ percentile ใน PHP แทน SQL `PERCENTILE_CONT` โดยเจตนา (ระบุไว้ในคอมเมนต์) เพื่อไม่ผูกกับ MariaDB build ที่ต่างกัน — การเปลี่ยนแปลงนี้เดินตามแบบแผนเดียวกันสำหรับ dedupe-by-email-with-tiebreak แทนที่จะใช้ window function ใน SQL

## Goals / Non-Goals

**Goals:**
- ผู้ใช้เลือกได้หลายกลุ่มต่อแคมเปญผ่าน UI checkbox list
- ตัวเลขจำนวนผู้รับ "ตรงกันทั้ง 3 จุด" (preview / บันทึก / ส่งจริง) เพราะใช้ฟังก์ชัน resolve เดียวกัน
- ผู้รับที่มีอีเมลเดียวกัน (ไม่ว่าจะมาจากกี่ `customer_id`/บริษัท/กลุ่ม) ได้รับอีเมลแคมเปญเดียวครั้งเดียว
- เมื่อต้อง personalize ให้อีเมลที่มีหลายแถวเป็นเจ้าของ เลือกแถวด้วยกติกาที่ระบุไว้แน่นอน (ไม่สุ่ม ไม่ผูกกับลำดับที่ query คืนมา)

**Non-Goals:**
- ไม่แก้ไข merge tags ที่มีอยู่ใน `api/email-utils.php` (personalization เดิมเพียงพอแล้ว — ตกลงระหว่าง explore)
- ไม่ทำ "customer merge" ถาวร (รวม 2 แถวเป็นแถวเดียวในตาราง `customers`) — ยังคงมีหลายแถวต่ออีเมลได้ตามปกติของระบบ multi-company contact เพียงแต่แคมเปญอีเมลจะมองเห็นเป็น "1 คน" เฉพาะตอน resolve ผู้รับ
- ไม่เปลี่ยนโครงสร้างตาราง `email_campaigns`/`email_campaign_recipients`/`email_group_members` (ไม่มี migration)

## Decisions

### 1. Resolve ผู้รับด้วย shared helper function เดียว เรียกใช้ 3 จุด
เพิ่มฟังก์ชัน `resolveCampaignRecipients(PDO $db, array $groupIds): array` ใน `api/email-campaigns.php` (หรือย้ายไป `email-utils.php` ถ้าเหมาะสมกว่าตอน implement) คืนอาร์เรย์ของผู้รับที่ dedupe แล้ว (1 แถวต่อ 1 อีเมล) เรียกใช้จาก `createEmailCampaign`, `updateEmailCampaign`, `sendCampaign`, และ action ใหม่ `recipient_count` — ไม่มีจุดไหนคำนวณ query ของตัวเองแยกอีกต่อไป

ทางเลือกที่พิจารณาแล้วไม่เลือก: คง query แยกกัน 3 จุดแต่ "sync สูตรให้เหมือนกัน" ด้วยมือ — ปัดตกเพราะเป็นต้นเหตุของบั๊กเดิมอยู่แล้ว (โค้ดซ้ำ 3 ที่ แก้ไม่ครบ) การรวมเป็นฟังก์ชันเดียวคือการแก้ที่ราก ไม่ใช่แค่ปะรอยรั่ว

### 2. Dedupe ตามอีเมล ไม่ใช่ customer_id — คำนวณใน PHP ไม่ใช้ window function
`resolveCampaignRecipients()`:
1. ดึงทุกแถวจาก `customers` ที่อยู่ในกลุ่มที่เลือก (`is_active=1 AND email != ''`) — เหมือน query เดิมของ `sendCampaign()`
2. Group ผลลัพธ์ด้วย `email` (lowercase-trim ก่อนเทียบ กันปัญหา case/space) ใน PHP
3. ต่อกลุ่มอีเมลที่มีมากกว่า 1 แถว เลือกแถวชนะด้วยกติกา: `is_primary_contact = 1` ก่อน ถ้าไม่มีแถวไหนเป็น primary (หรือมีมากกว่า 1 แถวที่เป็น primary ในคนละบริษัท) ใช้แถวที่ `updated_at` ล่าสุด

เหตุผลที่ไม่ใช้ `ROW_NUMBER() OVER (PARTITION BY email ORDER BY ...)`: ต้องการ MariaDB 10.2+ ซึ่งโค้ดที่มีอยู่แล้วในระบบเลี่ยงมาตลอด (ดู Context) — ทำใน PHP ทดสอบและอ่านง่ายกว่า และจำนวนผู้รับต่อแคมเปญ (หลักร้อย-พัน) เล็กพอที่จะไม่มีปัญหาประสิทธิภาพ

### 3. Endpoint ใหม่สำหรับ live preview — ใช้ helper เดียวกัน นับหลังจาก dedupe แล้วเท่านั้น
เพิ่ม `GET /email-campaigns.php?action=recipient_count&group_ids=<csv>` คืน `{ "count": N }` จาก `count(resolveCampaignRecipients($db, $groupIds))` — frontend เรียกทุกครั้งที่ผู้ใช้ติ๊ก/ยกเลิก checkbox กลุ่ม (debounce ~300ms กันยิงถี่เกินตอนติ๊กเร็วๆ)

### 4. `total_recipients` ที่บันทึกในตาราง เปลี่ยนไปใช้ helper เดียวกัน
`createEmailCampaign()`/`updateEmailCampaign()` เปลี่ยนจาก `COUNT(*) FROM email_group_members` เป็น `count(resolveCampaignRecipients($db, $groupIds))` — ตัวเลขที่บันทึกไว้ตรงกับที่ preview และตอนส่งจริงเป๊ะ

### 5. UI: Checkbox list แทน `<Select>` เดิม
[MarketingPage.tsx:1369](src/pages/MarketingPage.tsx:1369) เปลี่ยนจาก single-select `<Select>` เป็น checkbox list วนลูป `groups` — ทุกครั้งที่ toggle เรียก hook ใหม่ (เช่น `useCampaignRecipientCount(selectedCampaignGroups)`) ที่ debounce แล้วยิง `action=recipient_count`

## Risks / Trade-offs

- **[ความเสี่ยง] เปรียบเทียบอีเมลแบบ case/whitespace-sensitive อาจพลาด dedupe** (เช่น `A@x.com` กับ `a@x.com` ที่กรอกมาไม่ตรงกัน) → Mitigation: normalize ด้วย `strtolower(trim($email))` ก่อนใช้เป็น key ใน PHP array เสมอ
- **[ความเสี่ยง] แคมเปญที่เคยสร้าง/ส่งไปแล้วก่อนเปลี่ยนแปลงนี้ มี `total_recipients` ที่คำนวณด้วยสูตรเก่า (เกินจริงถ้ามี overlap)** → Mitigation: ไม่ backfill ข้อมูลเก่า (เป็น historical record ของสิ่งที่เกิดขึ้นจริงตอนนั้น) ตัวเลขใหม่มีผลกับแคมเปญที่สร้าง/แก้ไขนับจากนี้เท่านั้น
- **[ความเสี่ยง] preview endpoint ถูกยิงถี่ตอนผู้ใช้ติ๊กหลายกลุ่มเร็วๆ** → Mitigation: debounce ฝั่ง frontend (~300ms) และ query เบา (ไม่ join ตารางหนัก)
- **[Trade-off] เลือกแถว personalization ด้วย `is_primary_contact` → `updated_at` เป็นกติกาที่ตายตัว ไม่ให้ผู้ใช้เลือกเองต่อแคมเปญ** — ยอมรับความเรียบง่ายไว้ก่อน ถ้าพบว่าไม่พอในทางปฏิบัติ (เช่น อยากบังคับใช้ข้อมูลของบริษัทใดบริษัทหนึ่งเจาะจง) ค่อยเปิด option เพิ่มเป็นเวอร์ชันถัดไป

## Migration Plan

ไม่มี DB migration — ใช้ column/index ที่มีอยู่แล้วทั้งหมด (`customers.email`, `is_primary_contact`, `updated_at`, unique key `uq_customer_company_email`) Deploy ปกติ (backend endpoint ใหม่เป็น additive, ไม่กระทบ endpoint เดิม) Rollback: revert commit ได้ตรงๆ ไม่ต้องย้อน schema

## Open Questions

- **Normalize อีเมลแค่ไหน** — `strtolower(trim())` พอไหม หรือต้องจัดการ alias แบบ `name+tag@gmail.com` ด้วย (นอกเหนือขอบเขตที่คุยกันตอน explore ยังไม่ได้ตัดสินใจ ถือเป็นค่า default อย่างง่ายไปก่อน)
- **ตำแหน่งของ `resolveCampaignRecipients()`** — อยู่ใน `email-campaigns.php` เอง หรือย้ายไป `email-utils.php` (ที่มี `processMergeTags`/`getBaseUrl` อยู่แล้ว) ปล่อยให้ตัดสินใจตอน implement ตามความสะดวกของโครงสร้างไฟล์ที่มีอยู่
