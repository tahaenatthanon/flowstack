## Context

`dispatch_facebook()` เป็น dispatcher ตัวเดียวที่ทั้งเส้น `send_now` (`api/content-publish.php`) และเส้น cron (`api/cron/publish-scheduler.php`) เรียกใช้ผ่าน `dispatch_content()` — แก้ที่นี่จุดเดียวจึงได้ผลทั้งสองเส้น และไม่มีเส้นทางที่สามที่ UI ใช้อยู่ (`api/brand-content.php?action=publish` ไม่มี UI ไหนเรียก)

สถานะปัจจุบัน 3 ชั้นทับกัน:

1. `api/lib/publish-dispatch.php:47` ไม่ส่ง `$imgUrl` เข้าฟังก์ชัน ต่างจาก 4 platform อื่นที่รับพารามิเตอร์นี้
2. `dispatch_facebook()` ยิงไป `/{page_id}/feed` ซึ่งไม่มีช่องรับรูปอยู่แล้วโดยการออกแบบ
3. `generated_image_url` ทั้ง 14 แถวเป็น relative path และไม่มีคีย์ config ที่บอก public base URL — วิธี "ให้ Facebook ไปดึงรูปจาก URL" จึงเป็นไปไม่ได้บน localhost

ข้อจำกัดที่บังคับทางเลือก: เครื่องรันเป็น XAMPP บน localhost ไม่มี public hostname ที่ Graph API เข้าถึงได้ และ Graph API ต้องเห็นรูปด้วยวิธีใดวิธีหนึ่งเท่านั้น — ดึงจาก URL หรือรับ bytes ที่อัปโหลดขึ้นไป

## Goals / Non-Goals

**Goals:**
- โพสต์ Facebook ที่มีรูปต้องได้รูปขึ้นเพจพร้อมข้อความในโพสต์เดียว โดยไม่ต้องมี public URL
- ทดลองได้ทันทีบน XAMPP localhost ไม่ต้องตั้ง tunnel/ngrok หรือ deploy ขึ้น server
- ไม่ทำให้การซิงก์ engagement ที่เพิ่งสร้างเสร็จ (`api/cron/content-metrics-sync.php`) พังโดยไม่มีสัญญาณ
- โพสต์ข้อความเปล่าต้องได้ผลเหมือนเดิม 100% — เป็นเกณฑ์ตัดสินว่า regression ไม่เกิด

**Non-Goals:**
- ไม่แก้ workflow การอนุมัติ การย้อนสถานะ หรือ `approved_at` ที่ไม่เคยถูกล้าง (แยกเป็น change ถัดไปตามที่ตกลงไว้)
- ไม่เพิ่มเกตอนุมัติหรือ idempotency guard ให้เส้น cron
- ไม่ทำให้ Instagram โพสต์ได้บน localhost — Graph API ของ IG รับเฉพาะ public `image_url` ไม่รับ binary upload จึงแก้ที่ชั้น dispatch ไม่ได้
- ไม่รองรับโพสต์หลายรูป (carousel/album) — คอนเทนต์มีคอลัมน์รูปเดียว
- ไม่แตะ `api/brand-content.php` (dead code path) และไม่แตะ `dispatch_lotusdomino()`
- ไม่เพิ่มคีย์ config ใหม่ และไม่มี migration

## Decisions

### 1. อัปโหลด bytes ผ่าน `/photos` แทนการส่ง URL

เลือก `POST /{page_id}/photos` พร้อม `source=` (multipart) เป็นวิธีหลัก

ทางเลือกที่พิจารณาแล้วตัดออก:

