## Why

เหตุการณ์ 19 ส.ค. 2026 12:30 เผยให้เห็นว่าเส้นทางเผยแพร่คอนเทนต์ **รายงานผลไม่ตรงความจริงและกันการยิงซ้ำไม่ได้**: มี 16 request เข้า `send_now` ภายใน 11 วินาที POST คอนเทนต์ชิ้นเดียวกันไป Lotus Domino production 16 ครั้ง ทุกแถวได้ `status='sent'` และคอนเทนต์กลายเป็น `published` ทั้งที่ (ก) ยังไม่ผ่านการอนุมัติ (`approved_at IS NULL`) และ (ข) ระบบพิสูจน์ไม่ได้เลยว่า Domino บันทึกเอกสารจริง เพราะ `dispatch_lotusdomino()` ถือว่าสำเร็จเมื่อไม่มี cURL error แม้ปลายทางตอบ 4xx/5xx และไม่เก็บ response body ไว้ตรวจย้อนหลัง

ผลคือ `status='sent'` ในระบบนี้ **ไม่มีค่าเป็นหลักฐาน** — ซึ่งเป็นเกณฑ์ที่ change ก่อนหน้า (`phase-0-publish-dispatch-blockers`, archive 19 ส.ค. 2026) ใช้วัดความสำเร็จของเส้นทาง cron (งาน 5.2) จึงต้องแก้ความน่าเชื่อถือของชั้น dispatch ก่อน เกณฑ์นั้นจึงจะมีความหมาย

## What Changes

- **BREAKING** `dispatch_lotusdomino()` เลิกพฤติกรรม "assume ok" — HTTP >= 400 คืน `success=false` พร้อมข้อความจาก response body แทนที่จะพลิกเป็นสำเร็จ (ปัจจุบัน `api/lib/publish-dispatch.php:464-467` พลิกค่ากลับ ทั้งที่ `_dispatch_post()` ตรวจ status ถูกต้องอยู่แล้วที่บรรทัด 103-107)
- เก็บ response body ของทุกการ dispatch (สำเร็จและล้มเหลว) ลงคอลัมน์ใหม่ `content_publish_queue.response_snippet` — เป็นชิ้นส่วนที่ตอบคำถาม "ปลายทางรับเอกสารจริงหรือไม่" ซึ่งตอนนี้ไม่มีข้อมูลเลย
- เพิ่ม idempotency guard ใน `send_now`: ถ้าคู่ `(content_id, channel_id)` มีแถว `processing`/`sent` อยู่ในกรอบเวลาที่กำหนด → ข้าม ไม่ dispatch และรายงานเป็น `skipped` (แถว `failed` ไม่นับ เพื่อไม่ให้ปุ่ม "ลองส่งใหม่" พัง)
- `send_now` รายงานผลรายช่องทางตามจริง — UI ต้องแยก สำเร็จ / ข้าม / ล้มเหลว ได้ (ตอนนี้ `SchedulePublishDialog.tsx:88` ขึ้น "ส่งสำเร็จ!" ทุกกรณีเพราะ API คืน HTTP 200 พร้อม `results[]` ที่มี `success:false` รายช่องได้)
- **BREAKING** `send_now` ปฏิเสธคอนเทนต์ที่ `approved_at IS NULL` ด้วย 422 ก่อนถึง `dispatch_content()` — ยกเลิกเจตนาเดิมที่เขียนไว้ว่า "allow any status" (`api/content-publish.php:96`)
- บันทึก root cause ฝั่ง frontend ที่ทำให้เกิด 16 request ไว้ใน `design.md` เป็นหลักฐานประกอบการตัดสินใจ (งานอ่านโค้ด ไม่แก้โค้ด)

## Capabilities

