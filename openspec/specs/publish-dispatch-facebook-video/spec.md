# publish-dispatch-facebook-video Specification

## Purpose

ให้ `dispatch_facebook()` (`api/lib/publish-dispatch.php`) โพสต์วิดีโอของคอนเทนต์ขึ้นเพจ Facebook ได้จริง โดยรับค่า `video_url` จาก `dispatch_content()` แล้วอัปโหลดเนื้อไฟล์ขึ้นไปที่ `https://graph.facebook.com/v19.0/{page_id}/videos` เป็น `multipart/form-data` — แยกจาก branch รูป/ข้อความเดิมโดยสิ้นเชิง (เช็คก่อนเสมอ), ใช้ timeout ที่นานกว่าเพราะไฟล์ใหญ่กว่า, อ่าน `platform_post_id`/`published_url` ด้วยกติกาที่ต่างจากโพสต์รูปเล็กน้อยตามพฤติกรรมจริงของ endpoint นี้

## Requirements

### Requirement: dispatch_facebook รับ URL วิดีโอของคอนเทนต์
`dispatch_content()` SHALL ส่งค่า `video_url` ของคอนเทนต์เข้าเป็นพารามิเตอร์ใหม่ของ `dispatch_facebook()` แยกจากพารามิเตอร์รูป (`$imgUrl`) เดิม — ค่านี้ SHALL ถูกส่งเฉพาะกับ dispatcher ของ facebook เท่านั้น (platform อื่นยังไม่รองรับวิดีโอ)

#### Scenario: คอนเทนต์วิดีโอส่งค่า video_url ถึงฟังก์ชัน
- **WHEN** `dispatch_content('facebook', ...)` ถูกเรียกด้วยคอนเทนต์ที่ `video_url` ไม่ว่าง
- **THEN** `dispatch_facebook()` ได้รับค่า `video_url` นั้นเป็นพารามิเตอร์วิดีโอ

#### Scenario: คอนเทนต์ที่ไม่มีวิดีโอส่งค่าว่าง
- **WHEN** `dispatch_content('facebook', ...)` ถูกเรียกด้วยคอนเทนต์ที่ `video_url` ว่างหรือไม่มี
- **THEN** `dispatch_facebook()` ได้รับค่าสตริงว่างสำหรับพารามิเตอร์วิดีโอ และ SHALL ไม่ error

### Requirement: มีวิดีโอโพสต์ผ่าน endpoint /videos แทน /photos และ /feed
เมื่อพารามิเตอร์วิดีโอไม่ว่าง `dispatch_facebook()` SHALL POST ไปยัง `https://graph.facebook.com/v19.0/{page_id}/videos` แบบ `multipart/form-data` แทนที่จะไปทาง `/feed` หรือ `/photos` — การเช็คว่ามีวิดีโอ SHALL ทำก่อนการเช็คว่ามีรูป เพื่อให้คอนเทนต์วิดีโอไม่ตกไปทาง branch รูป/ข้อความโดยไม่ตั้งใจ

#### Scenario: มีวิดีโอแล้วยิงไป /videos
- **WHEN** `dispatch_facebook()` ถูกเรียกด้วยพารามิเตอร์วิดีโอที่ไม่ว่างและไฟล์อ่านได้
- **THEN** คำขอ POST ปลายทางเป็น `/{page_id}/videos`
- **AND** SHALL ไม่มีคำขอไปยัง `/feed` หรือ `/photos` สำหรับคอนเทนต์เดียวกัน

#### Scenario: ข้อความประกอบเป็น description ไม่ใช่ message
- **WHEN** `dispatch_facebook()` ถูกเรียกด้วยพารามิเตอร์วิดีโอที่ไม่ว่าง พร้อม `$title` และ `$body`
- **THEN** payload มีพารามิเตอร์ `description` เป็น `"{title}\n\n{body}"` ตัดที่ 63206 ตัวอักษรด้วย `mb_substr()`
- **AND** payload SHALL ไม่มีพารามิเตอร์ `message`

### Requirement: วิดีโอที่เป็น path บนเครื่องถูกอัปโหลดเป็น multipart
เมื่อพารามิเตอร์วิดีโอเป็น path แบบ relative (เช่น `/uploads/content/videos/xxx.mp4`) `dispatch_facebook()` SHALL แปลงเป็น path จริงบนดิสก์แล้วอัปโหลดเนื้อไฟล์เป็น `multipart/form-data` ในพารามิเตอร์ `source` — ตรรกะตรวจ path SHALL อยู่ภายใต้ไดเรกทอรี `uploads/` ของโปรเจกต์เท่านั้น เช่นเดียวกับที่ใช้กับรูป

#### Scenario: relative path ถูกอัปโหลดเป็น source
- **WHEN** พารามิเตอร์วิดีโอเป็น `/uploads/content/videos/xxx.mp4` และไฟล์นั้นมีอยู่จริงบนดิสก์
- **THEN** คำขอเป็น `multipart/form-data` และมีพารามิเตอร์ `source` เป็นเนื้อไฟล์นั้น

