# publish-dispatch-facebook-photo Specification

## Purpose

ให้ `dispatch_facebook()` (`api/lib/publish-dispatch.php`) โพสต์รูปของคอนเทนต์ขึ้นเพจ Facebook ได้จริง โดยรับค่า `generated_image_url` จาก `dispatch_content()` แล้วอัปโหลดเนื้อไฟล์ขึ้นไปที่ `https://graph.facebook.com/v19.0/{page_id}/photos` เป็น `multipart/form-data` พร้อมข้อความในพารามิเตอร์ `message` — ส่วนคอนเทนต์ที่ไม่มีรูปยังคงโพสต์ผ่าน `/{page_id}/feed` ตามพฤติกรรมเดิม การอ่านไฟล์ถูกจำกัดให้อยู่ใต้ไดเรกทอรี `uploads/` ของโปรเจกต์เท่านั้น รูปที่ระบุไว้แต่หาไฟล์ไม่เจอถือเป็นความล้มเหลว (ไม่ถอยไปโพสต์ข้อความเปล่า) และ `platform_post_id` ของโพสต์รูปอ่านจาก `response.post_id` เพื่อให้การซิงก์ engagement ใช้คีย์ที่ถูกต้อง

## Requirements

### Requirement: dispatch_facebook รับ URL รูปของคอนเทนต์
`dispatch_content()` SHALL ส่งค่า `generated_image_url` ของคอนเทนต์ (`$imgUrl`) เข้าเป็นพารามิเตอร์ของ `dispatch_facebook()` เช่นเดียวกับที่ส่งให้ `dispatch_instagram()`, `dispatch_linkedin()`, `dispatch_lotusdomino()` และ `dispatch_custom()` — ค่านี้ SHALL ไม่ถูกทิ้งที่จุด dispatch

#### Scenario: คอนเทนต์ที่มีรูปส่งค่าถึงฟังก์ชัน
- **WHEN** `dispatch_content('facebook', ...)` ถูกเรียกด้วยคอนเทนต์ที่ `generated_image_url` ไม่ว่าง
- **THEN** `dispatch_facebook()` ได้รับค่า `generated_image_url` นั้น

#### Scenario: คอนเทนต์ที่ไม่มีรูปส่งค่าว่าง
- **WHEN** `dispatch_content('facebook', ...)` ถูกเรียกด้วยคอนเทนต์ที่ไม่มี `generated_image_url`
- **THEN** `dispatch_facebook()` ได้รับค่าสตริงว่าง และ SHALL ไม่ error

### Requirement: คอนเทนต์ที่มีรูปโพสต์ผ่าน endpoint photos
เมื่อมีรูป `dispatch_facebook()` SHALL POST ไปยัง `https://graph.facebook.com/v19.0/{page_id}/photos` โดยส่งข้อความในพารามิเตอร์ `message` พร้อมรูปในคำขอเดียวกัน — SHALL ไม่ใช้ `/{page_id}/feed` ซึ่งไม่มีช่องรับรูป และ SHALL ไม่ใช้พารามิเตอร์ `link` ซึ่งได้ผลเป็น link preview ไม่ใช่รูปที่แนบกับโพสต์

#### Scenario: มีรูปแล้วยิงไป /photos
- **WHEN** `dispatch_facebook()` ถูกเรียกด้วย `$imgUrl` ที่ไม่ว่างและไฟล์อ่านได้
- **THEN** คำขอ POST ปลายทางเป็น `/{page_id}/photos`
- **AND** payload มี `message` เป็นข้อความโพสต์ และมีรูปอยู่ในคำขอเดียวกัน
- **AND** payload SHALL ไม่มีพารามิเตอร์ `link`

#### Scenario: ข้อความยังถูกประกอบแบบเดิม
- **WHEN** `dispatch_facebook()` ถูกเรียกพร้อม `$title` และ `$body` ที่มีค่าทั้งคู่
- **THEN** ค่า `message` เป็น `"{title}\n\n{body}"` และถูกตัดที่ 63206 ตัวอักษรด้วย `mb_substr()` เหมือนเดิมทั้งเส้นทาง `/photos` และ `/feed`