### New Capabilities
- `publish-dispatch-response-capture`: ชั้น dispatch ต้องเชื่อ HTTP status ของปลายทางและเก็บ response body ไว้ตรวจย้อนหลัง เพื่อให้ `sent` เป็นหลักฐานที่ตรวจสอบได้
- `publish-send-now-idempotency`: `send_now` ต้องกันการเผยแพร่ซ้ำของคู่ `(content_id, channel_id)` และรายงานผลรายช่องทางตามจริง
- `publish-approval-gate`: ห้ามเผยแพร่คอนเทนต์ที่ยังไม่ผ่านการอนุมัติผ่าน `send_now`

### Modified Capabilities
- `publish-dispatch-lotusdomino`: ถอน requirement "assume สำเร็จเมื่อไม่มี curl error" ออก (REMOVED) — เกณฑ์ความสำเร็จย้ายไปอยู่ที่ `publish-dispatch-response-capture` คือไม่มี cURL error **และ** HTTP status < 400

## Impact

**โค้ด**
- `api/lib/publish-dispatch.php` — ลบบล็อกพลิกค่าใน `dispatch_lotusdomino()` (บรรทัด 464-467) และส่ง response body ออกมาให้ผู้เรียกบันทึก
- `api/content-publish.php` — เพิ่ม approval gate + idempotency guard ใน `send_now` (บรรทัด 87-156) และเขียน `response_snippet`
- `api/cron/publish-scheduler.php` — เขียน `response_snippet` ในเส้นทาง cron ให้สอดคล้องกัน (บรรทัด 110-136)
- `src/components/content/SchedulePublishDialog.tsx`, `src/hooks/useContent.ts` — รายงานผลรายช่องทางตามจริง

**ฐานข้อมูล**
- migration เพิ่ม `content_publish_queue.response_snippet TEXT NULL`

**พฤติกรรมที่เปลี่ยนสำหรับผู้ใช้**
- คอนเทนต์ที่ยังไม่อนุมัติจะกดส่งไม่ได้อีก — ต้อง approve ก่อน (คอนเทนต์ `d698c9f2` ในระบบตอนนี้อยู่ในสภาพนี้)
- การ dispatch ที่ปลายทางตอบ 4xx/5xx จะขึ้น `failed` แทน `sent` → ตัวเลข `failed` มีแนวโน้มเพิ่มขึ้นหลัง deploy ซึ่งเป็นการเปิดเผยความล้มเหลวที่เคยถูกกลบ ไม่ใช่ regression

**เชื่อมโยงกับ change ที่ archive แล้ว** (`phase-0-publish-dispatch-blockers`)
- งาน 5.2 (พิสูจน์เส้นทาง cron ด้วย `sent` + `platform_post_id`) ต้องพิสูจน์ใหม่หลัง change นี้ เพราะเกณฑ์เดิมยอมรับ `sent` ที่ไม่ได้พิสูจน์อะไร
- งาน 2.2 / 5.1 (WordPress `test-channel` และ `published_url`) ยังติดที่ credentials จริงจากเจ้าของระบบ — ไม่อยู่ใน change นี้

**นอกขอบเขต (ตั้งใจไม่ทำ)**
- `dispatch_custom()` (`publish-dispatch.php:499-502`) ตั้ง `success = true` แบบไม่มีเงื่อนไข กลืนแม้ cURL error — บั๊กตระกูลเดียวกันแต่คนละ platform
- dedupe การ์ด "รายการที่ล้มเหลว" ใน `content-analytics.php:84-93` (`LIMIT 8` ไม่ dedupe ตาม `content_id`+`channel_id`) — เมื่อมี idempotency guard แล้ว การกดซ้ำจะถูกข้าม ความเสียหายหมดไป เหลือเป็นเรื่องความสวยงามของ UI
- approval gate ในเส้นทาง `schedule` และ cron scheduler — ถ้าปิดด้วยจะทำให้แถวที่เข้าคิวไว้แล้วของคอนเทนต์ที่ไม่ได้อนุมัติหยุดทำงานทันที ต้องประเมินผลกระทบแยก
