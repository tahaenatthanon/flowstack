## Context

สามฟีเจอร์ในการเปลี่ยนแปลงนี้แตะโค้ดคนละจุดแต่เกี่ยวโยงกันผ่านแนวคิด "ผู้รับ/ผู้ติดต่อของแคมเปญ" — จึงรวมไว้ในเปลี่ยนแปลงเดียวกันเพื่อให้ตรวจสอบ dependency ระหว่างกันได้ครบ

**สถานะปัจจุบันที่ตรวจสอบแล้วในโค้ดจริง:**

1. **ตั้งเวลาส่ง:** `api/email-campaigns.php` มี `scheduleCampaign()` ที่ตั้ง `status='scheduled'` และ `scheduled_at` ได้แล้ว และ frontend มี `useScheduleEmailCampaign()` hook ที่เรียก endpoint นี้ได้ — แต่ไม่มี component ไหน import hook นี้ไปใช้ และ**ไม่มี cron job ใดเลยที่สแกน `email_campaigns` ที่ถึงกำหนดส่ง** ระบบ cron ที่มีอยู่ (`cron_jobs` + `api/cron/tick.php` + `api/lib/cron-runner.php`, ดู spec `cron-job-dispatch`) เป็น infrastructure ทั่วไปที่รองรับ job ประเภท `include` อยู่แล้ว (ตัวอย่าง: `publish-scheduler` ที่ `include` ไฟล์ `api/cron/publish-scheduler.php` ทุก 1 นาที) — เราจะเพิ่ม job ใหม่ในรูปแบบเดียวกัน ไม่สร้างกลไกจับเวลาใหม่

2. **`sendCampaign()` เรียกซ้ำไม่ได้ในลูป:** ฟังก์ชันนี้เรียก `jsonError()`/`jsonSuccess()` ที่ทั้งคู่จบด้วย `exit` (ดู `api/config.php`) และอ่าน `$id` จาก `getRequestBody()`/`$_GET['id']` ตรงๆ — เขียนมาเพื่อรับ 1 HTTP request ต่อ 1 แคมเปญเท่านั้น ถ้า cron job เรียกฟังก์ชันนี้ตรงๆ ในลูป แคมเปญที่ถึงกำหนดตัวที่ 2 เป็นต้นไปจะไม่มีทางถูกประมวลผล เพราะตัวแรกจะ `exit` ทั้ง process ทันทีไม่ว่าสำเร็จหรือ error

3. **`resolveCampaignRecipients(PDO $db, array $groupIds): array`** (บรรทัด 531 ของ `api/email-campaigns.php`) เป็นจุดเดียวที่ query รายชื่อผู้รับจาก groups แล้ว dedupe ตามอีเมล ถูกเรียกจาก 3 จุด (preview/บันทึก/ส่งจริง) ตาม requirement ที่มีอยู่แล้วใน spec `email-campaign-recipient-resolution` — segment แบบไดนามิกต้องขยายฟังก์ชันนี้ ไม่ใช่สร้าง query คู่ขนานใหม่ ไม่งั้นตัวเลข preview/บันทึก/ส่งจริงจะไม่ตรงกันอีก

4. **`CreateOpportunityDialog.tsx`** ส่ง `customer_id` ใน payload ตอนสร้างโอกาสขายใหม่ (บรรทัด 86) แต่ `api/opportunities.php` ตอน `INSERT` อ่านจาก `$body['contact_id']` (บรรทัด 119) เท่านั้น — คนละ key กัน ทำให้ผู้ติดต่อที่เลือกไว้ตอนสร้างไม่เคยถูกบันทึกลง `contact_id` เลย (ต้องไปเลือกใหม่ตอนแก้ไขทีหลังถึงจะติด เพราะ endpoint `PUT` รับ key `contact_id` ถูกต้องอยู่แล้ว) — บั๊กนี้มีมาก่อนงานนี้และไม่เกี่ยวกับแคมเปญโดยตรง แต่ต้องแก้ก่อน เพราะ requirement การแนะนำแคมเปญต้องมี `contact_id` จริงถึงจะรู้ว่าจะค้นประวัติคลิกของใคร

