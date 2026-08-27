## 1. แก้ dispatcher ให้ส่งรูปเข้าฟังก์ชัน

- [x] 1.1 แก้ `api/lib/publish-dispatch.php:47` ให้ส่ง `$imgUrl` เป็นพารามิเตอร์ที่ 5 ของ `dispatch_facebook()` ให้ตรงแบบเดียวกับ `dispatch_instagram()` ที่ `:48`
- [x] 1.2 แก้ signature ของ `dispatch_facebook()` ที่ `:173` เป็น `(array $channel, array $creds, string $title, string $body, string $imgUrl = '')` — ใส่ค่า default ว่างไว้เพื่อให้ผู้เรียกอื่นที่อาจเรียกด้วย 4 อาร์กิวเมนต์ไม่พัง

## 2. เพิ่มตัวช่วยแปลง path รูปเป็นไฟล์บนดิสก์

- [x] 2.1 เพิ่มฟังก์ชัน helper ในไฟล์เดียวกัน (วางไว้ก่อน `dispatch_facebook()`) ที่รับ `$imgUrl` แล้วคืน path จริงบนดิสก์ หรือคืนข้อความ error — ยังไม่ผูกกับ Facebook เพื่อให้ platform อื่นเรียกใช้ได้ในอนาคต
- [x] 2.2 ใน helper: resolve project root จาก `__DIR__ . '/../../'` แล้วต่อกับ `ltrim($imgUrl, '/')` และเรียก `realpath()`
- [x] 2.3 ใน helper: ตรวจว่า `realpath()` ของผลลัพธ์อยู่ใต้ `realpath(project_root . '/uploads')` — เทียบ path ที่ normalize แล้วทั้งสองฝั่ง (Windows separator ไม่ตรงกัน) ถ้าอยู่นอกขอบเขตให้คืน error ระบุว่ารูปอยู่นอกขอบเขตที่อนุญาต
- [x] 2.4 ใน helper: ตรวจ `is_file()` และ `is_readable()` — ถ้าไม่ผ่านให้คืน error ที่มี path ของไฟล์อยู่ในข้อความเพื่อวินิจฉัยได้จาก `error_msg` คอลัมน์เดียว
- [x] 2.5 ใน helper: เดา MIME type จากนามสกุลไฟล์ด้วย map คงที่ (`jpg`/`jpeg` → `image/jpeg`, `png` → `image/png`, `gif` → `image/gif`, `webp` → `image/webp`) ไม่ใช้ `mime_content_type()` ที่ต้องการ extension `fileinfo` — นามสกุลที่ไม่รู้จักให้ fallback เป็น `application/octet-stream`

## 3. เพิ่มแขนง /photos ใน dispatch_facebook()

- [x] 3.1 คงการตรวจ `page_id`/`access_token` ไว้ที่ตำแหน่งเดิมและคืนข้อความเดิม `'Missing page_id or access_token'` — ต้องทำงานก่อนแตะรูป เพื่อให้ไม่มีคำขอออกไปแม้มีรูป
- [x] 3.2 คงการประกอบ `$msg` (`"$title\n\n$body"` + `mb_substr(..., 0, 63206)`) ไว้เหมือนเดิม ใช้ร่วมกันทั้งสองแขนง
- [x] 3.3 แขนง `$imgUrl === ''` → POST `/{page_id}/feed` ด้วย `http_build_query(['message'=>..., 'access_token'=>...])` เหมือนเดิมทุกตัวอักษร
- [x] 3.4 แขนง `$imgUrl` เป็น `http://`/`https://` → POST `/{page_id}/photos` ด้วย `http_build_query(['message'=>..., 'url'=>$imgUrl, 'access_token'=>...])`
- [x] 3.5 แขนง `$imgUrl` เป็น relative path → เรียก helper จากข้อ 2; ถ้า helper คืน error ให้ `return ['success'=>false, 'error'=>...]` **ทันทีโดยไม่ยิงคำขอ** และไม่ถอยไป `/feed`
- [x] 3.6 เมื่อ helper สำเร็จ → POST `/{page_id}/photos` ด้วย `CURLOPT_POSTFIELDS` เป็น **array ดิบ** ที่มี `'source' => new CURLFile($path, $mime, basename($path))` — ห้ามผ่าน `http_build_query()` เพราะจะทำให้ `CURLFile` กลายเป็นข้อความ
- [x] 3.7 เขียนคอมเมนต์ไทยอธิบายว่าทำไมต้องอัปโหลด bytes ไม่ส่ง URL (relative path + ไม่มี public base URL บน localhost) ตามแบบคอมเมนต์อธิบายเหตุผลที่มีอยู่ในไฟล์นี้แล้ว