### Requirement: คอนเทนต์ที่ไม่มีรูปคงพฤติกรรมเดิม
เมื่อไม่มีรูป (`$imgUrl` ว่าง) `dispatch_facebook()` SHALL POST ไปยัง `/{page_id}/feed` ด้วย `message` และ `access_token` แบบ `application/x-www-form-urlencoded` ตามพฤติกรรมเดิมทุกอย่าง — การเพิ่มความสามารถโพสต์รูป SHALL ไม่เปลี่ยนผลของโพสต์ข้อความเปล่า

#### Scenario: ไม่มีรูปยิงไป /feed
- **WHEN** `dispatch_facebook()` ถูกเรียกด้วย `$imgUrl` เป็นสตริงว่าง
- **THEN** คำขอ POST ปลายทางเป็น `/{page_id}/feed` พร้อม `message` และ `access_token`

#### Scenario: creds ไม่ครบยังคืน error เดิมก่อนยิงคำขอ
- **WHEN** `dispatch_facebook()` ถูกเรียกโดย creds ขาด `page_id` หรือ `access_token`
- **THEN** คืน `['success' => false, 'error' => 'Missing page_id or access_token']` และไม่มีคำขอออกไปยัง Graph API ไม่ว่าจะมีรูปหรือไม่

### Requirement: รูปที่เป็น path บนเครื่องถูกอัปโหลดเป็น multipart
เมื่อ `$imgUrl` เป็น path แบบ relative (เช่น `/uploads/content/xxx.jpg`) `dispatch_facebook()` SHALL แปลงเป็น path จริงบนดิสก์แล้วอัปโหลดเนื้อไฟล์ขึ้นไปเป็น `multipart/form-data` ในพารามิเตอร์ `source` — SHALL ไม่ส่ง path นั้นเป็น `url` เพราะ Facebook จะดึงรูปจาก URL นั้นไม่ได้ (ค่าที่เก็บไว้เป็น relative ทั้งหมด และระบบไม่มี public base URL ที่กำหนดไว้) การอัปโหลด bytes จึงเป็นวิธีเดียวที่ทำงานได้บน XAMPP localhost

#### Scenario: relative path ถูกอัปโหลดเป็น source
- **WHEN** `$imgUrl` เป็น `/uploads/content/xxx.jpg` และไฟล์นั้นมีอยู่จริงบนดิสก์
- **THEN** คำขอเป็น `multipart/form-data` และมีพารามิเตอร์ `source` ที่เป็นเนื้อไฟล์นั้น
- **AND** SHALL ไม่มีพารามิเตอร์ `url` ในคำขอ

#### Scenario: absolute URL ส่งเป็น url ให้ปลายทางดึงเอง
- **WHEN** `$imgUrl` เริ่มต้นด้วย `http://` หรือ `https://`
- **THEN** คำขอส่งพารามิเตอร์ `url` เป็นค่านั้น และ SHALL ไม่พยายามอ่านไฟล์จากดิสก์

### Requirement: อ่านไฟล์ได้เฉพาะใต้ไดเรกทอรี uploads
`dispatch_facebook()` SHALL ยอมอัปโหลดเฉพาะไฟล์ที่ path จริงหลัง resolve แล้วอยู่ใต้ไดเรกทอรี `uploads/` ของโปรเจกต์ — ค่า `$imgUrl` ที่ resolve ออกไปนอกขอบเขตนี้ SHALL ถูกปฏิเสธและไม่มีคำขอออกไปยัง Graph API เพราะค่านี้มาจากคอลัมน์ในฐานข้อมูลซึ่งไม่ควรถือเป็น path ที่เชื่อถือได้โดยปริยาย

#### Scenario: path ที่หลุดออกนอก uploads ถูกปฏิเสธ
- **WHEN** `$imgUrl` resolve ได้เป็นไฟล์ที่อยู่นอกไดเรกทอรี `uploads/` (เช่นมี `../` ไต่ขึ้นไป)
- **THEN** คืนผลล้มเหลวพร้อมข้อความระบุว่ารูปอยู่นอกขอบเขตที่อนุญาต
- **AND** ไม่มีคำขอออกไปยัง Graph API

