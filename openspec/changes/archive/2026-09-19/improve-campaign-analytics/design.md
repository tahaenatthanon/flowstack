## Context

หน้า `/campaign-analytics` ([CampaignAnalyticsPage.tsx](src/pages/CampaignAnalyticsPage.tsx)) ดึงข้อมูลทั้งหมดจาก endpoint เดียว `api/campaign-analytics.php` ซึ่งอ่านจาก 2 ตาราง:
- `email_campaigns` — ตัวนับสรุปต่อแคมเปญ (`total_sent`, `total_opens`, `total_clicks`) อัปเดตแบบ increment ตอนส่ง/เปิด/คลิกจริง
- `email_tracking` — บันทึกละเอียดต่อผู้รับ 1 แถว/1 คน มีคอลัมน์ `status` (`queued|sent|delivered|bounced|failed`) พร้อม index บน `campaign_id` และ `status` อยู่แล้ว

งานนี้เป็นการเพิ่มการอ่าน/คำนวณจากข้อมูลที่มีอยู่แล้วทั้งหมด ไม่มีการเพิ่มคอลัมน์หรือตารางใหม่

ข้อจำกัดสำคัญที่ต้องคำนึงถึง: สถานะ `delivered` ใน `email_tracking` ไม่ได้แปลว่าอีเมลถึงกล่องจดหมายจริง — ระบบตั้งค่านี้เฉพาะตอนพิกเซลเปิดอีเมลถูกเรียก ([track-open.php](api/track-open.php)) เพราะระบบส่งผ่าน SMTP ตรง (PHPMailer) ไม่ได้ใช้ผู้ให้บริการที่มี webhook ยืนยันการส่งถึง งานนี้จึงไม่นำสถานะ `delivered`/`bounced` มาแสดงเป็นตัวชี้วัดใหม่ เพื่อไม่ให้ผู้ใช้เข้าใจผิด

## Goals / Non-Goals

**Goals:**
- ป้ายชื่อและกราฟบนหน้า analytics สื่อความหมายตรงกับสูตรที่คำนวณจริง
- เพิ่มตัวชี้วัด CTOR และแยกนับ "ส่งไม่สำเร็จ" โดยใช้ข้อมูลที่มีอยู่แล้วเท่านั้น
- ให้ผู้ใช้เลือกมุมมองจัดอันดับ Top Campaign ได้เอง
- เพิ่ม summary funnel จากขั้นตอนที่มีข้อมูลจริงรองรับ (ส่ง → เปิด → คลิก)

**Non-Goals:**
- ไม่ทำระบบตรวจจับ bounce จริงจากผู้ให้บริการอีเมล (ต้องมี ESP webhook หรือระบบอ่านกล่องเมลเด้งกลับก่อน — เป็นงานแยกในอนาคต)
- ไม่ทำระบบ/ตัวชี้วัด unsubscribe (ยังไม่มีกลไกยกเลิกรับอีเมลในระบบเลย — เป็นงานแยกในอนาคต)
- ไม่เพิ่มการจัดเรียงให้ตาราง "แคมเปญทั้งหมด" (เฉพาะการ์ด "Top Campaign" เท่านั้นที่เพิ่มการจัดเรียงในรอบนี้)
- ไม่มีการเปลี่ยนแปลง schema ฐานข้อมูล ไม่มี migration ใหม่

## Decisions

**1. คำนวณ CTOR ที่ backend ไม่ใช่ frontend**
`open_rate`/`click_rate` คำนวณที่ `api/campaign-analytics.php` อยู่แล้วพร้อม logic ป้องกันหารด้วยศูนย์ (`total_sent > 0 ? ... : 0`) — ทำ CTOR (`clicks ÷ opens`) ตาม pattern เดียวกันที่จุดเดียว เพื่อไม่ให้ logic ป้องกันหารด้วยศูนย์กระจายไปทั้ง frontend และ backend

*ทางเลือกที่พิจารณาแล้วไม่เลือก:* คำนวณที่ frontend จาก `total_opens`/`total_clicks` ที่ได้มาอยู่แล้ว — ตัดทิ้งเพราะจะทำให้มี 2 จุดคำนวณอัตราแบบเดียวกันคนละที่ (backend คำนวณ open/click rate, frontend คำนวณ CTOR) เสี่ยงสูตรเพี้ยนไม่ตรงกันในอนาคต