## Goals / Non-Goals

**Goals:**
- แคมเปญที่ตั้งเวลาไว้ถูกส่งจริงเมื่อถึงเวลา ไม่ต้องมีคนกดปุ่มตอนนั้น
- ผู้ใช้กรองผู้รับแคมเปญด้วยเงื่อนไขอัตโนมัติได้ นอกเหนือจากกลุ่ม static
- โอกาสขายใหม่ที่มาจากลูกค้าที่เคยคลิกแคมเปญ ได้รับการเสนอ campaign ที่ถูกต้องให้ยืนยัน ลดการลืมกรอก
- ผู้ติดต่อที่เลือกไว้ตอนสร้างโอกาสขายถูกบันทึกจริง (แก้บั๊กเดิม)

**Non-Goals:**
- ไม่ทำ segment ตามเงื่อนไขซับซ้อน/รวมหลายเงื่อนไขด้วย AND/OR ในรอบนี้ — เริ่มจาก 2 มิติที่ระบุไว้ในเดียว (ผู้ใช้เลือกได้ทีละมิติ หรือทั้งสองมิติรวมกันแบบ AND)
- ไม่ทำ retry/backoff ละเอียดสำหรับแคมเปญที่ตั้งเวลาแล้วส่งไม่สำเร็จทั้งหมด (พฤติกรรมเดิมคือ fallback กลับเป็น `draft` เมื่อส่งไม่สำเร็จเลยสักคน — คงพฤติกรรมเดิมไว้)
- ไม่เปลี่ยนกลไก cron ที่มีอยู่ ไม่เพิ่มตัวจับเวลาระดับ OS ใหม่
- ไม่ auto-set แคมเปญในฟอร์ม Opportunity แบบไม่ให้ผู้ใช้เห็น (ตามที่ผู้ใช้ยืนยันไว้ว่าต้อง pre-fill + ให้ยืนยันเอง)

## Decisions

**1. แยก `sendCampaign()` เป็น `sendCampaignCore()` + wrapper HTTP เดิม**

```
function sendCampaignCore(PDO $db, string $id, string $userId, string $tenantId): array {
    // เนื้อหาเดิมของ sendCampaign() ทั้งหมด แต่คืน array แทน jsonSuccess()/jsonError()
    // เช่น ['ok' => false, 'error' => '...', 'code' => 400] หรือ
    //      ['ok' => true, 'sent' => N, 'failed' => M, 'errors' => [...]]
}

function sendCampaign($db, $userId, string $tenantId) {
    $body = getRequestBody();
    $id = $body['id'] ?? $_GET['id'] ?? '';
    if (empty($id)) jsonError('Campaign ID required', 400);
    $result = sendCampaignCore($db, $id, $userId, $tenantId);
    if (!$result['ok']) jsonError($result['error'], $result['code']);
    jsonSuccess($result['data']);
}
```

ตัวจับเวลาเรียก `sendCampaignCore()` ตรงๆ ในลูป, ดัก exception/ผลลัพธ์ `ok=false` ต่อแคมเปญ, ไม่ให้ตัวใดตัวหนึ่งทำให้รอบทั้งหมดหยุด

*ทางเลือกที่พิจารณาแล้วไม่เลือก:* คัดลอกตรรกะการส่งไปเขียนแยกในไฟล์ cron — ตัดทิ้งเพราะจะมี logic ส่งอีเมล (PHPMailer, merge tags, tracking) อยู่ 2 ชุดที่ต้องแก้พร้อมกันตลอดไป เสี่ยงตกหล่น

**2. งาน cron ใหม่ `send-scheduled-campaigns` แบบ `type='include'` เหมือน `publish-scheduler`**