| ทางเลือก | ทำไมไม่เลือก |
|---|---|
| `/photos` + `url=<absolute>` | ต้องมี public URL ที่ Graph API เข้าถึงได้ — ไม่มีบน localhost ต้องเพิ่มคีย์ config + tunnel ซึ่งเป็นงานคนละก้อนและทดลองไม่ได้วันนี้ |
| `/feed` + `link=<img>` | ได้ link preview ไม่ใช่รูปที่แนบกับโพสต์ — เป็นสิ่งที่ `api/brand-content.php:2249` ทำอยู่และเป็นเหตุที่รูปไม่ขึ้นบนเส้นนั้นด้วย |
| `/feed` + `attached_media` | ต้องอัปโหลดรูปแยกก่อนด้วย `/photos?published=false` แล้วค่อยอ้าง media_fbid — 2 คำขอ มีสถานะกลางที่ค้างได้ ไม่คุ้มสำหรับรูปเดียว |

`/photos` แบบคำขอเดียวไม่มีสถานะกลาง ล้มเหลวแล้วไม่ทิ้งรูปค้างบนเพจ

### 2. เก็บ `post_id` เป็น `platform_post_id` ไม่ใช่ `id`

นี่คือการตัดสินใจที่มีผลกระทบมากที่สุดและมองไม่เห็นจากอาการ

ข้อมูลจริงจาก `content_publish_queue.response_snippet` ยืนยันว่า `/feed` คืน `{"id":"1257586584107497_122103229803446843"}` — รูปแบบผสม `{page_id}_{post_id}` ซึ่งเป็นรูปแบบที่ `api/lib/insights-fetch.php` ใช้เป็นคีย์ดึง engagement ได้

แต่ `/photos` คืนคนละอย่าง: `{"id":"<photo_id>","post_id":"<page_id>_<post_id>"}` — `id` เป็น photo id เปล่าซึ่งใช้ทั้ง permalink lookup และ `/insights` ไม่ได้ ถ้าคงโค้ดเดิม `$result['data']['id'] ?? null` ไว้ ผลคือ **โพสต์สำเร็จ รูปขึ้นเพจ แต่ยอด view/like ไม่ขึ้นตลอดไป** และไม่มี error ที่ไหน — อาการแบบเดียวกับบั๊กเดิมที่กำลังแก้ เพียงย้ายที่

จึงอ่าน `post_id ?? id` โดยให้ `post_id` มาก่อน — ลำดับนี้ครอบทั้งสอง endpoint ด้วยบรรทัดเดียว ไม่ต้องแยก branch ตาม endpoint

### 3. resolve path จาก document root แล้วล็อกขอบเขตไว้ที่ `uploads/`

`generated_image_url` เก็บเป็น `/uploads/content/<file>` (ผลิตจาก `api/brand-content.php:179`) ซึ่งเป็น path เทียบกับ document root ไม่ใช่ path บนดิสก์ ไฟล์ dispatcher อยู่ที่ `api/lib/` จึงย้อนขึ้น 2 ระดับเพื่อได้ project root

ค่านี้มาจากคอลัมน์ในฐานข้อมูล — ไม่ถือเป็น path ที่เชื่อถือได้โดยปริยาย จึงใช้ `realpath()` แล้วตรวจว่าผลลัพธ์ยังอยู่ใต้ `uploads/` ก่อนเปิดอ่าน กัน `../` ไต่ไปหยิบ `.env` หรือ `api/config.php` ขึ้นไปโพสต์บนเพจสาธารณะ

ตรวจ prefix ด้วย `realpath()` ทั้งสองฝั่ง เพื่อให้เทียบ path ที่ normalize แล้วกับ normalize แล้ว ไม่ใช่สตริงดิบเทียบสตริงดิบ (บน Windows path separator ไม่ตรงกัน)

### 4. ไฟล์หายแล้วล้มเหลว ไม่ถอยไปโพสต์ข้อความเปล่า

ตามกฎ NO MAGIC — การถอยแบบเงียบจะได้โพสต์ที่ต่างจากที่ผู้ใช้อนุมัติ และผู้ใช้จะไม่รู้ว่ารูปหายไป ซึ่งคืออาการเดิมที่ change นี้แก้ ถ้าถอยเงียบก็เท่ากับสร้างบั๊กเดิมขึ้นมาใหม่ในรูปแบบที่ตรวจจับได้ยากกว่า

