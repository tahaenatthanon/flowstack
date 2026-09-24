## Why

คอนเทนต์วิดีโอที่สร้างเสร็จแล้ว (`content_items.video_url` จาก `combine-video`) ยังโพสต์ขึ้น Facebook ไม่ได้เลย — `dispatch_facebook()` มีแค่สาขาสำหรับข้อความ (`/feed`) และรูป (`/photos`) เท่านั้น เมื่อคอนเทนต์เป็นวิดีโอ ระบบจะเพิกเฉยไฟล์วิดีโอโดยเงียบและโพสต์เป็นข้อความล้วนแทน ตอนนี้ pipeline สร้างวิดีโอ (Phase 4) ผ่านการทดสอบจริงกับ kie.ai แล้ว (คลิปรายฉาก + รวมด้วย ffmpeg ได้ไฟล์ mp4 ที่ใช้งานได้จริง) จึงพร้อมต่อยอดเป็นการเผยแพร่จริง

## What Changes

- เพิ่มสาขาวิดีโอใน `dispatch_facebook()`: เมื่อคอนเทนต์เป็นวิดีโอ (`type='video'` และมี `video_url`) POST ไปยัง `https://graph.facebook.com/v19.0/{page_id}/videos` แบบ `multipart/form-data` (`source` = เนื้อไฟล์, `description` = ข้อความโพสต์) แทนที่จะไปทาง `/feed`/`/photos`
- `dispatch_content()` ส่ง `video_url` (จาก `content_items.video_url`, resolve เป็น path จริงใต้ `uploads/` เหมือนรูป) เข้า `dispatch_facebook()` เป็นพารามิเตอร์ใหม่
- ถือว่า publish สำเร็จทันทีหลังอัปโหลดเสร็จ (ไม่รอ Facebook ประมวลผลวิดีโอ `video_status: ready`) — สอดคล้องกับพฤติกรรมเดิมของ `/photos` และ `/feed`
- แยก timeout ของคำขอที่แนบไฟล์วิดีโอออกจากค่า 30 วินาทีเดิมที่ใช้กับข้อความ/รูป เพื่อรองรับไฟล์ที่ใหญ่กว่าและใช้เวลาอัปโหลดนานกว่า
- **gate ใหม่**: ก่อนอนุญาตเผยแพร่คอนเทนต์วิดีโอ (send now / schedule / cron) ต้องเช็คว่า `video_gen_status='done'` และไฟล์ที่ `video_url` ชี้ถึงมีอยู่จริงบนดิสก์ — ไม่ผ่านต้องปฏิเสธพร้อมเหตุผลภาษาไทยที่ชัดเจน แทนที่จะปล่อยให้ไป error ตอน dispatch จริง
- ขอบเขตจำกัดเฉพาะ **Facebook** เท่านั้น (platform เดียวที่มี token ใช้งานได้จริงในระบบตอนนี้) — platform โซเชียลอื่นยังไม่รองรับวิดีโอใน change นี้
- ทดสอบจริง: โพสต์วิดีโอขึ้นเพจ Facebook จริง 1 ครั้ง (รวมงาน 6.4 ที่ค้างจาก change `platform-post-text` ซึ่งมีเป้าหมายเดียวกัน)

## Capabilities

### New Capabilities
- `publish-dispatch-facebook-video`: การโพสต์วิดีโอของคอนเทนต์ขึ้นเพจ Facebook ผ่าน endpoint `/videos`, การอ่านไฟล์จาก path จริงใต้ `uploads/`, timeout ที่แยกจากรูป/ข้อความ, และการอ่าน `platform_post_id`/`published_url` ของโพสต์วิดีโอ
- `publish-video-readiness-gate`: การตรวจว่าคอนเทนต์วิดีโอพร้อมเผยแพร่จริง (`video_gen_status='done'` และไฟล์มีอยู่จริง) ก่อนอนุญาต send now / schedule / cron dispatch

### Modified Capabilities
(ไม่มี — ความสามารถที่มีอยู่ไม่เปลี่ยนพฤติกรรมเดิม เพิ่มสาขาใหม่คู่ขนานเท่านั้น)

## Impact

- **Backend**: `api/lib/publish-dispatch.php` (`dispatch_facebook()` เพิ่มสาขาวิดีโอ, `dispatch_content()` ส่ง `video_url`, `final_publish_gate_check()`/`quality_required_gate()` หรือฟังก์ชันใหม่สำหรับ video readiness gate, `_dispatch_post()` หรือฟังก์ชันใหม่สำหรับ timeout ของไฟล์วิดีโอ)
- **ไม่มี migration**: ไม่มีการเปลี่ยนโครงสร้างตาราง ใช้คอลัมน์ `video_url`/`video_gen_status` ที่มีอยู่แล้ว
- **ไม่อยู่ในขอบเขต**: platform โซเชียลอื่นนอกจาก Facebook, การรอ/poll สถานะประมวลผลวิดีโอของ Facebook หลังโพสต์, resumable upload (ไฟล์ปัจจุบันมีขนาดหลัก MB ไม่ถึงเกณฑ์ที่ Facebook บังคับใช้ resumable), การลบไฟล์วิดีโอเก่า