### Requirement: รูปที่ระบุไว้แต่หาไฟล์ไม่เจอถือเป็นความล้มเหลว
เมื่อ `$imgUrl` มีค่าแต่ไฟล์ไม่มีอยู่หรืออ่านไม่ได้ `dispatch_facebook()` SHALL คืน `success=false` พร้อมข้อความที่ระบุ path ที่หาไม่เจอ และ SHALL ไม่ถอยไปโพสต์ข้อความเปล่าผ่าน `/feed` — การถอยแบบเงียบจะทำให้โพสต์ที่ออกเพจต่างจากที่ผู้ใช้อนุมัติไว้ และผู้ใช้จะไม่มีทางรู้ว่ารูปหายไป ซึ่งคืออาการเดิมที่ change นี้แก้

#### Scenario: ไฟล์รูปหาไม่เจอจึงไม่โพสต์
- **WHEN** `$imgUrl` มีค่าแต่ไฟล์ที่ path นั้นไม่มีอยู่บนดิสก์
- **THEN** คืน `success=false` พร้อมข้อความที่มี path ของไฟล์ที่หาไม่เจอ
- **AND** ไม่มีคำขอออกไปยัง Graph API และไม่มีโพสต์เกิดขึ้นบนเพจ

#### Scenario: ความล้มเหลวถูกบันทึกตามเส้นทางเดิม
- **GIVEN** คอนเทนต์ที่ `generated_image_url` ชี้ไปไฟล์ที่หายไป
- **WHEN** ผู้ใช้เรียก `send_now` ไปยัง channel facebook
- **THEN** `content_items` ยังคงสถานะเดิม ไม่ถูกตั้งเป็น `published`
- **AND** แถวคิวถูกตั้งเป็น `failed` พร้อม `error_msg` ที่อธิบายว่ารูปหาไม่เจอ

### Requirement: platform_post_id ของโพสต์รูปมาจาก post_id
เมื่อโพสต์ผ่าน `/photos` สำเร็จ `dispatch_facebook()` SHALL อ่าน `platform_post_id` จาก `response.post_id` ก่อน แล้วจึง fallback ไป `response.id` — เพราะ `/photos` คืน `id` เป็น photo id เปล่า ขณะที่ `post_id` เป็นรูปแบบผสม `{page_id}_{post_id}` ซึ่งเป็นรูปแบบเดียวกับที่ `/feed` คืนมาใน `id` และเป็นคีย์ที่ `api/lib/insights-fetch.php` ใช้ดึง engagement จาก `content_publish_queue.platform_post_id` การเก็บ photo id ไว้แทนจะทำให้การซิงก์ engagement เงียบหายไปทั้งที่โพสต์สำเร็จ

#### Scenario: โพสต์รูปเก็บ post_id ไม่ใช่ photo id
- **WHEN** `/photos` คืน `{"id": "<photo_id>", "post_id": "<page_id>_<post_id>"}`
- **THEN** `platform_post_id` ของผล dispatch เท่ากับค่า `post_id`
- **AND** ค่านั้นมีรูปแบบผสมที่มีขีดล่างคั่นระหว่าง page id กับ post id

#### Scenario: โพสต์ข้อความเปล่ายังอ่านจาก id
- **WHEN** `/feed` คืน `{"id": "<page_id>_<post_id>"}`
- **THEN** `platform_post_id` เท่ากับค่า `id` นั้นตามพฤติกรรมเดิม

#### Scenario: ค่าที่ได้ใช้ซิงก์ engagement ได้
- **GIVEN** โพสต์รูปที่สำเร็จและบันทึก `platform_post_id` ลง `content_publish_queue` แล้ว
- **WHEN** `api/cron/content-metrics-sync.php` รันและหยิบแถวนั้น
- **THEN** การเรียก Graph API ด้วยคีย์นั้นไม่ถูกปฏิเสธว่า id ไม่ถูกต้อง
