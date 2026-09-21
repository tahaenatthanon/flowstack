## Context

เจอบั๊กนี้ระหว่างสืบสาเหตุแคมเปญ "ทดสอบการส่งแคมเปญ" ที่ผู้ใช้รายงานว่าส่งล้มเหลว (`api/email-campaigns.php` `sendCampaign()`) ตรวจโค้ดจริงพบว่า `catch (MailException $e)` จับ `$mail->ErrorInfo` ได้ถูกต้อง แต่ query `UPDATE email_tracking SET status = 'failed' WHERE id = ?` ไม่เขียน `bounce_reason` เลย ทั้งที่คอลัมน์นี้มีอยู่แล้ว (`VARCHAR(500)`, ตรวจสอบผ่าน `SHOW COLUMNS` บน DB จริง) และฝั่ง frontend (`CampaignsPage.tsx`) ก็มีโค้ดแสดงผล `bounce_reason` ไว้พร้อมแล้วทั้งใน mobile card (บรรทัด 1655) และ desktop table (บรรทัด 1693-1695) — เป็นโค้ดที่เขียนดักไว้ล่วงหน้าถูกต้องแต่ไม่เคยมีข้อมูลให้แสดงเพราะ backend ไม่เคยเขียนถึง และปุ่ม "ดู Log" (บรรทัด 784) ที่เปิด dialog นี้ก็ถูกจำกัดด้วย `campaign.status === 'sent'` — แคมเปญที่ทุกผู้รับล้มเหลว (`$sent === 0`) จะได้ `$finalStatus = 'draft'` (บรรทัด 712) ทำให้ปุ่มนี้ไม่โผล่เลย

ยืนยันแล้วว่า `sendCampaign()` อนุญาตให้เรียกซ้ำจากสถานะ `draft` ได้อยู่แล้ว (`in_array($campaign['status'], ['draft', 'scheduled'])` บรรทัด 582) — ดังนั้นดีไซน์ปัจจุบัน (ไม่มี status `'failed'` แยก) รองรับการ retry ได้อยู่แล้วโดยไม่ต้องแก้ schema

## Goals / Non-Goals

**Goals:**
- ข้อความ error จริงจาก PHPMailer ถูกบันทึกลง `bounce_reason` ทุกครั้งที่การส่งล้มเหลว
- ผู้ใช้เปิดดู "ประวัติการส่งอีเมล" ได้ทันทีที่มีการพยายามส่ง (`sent_at` มีค่า) ไม่ว่าผลจะสำเร็จหรือล้มเหลวทั้งหมด

**Non-Goals:**
- ไม่เพิ่ม status `'failed'` แยกจาก `'draft'` ใน `email_campaigns.status` — ENUM ปัจจุบันคือ `('draft','scheduled','sending','sent','cancelled')` การเพิ่มค่าใหม่ต้อง migration และต้องแก้ `STATUS_CONFIG` ฝั่ง frontend ด้วย (ไม่งั้น `STATUS_CONFIG[campaign.status]` จะเป็น `undefined` แล้ว crash) — ตัดสินใจแล้วว่าไม่คุ้มกับความซับซ้อนที่เพิ่มในรอบนี้ เพราะดีไซน์ retry-from-draft ที่มีอยู่แล้วก็ใช้งานได้
- ไม่แก้ปัญหา SMTP ที่แท้จริง (เช่น sender domain authorization ที่ SMTP2GO ระหว่าง `mail_username` domain `ktnbusinesssolutions.com` กับ `mail_from_address` domain `ktnbs.com`) — เป็นการตั้งค่านอกระบบโค้ด ต้องรอดู error message จริงหลัง deploy การเปลี่ยนแปลงนี้ก่อน
- ไม่แก้ retroactive ข้อมูลเก่า — แคมเปญที่เคยล้มเหลวไปแล้วก่อนหน้านี้จะไม่มี `bounce_reason` ย้อนหลัง (ข้อมูลจริงหายไปแล้ว ไม่มีทางกู้คืน)

## Decisions