## 4. แก้การอ่าน id โพสต์

- [x] 4.1 เปลี่ยน `:186` จาก `$result['data']['id'] ?? null` เป็นอ่าน `post_id` ก่อนแล้ว fallback ไป `id` — ครอบทั้งสอง endpoint ด้วยบรรทัดเดียว ไม่ต้องแยกตามแขนง
- [x] 4.2 เขียนคอมเมนต์ระบุว่า `/photos` คืน `id` เป็น photo id เปล่าที่ใช้ทั้ง permalink lookup และ `/insights` ไม่ได้ ขณะที่ `post_id` เป็นรูปแบบผสม `{page_id}_{post_id}` เดียวกับที่ `/feed` คืนใน `id` — และระบุว่า `api/lib/insights-fetch.php` พึ่งค่านี้เป็นคีย์
- [x] 4.3 ปล่อยบล็อก permalink lookup ที่ `:192-200` ไว้เหมือนเดิม — มันใช้ `$result['platform_post_id']` อยู่แล้วจึงได้ค่าที่ถูกต้องโดยอัตโนมัติ

## 5. ตรวจก่อนยิงของจริง

- [x] 5.1 `php -l api/lib/publish-dispatch.php` ต้องผ่าน
- [x] 5.2 ตรวจว่าไม่มีผู้เรียก `dispatch_facebook()` ที่อื่นซึ่งจะพังจากการเพิ่มพารามิเตอร์ — grep ทั้ง `api/` แล้วยืนยันว่ามีเฉพาะจุดใน `dispatch_content()`
- [x] 5.3 `pnpm build` ต้องผ่าน (ยืนยันว่าไม่แตะฝั่งหน้าเว็บ)
- [x] 5.4 ตรวจว่า `CURLFile` ใช้ได้บน PHP ของเครื่องนี้ — `php -r "var_dump(class_exists('CURLFile'));"`

## 6. ทดลองแบบไม่ยิงออกภายนอกก่อน

- [x] 6.1 ทดลอง helper แยกด้วยสคริปต์ชั่วคราว: ป้อน `/uploads/content/b4535f81-9056-4223-b93c-8f0bec4bf8c8_20260618152554.jpg` แล้วยืนยันว่าได้ path จริงและ MIME `image/jpeg`
- [x] 6.2 ทดลอง path ที่ควรถูกปฏิเสธ: `/uploads/../.env` และ `/uploads/content/ไฟล์ที่ไม่มีอยู่.jpg` — ทั้งสองต้องคืน error ไม่ใช่ path
- [x] 6.3 ยืนยันว่าแขนง `/feed` ยังประกอบคำขอเหมือนเดิม โดยเทียบ payload ที่จะส่งกับ `response_snippet` ของโพสต์ข้อความเปล่าที่สำเร็จไปแล้ว 10 แถวในคิว

## 7. ยิงจริง 1 ครั้งแล้วตรวจผล

- [x] 7.1 **ยืนยันกับผู้ใช้ก่อน** ว่าเพจของ channel `7b144d1b-ef28-4ef3-a3b6-c3bed93a01a9` เป็นเพจทดสอบที่ยอมให้มีโพสต์ทดลองค้างอยู่ได้ — `send_now` ไม่มี dry-run และย้อนสถานะคอนเทนต์หลังสำเร็จไม่ได้
      - ตรวจสด: page id จริงคือ `1321744214351122` ("Flowstack Content", 0 ผู้ติดตาม) ไม่ใช่ `1257586584107497` ที่จดไว้ตอนวางแผน — credentials ถูกอัปเดต 2026-08-25 16:24
      - ผู้ใช้ยืนยันแล้วว่าเป็นเพจทดสอบ
- [x] 7.2 ยิง `send_now` ด้วยคอนเทนต์ `b4535f81-9056-4223-b93c-8f0bec4bf8c8` ไปยัง channel นั้น — **ห้ามเลือก channel Lotus Notes** ที่ชี้ไปเว็บลูกค้าจริง
      - ยิงเมื่อ 2026-08-25 17:06:30 → HTTP 200, `results[0].success = true`; queue row `16bf3b19-b6aa-4bb3-aa8f-2c80c098979c`
