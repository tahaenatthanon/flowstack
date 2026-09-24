## 1. Path resolver สำหรับไฟล์อัปโหลด

- [x] 1.1 แยก `resolve_local_image()` เป็น core `resolve_local_upload(string $path, array $mimeByExt): array` + wrapper `resolve_local_image()` ที่คงพฤติกรรม/mime map เดิมทุกอย่าง
- [x] 1.2 เพิ่ม `resolve_local_video(string $path): array` (mime map: `mp4→video/mp4, mov→video/quicktime, webm→video/webm`) เรียก core เดียวกัน
- [x] 1.3 เทสต์: `resolve_local_image()` ยังผ่านเทสต์เดิมทั้งหมดหลังแยก core (regression) — `api/tests/publish-video-facebook-test.php` TC01-TC03
- [x] 1.4 เทสต์: `resolve_local_video()` เช็ค path traversal, ไฟล์ไม่มีอยู่, ไฟล์อยู่นอก `uploads/` เหมือนที่มีกับรูป — TC04-TC06

## 2. dispatch_facebook รองรับวิดีโอ

- [x] 2.1 เพิ่มพารามิเตอร์ `string $videoUrl = ''` ให้ `dispatch_facebook()`
- [x] 2.2 เพิ่ม branch: ถ้า `$videoUrl` ไม่ว่าง → resolve ผ่าน `resolve_local_video()` → POST `/{page_id}/videos` แบบ multipart (`source`, `description`, `access_token`) — เช็คก่อน branch รูป/ข้อความเดิม
- [x] 2.3 ไฟล์วิดีโอหาไม่เจอ → คืน `success=false` พร้อม path ที่หาไม่เจอ ไม่ถอยไปโพสต์ข้อความ/รูป
- [x] 2.4 อ่าน `platform_post_id` จาก `response.id` ตรงๆ สำหรับผลลัพธ์จาก `/videos`
- [x] 2.5 lookup `permalink_url` แบบ non-blocking เหมือน `/photos` (ใช้ `video_id` แทน `photo_post_id`)
- [x] 2.6 `dispatch_content()`: ส่ง `$content['video_url'] ?? ''` เข้า `dispatch_facebook()` เป็นอาร์กิวเมนต์ใหม่

## 3. Timeout แยกสำหรับคำขอวิดีโอ

- [x] 3.1 เพิ่มพารามิเตอร์ `int $timeoutSeconds = 30` ให้ `_dispatch_post()` (ใช้ตั้ง `CURLOPT_TIMEOUT`, ค่า default คงเดิมไม่กระทบ caller อื่น)
- [x] 3.2 branch วิดีโอใน `dispatch_facebook()` เรียก `_dispatch_post()` ด้วย `timeoutSeconds=120`
- [x] 3.3 เทสต์: คำขอ `/feed`/`/photos` ยังใช้ timeout 30 วินาที (regression) — ยืนยันด้วยการอ่านโค้ด (`_dispatch_post()` ค่า default ยังเป็น 30 ทุก caller เดิมไม่ได้ส่ง `$timeoutSeconds`)

## 4. Video readiness gate

- [x] 4.1 เพิ่มเช็คใน `final_publish_gate_check()` ก่อน early-return ของ `SCRIPT_PLATFORMS`: ถ้า `$content['type'] === 'video'` ต้อง `video_gen_status === 'done'` และไฟล์ที่ `video_url` ชี้ถึงมีอยู่จริง (ใช้ `resolve_local_video()` เช็คการมีอยู่ของไฟล์)
- [x] 4.2 ไม่ผ่าน → คืน `blocked=true` พร้อมเหตุผลภาษาไทยที่แยกกรณี "ยังสร้างไม่เสร็จ" กับ "หาไฟล์ไม่เจอ"
- [x] 4.3 เทสต์: คอนเทนต์ `type='video'` ที่ `video_gen_status` ไม่ใช่ `done` → gate ปฏิเสธ — TC08
- [x] 4.4 เทสต์: คอนเทนต์ `type='video'` ที่ `video_gen_status='done'` แต่ไฟล์ไม่มีอยู่จริง → gate ปฏิเสธ — TC09
- [x] 4.5 เทสต์: คอนเทนต์ `type='video'` ที่พร้อมจริง → gate ผ่าน — TC10
- [x] 4.6 เทสต์: คอนเทนต์ `type='article'` ไม่ถูกเช็คไฟล์วิดีโอเลย (regression — gate เดิมสำหรับบทความยังทำงานเหมือนเดิม) — TC07 + `publish-gate-test.php` 18/18 และ `quality-required-tiers-test.php` 24/24 ผ่านหมดหลังเพิ่ม gate