ไฟล์ `api/cron/send-scheduled-campaigns.php`:
```
- SELECT id, tenant_id, created_by FROM email_campaigns
  WHERE status = 'scheduled' AND scheduled_at <= NOW()
- foreach: เรียก sendCampaignCore($db, $id, $createdBy, $tenantId)
  (ใช้ created_by ของแคมเปญเป็น "ผู้ส่ง" เพราะไม่มี session user ในบริบท cron)
- พิมพ์สรุปจำนวนที่ประมวลผล/สำเร็จ/ล้มเหลว ให้ cron-runner อ่านได้ตามรูปแบบเดียวกับ publish-scheduler
```
เพิ่มแถวใหม่ใน `cron_jobs` ผ่าน migration ด้วย `cron_expression='* * * * *'` (ทุก 1 นาที เหมือน publish-scheduler) `enabled=1`

**3. Segment filters เก็บเป็น JSON บนตัวแคมเปญ คำนวณสดทุกครั้ง**

คอลัมน์ใหม่ `email_campaigns.segment_filters` (JSON, NULLABLE) เก็บรูปแบบ:
```json
{ "business_type": "IT", "engagement": "has_opened_or_clicked_any" }
```
ทั้งสองคีย์ optional (ใส่คีย์ไหนก็กรองด้วยเงื่อนไขนั้น เป็น AND ระหว่างคีย์ที่มี) ขยาย `resolveCampaignRecipients()`:
```
function resolveCampaignRecipients(PDO $db, array $groupIds, ?array $segmentFilters = null): array
```
เมื่อมี `$segmentFilters` ให้ query เพิ่มจาก `customers` (join `companies` สำหรับ business_type, join `email_tracking` สำหรับ engagement) แล้ว merge แถวเข้ากับผลจาก group_ids **ก่อน** ขั้นตอน dedupe-by-email เดิม (ใช้ dedupe logic เดียวกัน ไม่เขียนซ้ำ)

*ทางเลือกที่พิจารณาแล้วไม่เลือก:* สร้างตาราง `email_campaign_segments` แยกเก็บเงื่อนไขเป็นแถวๆ — ตัดทิ้งเพราะ v1 มีแค่ 2 มิติคงที่ ยังไม่คุ้มความซับซ้อนของตารางใหม่ ใช้ JSON column พอสำหรับตอนนี้ ขยายเป็นตารางได้ภายหลังถ้าจำนวนมิติเพิ่มขึ้นเยอะ

**4. Endpoint แนะนำแคมเปญจากประวัติคลิก**

`GET /email-campaigns.php?action=suggest_campaign&customer_id=xxx` คืน:
```json
{ "campaign_id": "...", "campaign_name": "...", "clicked_at": "..." }
```
หรือ `{ "campaign_id": null }` ถ้าไม่พบ — query จาก `email_tracking WHERE customer_id = ? AND clicked_at IS NOT NULL AND clicked_at >= NOW() - INTERVAL 180 DAY ORDER BY clicked_at DESC LIMIT 1` join `email_campaigns` เอาชื่อมาโชว์

*กรอบเวลา 180 วัน:* เป็นสมมติฐานที่ตั้งไว้เพื่อไม่ให้แนะนำคลิกเก่ามากจนไม่เกี่ยวข้องแล้ว ปรับได้ภายหลังถ้าฝ่ายขายบอกว่าไม่พอ/มากไป

**5. Auto-suggest ต้องแสดงผลให้เห็น ไม่ใช่ set ค่าเงียบๆ**

ช่อง "Campaign" ในฟอร์มสร้างโอกาสขายอยู่ใน `<Collapsible>` ที่ปิดอยู่โดย default (`advancedOpen` เริ่มที่ `false`) — ถ้า auto-fill ค่าโดยไม่เปิด section นี้ให้เห็น ผู้ใช้จะไม่รู้ตัวว่ามีการเดาให้ ขัดกับที่ตัดสินใจไว้ว่าต้อง "pre-fill ให้ยืนยันเอง" ดังนั้นเมื่อพบคำแนะนำ ระบบ SHALL เปิด `advancedOpen` ให้อัตโนมัติพร้อมข้อความกำกับสั้นๆ ข้างช่อง Campaign ว่าแนะนำจากประวัติคลิก ให้ผู้ใช้ตรวจสอบเอง — ถ้าผู้ใช้เคยเลือก Campaign เองไว้ก่อนแล้ว (ไม่ใช่ `__none__`) ระบบ SHALL NOT เขียนทับค่าที่เลือกไว้เอง

