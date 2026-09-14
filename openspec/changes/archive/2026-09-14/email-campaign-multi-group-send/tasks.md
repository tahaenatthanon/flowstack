## 1. Backend — Shared recipient resolution

- [x] 1.1 เขียนฟังก์ชัน `resolveCampaignRecipients($db, array $groupIds): array` ใน `api/email-campaigns.php` — ดึงทุกแถวจาก `customers` ที่ `is_active=1 AND email != ''` และอยู่ในกลุ่มใดกลุ่มหนึ่งของ `$groupIds` (join `email_group_members`)
- [x] 1.2 Group ผลลัพธ์ด้วยอีเมล normalize (`strtolower(trim($email))`) ใน PHP — ไม่ใช้ window function ของ SQL (ดู design.md เหตุผลเรื่อง MariaDB version)
- [x] 1.3 สำหรับอีเมลที่มีมากกว่า 1 แถว เลือกแถวชนะด้วยกติกา: `is_primary_contact = 1` ก่อน ถ้าไม่มี/มีมากกว่าหนึ่ง ใช้ `updated_at` ล่าสุด
- [x] 1.4 คืนอาร์เรย์ผู้รับที่ dedupe แล้ว (1 แถวต่อ 1 อีเมล) พร้อมข้อมูลที่ `sendCampaign`/`processMergeTags` ต้องใช้ (id, first_name, last_name, email, phone, position, company_name)

## 2. Backend — ใช้ helper แทน query เดิมทั้ง 3 จุด

- [x] 2.1 แก้ `sendCampaign()`: แทนที่ query `SELECT DISTINCT c.* ...` เดิมด้วย `resolveCampaignRecipients($db, $groupIds)` (ต้องดึง `group_ids` ของแคมเปญจาก `email_campaign_recipients` ก่อน) — คงพฤติกรรมเดิมส่วนอื่นไว้ (tracking, merge tags, PHPMailer loop)
- [x] 2.2 แก้ `createEmailCampaign()`: แทนที่ `SELECT COUNT(*) FROM email_group_members ...` ด้วย `count(resolveCampaignRecipients($db, $groupIds))` สำหรับ `total_recipients`
- [x] 2.3 แก้ `updateEmailCampaign()`: เช่นเดียวกับ 2.2 เมื่อ `group_ids` ถูกส่งมาอัปเดต
- [x] 2.4 เพิ่ม action ใหม่ `GET ?action=recipient_count&group_ids=<csv>` ในส่วน dispatch (บรรทัด ~30 ของไฟล์) เรียก `resolveCampaignRecipients()` แล้วคืน `{ "count": N }` — parse `group_ids` เป็น array, คืน `count: 0` ทันทีถ้าค่าว่าง (ไม่ query) — เพิ่ม tenant scoping ผ่าน `email_groups.tenant_id` ด้วย เพราะ endpoint นี้รับ group_ids ตรงจาก client โดยไม่มี campaign ผูกไว้ยืนยันสิทธิ์

## 3. Frontend — Types และ hook

- [x] 3.1 เพิ่ม hook `useCampaignRecipientCount(groupIds: string[])` ใน `src/hooks/useMarketing.ts` — เรียก `GET /email-campaigns.php?action=recipient_count&group_ids=...` debounce ~300ms, `enabled: groupIds.length > 0`

## 4. Frontend — UI เลือกหลายกลุ่ม

- [x] 4.1 แก้ `src/pages/MarketingPage.tsx` (บริเวณ [MarketingPage.tsx:1369](src/pages/MarketingPage.tsx:1369)): เปลี่ยนจาก `<Select>` single-select เป็น checkbox list วนลูป `groups` — แต่ละแถวแสดงชื่อกลุ่ม + `member_count`, toggle เข้า/ออก `selectedCampaignGroups` array (state มีอยู่แล้ว ไม่ต้องแก้ type) — ลบ import `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue` ที่ไม่ได้ใช้แล้วออกด้วย
- [x] 4.2 แทนที่ข้อความ "จะส่งถึง {g.member_count} คน" (ที่อ่านจากกลุ่มเดียว) ด้วยผลจาก `useCampaignRecipientCount(selectedCampaignGroups)` — แสดง "จะส่งถึง N คน" หรือซ่อนไปเมื่อยังไม่เลือกกลุ่มใดเลย

## 5. Verification

- [x] 5.1 รัน `pnpm lint` และ `pnpm build`, `php -l api/email-campaigns.php` (ทั้งหมดผ่าน 0 error)
- [x] 5.2 ทดสอบ manual (preview เท่านั้น ไม่ได้กดส่งจริงเพราะจะยิงอีเมลจริงผ่าน SMTP): แทรกลูกค้าทดสอบชั่วคราว 2 แถว อีเมลเดียวกัน (`dedup.test@example.com`) คนละบริษัท ใส่ไว้คนละกลุ่ม ("Test Group" 3 คน, "Smart Factory" 22 คน) — ยิง `?action=recipient_count` จริงผ่าน UI (ติ๊กทั้ง 2 กลุ่ม) ได้ `count: 24` ตรงตามที่คาด (22+3−1 ซ้ำ ไม่ใช่ 25) ยืนยัน dedupe-by-email ทำงานถูกต้องกับข้อมูลจริงผ่าน HTTP endpoint เต็มรูปแบบ — ลบข้อมูลทดสอบออกหลังยืนยันเสร็จ
- [x] 5.3 ทดสอบ personalization ของผู้รับที่มีหลายแถว — ตรวจ logic ผ่าน code review (ไม่ได้ทดสอบด้วยการส่งอีเมลจริงเพื่อเลี่ยงผลข้างเคียงส่งเมลจริง): แถวทดสอบ `is_primary_contact=1` (updated_at เก่ากว่า) ชนะแถว `is_primary_contact=0` (updated_at ใหม่กว่า) ตามกติกาที่ implement ไว้ใน `resolveCampaignRecipients()` ถูกต้องตาม logic ที่ตรวจสอบทีละบรรทัด
- [x] 5.4 debounce ใช้ pattern เดียวกับ `useDebounced` ที่มีอยู่แล้วใน `useCapacity.ts` (ทดสอบแล้วในโค้ดเดิม) — ยืนยันจาก network log ว่าแต่ละครั้งที่ติ๊ก checkbox ยิง request แยกกันตามลำดับ ไม่ชนกัน (ไม่ได้ stress-test เคสติ๊กรัวเร็วมากในรอบนี้)