## 5. เทสต์ end-to-end แบบ mock

- [x] 5.1 เทสต์ `dispatch_content('facebook', ...)` กับคอนเทนต์วิดีโอ mock ครบเส้นทาง (video_url → dispatch_facebook → POST /videos) — TC14
- [x] 5.2 เทสต์ว่าคอนเทนต์ที่มีทั้งรูปและวิดีโอ (ไม่ควรเกิดจริง แต่กันไว้) ใช้ branch วิดีโอเป็นหลัก ไม่ตกไป branch รูป — TC13
- [x] 5.3 รัน lint/existing test suite ที่เกี่ยวข้องกับ `api/lib/publish-dispatch.php` ให้ผ่านทั้งหมด (regression) — `php -l` ผ่าน, `publish-gate-test.php` 18/18, `quality-required-tiers-test.php` 24/24, `publish-video-facebook-test.php` 14/14

## 6. ทดสอบจริงกับ Facebook

- [x] 6.1 เลือกคอนเทนต์วิดีโอที่ผ่านการทดสอบ Phase 4 จริงแล้ว (`5121176a...`) → อนุมัติคอนเทนต์ (user กดอนุมัติเองในหน้าเว็บ)
- [x] 6.2 ยืนยัน gate: video readiness gate ผ่าน gate ปกติเพราะ `video_gen_status='done'` และไฟล์มีอยู่จริงตอนนั้น (ครอบคลุมด้วยเทสต์ mock TC08-TC10 แทนการรอคอนเทนต์วิดีโอที่ยังไม่เสร็จจริงมาทดสอบซ้ำ)
- [x] 6.3 กด "ส่งทันที" ไปยัง Facebook จริงกับคอนเทนต์วิดีโอที่พร้อมแล้ว — user กดเองในหน้าเว็บ สำเร็จ (`content_publish_queue.status='sent'`) — ครบเป้าหมายของงาน 6.4 เดิมที่ค้างจาก change `platform-post-text`
- [x] 6.4 ตรวจบนเพจจริงว่าวิดีโอขึ้นจริง — เปิด `https://www.facebook.com/reel/1838460690668548/` ยืนยันแล้ว: โพสต์เป็น Reel, "Public", หัวข้อ "ทดสอบ A1: 3 เหตุผลที่ร้านกาแฟควรใช้ AI ตอบแชทลูกค้า" + ข้อความโพสต์ "ทดสอบการส่งวิดีโอ" ตรงกับที่อนุมัติไว้ ไม่มีคำกำกับหลุด
- [x] 6.5 ตรวจ `content_publish_queue.platform_post_id`/`response_snippet` — `platform_post_id=1838460690668548`, `response_snippet={"id":"1838460690668548"}` ตรงตามดีไซน์ (อ่านจาก `id` ตรงๆ ไม่ใช่ `post_id`)
- [x] 6.6 บันทึกผลจริงลง design.md — **พบบั๊กจริง 1 จุด**: `permalink_url` ที่ Facebook คืนมาสำหรับโพสต์วิดีโอ/Reel เป็น path สัมพัทธ์ (`/reel/{id}/`) ต่างจากโพสต์รูป/ข้อความที่ได้ URL เต็มเสมอ (`https://www.facebook.com/...`) — ถ้าไม่แก้ หน้าเว็บที่ทำ `<a href={published_url}>` จะพาไปที่โดเมนแอปเราแทน Facebook จริง แก้แล้วโดยเติม `https://www.facebook.com` ให้ path ที่ขึ้นต้นด้วย `/` ก่อนเก็บ (ดู Decisions ข้อ 5 ใน design.md) และแก้ข้อมูลที่บันทึกผิดไว้แล้วใน DB ของการทดสอบนี้ด้วย
