## ADDED Requirements

### Requirement: ชั้น API ตั้งเขตเวลาที่จุด bootstrap เดียว
`api/config.php` SHALL เรียก `date_default_timezone_set()` หนึ่งครั้งด้วยค่าจาก `.env` คีย์ `APP_TIMEZONE` และ SHALL ถอยไปใช้ `'Asia/Bangkok'` เมื่อคีย์นั้นไม่มีหรือไม่ใช่ชื่อเขตเวลา IANA ที่ถูกต้อง — ต้องตั้งก่อนโค้ดใดในไฟล์เดียวกันหรือไฟล์ที่ require ต่อจากนี้เรียก `date()`, `strtotime()` หรือสร้าง `DateTime` เพื่อให้ทุก endpoint ที่ require `config.php` (ทางตรงหรือผ่าน `api/auth.php`) ตีความและเขียนเวลาบนเขตเวลาเดียวกับฐานข้อมูล

#### Scenario: เขตเวลาของ PHP ตรงกับฐานข้อมูล
- **WHEN** โหลด `api/config.php` แล้วอ่าน `date('Y-m-d H:i:s')` เทียบกับ `SELECT NOW()` จาก connection เดียวกัน
- **THEN** ทั้งสองค่าต่างกันไม่เกิน 2 วินาที

#### Scenario: APP_TIMEZONE ที่ตั้งไว้ถูกใช้จริง
- **WHEN** `.env` มี `APP_TIMEZONE` เป็นชื่อเขตเวลา IANA ที่ถูกต้อง
- **THEN** `date_default_timezone_get()` คืนค่านั้น

#### Scenario: APP_TIMEZONE ไม่มีคีย์ก็ยังได้เขตเวลาที่ถูก
- **WHEN** `.env` ไม่มีคีย์ `APP_TIMEZONE`
- **THEN** `date_default_timezone_get()` คืน `'Asia/Bangkok'` และไม่มี warning หรือ error

#### Scenario: APP_TIMEZONE ที่ผิดรูปแบบไม่ทำให้ทุก endpoint ล้ม
- **WHEN** `.env` มี `APP_TIMEZONE` เป็นค่าที่ไม่ใช่ชื่อเขตเวลา IANA (เช่น `Mars/Olympus`)
- **THEN** `date_default_timezone_get()` คืน `'Asia/Bangkok'` และ endpoint ยังตอบได้ตามปกติ ไม่ตอบ 500

#### Scenario: capacity override ต่อ tenant ยังทำงาน
- **WHEN** เรียก endpoint `api/capacity.php` ซึ่งอ่าน `company_settings.timezone` แล้วเรียก `date_default_timezone_set()` ของตัวเองหลัง `requireAuth()`
- **THEN** เขตเวลาสุดท้ายเป็นค่าของ tenant นั้น (bootstrap เป็นเพียงค่าเริ่มต้นที่ถูกก่อน override)

### Requirement: การเทียบเวลาที่อ่านจากฐานข้อมูลให้ผลเป็นบวกและสมเหตุสมผล
ทุกจุดที่เทียบเวลาซึ่งอ่านมาจากคอลัมน์ DATETIME กับเวลาปัจจุบันของ PHP SHALL ให้ผลต่างที่มีเครื่องหมายและขนาดตรงกับความจริง — ห้ามมีผลต่างติดลบคงที่จากการที่ `strtotime()` ตีความสตริงจากฐานข้อมูลด้วยเขตเวลาอื่น

#### Scenario: อายุการรัน cron ล่าสุดเป็นบวก
- **WHEN** มีแถว `cron_runs` ที่ `finished_at` ถูกเขียนด้วย `NOW()` ของฐานข้อมูลเมื่อไม่กี่นาทีก่อน แล้วคำนวณอายุของแถวนั้น
- **THEN** ได้ค่าเป็นบวกและไม่เกินไม่กี่นาที (ไม่ใช่ค่าติดลบประมาณ −300 นาที)

#### Scenario: API key ที่หมดอายุถูกปฏิเสธทันที
- **WHEN** เรียก endpoint ด้วย API key ที่ `agent_api_keys.expires_at` เป็นเวลาในอดีตตามนาฬิกาฐานข้อมูล
- **THEN** ถูกปฏิเสธทันที ไม่ยังใช้ได้ต่อไปอีกตามระยะที่นาฬิกาคลาดกัน

#### Scenario: เวลาตอบกลับครั้งแรกของ Helpdesk ไม่เป็นศูนย์เสมอ
- **WHEN** ตั๋วที่มี `first_response_at` ห่างจากเวลาสร้างจริงหลายนาที ถูกคำนวณเวลาตอบกลับครั้งแรก
- **THEN** ได้ค่าเป็นจำนวนนาทีที่ตรงกับความจริง ไม่ถูกบีบเป็น 0 ด้วย `max(0, ...)`

### Requirement: เส้นเผยแพร่คอนเทนต์ใช้นาฬิกาฐานข้อมูลเป็นแหล่งเดียว
จุดที่เขียนหรือส่งเวลาบนเส้นเผยแพร่ SHALL ใช้นาฬิกาของฐานข้อมูล ไม่ใช่ `date()` ของ PHP — `api/content-publish.php` SHALL เขียน `content_publish_queue.scheduled_at` ด้วย `NOW()` ใน SQL และ fallback ของฟิลด์ `Date` ที่ส่งไปยังปลายทางภายนอกใน `api/lib/publish-dispatch.php` และ `api/brand-content.php` SHALL มาจากฐานข้อมูล เพื่อให้คอลัมน์เดียวไม่มีสองนาฬิกาปนกัน และให้ความถูกต้องของเส้นนี้ไม่ขึ้นกับการตั้งค่า runtime

