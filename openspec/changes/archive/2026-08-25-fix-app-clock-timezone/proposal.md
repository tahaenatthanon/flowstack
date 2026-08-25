## Why

นาฬิกาของ PHP กับ MariaDB ไม่ตรงกัน 5 ชั่วโมง — วัดสด ๆ ได้ว่า PHP บอก `2026-08-25 04:36:48` ขณะที่ `SELECT NOW()` บอก `2026-08-25 09:36:48` เพราะ `php.ini` ตั้ง `date.timezone=Europe/Berlin` แต่ MariaDB รับเวลาระบบ (`time_zone=SYSTEM`) ซึ่งเป็น `+07:00` และ `company_settings.timezone` ของทุก tenant เป็น `Asia/Bangkok` ทั้งหมด ผลคือทุกที่ที่โค้ดใช้ `date('Y-m-d H:i:s')` ของ PHP จะได้เวลาย้อนหลังไป 5 ชั่วโมง แล้วเขียนปนกับคอลัมน์ที่ที่อื่นเขียนด้วย `NOW()` ของฐานข้อมูล

เรื่องนี้กลายเป็นเรื่องเร่งด่วนตั้งแต่ 2026-08-24 เพราะตัวตั้งเวลา cron เพิ่งเริ่มเดินจริง — `publish-scheduler` ถูกเรียกทุก 1 นาทีและเทียบ `scheduled_at <= NOW()` ด้วยนาฬิกาฐานข้อมูล เวลาที่เพี้ยนจึงไม่ได้นอนนิ่งในตารางอีกแล้ว แต่กลายเป็นการยิงของออกนอกบริษัท และจุดที่หนักที่สุดคือฟิลด์ `Date` ที่ POST ไปยัง Lotus Domino agent ซึ่งเป็นวันที่ที่ขึ้นบนเว็บไซต์ลูกค้าจริง — ระหว่าง 00:00–05:00 ตามเวลาไทยจะได้วันที่ของ "เมื่อวาน"

ระหว่างสำรวจยังพบว่ารากเดียวกันนี้ทำให้ **การอ่านเวลาผิด** ด้วย ไม่ใช่แค่การเขียน — 7 จุดเทียบ `strtotime($ค่าจากคอลัมน์ DB)` กับ `time()` ซึ่งได้ผลต่าง −300 นาทีทุกครั้ง ที่ร้ายที่สุดคือ `api/health.php` รายงาน `minutes_ago: -300` (ยืนยันสด ๆ แล้ว) ทำให้เพดานเตือน "cron ค้าง" ที่ 120 นาทีไม่เคยถึงจนกว่า cron จะตายเกิน 7 ชั่วโมง — นี่คือเหตุผลที่ตัวตั้งเวลาหยุดไป 15 ชั่วโมงเมื่อคืนวันที่ 24 โดยไม่มีอะไรเตือน นอกจากนั้น API key และ subscription ที่หมดอายุแล้วยังใช้ได้ต่ออีก 5 ชั่วโมง และตัวเลขเวลาตอบกลับครั้งแรกของ Helpdesk ถูกบีบเป็น 0 เสมอ

## What Changes

- ตั้งเขตเวลาให้ทั้งชั้น API ที่จุด bootstrap เดียว (`api/config.php`) เพื่อให้ `date()`/`strtotime()`/`DateTime` ของทุก endpoint อยู่บนเขตเวลาเดียวกับฐานข้อมูล แทนที่จะพึ่ง `date.timezone` ใน `php.ini` ซึ่งอยู่นอกโปรเจกต์และไม่ถูกเวอร์ชันคุม — จุดเดียวนี้ซ่อมทั้งการเขียนเวลาผิดและการอ่านเวลาผิดพร้อมกัน
- เปลี่ยนจุดเขียนเวลาบน **เส้นเผยแพร่คอนเทนต์** ให้ใช้นาฬิกาฐานข้อมูล (`NOW()`) เป็นแหล่งเดียว ไม่ใช่ `date()` ของ PHP — `api/content-publish.php` (คอลัมน์ `content_publish_queue.scheduled_at`), `api/lib/publish-dispatch.php` และ `api/brand-content.php` (ฟิลด์ `Date` ที่ส่งไป Domino) เพราะเป็นเส้นที่ส่งของออกภายนอกและเรียกคืนไม่ได้ จึงไม่ควรขึ้นกับการตั้งค่าของ runtime
- ซ่อม `api/health.php` ให้ตรวจ cron ค้างได้จริง — ไฟล์นี้ไม่ได้ require `config.php` จึงไม่ได้รับผลจาก bootstrap และต้องแก้แยก
- เพิ่มการตรวจแบบวัดผลได้ว่านาฬิกาสองฝั่งตรงกัน เพื่อให้เห็นทันทีถ้ามีใครย้ายเครื่องหรือแก้ `php.ini` ในอนาคต
- ไม่แก้ `php.ini` เป็นทางแก้หลัก (แก้ได้แต่ไม่นับเป็นของโปรเจกต์ — เครื่องใหม่จะพลาดซ้ำ) และไม่ย้อนแก้ข้อมูลเก่าที่เขียนผิดไปแล้ว