**2. นับ "ส่งไม่สำเร็จ" ด้วย subquery สดจาก `email_tracking` ไม่เพิ่มคอลัมน์ใหม่**
เพิ่ม `(SELECT COUNT(*) FROM email_tracking WHERE campaign_id = ec.id AND status = 'failed') AS total_failed` ในคำสั่ง SELECT ของตาราง "แคมเปญทั้งหมด" — ใช้ index ที่มีอยู่แล้ว (`idx_campaign_id`, `idx_status`) และผลกระทบจำกัดเพราะ query มี `LIMIT`/`OFFSET` อยู่แล้ว (สูงสุด 100 แถวต่อครั้ง)

*ทางเลือกที่พิจารณาแล้วไม่เลือก:* เพิ่มคอลัมน์ `total_failed` ลงตาราง `email_campaigns` แล้ว sync ตอนส่ง (เหมือน `total_sent`/`total_opens`) — ตัดทิ้งเพราะต้องเพิ่ม migration และจุด sync ใหม่ ทั้งที่คำนวณสดจากข้อมูลที่มีอยู่แล้วได้โดยไม่มีต้นทุนเพิ่มเติมที่มีนัยสำคัญ

**3. Sort parameter ของ Top Campaign เป็น query string เดียว มี default เท่าค่าเดิม**
`?top_sort=opens|clicks|open_rate|click_rate` (default: `opens` — พฤติกรรมเดิม) ไม่ breaking กับการเรียกที่ไม่ส่ง param มา

**4. Summary funnel ใช้ตัวเลขระดับ "รวมทั้งช่วงเวลาที่เลือก" 3 ขั้นเท่านั้น: ส่ง → เปิด → คลิก**
ใช้ `total_sent`/`total_opens`/`total_clicks` ที่มีอยู่แล้วในสรุปสถิติ ไม่เพิ่มขั้น "Delivered" เพราะสถานะนี้ในระบบปัจจุบันจะเท่ากับจำนวน "เปิด" เป๊ะทุกครั้ง (ดู Context) การใส่เข้าไปจะทำให้ funnel มี 2 ขั้นที่ตัวเลขซ้ำกันและเข้าใจผิดว่าเป็นข้อมูลคนละชุด

## Risks / Trade-offs

- **[Risk]** ผู้ใช้อาจเข้าใจว่าคอลัมน์ "ส่งไม่สำเร็จ" ครอบคลุมอีเมลตีกลับ (bounce) ด้วย → **Mitigation:** ใช้ label "ส่งไม่สำเร็จ" เท่านั้น ไม่ใช้คำว่า "bounce"/"เด้งกลับ" ในหน้า UI ของงานนี้ เพื่อไม่ชนกับความหมายของ bounce จริงที่จะทำในงานแยกภายหลัง
- **[Risk]** เปลี่ยนกราฟแนวโน้มจากจำนวนดิบเป็น % อาจทำให้ผู้ใช้ที่คุ้นกับตัวเลขเดิมสับสนช่วงแรก → **Mitigation:** เก็บจำนวนดิบไว้แสดงใน tooltip ของกราฟ ไม่ลบข้อมูลเดิม เปลี่ยนแค่แกนหลักที่พล็อต
- **[Risk]** subquery นับ failed เพิ่มภาระ query ในตารางที่ email_tracking โตขึ้นมากในอนาคต → **Mitigation:** มี index รองรับอยู่แล้วและ query ถูกจำกัดด้วย pagination อยู่แล้ว หากในอนาคตกลายเป็นคอขวดจริง ค่อยพิจารณาย้ายไปใช้ตัวนับสะสมแบบ `total_sent`

## Migration Plan

ไม่มี migration ฐานข้อมูล — deploy frontend และ backend พร้อมกันได้ในรอบเดียว (backward compatible เพราะ sort parameter มีค่า default เท่าพฤติกรรมเดิม) ไม่ต้อง rollback plan พิเศษนอกจาก revert commit ตามปกติ

## Open Questions

ไม่มี — ทุกจุดที่ต้องตัดสินใจถูกเคาะไว้ในเอกสารนี้แล้ว
