## Why

ส่งโพสต์ไป Facebook แล้วรูปไม่ไปด้วย — ข้อความขึ้นเพจ แต่รูปที่สร้างไว้ใน `content_items.generated_image_url` หายไปทั้งหมด ต้นเหตุอยู่ที่บรรทัดเดียว: `api/lib/publish-dispatch.php:47` เรียก `dispatch_facebook($channel, $creds, $title, $body)` โดย **ไม่ส่ง `$imgUrl` เข้าไปเลย** ต่างจาก `instagram`, `linkedin`, `lotusdomino`, `custom` ที่รับพารามิเตอร์นี้ทุกตัว — ตัว `$imgUrl` ถูกอ่านจากคอนเทนต์ถูกต้องแล้วที่ `:32` แต่ถูกทิ้งก่อนถึงฟังก์ชัน แล้ว `dispatch_facebook()` เองก็ POST ไปที่ `/{page-id}/feed` ด้วย `message` + `access_token` เท่านั้น ไม่มีช่องรับรูปอยู่แล้วตั้งแต่ต้น

ยืนยันด้วยข้อมูลจริง: แถว `content_publish_queue` ของ channel facebook ที่ `status='sent'` มี 10 แถว ทุกแถวมี `platform_post_id` ครบ — แปลว่าโพสต์ออกเพจจริงสำเร็จหมด แต่เป็นโพสต์ข้อความเปล่าทั้ง 10 ครั้ง รวมถึงคอนเทนต์ที่มีรูปพร้อมอยู่บนดิสก์แล้ว ไม่มี error ให้เห็นที่ไหน เพราะระบบไม่เคยพยายามส่งรูปตั้งแต่แรก

มีอุปสรรคชั้นที่สองซ่อนอยู่ด้วย: `generated_image_url` ทั้ง 14 แถวในฐานข้อมูลเป็น path แบบ relative (`/uploads/content/...`) ไม่มีแถวใดเป็น absolute URL และโปรเจกต์ไม่มีคีย์ config ที่บอก public base URL — ดังนั้นวิธี "ส่ง URL ให้ Facebook ไปดึงรูปเอง" ใช้ไม่ได้บน XAMPP localhost แม้จะแก้บรรทัดที่ 47 แล้วก็ยังโพสต์รูปไม่ได้ ต้องอัปโหลด bytes ขึ้นไปเองจึงจะทำงานได้จริง

## What Changes

- ส่ง `$imgUrl` เข้า `dispatch_facebook()` ที่ `api/lib/publish-dispatch.php:47` ให้ครบเหมือน platform อื่น
- เปลี่ยน `dispatch_facebook()` ให้เลือก endpoint ตามว่ามีรูปหรือไม่ — **มีรูป → `POST /{page-id}/photos`** พร้อมอัปโหลดไฟล์เป็น multipart (`source=`) ซึ่งไม่ต้องการ public URL จึงทำงานบน localhost ได้; **ไม่มีรูป → `POST /{page-id}/feed`** ตามพฤติกรรมเดิมทุกอย่าง
- แปลง relative path (`/uploads/content/...`) เป็น path จริงบนดิสก์ก่อนอัปโหลด และจำกัดให้อ่านได้เฉพาะใต้ `uploads/` เท่านั้น (กัน path traversal)
- ถ้ามี `generated_image_url` แต่ไฟล์หาไม่เจอ/อ่านไม่ได้ → **คืนความล้มเหลว ไม่โพสต์** ไม่ถอยไปโพสต์ข้อความเปล่าเงียบ ๆ เพราะจะได้โพสต์ที่ผิดจากที่ผู้ใช้อนุมัติไว้ (กฎ NO MAGIC) — ต่างจากกรณี "ไม่มีรูปตั้งแต่แรก" ที่โพสต์ข้อความเปล่าถูกต้องอยู่แล้ว
- อ่าน `post_id` ก่อน `id` จาก response ของ `/photos` — **จุดนี้เป็นกับดักที่วัดได้จริง**: `/feed` คืน `id` เป็นรูปแบบผสม `{page_id}_{post_id}` (ตรวจจาก `response_snippet` จริง เช่น `{"id":"1257586584107497_122103229803446843"}`) ซึ่งเป็นคีย์ที่ `insights-fetch` ใช้ดึง engagement แต่ `/photos` คืน `id` เป็น **photo id เปล่า** และเก็บรูปแบบผสมไว้ใน `post_id` ถ้าอ่านผิดคีย์ ระบบจะรายงานว่าโพสต์สำเร็จแต่ยอด view/like ไม่ขึ้นตลอดไป และวินิจฉัยยากกว่าอาการรูปไม่ขึ้นเดิม
- รองรับกรณี `generated_image_url` เป็น absolute URL (`http…`) ด้วย โดยส่งเป็น `url=` ให้ Facebook ไปดึงเอง — ไม่มีข้อมูลแบบนี้ในฐานข้อมูลตอนนี้ แต่แยกทางไว้เพื่อไม่ให้พังถ้ามีในอนาคต