## Capabilities

### New Capabilities
- `app-clock-timezone`: เวลาที่ระบบเขียนลงฐานข้อมูล อ่านกลับมาเทียบ และส่งออกภายนอก ต้องอยู่บนเขตเวลาเดียวกันทั้งหมด — กำหนดเขตเวลาที่จุด bootstrap ของ API, ระบุว่าเส้นเผยแพร่ต้องใช้นาฬิกาฐานข้อมูลเท่านั้น, ให้ health check ตรวจ cron ค้างได้จริง และมีวิธีตรวจว่านาฬิกา PHP กับ MariaDB ไม่คลาดกัน

### Modified Capabilities
- `publish-dispatch-lotusdomino`: ฟิลด์ `Date` ใน payload เดิมกำหนดแค่ว่า "ต้องมี" — เพิ่มข้อกำหนดว่าค่าต้องเป็นเวลาท้องถิ่นของ tenant ไม่ใช่เวลาตาม `date.timezone` ของ PHP เพราะค่านี้แสดงเป็นวันที่ของบทความบนเว็บไซต์ลูกค้า

## Impact

- **แก้ไข:** `api/config.php` (bootstrap เขตเวลา), `api/content-publish.php:162`, `api/lib/publish-dispatch.php:516`, `api/brand-content.php:2316` และ `:2590`, `api/health.php:63` และ `:96`
- **เพิ่ม:** `.env` คีย์ `APP_TIMEZONE` (fallback `Asia/Bangkok` เมื่อไม่มี), `scripts/test-app-clock-timezone.php`
- **ได้ผลถูกต้องโดยไม่ต้องแก้ไฟล์ (จาก bootstrap):** อีก 14 จุดที่เรียก `date('Y-m-d H:i:s')` ใน `api/surveys.php` (4), `api/survey-responses.php` (3), `api/quotation-templates.php` (2), `api/sales-activities.php` (2), `api/survey-public.php` (1), `api/email-aliases.php` (1), `api/line-webhook.php` (1), `api/backup.php` (1), `api/cron-publish.php` (1) และอีก 6 จุดที่เทียบ `strtotime()` กับ `time()` ใน `api/agent-auth.php:39,94`, `api/billing/status.php:26`, `api/support-tickets.php:540`, `api/lib/customer-tiering.php:99,135` — ทั้งหมดอยู่ในสายที่ require `config.php` (ทางตรงหรือผ่าน `api/auth.php`) แล้ว ยืนยันด้วยการตรวจ require chain
- **ไม่กระทบ:** เส้น cron (`api/lib/cron-runner.php`, `api/cron/tick.php`) ใช้นาฬิกาฐานข้อมูลอยู่แล้วทั้งเส้น; JWT ใน `api/auth.php:29-30,57` ใช้ Unix epoch ทั้งสองฝั่งจึงไม่ขึ้นกับเขตเวลา; `api/capacity.php:55-58` ที่ตั้งเขตเวลาต่อ tenant เองอยู่แล้วจะเริ่มจากค่าเริ่มต้นที่ถูกก่อน override
- **ฐานข้อมูล:** ไม่มี migration — ไม่มีการเปลี่ยน schema และไม่ย้อนแก้แถวเก่า
- **ฝั่งหน้าเว็บ:** ไม่มีการแก้ไข แต่ตัวเลขบางตัวที่หน้าเว็บแสดง (เวลาตอบกลับ SLA, `minutes_ago` ของ health) จะกระโดดเมื่อเริ่มคำนวณถูก