แยกสองกรณีให้ชัด:
- `$imgUrl` ว่างตั้งแต่แรก → โพสต์ข้อความเปล่าผ่าน `/feed` ถูกต้อง ไม่ใช่ความล้มเหลว
- `$imgUrl` มีค่าแต่ไฟล์หาย/อ่านไม่ได้/อยู่นอกขอบเขต → `success=false` ไม่ยิงคำขอ

ความล้มเหลวไหลไปตามเส้นทางเดิมทั้งหมด: `send_now` ปล่อย `content_items` ไว้สถานะเดิม, คิวเป็น `failed` พร้อม `error_msg`, cron retry 3 ครั้งตามกลไกเดิม — ไม่ต้องเพิ่ม error handling ใหม่

### 5. รองรับ absolute URL ไว้ด้วยแม้ยังไม่มีข้อมูลแบบนั้น

ตรวจ prefix `http://`/`https://` แล้วส่งเป็น `url=` — ตอนนี้ 0 แถวเป็นแบบนี้ แต่แขนงนี้มีต้นทุน 2 บรรทัด และป้องกันกรณีที่มีคนตั้ง absolute URL ในอนาคตแล้วโค้ดไปพยายามเปิดไฟล์ชื่อ `https:/graph...` บนดิสก์แล้วล้มเหลวแบบสับสน

### 6. ใช้ `_dispatch_post()` เดิม ไม่สร้าง helper ใหม่

`_dispatch_post()` ที่ `:114` ส่ง `$options` เข้า `curl_setopt_array($ch, $options + $defaults)` ตรง ๆ — พอส่ง `CURLOPT_POSTFIELDS` เป็น array (มี `CURLFile` อยู่ข้างใน) cURL จะสลับเป็น `multipart/form-data` ให้เองโดยไม่ต้องตั้ง header เพิ่ม ไม่ต้องแก้ helper และการเก็บ `response_snippet` / การแปลง error ยังทำงานเหมือนเดิมทุกอย่าง

**สำคัญ:** เส้น multipart ต้องส่ง array ดิบ ห้ามผ่าน `http_build_query()` เพราะจะได้สตริงที่ทำให้ `CURLFile` กลายเป็นข้อความ

ส่ง MIME type เข้า `CURLFile` ด้วย โดยเดาจากนามสกุลไฟล์ — ไม่พึ่ง `mime_content_type()` ซึ่งต้องการ extension `fileinfo` ที่อาจไม่เปิดบน XAMPP บางเครื่อง

## Risks / Trade-offs

**[token ไม่มีสิทธิ์อัปโหลดรูป] → ตรวจได้จาก error message ตรง ๆ**
`/photos` ต้องการ `pages_manage_posts` เหมือน `/feed` ไม่ได้เพิ่ม permission ใหม่ ถ้า token เดิมโพสต์ `/feed` ได้ก็ควรโพสต์ `/photos` ได้ และถ้าไม่ได้ Graph API จะตอบ error ชัดเจนซึ่งถูกเก็บลง `response_snippet` แล้ว

**[ไฟล์รูปใหญ่เกินเพดานหรือ timeout] → เพดาน cURL 30 วินาทีเดิม, ไฟล์ตัวอย่างอยู่ที่ 157 KB**
Facebook รับไฟล์ได้ถึงระดับหลาย MB ไฟล์ที่ระบบสร้างเองอยู่ในหลักร้อย KB ยังห่างจากเพดาน ถ้าอนาคตมีไฟล์ใหญ่ผิดปกติ อาการจะเป็น cURL timeout ซึ่งเข้ากลไก retry ของ cron อยู่แล้ว ไม่เพิ่ม logic ใหม่ตอนนี้

