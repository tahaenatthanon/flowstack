## MODIFIED Requirements

### Requirement: บันทึกข้อมูลอ้างอิงโพสต์ลง content_publish_queue
เมื่อ cron queue ส่งสำเร็จ ระบบ SHALL เขียน `platform_post_id`, `published_url` (ถ้ามี) และ `platform_post_type` กลับลงแถว `content_publish_queue` ที่กำลังประมวลผล โดย `platform_post_type` บอกชนิดของ id ที่ได้จากปลายทาง: `video` เมื่อ id เป็น video id (Facebook `/videos`) และ `post` สำหรับกรณีอื่นทั้งหมด ค่านี้ SHALL มาจากผลของ dispatch โดยตรง ไม่ใช่การเดาจากรูปแบบของ id ภายหลัง

#### Scenario: queue ได้ platform_post_id
- **WHEN** `publish-scheduler.php` ส่งสำเร็จและผล dispatch มี `platform_post_id`
- **THEN** แถว `content_publish_queue` นั้นมี `platform_post_id` ไม่เป็น NULL และ `status='sent'`

#### Scenario: เผยแพร่วิดีโอ Facebook บันทึกชนิด video
- **WHEN** `dispatch_facebook()` ส่งวิดีโอผ่าน `/{page_id}/videos` สำเร็จ
- **THEN** แถว `content_publish_queue` นั้นมี `platform_post_type='video'`

#### Scenario: เผยแพร่ข้อความหรือรูปบันทึกชนิด post
- **WHEN** การเผยแพร่สำเร็จผ่าน endpoint อื่นที่ไม่ใช่ `/videos` (เช่น `/feed`, `/photos` หรือ platform อื่น)
- **THEN** แถว `content_publish_queue` นั้นมี `platform_post_type='post'`

#### Scenario: แถวเดิมก่อน change นี้ถูก backfill
- **WHEN** migration ของ change นี้รันสำเร็จ
- **THEN** แถว Facebook ที่ `status='sent'` และ `platform_post_id` ไม่มีเครื่องหมาย `_` ถูกตั้งเป็น `video` ส่วนแถวที่เหลือที่มี `platform_post_id` ถูกตั้งเป็น `post`
