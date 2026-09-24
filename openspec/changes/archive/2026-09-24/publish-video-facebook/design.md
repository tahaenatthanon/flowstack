## Context

- `dispatch_facebook()` ([publish-dispatch.php:760](api/lib/publish-dispatch.php:760)) มี 3 สาขาอยู่แล้ว: ไม่มีรูป → `/feed`, รูปเป็น absolute URL → `/photos?url=`, รูปเป็น relative path → `/photos` แบบ multipart ผ่าน `resolve_local_image()` + `CURLFile` — ไม่มีสาขาสำหรับวิดีโอเลย คอนเทนต์ `type='video'` จึงตกไปที่สาขาข้อความ/รูปเหมือนเดิมเสมอ (เพิกเฉยไฟล์วิดีโอ)
- `dispatch_content()` ([publish-dispatch.php:386](api/lib/publish-dispatch.php:386)) อ่าน `generated_image_url` จาก `$content` แล้วส่งเข้าทุก dispatcher ที่รับรูป — ยังไม่อ่าน `video_url`
- `_dispatch_post()` ([publish-dispatch.php:625](api/lib/publish-dispatch.php:625)) ตั้ง `CURLOPT_TIMEOUT => 30` ตายตัวทั้งสอง case (form-encoded และ multipart) — พอสำหรับข้อความ/รูปไม่กี่ร้อย KB แต่ไม่ได้ออกแบบมาสำหรับไฟล์ระดับ MB
- `final_publish_gate_check()` ([publish-dispatch.php:267](api/lib/publish-dispatch.php:267)) เป็น gate กลางที่ send now / schedule / cron เรียกร่วมกัน — สำหรับ platform ใน `SCRIPT_PLATFORMS` (รวม facebook) จะ return `blocked:false` ทันทีหลังผ่าน Approval + Platform gate โดยไม่มี Quality gate (ตามดีไซน์เดิม เพราะโซเชียลไม่มี Quality gate ของตัวเอง)
- ทดสอบจริงกับ kie.ai แล้ว (2026-09-24): ไฟล์วิดีโอผลลัพธ์จริงจาก `combine-video` คือ mp4, h264 720×1280, AAC 48kHz, ตัวอย่าง 32 วินาที ~9.1MB — ใช้เป็นเกณฑ์ประเมิน timeout/ขนาดในดีไซน์นี้
- `publish_channels` ในระบบตอนนี้มีแค่ Facebook ที่ `token_status='valid'` จริง — ยืนยันขอบเขต Facebook-only ของ proposal

## Goals / Non-Goals

**Goals:**
- โพสต์คอนเทนต์วิดีโอขึ้นเพจ Facebook ได้จริงผ่าน `/videos` endpoint โดยใช้โครงเดียวกับที่มีอยู่แล้วสำหรับรูป (multipart, อ่านไฟล์จาก `uploads/` เท่านั้น)
- กันไม่ให้กดเผยแพร่คอนเทนต์วิดีโอที่ยังไม่มีไฟล์จริงหรือสร้างไม่เสร็จ ด้วย gate ที่ให้เหตุผลภาษาไทยชัดเจน แทนที่จะไป error ตอน dispatch
- ไม่ทำให้ path เดิม (ข้อความ/รูป, platform อื่น) เปลี่ยนพฤติกรรม

**Non-Goals:**
- Platform อื่นนอกจาก Facebook (TikTok/Instagram/LineOA ฯลฯ)
- รอ/poll สถานะประมวลผลวิดีโอของ Facebook (`video_status`) หลังโพสต์
- Resumable upload (`/videos` แบบ chunked) — ไฟล์ปัจจุบันขนาดหลัก MB ไม่ใหญ่พอที่ Facebook บังคับ
- แก้ cron `publish-scheduler.php` ให้มี time budget เหมือน `video-clips-sync.php` (ความเสี่ยงเรื่อง cron ค้างที่พบระหว่างสำรวจ — ทิ้งเป็น Open Question แยก ไม่ใช่ scope ของ change นี้)
- ลบไฟล์วิดีโอเก่าหลังโพสต์

## Decisions