**[`send_now` ไม่มี dry-run — ทดลองคือโพสต์จริง] → ยืนยันเพจก่อนกดส่ง**
channel facebook ที่ active มีตัวเดียว `7b144d1b-ef28-4ef3-a3b6-c3bed93a01a9` ปัจจุบันชี้เพจ `1257586584107497` (อ่านจาก `platform_post_id` ของโพสต์ล่าสุด) ต้องยืนยันว่าเป็นเพจทดสอบก่อน และ **ต้องไม่เลือก channel Lotus Notes** ที่ชี้ไปเว็บลูกค้าจริง

**[คอนเทนต์ที่ทดลองสำเร็จจะย้อนสถานะไม่ได้อีก] → ใช้คอนเทนต์ที่ยอมทิ้งได้**
`send_now` เขียน `published_at` แล้วเกตที่ `api/content-items.php:103` จะบล็อกการถอยสถานะตลอดไป — เป็นพฤติกรรมที่ตั้งใจไว้ ไม่ใช่บั๊ก

**[กดทดลองซ้ำภายใน 10 นาทีจะถูกกันด้วย idempotency] → เปลี่ยนคอนเทนต์หรือรอ**
`api/content-publish.php:126-159` ใช้ advisory lock + ตรวจซ้ำ 10 นาทีบน `status IN ('processing','sent')` เป็นเพื่อนตอน production แต่เป็นอุปสรรคตอนไล่ทดลอง ต้องรู้ไว้ล่วงหน้าไม่ใช่ไปตกใจตอนกดแล้วไม่มีอะไรเกิดขึ้น

**[รูปที่อยู่เฉพาะบน `content_plan_items` จะยังมองไม่เห็น] → ตรวจแล้วว่ายังไม่เกิด และปล่อยไว้นอกขอบเขต**
`api/content-publish.php:97` โหลดด้วย `SELECT * FROM content_items` ไม่ได้ COALESCE กับ `content_plan_items` ต่างจาก GET ที่ `api/content-items.php:46` — วัดแล้วได้ 14 แถวมีรูปบน `content_items` และ 0 แถวมีเฉพาะบน plan item จึงยังไม่กัด แต่ถ้ามีคนสร้างคอนเทนต์จาก plan โดยไม่ copy รูปลงมา อาการจะกลับมาเป็น "รูปไม่ไป" เหมือนเดิม โดยที่ change นี้ทำงานถูกต้องทุกอย่าง — บันทึกไว้เป็นรอยที่ต้องเฝ้า

**[trade-off: `/photos` เปลี่ยนชนิดของโพสต์บนเพจ] → ยอมรับ**
โพสต์จะกลายเป็น photo post ไม่ใช่ status post ผลข้างเคียงคือ metric ที่ Graph API มีให้ต่างกันบางตัว (เช่นตระกูล video ไม่มี) — `insights-fetch` มี fallback ยิง metric แยกทีละตัวและรายงานตัวที่ถูกปฏิเสธเป็นคำเตือนอยู่แล้ว จึงไม่ทำให้รอบซิงก์ล้มเหลว

## Migration Plan

ไม่มี migration ฐานข้อมูล — ไม่แตะ schema ไม่ย้อนแก้แถวเดิม คอลัมน์ `platform_post_id`/`external_post_id` เป็น `VARCHAR(255)` รับรูปแบบผสมอยู่แล้ว (ค่าที่ยาวที่สุดในตารางตอนนี้ 36 ตัวอักษร)

การย้อนกลับ: `git revert` ไฟล์เดียว ไม่มีสถานะค้างที่ต้องเก็บกวาด — โพสต์ที่ออกไปแล้วลบจากเพจด้วยมือหากเป็นการทดลองที่ไม่ต้องการ

การทดลอง: คอนเทนต์ `b4535f81-9056-4223-b93c-8f0bec4bf8c8` (`วิธีลดเวลาทำงานลง 80% ด้วย A…`) มี `generated_image_url` ชี้ไฟล์ที่ยืนยันแล้วว่ามีอยู่จริง 156,923 bytes และมี `approved_at` ค้างอยู่จึงผ่านเกต `send_now` ได้ทันทีโดยไม่ต้องเดินวงจรอนุมัติใหม่ — สถานะนี้เป็นรอยรั่วที่ change ถัดไปจะอุด จึงเป็นหน้าต่างเวลาที่ทดลองได้ง่ายที่สุด