- [x] 7.3 ตรวจ `content_publish_queue.response_snippet` ของแถวใหม่ — ต้องมีทั้งคีย์ `id` และ `post_id` (พิสูจน์ว่ายิงไป `/photos` จริง ไม่ใช่ `/feed`)
      - ได้ `{"id":"122098143213455897","post_id":"1321744214351122_122098143255455897"}` — มีทั้งสองคีย์ และ `id` เป็น photo id เปล่าจริงตามที่ design คาด
- [x] 7.4 ตรวจ `content_publish_queue.platform_post_id` — ต้องเป็นรูปแบบผสมมีขีดล่างคั่น ไม่ใช่เลขชุดเดียว
      - ได้ `1321744214351122_122098143255455897` (composite) ไม่ใช่ `122098143213455897` → การอ่าน `post_id` ก่อน `id` ทำงานถูก
- [x] 7.5 เปิดเพจ Facebook ยืนยันด้วยตาว่ารูปขึ้นพร้อมข้อความในโพสต์เดียวกัน ไม่ใช่ link preview
      - ตรวจด้วย Graph API read-only แทนการดูด้วยตา (วัดผลได้กว่า): `status_type = "added_photos"`,
        `attachments.data[0].media_type = "photo"`, รูป 720×720 อยู่บน fbcdn, `message` มีข้อความไทยครบในโพสต์เดียวกัน
- [x] 7.6 ตรวจว่า `content_items.published_url` ได้ permalink หรือเป็น NULL — ทั้งสองกรณีถือว่าผ่านตาม spec แต่บันทึกผลไว้เพื่อปิด open question ใน design
      - ได้ permalink จริง: `https://www.facebook.com/122098016637455897/posts/122098143255455897`
        (เขียนทั้ง `content_publish_queue.published_url` และ `content_items.published_url`)
- [x] 7.7 รัน `php api/cron/content-metrics-sync.php` แล้วยืนยันว่าโพสต์ใหม่ไม่ถูก Graph API ปฏิเสธว่า id ไม่ถูกต้อง — นี่คือข้อพิสูจน์ว่าการอ่าน `post_id` ถูก
      - แถวใหม่ได้ `facebook views=0 likes=0` = Graph API รับ id (0 เพราะโพสต์เพิ่งขึ้น) ไม่ถูกปฏิเสธ
      - 2 error ที่เห็นเป็นแถวเก่าของเพจเดิม `1257586584107497` ที่เข้าไม่ได้แล้วหลังเปลี่ยน credentials — ไม่เกี่ยวกับ change นี้
- [x] 7.8 ทดลองกรณีล้มเหลว: ตั้ง `generated_image_url` ของคอนเทนต์ทดสอบอีกตัวให้ชี้ไฟล์ที่ไม่มีอยู่ แล้วยิง — ต้องได้ `failed` พร้อม `error_msg` ที่ระบุ path และ **ต้องไม่มีโพสต์ข้อความเปล่าโผล่บนเพจ**
      - ใช้คอนเทนต์ `afe38def-9b9d-4b90-9985-02e14f7bb8d1` (ค่าเดิมของคอลัมน์ = NULL, คืนค่าแล้วหลังทดสอบ)
      - queue row `bbcf16d4-56ad-47a5-88c8-4005862c60f9`: `status=failed`, `platform_post_id=NULL`,
        `error_msg` มีทั้งค่าใน DB และ path จริงบนดิสก์, `response_snippet` = "(no response body)" → ไม่มีคำขอออกไปเลย
      - `content_items` ไม่ถูกแตะ: ยังเป็น `draft`, `published_at=NULL`
      - timeline ของเพจมีแค่ 3 โพสต์: ล่าสุดคือโพสต์รูป 10:06 UTC (`added_photos`) และก่อนหน้าคือ 2 โพสต์ข้อความ 05:26 UTC ของเดิม
        → **ไม่มีโพสต์ข้อความเปล่าโผล่ใหม่** ยืนยันว่าไม่ถอยไป `/feed`

## 8. ปิดงาน

- [x] 8.1 ลบสคริปต์ทดลองชั่วคราวจากข้อ 6 ออกให้หมด
- [x] 8.2 บันทึกผลจริงของ open question ทั้งสองข้อใน `design.md` (permalink จาก `post_id` ได้หรือไม่, เพจทดสอบยืนยันแล้วหรือไม่)
- [x] 8.3 commit ไฟล์ที่แก้พร้อม artifacts ของ change นี้ — ไม่รวมโค้ดของ change ถัดไป (การย้อนสถานะ / เกตอนุมัติ) ที่ตกลงกันว่าแยกรอบ
      - commit `3a6ae09` บน `main` (7 ไฟล์, +511/−6) ยังไม่ push