### 1. `resolve_local_image()` แยกเป็น core + wrapper 2 ตัว แทนการเขียนซ้ำ
ตรรกะตรวจ path (resolve realpath, เช็คว่าอยู่ใต้ `uploads/`, เช็ค `is_file`/`is_readable`) เป็นโค้ดป้องกันความปลอดภัย (path traversal) ที่ต้องคงเหมือนกันทุกจุดที่อ่านไฟล์จาก path ในคอลัมน์ DB — แยกเป็น `resolve_local_upload(string $path, array $mimeByExt): array` แล้วให้ `resolve_local_image()` (คงชื่อ/พฤติกรรมเดิมทุกอย่างตาม spec `publish-dispatch-facebook-photo`) และ `resolve_local_video()` ใหม่ เป็น wrapper บาง ๆ ที่ส่ง mime map ของตัวเองเข้าไป (`resolve_local_video`: `mp4→video/mp4, mov→video/quicktime, webm→video/webm`)
- ทางเลือกที่ไม่เลือก: copy ทั้งฟังก์ชันเป็น `resolve_local_video()` แยกอิสระ — เสี่ยงแก้ security check จุดเดียวแล้วลืมอีกจุด (เช่นถ้าพบช่องโหว่ path traversal ภายหลัง)

### 2. `dispatch_facebook()` เพิ่มพารามิเตอร์ `videoUrl` แยกจาก `imgUrl`
Signature ใหม่: `dispatch_facebook($channel, $creds, $title, $body, $imgUrl = '', $videoUrl = '')` — เช็ค `$videoUrl` ก่อน `$imgUrl` (คอนเทนต์วิดีโอจะไม่มี `generated_image_url` อยู่แล้วในทางปฏิบัติ แต่เช็คลำดับชัดเจนกันความกำกวม) ถ้ามี `$videoUrl` → เข้าสาขาวิดีโอทั้งหมด ไม่ผ่าน branch รูป/ข้อความเดิมเลย
- `dispatch_content()` ส่ง `$content['video_url'] ?? ''` เป็น argument ใหม่ — ส่งเฉพาะ facebook (dispatcher อื่นไม่รับ พารามิเตอร์นี้ยังไม่ต้องรองรับ ตาม Non-Goals)
- ทางเลือกที่ไม่เลือก: ตรวจ `$content['type'] === 'video'` แล้วสลับ `$imgUrl` ให้กลายเป็น video path ตัวเดียวกัน (ใช้พารามิเตอร์เดิม) — จะทำให้ `dispatch_facebook()` ต้องเดาว่า path ที่ได้รับมาเป็นรูปหรือวิดีโอจากนามสกุลไฟล์ ซึ่งเปราะกว่าการรับ 2 พารามิเตอร์ที่ชัดเจน

### 3. Endpoint `/videos` — payload และการอ่านผลลัพธ์
```
POST https://graph.facebook.com/v19.0/{page_id}/videos
multipart/form-data:
  source      = CURLFile(path จริง, mime, basename)
  description = "{title}\n\n{body}" (ประกอบแบบเดียวกับ $msg ของ /photos, ตัดที่ 63206 ตัวอักษรเหมือนเดิม)
  access_token = token
```
- Facebook Graph API รับ `description` เป็นแคปชันของวิดีโอ (ต่างจาก `/photos`/`/feed` ที่ใช้ `message`) — ยึดตามเอกสาร Graph API `/videos`
- ผลลัพธ์: `/videos` คืน `{"id": "<video_id>"}` เท่านั้น ไม่มี `post_id` แบบผสมเหมือน `/photos` — ใช้ `id` เป็น `platform_post_id` ตรง ๆ (ต่างจาก `/photos` ที่ต้องอ่าน `post_id` ก่อน)
- `published_url`: lookup permalink ด้วย `GET /{video_id}?fields=permalink_url` แบบเดียวกับที่ `/photos` ทำ (non-blocking — lookup ล้มเหลวไม่ทำให้ผลลัพธ์กลายเป็น failure)