#### Scenario: send_now เขียน scheduled_at ด้วยนาฬิกาฐานข้อมูล
- **WHEN** ผู้ใช้สั่งเผยแพร่ทันที (`send_now`) แล้วมีแถวใหม่ใน `content_publish_queue`
- **THEN** `scheduled_at` ของแถวนั้นต่างจาก `NOW()` ของฐานข้อมูลไม่เกิน 2 วินาที

#### Scenario: scheduled_at จากเส้น retry และเส้น send_now อยู่บนนาฬิกาเดียวกัน
- **WHEN** เทียบ `scheduled_at` ของแถวที่สร้างจาก `send_now` กับแถวที่ `api/cron/publish-scheduler.php` เขียนด้วย `DATE_ADD(NOW(), INTERVAL 5 MINUTE)` ตอน retry
- **THEN** ทั้งสองค่าอยู่บนนาฬิกาเดียวกัน เทียบกับ `WHERE scheduled_at <= NOW()` ได้ตรงความหมาย

#### Scenario: ไม่มี date() ของ PHP เหลือบนเส้นเผยแพร่
- **WHEN** ตรวจ `api/content-publish.php`, `api/lib/publish-dispatch.php` และจุดเผยแพร่ใน `api/brand-content.php` หลังแก้
- **THEN** ไม่มีการเรียก `date('Y-m-d H:i:s')` เพื่อสร้างเวลาที่จะเขียนลงฐานข้อมูลหรือส่งออกภายนอกในไฟล์เหล่านั้น

### Requirement: health check ตรวจ cron ค้างได้จริง
`api/health.php` SHALL คำนวณอายุของการรัน cron ล่าสุดด้วย SQL (`TIMESTAMPDIFF`) ไม่ใช่ `time() - strtotime(...)` และ SHALL ตั้งเขตเวลาของตัวเองเพราะไฟล์นี้ไม่ require `api/config.php` โดยเจตนา (ต้องยังตอบได้เมื่อ config พัง) — ค่า `minutes_ago` SHALL เป็นบวก และสถานะ SHALL เป็น `STALE` เมื่อเกินเพดานที่กำหนดไว้จริง

#### Scenario: minutes_ago เป็นบวกเมื่อ cron เพิ่งรัน
- **WHEN** เรียก `GET /api/health.php` ขณะที่ `cron_runs` มีแถวที่ `finished_at` เมื่อไม่กี่นาทีก่อน
- **THEN** `checks.cron_last_run.minutes_ago` เป็นค่าบวกและไม่เกินไม่กี่นาที และ `status` เป็น `ok`

#### Scenario: STALE ขึ้นเมื่อ cron ค้างเกินเพดาน
- **WHEN** เรียก `GET /api/health.php` ขณะที่แถว `cron_runs` ล่าสุดมี `finished_at` เก่ากว่าเพดานที่กำหนด
- **THEN** `checks.cron_last_run.status` เป็น `STALE` และ HTTP status เป็น 503

#### Scenario: ฟิลด์ timestamp รายงาน offset ที่ถูก
- **WHEN** เรียก `GET /api/health.php`
- **THEN** `checks.timestamp` มี offset ตรงกับเขตเวลาที่ระบบใช้ (เช่น `+07:00` สำหรับ `Asia/Bangkok`) ไม่ใช่ offset ของเขตเวลาอื่น

#### Scenario: health check ยังยืนได้เองโดยไม่ต้องพึ่ง config.php
- **WHEN** ตรวจ `api/health.php` หลังแก้
- **THEN** ไฟล์นี้ยังไม่ require `api/config.php` และยังโหลด `.env` กับสร้าง PDO ของตัวเอง

### Requirement: ตรวจความตรงกันของนาฬิกาซ้ำได้ด้วยคำสั่งเดียว
โครงการ SHALL มีสคริปต์ `scripts/test-app-clock-timezone.php` ที่รันจาก CLI แล้วรายงานผลผ่าน/ไม่ผ่านของการเทียบนาฬิกา PHP กับ MariaDB ตามรูปแบบของ `scripts/test-*.php` ที่มีอยู่ และ SHALL คืน exit code ไม่เป็นศูนย์เมื่อมีข้อใดไม่ผ่าน เพื่อให้เห็นทันทีถ้ามีการย้ายเครื่องหรือแก้ `php.ini` ในอนาคต

#### Scenario: รันสคริปต์แล้วผ่านทุกข้อบนเครื่องที่ตั้งค่าถูก
- **WHEN** รัน `php scripts/test-app-clock-timezone.php` บนเครื่องที่แก้ตาม change นี้แล้ว
- **THEN** ทุกข้อรายงาน PASS และ exit code เป็น 0

#### Scenario: นาฬิกาคลาดกันทำให้สคริปต์ไม่ผ่าน
- **WHEN** รันสคริปต์บนเครื่องที่เขตเวลาของ PHP ไม่ตรงกับฐานข้อมูล
- **THEN** มีข้อที่รายงาน FAIL พร้อมระบุค่าที่ได้จากทั้งสองฝั่ง และ exit code ไม่เป็นศูนย์

#### Scenario: ปฏิเสธการเรียกผ่านเว็บ
- **WHEN** เรียกสคริปต์นี้ผ่าน HTTP
- **THEN** ปฏิเสธและไม่รันการทดสอบ