**Decision 1 — เขียน `bounce_reason` ในบรรทัดเดียวกับที่ update status เป็น 'failed'**
```php
// เดิม
} catch (MailException $e) {
    $err = $mail->ErrorInfo;
    $db->prepare("UPDATE email_tracking SET status = 'failed' WHERE id = ?")->execute([$trackingId]);
    $errors[] = $recipient['email'] . ': ' . $err;
    $failed++;
}

// ใหม่
} catch (MailException $e) {
    $err = $mail->ErrorInfo;
    $db->prepare("UPDATE email_tracking SET status = 'failed', bounce_reason = ? WHERE id = ?")
       ->execute([$err, $trackingId]);
    $errors[] = $recipient['email'] . ': ' . $err;
    $failed++;
}
```
ทางเลือกที่พิจารณา: สร้างฟังก์ชันแยกสำหรับบันทึก error — ตัดออก เพราะเป็นการเปลี่ยนแปลง 1 บรรทัดในจุดเดียว ไม่มีความซับซ้อนพอที่จะคุ้มกับการแยกฟังก์ชัน

**Decision 2 — ใช้ `campaign.sent_at` แทน `campaign.status === 'sent'` เป็นเงื่อนไขเปิดปุ่ม "ดู Log"**
```tsx
// เดิม
{campaign.status === 'sent' && (
  <Button onClick={() => openRecipientLog(campaign.id)} ...>ดู Log</Button>
)}

// ใหม่
{campaign.sent_at && (
  <Button onClick={() => openRecipientLog(campaign.id)} ...>ดู Log</Button>
)}
```
ทางเลือกที่พิจารณา: เพิ่มเงื่อนไข `campaign.status === 'sent' || campaign.status === 'draft' && campaign.sent_at` — ตัดออก เพราะซับซ้อนโดยไม่จำเป็น `sent_at` เพียงอย่างเดียวครอบคลุมทั้งสองกรณีอยู่แล้ว (`sent_at` ถูก set ทุกครั้งที่มีการเรียก `sendCampaign()` ไม่ว่าผลจะเป็นอย่างไร ตรวจสอบแล้วจากบรรทัด 713-714 `UPDATE email_campaigns SET status = ?, sent_at = NOW(), ...` ไม่มีเงื่อนไข)

ปุ่ม "ส่ง"/"แก้ไข" (เงื่อนไข `campaign.status === 'draft'`) ยังคงแสดงคู่กันได้ตามปกติสำหรับแคมเปญที่ล้มเหลว — ผู้ใช้เห็นทั้ง "ดู Log" (เข้าใจสาเหตุ) และ "ส่ง" (ลองใหม่) พร้อมกัน ไม่ต้องแก้ backend เพิ่ม

## Risks / Trade-offs

- **[Risk] ข้อความ `$mail->ErrorInfo` อาจยาวเกิน 500 ตัวอักษรของ `bounce_reason VARCHAR(500)`** → **Mitigation:** ข้อความ error ของ PHPMailer ตามปกติสั้นกว่านี้มาก (เช่น "SMTP connect() failed...", "Could not authenticate.") ความเสี่ยงต่ำ ไม่ต้อง truncate เพิ่มเติมในรอบนี้
- **[Risk] แคมเปญเก่าที่เคยล้มเหลวก่อนหน้านี้ (ก่อน deploy change นี้) จะยังไม่มี bounce_reason ให้ดู** → **Mitigation:** ยอมรับ เป็นข้อมูลที่สูญหายไปแล้วจริง ไม่มีทาง backfill ได้ ผู้ใช้ต้องลองส่งใหม่เพื่อให้เกิด error message ใหม่ที่จะถูกบันทึกจากนี้ไป

## Migration Plan

1. แก้ `api/email-campaigns.php` (1 บรรทัด)
2. แก้ `src/pages/CampaignsPage.tsx` (1 เงื่อนไข)
3. ไม่มี DB migration (คอลัมน์มีอยู่แล้ว)
4. Rollback: revert commit ที่เกี่ยวข้อง ไม่มีข้อมูลถูกทำลาย

## Open Questions

- สาเหตุที่แท้จริงของการส่งล้มเหลว (sender domain authorization ที่ SMTP2GO หรืออื่น) ยังไม่ทราบแน่ชัด — จะรู้ได้หลัง deploy change นี้แล้วลองส่งใหม่อีกครั้ง (ต้องขออนุญาตผู้ใช้ก่อนทุกครั้งที่จะส่งอีเมลจริง ไม่ใช่ส่วนหนึ่งของ change นี้)