### 4. Timeout ของคำขอวิดีโอแยกจากค่าเดิม
เพิ่มพารามิเตอร์ `timeoutSeconds` ให้ `_dispatch_post()` (default คงเป็น 30 เหมือนเดิม เพื่อไม่กระทบ caller อื่น) — เรียกจาก branch วิดีโอด้วยค่าที่สูงกว่า (120 วินาที) ประเมินจากไฟล์ตัวอย่างจริง 9.1MB บนอัตราอัปโหลดบ้าน/ออฟฟิศทั่วไป (~1-3 Mbps upload) ใช้เวลา ~30-70 วินาที เผื่อ margin
- ทางเลือกที่ไม่เลือก: เพิ่ม timeout ของ `_dispatch_post()` ทั้งหมดเป็น 120 วินาที — จะทำให้คำขอข้อความ/รูปที่ล้มเหลวจริง (token หมดอายุ, เพจไม่ตอบ) ค้างนานขึ้นโดยไม่จำเป็น กระทบ cron ทุกตัวที่ใช้ dispatcher เดียวกัน

### 5. `published_url` ต้องเป็น absolute URL เสมอ — normalize permalink ที่เป็น relative path
**พบจากการทดสอบจริง (2026-09-24):** โพสต์วิดีโอขึ้น `/videos` แล้ว lookup `GET /{video_id}?fields=permalink_url` คืนค่าเป็น path สัมพัทธ์ `/reel/{id}/` (Facebook จัดวิดีโอแนวตั้งสั้นเป็น Reel อัตโนมัติ) — ต่างจากโพสต์รูป/ข้อความที่ยืนยันจากข้อมูลจริงในระบบว่าได้ URL เต็มเสมอ (`https://www.facebook.com/{page_id}/posts/{id}`) โค้ดเดิมเก็บค่าที่ได้จาก `permalink_url` ตรงๆ โดยไม่เช็ครูปแบบ — ถ้าเป็น path สัมพัทธ์ หน้าเว็บที่ทำ `<a href={published_url}>` ([AnalyticsSocialTab.tsx:267](src/components/content/AnalyticsSocialTab.tsx:267)) จะพาไปที่โดเมนของแอปเราเอง (เช่น `localhost:8080/reel/...`) แทนที่จะไปหน้าโพสต์จริงบน Facebook

**แก้ไข:** จุด lookup permalink ที่ใช้ร่วมกันทั้งสอง branch (รูป/ข้อความ และวิดีโอ) เช็คว่าค่าที่ได้ขึ้นต้นด้วย `/` หรือไม่ ถ้าใช่ให้เติม `https://www.facebook.com` นำหน้าก่อนเก็บ — ไม่กระทบ URL ที่เป็น absolute อยู่แล้ว (ผ่านทันทีไม่แก้)
- ทางเลือกที่ไม่เลือก: เช็คเฉพาะ branch วิดีโอ — โค้ด lookup เป็นจุดเดียวที่ทั้งสอง branch เรียกร่วมกันอยู่แล้ว การเช็คแบบรูปแบบ (ขึ้นต้นด้วย `/`) ทั่วไปปลอดภัยกว่าเช็คจาก `$isVideo` เพราะกันเคสในอนาคตที่ Facebook อาจเปลี่ยนพฤติกรรมของโพสต์ประเภทอื่นด้วย

### 6. Video readiness gate ใน `final_publish_gate_check()`
เพิ่มเช็คใหม่ก่อน early-return ของ `SCRIPT_PLATFORMS` ([publish-dispatch.php:288](api/lib/publish-dispatch.php:288)): ถ้า `$content['type'] === 'video'` ต้อง `video_gen_status === 'done'` และไฟล์ที่ `video_url` ชี้ถึงมีอยู่จริงบนดิสก์ (ใช้ตรรกะ resolve เดียวกับ `resolve_local_video()`) — ไม่ผ่านคืน `blocked:true` พร้อมเหตุผลไทย เช่น "วิดีโอยังไม่พร้อมเผยแพร่ — กรุณาสร้างวิดีโอรวมให้เสร็จก่อน"
- เช็คนี้ทำงานทุกเส้นทาง (send now, schedule, cron) เพราะอยู่ใน gate กลางที่ทั้งสามเรียกร่วมกันอยู่แล้ว — ไม่ต้องเพิ่มจุดเช็คแยก
- ทางเลือกที่ไม่เลือก: เช็คแค่ตอน dispatch จริงใน `dispatch_facebook()` (คืน error ถ้าไฟล์หาไม่เจอ) — ทำได้เหมือนกันแต่ผู้ใช้จะไม่รู้ล่วงหน้าตอนกด "ส่งทันที" ว่าทำไมถึงเผยแพร่ไม่ได้ (ต้องรอ dispatch ล้มเหลวก่อน) ต่างจาก gate ที่ block ตั้งแต่ก่อนสร้าง queue row