## Risks / Trade-offs

- **[Risk]** คำแนะนำแคมเปญอาจผิดถ้าลูกค้าคลิกหลายแคมเปญใกล้กัน (โฆษณาสับสนว่ามาจากอันไหนจริง) → **Mitigation:** ใช้แคมเปญที่คลิกล่าสุดเป็นค่าเริ่มต้นเท่านั้น และให้ผู้ใช้แก้เองได้เสมอ (ไม่ auto-set แบบล็อก)
- **[Risk]** งาน cron ใหม่รันทุก 1 นาทีอาจส่งแคมเปญเดียวกันซ้ำถ้ามีปัญหา race condition (สองรอบ tick มาซ้อนกัน) → **Mitigation:** `sendCampaignCore()` ตั้ง `status='sending'` ทันทีก่อนเริ่มส่ง (พฤติกรรมเดิมของ `sendCampaign()` มีอยู่แล้ว) และ query ของ cron กรอง `status='scheduled'` เท่านั้น แคมเปญที่เปลี่ยนเป็น `sending` แล้วจะไม่ถูกหยิบซ้ำในรอบถัดไป
- **[Risk]** Segment filter ที่คำนวณสดตอนส่งอาจได้จำนวนผู้รับต่างจากตอน preview ถ้าข้อมูลลูกค้าเปลี่ยนระหว่างนั้น (เช่น ลูกค้าถูกปิดใช้งาน) → **Mitigation:** เป็นพฤติกรรมเดียวกับกลุ่ม static ที่มีอยู่แล้วในระบบ (resolve สดทุกครั้งเช่นกัน) ไม่ใช่ความเสี่ยงใหม่ที่งานนี้สร้างขึ้น
- **[Risk]** แก้บั๊ก `customer_id`→`contact_id` อาจกระทบพฤติกรรมเดิมที่บางคนอาจพึ่งพาการที่ contact_id ว่างเปล่าอยู่ (ไม่น่าเป็นไปได้) → **Mitigation:** ตรวจสอบแล้วว่าเป็นบั๊กที่ไม่มีใครตั้งใจให้เกิด (endpoint PUT ใช้ key ที่ถูกต้องอยู่แล้ว) การแก้คือทำให้ create สอดคล้องกับ update

## Migration Plan

1. รัน migration เพิ่มคอลัมน์ `segment_filters` ใน `email_campaigns`
2. รัน migration เพิ่มแถวงานใหม่ใน `cron_jobs` สำหรับ `send-scheduled-campaigns`
3. Deploy backend (แยก `sendCampaignCore`, endpoint ใหม่, ไฟล์ cron ใหม่) พร้อมกับ frontend (ปุ่มตั้งเวลา, UI segment, auto-suggest)
4. ตรวจสอบด้วยมือ 1 ครั้ง: ตั้งเวลาส่งแคมเปญทดสอบไว้ 2 นาทีข้างหน้า แล้วรอดูว่า cron ส่งจริงภายในรอบถัดไป (ไม่ต้องรอ deploy ใหม่ถ้าจะ rollback — ปิด `enabled` ของ job ใน `cron_jobs` ได้ทันทีผ่านหน้าแอดมินโดยไม่ต้อง deploy ซ้ำ)

## Open Questions

ไม่มี — จุดตัดสินใจหลัก (segment computed live, auto-link แบบ pre-fill+confirm) ผู้ใช้ยืนยันไว้แล้วก่อนเริ่มเขียนเอกสารนี้
