## Why

ระบบเผยแพร่คอนเทนต์ยังไม่เคยทำงานสำเร็จแม้แต่ครั้งเดียว: `content_publish_queue` มี `failed` 23 แถวและ `sent` 0 แถว ซึ่งทำให้เกณฑ์เสร็จเฟส 0 (`content_items.published_at` ไม่ NULL ≥ 1) ยังไม่ผ่าน สาเหตุหลัก 16/23 มาจาก `dispatch_content()` ไม่รองรับ platform `lotusdomino` (`Unknown platform: lotusdomino`) และอีก 7/23 มาจาก credentials ของ WordPress channel ไม่ครบ (`username`/`app_password`)

## What Changes

- เพิ่ม platform `lotusdomino` เข้า `dispatch_content()` ใน `api/lib/publish-dispatch.php` โดยสกัด logic จาก `api/brand-content.php` inline handler ออกมาเป็น `dispatch_lotusdomino()` (งานที่ roadmap เดิมเลื่อนไว้ แต่ตอนนี้กลายเป็นตัวขวางจริง)
- แก้ credentials ของ WordPress channel (`351b7173-…`) ให้ถอดรหัสแล้วมี key `username` และ `app_password` ครบ
- แก้ channel Youtube (`6e77f494-…`) ที่ `platform = ''` — ตั้ง platform ถูกต้อง หรือปิด `is_active = 0`
- Re-queue รายการ `failed` ที่ยังควรเผยแพร่ (ตรวจรายแถวก่อน ห้าม reset ทั้งก้อน 23 แถว)
- ยืนยัน DoD เฟส 0 ผ่านทั้ง 3 เส้นทาง: `send_now`, cron queue, approve

## Capabilities

### New Capabilities
- `publish-dispatch-lotusdomino`: เพิ่มฟังก์ชัน dispatch สำหรับ platform `lotusdomino` (Lotus Domino agent endpoint) เข้า match ใน `dispatch_content()` เพื่อให้ cron queue และ `send_now` เผยแพร่ไป Lotus Domino ได้แทนที่จะคืน `Unknown platform`

### Modified Capabilities
<!-- ไม่มี requirement-level change ใน spec เดิม — result tracking เดิมครอบคลุมการเขียนกลับ platform_post_id อยู่แล้ว -->

## Impact

- `api/lib/publish-dispatch.php` — เพิ่ม `dispatch_lotusdomino()` + match arm
- `api/brand-content.php` — inline `lotusdomino` handler (~50 บรรทัด) ยังคงอยู่ (patch ไม่ refactor ยกเว้นจุด lotusdomino ที่จำเป็น) หรือ refactor ให้เรียก dispatch function
- `api/cron/publish-scheduler.php` — ได้รับประโยชน์อัตโนมัติจาก `dispatch_content()` ที่รองรับ lotusdomino
- ฐานข้อมูล — แก้ไขข้อมูล `publish_channels` (credentials WordPress, platform ของ Youtube) และ `content_publish_queue` (re-queue)
- ไม่มีการเปลี่ยนแปลง schema