## ผลทดสอบจริง (2026-09-24)

โพสต์วิดีโอ 32s/720p (คอนเทนต์ `5121176a...`) ขึ้นเพจ Facebook จริงสำเร็จผ่าน "ส่งทันที" ในหน้าเว็บ:
- Facebook จัดเป็น **Reel** อัตโนมัติ (วิดีโอแนวตั้งสั้น) — โพสต์เป็น Public ตรวจสอบได้แม้ไม่ล็อกอิน (ไม่ถูกกระทบโดย Facebook Development mode ของแอป เพราะเป็นโพสต์สาธารณะของเพจเอง ไม่ใช่การอ่านผ่าน Graph API ด้วยบัญชีอื่น)
- หัวข้อ + ข้อความโพสต์ตรงกับที่อนุมัติไว้ ไม่มีคำกำกับหลุด
- `platform_post_id`/`response_snippet` ถูกต้องตามดีไซน์ (อ่านจาก `id` ตรงๆ)
- **พบบั๊กจริง**: `permalink_url` เป็น path สัมพัทธ์ — แก้แล้ว (ดู Decision 5)
- อัปโหลดสำเร็จภายใน ~10 วินาที (ไฟล์ 9.1MB, เน็ตออฟฟิศ) — ยืนยันว่า timeout 120s ที่ตั้งไว้มี margin เหลือเยอะ

## Risks / Trade-offs

- [`publish-scheduler.php` ไม่มี time budget] → ถ้าคิววิดีโอหลายรายการค้างพร้อมกัน อัปโหลดครั้งละ ~30-70 วินาทีจะไปถ่วง cron อื่นใน `tick.php` (รวมถึง `video-clips-sync` เอง) — ยอมรับความเสี่ยงนี้ใน change นี้ (ปริมาณโพสต์วิดีโอจริงยังต่ำมาก) บันทึกเป็น Open Question สำหรับ change ถัดไปถ้าปริมาณเพิ่มขึ้น
- [Facebook ยังประมวลผลวิดีโอไม่เสร็จตอนที่เราถือว่า publish สำเร็จ] → ผู้ใช้ที่กดดูเพจทันทีอาจเห็นวิดีโอ "กำลังประมวลผล" ชั่วคราว — เป็นพฤติกรรมปกติของ Facebook เอง ไม่ใช่ error ของระบบ ผู้ใช้เพจทั่วไปก็เจอแบบนี้เวลาอัปโหลดวิดีโอตรงจาก Facebook UI เช่นกัน
- [แอป Facebook ยังอยู่ Development mode] → ตามที่เคยพบใน change `platform-post-text` (memory: `facebook-app-dev-mode-hides-posts`) — โพสต์วิดีโอจริงอาจไม่เห็นจากบัญชีอื่นนอกจากแอดมินแอป จนกว่าจะขอ App Review — ไม่ใช่บั๊กของ change นี้ ต้องแจ้งผู้ใช้ล่วงหน้าตอนทดสอบจริง
- [ไฟล์วิดีโอในอนาคตอาจใหญ่กว่าตัวอย่างที่ทดสอบ] → ถ้าความยาว/ความละเอียดเพิ่มขึ้นมาก (เช่น 1080p หลายฉาก) timeout 120 วินาทีอาจไม่พอ — ยอมรับเป็นความเสี่ยงที่ประเมินจากข้อมูลจริงที่มีตอนนี้ ปรับค่าได้ภายหลังถ้าเจอจริง

## Open Questions

- ปริมาณโพสต์วิดีโอเพิ่มขึ้นถึงจุดที่ต้องใส่ time budget ให้ `publish-scheduler.php` เมื่อไหร่ — ไม่ตัดสินใจล่วงหน้าใน change นี้