#### Scenario: path ที่หลุดออกนอก uploads ถูกปฏิเสธ
- **WHEN** พารามิเตอร์วิดีโอ resolve ได้เป็นไฟล์ที่อยู่นอกไดเรกทอรี `uploads/`
- **THEN** คืนผลล้มเหลวพร้อมข้อความระบุว่าไฟล์อยู่นอกขอบเขตที่อนุญาต
- **AND** ไม่มีคำขอออกไปยัง Graph API

### Requirement: ไฟล์วิดีโอที่ระบุไว้แต่หาไฟล์ไม่เจอถือเป็นความล้มเหลว
เมื่อพารามิเตอร์วิดีโอมีค่าแต่ไฟล์ไม่มีอยู่หรืออ่านไม่ได้ `dispatch_facebook()` SHALL คืน `success=false` พร้อมข้อความที่ระบุ path ที่หาไม่เจอ และ SHALL ไม่ถอยไปโพสต์ข้อความเปล่าหรือรูปแทน

#### Scenario: ไฟล์วิดีโอหาไม่เจอจึงไม่โพสต์
- **WHEN** พารามิเตอร์วิดีโอมีค่าแต่ไฟล์ที่ path นั้นไม่มีอยู่บนดิสก์
- **THEN** คืน `success=false` พร้อมข้อความที่มี path ของไฟล์ที่หาไม่เจอ
- **AND** ไม่มีคำขอออกไปยัง Graph API และไม่มีโพสต์เกิดขึ้นบนเพจ

### Requirement: คำขอโพสต์วิดีโอใช้ timeout ที่นานกว่าข้อความ/รูป
คำขอ POST ที่แนบไฟล์วิดีโอ SHALL ใช้ timeout ที่มากกว่าค่าเริ่มต้น 30 วินาทีที่ใช้กับข้อความและรูป — SHALL ไม่เปลี่ยน timeout ของคำขอข้อความ/รูปเดิม

#### Scenario: คำขอวิดีโอใช้ timeout สูงกว่าเดิม
- **WHEN** `dispatch_facebook()` ส่งคำขอไปยัง `/videos`
- **THEN** timeout ของคำขอนั้นมากกว่า 30 วินาที

#### Scenario: คำขอข้อความ/รูปยัง timeout เท่าเดิม
- **WHEN** `dispatch_facebook()` ส่งคำขอไปยัง `/feed` หรือ `/photos`
- **THEN** timeout ของคำขอนั้นยังเป็น 30 วินาทีเหมือนเดิม

### Requirement: platform_post_id ของโพสต์วิดีโอมาจาก id ของ /videos โดยตรง
เมื่อโพสต์ผ่าน `/videos` สำเร็จ `dispatch_facebook()` SHALL อ่าน `platform_post_id` จาก `response.id` โดยตรง (ต่างจาก `/photos` ที่ต้องอ่าน `post_id` ก่อน เพราะ `/videos` ไม่คืนค่า `post_id` แบบผสม)

#### Scenario: โพสต์วิดีโอเก็บ id ตรงๆ
- **WHEN** `/videos` คืน `{"id": "<video_id>"}`
- **THEN** `platform_post_id` ของผล dispatch เท่ากับค่า `id` นั้น

#### Scenario: lookup permalink ไม่ทำให้ผลลัพธ์ล้มเหลว
- **GIVEN** โพสต์วิดีโอสำเร็จและได้ `video_id` แล้ว
- **WHEN** การ lookup `GET /{video_id}?fields=permalink_url` ล้มเหลวหรือไม่มี `pages_read_engagement`
- **THEN** ผล dispatch ยังคง `success=true` และ `published_url` เป็น `null`

### Requirement: published_url ต้องเป็น absolute URL เสมอ
`permalink_url` ที่ Facebook คืนมาสำหรับโพสต์วิดีโอ (จัดเป็น Reel โดยอัตโนมัติเมื่อเป็นวิดีโอแนวตั้งสั้น) อาจเป็น path สัมพัทธ์ (เช่น `/reel/{id}/`) ต่างจากโพสต์รูป/ข้อความที่ได้ URL เต็มเสมอ — `dispatch_facebook()` SHALL เติม `https://www.facebook.com` นำหน้าค่า `permalink_url` ที่ขึ้นต้นด้วย `/` ก่อนเก็บเป็น `published_url` เพื่อไม่ให้ค่านี้ถูกตีความเป็น path สัมพัทธ์กับโดเมนของแอปเราเองเมื่อใช้เป็น `href`

#### Scenario: permalink เป็น path สัมพัทธ์ถูกเติมโดเมนให้
- **WHEN** lookup permalink คืน `permalink_url` เป็น `/reel/{id}/`
- **THEN** `published_url` ของผล dispatch เท่ากับ `https://www.facebook.com/reel/{id}/`

#### Scenario: permalink ที่เป็น absolute URL อยู่แล้วไม่ถูกแก้
- **WHEN** lookup permalink คืน `permalink_url` เป็น `https://www.facebook.com/{page_id}/posts/{id}`
- **THEN** `published_url` ของผล dispatch เท่ากับค่านั้นโดยไม่เปลี่ยนแปลง