## Open Questions

ทั้งสองข้อปิดแล้วจากการทดลองจริงเมื่อ 2026-08-25 17:06 (queue row `16bf3b19-b6aa-4bb3-aa8f-2c80c098979c`)

- ~~`/photos` จะได้ `permalink_url` จาก `post_id` หรือไม่~~ — **ได้** `published_url` ถูกเขียนเป็น
  `https://www.facebook.com/122098016637455897/posts/122098143255455897` ทั้งใน `content_publish_queue` และ `content_items`
  บล็อก permalink lookup เดิมทำงานถูกโดยไม่ต้องแก้ เพราะใช้ `$result['platform_post_id']` ที่ตอนนี้เป็น `post_id`

- ~~เพจ `1257586584107497` เป็นเพจทดสอบหรือเพจจริง~~ — **คำถามนี้ล้าสมัยก่อนได้คำตอบ:** ตอนทดลองพบว่า credentials
  ของ channel ถูกอัปเดตเมื่อ 2026-08-25 16:24 และ `page_id` จริงคือ `1321744214351122` ("Flowstack Content", 0 ผู้ติดตาม, category Tech)
  ผู้ใช้ยืนยันแล้วว่าเป็นเพจทดสอบ ส่วนเพจเก่า `1257586584107497` เข้าถึงด้วย token ปัจจุบันไม่ได้อีก ทำให้แถว metrics เก่า 2 แถวซิงก์ไม่ผ่าน
  (อาการก่อนหน้า change นี้ ไม่เกี่ยวกับการแก้ครั้งนี้)

## ผลการทดลองจริง

ยืนยันสมมติฐานหลักของ Decision 2 ได้ตรงตัว — `response_snippet` ของโพสต์จริงคือ:

```json
{"id":"122098143213455897","post_id":"1321744214351122_122098143255455897"}
```

`id` เป็น photo id เปล่าจริงตามที่คาด ถ้าคงโค้ดเดิมที่อ่าน `id` ก่อน ระบบจะเก็บ `122098143213455897`
แล้ว `content-metrics-sync` จะดึง engagement ไม่ได้ตลอดไปโดยไม่มี error — Graph API ยืนยันว่าโพสต์เป็น
`status_type = "added_photos"` และ `attachments.data[0].media_type = "photo"` (รูป 720×720 บน fbcdn)
ไม่ใช่ link preview

เส้นทางล้มเหลว (queue row `bbcf16d4-56ad-47a5-88c8-4005862c60f9`): ตั้ง path ที่ไม่มีไฟล์แล้วยิง ได้ `status=failed`,
`platform_post_id=NULL`, `response_snippet = "(no response body) …"` แปลว่าไม่มีคำขอ HTTP ออกไปเลย,
`content_items` ยังเป็น `draft` และ timeline ของเพจไม่มีโพสต์ข้อความเปล่าโผล่ใหม่ — Decision 4 ทำงานตามที่ออกแบบ

### เรื่องที่พบระหว่างทดลองแต่อยู่นอกขอบเขต change นี้

`message` ของโพสต์บน Facebook มี HTML ดิบติดไปด้วย (`<article class="prose …">`, `<h1>`, `<p>`, `&#039;`)
เพราะ `api/lib/publish-dispatch.php:30` ใช้ `$body = $art['html']` ตรง ๆ เป็นพฤติกรรมเดิมที่มีอยู่ก่อน change นี้
และกระทบเส้นข้อความเปล่าเท่ากัน — ไม่ได้แก้ในรอบนี้เพราะไม่ใช่เรื่องรูป ควรตั้งเป็นงานแยก