**ไม่อยู่ในขอบเขตรอบนี้** (ตัดสินใจร่วมกับผู้ใช้ให้ทดลองการโพสต์ก่อน แล้วค่อยแก้ workflow):
- การย้อนสถานะคอนเทนต์ และรอยรั่ว `approved_at` ที่ไม่เคยถูกล้าง — จะแก้เป็น change แยก เพราะการอุดรอยรั่วนั้นจะปิดประตูที่ต้องใช้ทดลองรอบนี้พอดี
- เกตอนุมัติที่ขาดใน `api/cron/publish-scheduler.php` และการยิงซ้ำจากการไม่มี idempotency guard บนเส้น cron
- `api/brand-content.php:2249` ที่ใช้ `$params['link']` (link preview) แทนการส่งรูป — เป็น dead code path ไม่มี UI ไหนเรียก
- Instagram บน localhost — Graph API รับเฉพาะ public `image_url` ไม่รับ binary upload จึงแก้ที่ชั้นนี้ไม่ได้
- `dispatch_lotusdomino()` ที่ส่ง relative path ใน `AttachPhoto`

## Capabilities

### New Capabilities
- `publish-dispatch-facebook-photo`: `dispatch_facebook()` ต้องส่งรูปไปพร้อมข้อความเมื่อคอนเทนต์มีรูป — กำหนดการเลือก endpoint `/photos` กับ `/feed`, การอัปโหลดไฟล์จาก path บนดิสก์แบบ multipart, ขอบเขตไฟล์ที่อ่านได้, พฤติกรรมเมื่อไฟล์หาไม่เจอ และการอ่าน `post_id` เป็นคีย์อ้างอิงโพสต์

### Modified Capabilities
- `content-publish-result-tracking`: ข้อกำหนด "published_url ของ facebook มาจาก permalink_url ของ Graph API" ตั้งอยู่บนสมมติฐานว่า `platform_post_id` มาจาก `response.data.id` ซึ่งเป็นจริงกับ `/feed` เท่านั้น — ต้องระบุเพิ่มว่าเมื่อโพสต์ผ่าน `/photos` ค่านี้ SHALL มาจาก `post_id` ไม่ใช่ `id` เพื่อให้ permalink lookup และการซิงก์ engagement ยังทำงานได้

## Impact

- **แก้ไข:** `api/lib/publish-dispatch.php` — 2 จุด: `:47` (ส่ง `$imgUrl`) และ `dispatch_facebook()` ที่ `:173-203` (เพิ่มแขนง `/photos` + อ่าน `post_id`) ไฟล์เดียว ไม่มีไฟล์อื่น
- **ได้ผลทั้งสองเส้นเผยแพร่โดยไม่ต้องแก้:** `api/content-publish.php` (`?action=send_now` — เส้นที่ปุ่มทุกปุ่มใน UI ใช้ ยืนยันจาก `src/hooks/useContent.ts:409`) และ `api/cron/publish-scheduler.php:105` เรียก `dispatch_content()` ตัวเดียวกันทั้งคู่
- **ไม่มี migration:** ไม่แตะ schema ไม่ย้อนแก้ข้อมูลเดิม คอลัมน์ `platform_post_id`/`external_post_id` เป็น `VARCHAR(255)` รับรูปแบบผสมอยู่แล้ว
- **ไม่แก้ฝั่งหน้าเว็บ:** ไม่มีการเปลี่ยน UI, สถานะ, หรือ workflow อนุมัติ
- **ต้องพึ่งพา:** `api/lib/insights-fetch.php` อ่าน `content_publish_queue.platform_post_id` เป็นคีย์ดึง engagement — ความถูกต้องของ change นี้วัดที่คีย์นั้นยังใช้ได้ ไม่ใช่แค่ที่รูปขึ้นเพจ
- **ข้อจำกัดที่รู้อยู่ (ไม่แก้รอบนี้):** `api/content-publish.php:97` โหลดคอนเทนต์ด้วย `SELECT *` จาก `content_items` ตรง ๆ ไม่ได้ COALESCE กับ `content_plan_items` ต่างจาก GET ใน `api/content-items.php:46` — ถ้ารูปอยู่บน plan item เท่านั้น เส้น `send_now` จะมองไม่เห็น ตรวจแล้วว่าตอนนี้ยังไม่เป็นปัญหา (14 แถวมีรูปบน `content_items` ทั้งหมด, 0 แถวมีเฉพาะบน plan item) จึงคงไว้นอกขอบเขตและเฝ้าดู
- **ความเสี่ยงตอนทดลอง:** `send_now` ไม่มี dry-run — โพสต์ออกเพจจริงทันที channel facebook ที่ active มีตัวเดียว (`7b144d1b-ef28-4ef3-a3b6-c3bed93a01a9`) ชี้ไปเพจ `1257586584107497` ต้องยืนยันว่าเป็นเพจทดสอบก่อนกดส่ง และคอนเทนต์ที่ทดลองสำเร็จแล้วจะถูกตั้ง `published_at` ซึ่งเกตที่ `api/content-items.php:103` จะบล็อกการถอยสถานะตลอดไป
