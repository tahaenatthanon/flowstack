## Context

`cron_jobs` มี 7 งาน `enabled=1` ทุกงาน แต่ไม่มีตัวใดเรียกงานตามเวลา — `api/cron-manager.php` รันงานเฉพาะเมื่อแอดมินกด `POST ?action=run&job=<key>` ประวัติใน `cron_runs` มีแค่ 3 งาน (`notification-dispatch`, `publish-scheduler`, `cron-publish`) และรันครั้งสุดท้ายทั้งระบบคือ 2026-06-09 ส่วน `ai-digest`, `billing-reminders`, `recurring-tasks`, `content-metrics-sync` ไม่เคยรัน ตรวจ `schtasks` บนเครื่องนี้แล้วไม่มี task ใดอ้างถึง flowstack/xampp/php

ข้อจำกัดที่มีอยู่จริงและต้องออกแบบให้เข้ากับมัน:
- `cron_jobs.interval_label` เป็น `varchar(100)` ข้อความไทย (`ทุก 6 ชั่วโมง`, `ทุกวัน 07:30`) เครื่องอ่านไม่ได้ และไม่มีคอลัมน์ `next_run_at`/`last_run_at`
- `composer.json` มีแค่ `phpmailer` และ `phpspreadsheet` — ไม่มีไลบรารีอ่าน cron expression
- `runJob()` ใน `api/cron-manager.php` ทำงานสองแบบ: `type='include'` ใช้ `include` ไฟล์ในโปรเซสเดียวกัน, `type='http'` ใช้ curl ไปที่ `http://localhost/flowstack/api/<endpoint>` และอ่านจำนวนงานจาก output ด้วย `preg_match` ของ `"N entries"` / `"N error"`
- `getDB()` ใน `api/config.php` เป็น static singleton
- `api/cron-manager.php` fallback `CRON_SECRET` เป็น `'flowstack-cron-2026'` แต่ `api/cron-publish.php` fallback เป็นค่าว่างแล้วตอบ 500 และ `.env` ไม่มีคีย์นี้
- ยุทธศาสตร์ roadmap คือ "patch ไม่ refactor"

## Goals / Non-Goals

**Goals:**
- มี entry point เดียว (`api/cron/tick.php`) ที่ตัวตั้งเวลาระดับ OS เรียกทุกนาที แล้วกระจายงานตามตารางเวลาใน DB
- ตารางเวลาเป็นแหล่งความจริงเดียวใน `cron_jobs` แก้ได้จากหน้าแอดมิน ไม่ต้องไปแก้ที่ Task Scheduler
- ปุ่ม "รันเดี๋ยวนี้" ของแอดมินและตัวตั้งเวลาใช้โค้ดรันงานชุดเดียวกัน
- ปลดล็อกเฟส 0 DoD (ข) และเฟส 2 ให้เริ่มมีข้อมูล

**Non-Goals:**
- ไม่เขียน scheduler daemon ของตัวเอง (ไม่มีโปรเซสค้างของ PHP)
- ไม่รองรับ cron syntax ครบทุกแบบ — ไม่รับ `L`, `W`, `#`, `?`, ชื่อเดือน/วัน (`MON`, `JAN`), และไม่รองรับหลายวินาที
- ไม่ย้อนรัน (backfill) งานที่พลาดไปในอดีต 2.5 เดือน
- ไม่ทำ retention ของ `cron_runs`, ไม่ทำการแจ้งเตือนเมื่อ cron ล้มเหลว, ไม่แก้เรื่อง token channel หมดอายุ
- ไม่แตะ `api/lib/publish-dispatch.php` หรือตรรกะการเผยแพร่ใด ๆ — change นี้แก้เฉพาะ "ใครเรียก" ไม่ใช่ "เรียกแล้วทำอะไร"

## Decisions

### D1: OS task เดียวเรียก tick.php แล้ว tick กระจายงานจาก DB
เลือกแบบนี้แทน (ก) สร้าง Windows Task 7 อันแยกตามงาน และ (ข) ให้ frontend poll เอา

- (ก) ทำให้ตารางเวลาแตกเป็นสองแหล่ง — `interval_label` ในหน้าแอดมินจะเพี้ยนจาก schedule จริงที่ Task Scheduler ถือไว้ ผิดกฎ NO MAGIC และแอดมินแก้รอบเวลาจากหน้าเว็บไม่ได้จริง
- (ข) งานจะรันเฉพาะตอนมีเบราว์เซอร์เปิดอยู่ ไม่ใช่ cron
- แบบที่เลือก: OS ถือแค่ "เรียกทุกนาที" อันเดียว ตารางเวลาจริงอยู่ใน DB ที่หน้าแอดมินแก้ได้อยู่แล้ว

### D2: ตัดสิน "ถึงกำหนด" ด้วย `next_run_at` ไม่ใช่จับคู่นาทีปัจจุบัน
จับคู่นาทีปัจจุบันกับ `cron_expression` ตรง ๆ เป็น stateless แต่ถ้า tick พลาดนาทีนั้นไป (XAMPP ปิด, เครื่อง sleep) งานจะหายไปเลย ส่วน `next_run_at <= NOW()` ทำให้งานที่เลยกำหนดได้รันครั้งเดียวเมื่อกลับมา แล้วคำนวณรอบถัดไปจาก "เวลานี้" — ไม่ใช่ไล่รันทุกนาทีที่พลาด จึงไม่มีพายุ catch-up

**`next_run_at IS NULL` = ยังไม่เคยตั้งรอบ → tick จะคำนวณค่าให้แต่ไม่รันในรอบนั้น** migration จึงตั้งเป็น NULL ทุกแถวโดยเจตนา: tick ครั้งแรกทำหน้าที่ initialize เท่านั้น งาน 6 งานที่เงียบไป 2.5 เดือนจะไม่ยิงพร้อมกันทันที และ `billing-reminders`/`recurring-tasks`/`notification-dispatch` จะรอเวลาจริงของตัวเอง

### D3: เขียนตัวจับคู่ cron expression เองใน `api/lib/cron-runner.php`
ไม่เพิ่ม composer dependency (เช่น `dragonmantank/cron-expression`) เพราะโปรเจกต์ deploy บน XAMPP ด้วยการ copy ไฟล์ และ `composer.json` ปัจจุบันมีแค่ 2 แพ็กเกจ — เพิ่ม vendor tree เพื่อฟังก์ชันประมาณ 40 บรรทัดไม่คุ้ม

รองรับเฉพาะ 5 ฟิลด์และไวยากรณ์ `*`, `N`, `*/N`, `A-B`, `A,B,C` (รวมกันได้ เช่น `0,30 9-17 * * 1-5`) นอกนั้น validate ไม่ผ่านและตอบ 422 — ไม่ยอมรับเงียบ ๆ แล้วแปลผลผิด งานทั้ง 7 งานที่มีอยู่แปลงเป็นไวยากรณ์ชุดนี้ได้ครบ

การคำนวณ `next_run_at` ใช้วิธีเดินหน้าทีละนาทีจากนาทีถัดไปจนเจอนาทีที่ match โดยจำกัดเพดานการค้นหาไว้ (เพื่อไม่ให้ expression ที่ match ไม่ได้เลย เช่น `0 0 30 2 *` วนไม่จบ) ถ้าเกินเพดานให้ถือว่า expression ใช้ไม่ได้และบันทึกเป็น error ของงานนั้น ไม่ใช่ทำให้ tick ทั้งรอบล้ม

### D4: ย้าย `runJob()` ทั้งก้อนไปไฟล์ใหม่ ไม่เขียนใหม่
`api/lib/cron-runner.php` รับ `runJob()` มาแบบยกมาทั้งฟังก์ชัน แล้ว `api/cron-manager.php` เปลี่ยนเป็น `require_once` + เรียกใช้ ไม่แก้พฤติกรรมภายใน (รวมทั้ง `preg_match` อ่าน `"N entries"`/`"N error"` ที่หยาบแต่ใช้อยู่) — การปรับปรุงวิธีอ่านผลลัพธ์เป็นเรื่องแยก ไม่อยู่ใน change นี้

ไฟล์ใหม่จะมีเพิ่มแค่: ค่าคงที่เพดานเวลา "ค้าง", `cron_secret()`, `cron_expr_validate()`, `cron_expr_matches()`, `cron_next_run()`

### D5: กันงานทับซ้อนด้วยแถว `cron_runs` ที่ยังเปิด และใช้เพดานเดียวกับ UI
`jobState()` ใน `cron-manager.php` ถือว่างานที่เริ่มมาเกิน 600 วินาทีและยังไม่จบคือ `stuck` อยู่แล้ว จึงใช้ค่าเดียวกันเป็นค่าคงที่ใน `cron-runner.php` และให้ทั้ง `jobState()` และ tick อ่านจากที่เดียว — ถ้าใช้ค่าต่างกัน หน้าแอดมินจะบอกว่า "running" ขณะที่ tick ยิงซ้อนไปแล้ว

`runJob()` เดิมมีขั้น "ปิดแถวค้างก่อนเริ่ม" อยู่แล้ว (`Force-restarted after timeout`) การกันซ้อนจึงอยู่ที่ **ตัวเลือกงานใน tick** คือข้ามงานที่มีแถวเปิดค้างและยังไม่เกินเพดาน ไม่ใช่ไปแก้ `runJob()`

### D6: tick รันได้ทั้ง CLI และ HTTP โดยยึด CLI เป็นทางหลัก
ทำตามแบบ `api/cron-publish.php` ที่ตรวจ `php_sapi_name() === 'cli'` — Windows Task Scheduler เรียกแบบ CLI จึงไม่พึ่ง Apache และไม่ติดเพดาน curl 120 วินาที ทาง HTTP เก็บไว้สำหรับตรวจสอบด้วยมือและต้องมี token ตรงกับ `CRON_SECRET` เท่านั้น

### D7: รวม fallback ของ `CRON_SECRET` ไว้ที่ฟังก์ชันเดียว และคงค่า literal เดิมไว้เป็นชั้นสุดท้าย
`cron_secret()` อ่านตามลำดับ `getenv('CRON_SECRET')` → `$_ENV['CRON_SECRET']` → `'flowstack-cron-2026'` แล้วทั้ง `cron-manager.php`, `cron-publish.php`, `tick.php` เรียกฟังก์ชันนี้

คงค่า literal ชั้นสุดท้ายไว้เพราะ `api/notification-dispatch.php` ใช้ค่านี้เป็น fallback อยู่แล้ว ถ้าตัดออกทันทีงานแจ้งเตือนจะพังในเครื่องที่ยังไม่มี `.env` ที่อัปเดต — **ข้อสังเกตที่ต้องบันทึกไว้: secret ที่ hardcode อยู่ใน repo คือจุดอ่อนด้านความปลอดภัยที่มีอยู่ก่อน change นี้** วิธีแก้จริงคือบังคับให้ต้องมี `CRON_SECRET` แล้วเอา literal ออก ซึ่งควรทำเป็นงานแยกพร้อมประกาศให้ผู้ดูแลระบบตั้งค่าก่อน

### D8: ปิด `cron-publish` แทนที่จะซ่อมมัน
`cron-publish` อ่าน `content_schedules` + `content_plan_items` ซึ่งเป็นไปป์ไลน์รุ่นก่อน — ตารางนี้มีทั้งหมด 2 แถว (`sent` 1, `failed` 1) และ pending = 0 ขณะที่คิวที่ใช้จริงคือ `content_publish_queue` ผ่าน `publish-scheduler` ถ้าเปิดตัวตั้งเวลาโดยไม่ปิดงานนี้จะได้แถว `cron_runs` เปล่า 1,440 แถว/วัน และถ้าอนาคตมีแถวใน `content_schedules` จะกลายเป็นเผยแพร่ซ้ำจากสองเส้นทางที่ไม่รู้จักกัน ตั้ง `enabled=0` ไว้ ยังกดรันมือได้ถ้าจำเป็น

### D9: ป้องกัน `$db` ถูกทับจากไฟล์งานที่ include
ไฟล์งานแบบ include ตั้ง `$db = getDB();` ที่ global scope ซึ่งอยู่ใน scope เดียวกับตัวแปรใน `runJob()` — วันนี้ไม่พังเพราะค่าที่ทับเป็น PDO ตัวเดิม (getDB เป็น static singleton) แต่เป็นการพึ่งความบังเอิญ ใน `cron-runner.php` จะเรียก `$db = getDB();` ใหม่หลัง `include` เสร็จ (ราคาเป็นศูนย์เพราะ singleton) และเก็บ `$runId`/`key` ในตัวแปรที่ตั้งชื่อกันชนไว้ก่อน include

### D10: ใช้นาฬิกาของ MariaDB ตัวเดียวในเส้นทาง cron — ห้ามใช้ `time()`/`date()` ของ PHP
**พบตอน implement:** PHP บนเครื่องนี้ใช้ `date.timezone = Europe/Berlin` (ค่าตั้งต้นของ XAMPP) ขณะที่ MariaDB ใช้เวลาระบบ UTC+7 — ห่างกัน 5 ชั่วโมง (`SELECT TIMEDIFF(NOW(), UTC_TIMESTAMP())` = `07:00:00`, `time() - strtotime(NOW())` = `-18000`) ถ้าเขียน tick ด้วย `time()`/`date()` ตามปกติจะเกิดสามอาการพร้อมกัน:

1. `next_run_at` ถูกคำนวณและเขียนในกรอบ Berlin → `30 7 * * *` ยิงตอน 12:30 ตามเวลาจริง ผิดความหมายของตารางเวลา
2. `last_run_at` (เขียนด้วย `NOW()` ของ MySQL) กับ `next_run_at` (เขียนด้วย PHP) ขัดกันเองในแถวเดียว
3. `time() - strtotime(started_at)` ติดลบ ~18000 เสมอ → **เพดาน "ค้าง" ไม่เคยถึง** ทั้งในการกันงานซ้อนของ tick และใน `jobState()` ของหน้าแอดมิน (หน้าแอดมินจะไม่เคยแสดง `stuck` เลย — บั๊กนี้มีอยู่ก่อน change นี้)

หลักฐานว่ากระทบจริง: รอบทดสอบแรกที่ยังใช้ `time()` ตั้ง `billing-reminders` เป็น `2026-08-24 09:00` ซึ่ง**เป็นเวลาในอดีตแล้ว** (เวลาจริงตอนนั้น 13:47) → งานส่งอีเมลแจ้งหนี้จะยิงทันทีในรอบถัดไป ทั้งที่ควรรอถึงเช้าวันรุ่งขึ้น

**ข้อตกลงที่เลือก:** ในเส้นทาง cron ทั้งหมด เวลา "เดี๋ยวนี้" มาจากฐานข้อมูล และการเทียบอายุเวลาทำด้วย SQL:
- `cron_now(PDO $db): int` → `SELECT UNIX_TIMESTAMP()` (instant สัมบูรณ์ ไม่ต้องแปลงเขตเวลา)
- `cron_timezone(PDO $db): DateTimeZone` → อ่าน offset จริงจาก `TIMEDIFF(NOW(), UTC_TIMESTAMP())` แล้วสร้าง `DateTimeZone` แบบ **offset คงที่** ไม่ hardcode `Asia/Bangkok` เพื่อไม่ให้เพี้ยนเงียบ ๆ เมื่อย้ายเครื่อง และเพราะ offset คงที่ไม่มี DST จึงไม่มีชั่วโมงที่ซ้ำหรือหายตอนเดินหน้าทีละนาทีใน `cron_next_run()` (`DateTimeZone` รับ `+07:00`/`+05:30` ได้ ต่างจาก `date_default_timezone_set()` ที่ไม่รับ)
- `cron_expr_matches()` / `cron_next_run()` รับ `?DateTimeZone` เข้ามา แทนที่จะพึ่งเขตเวลาปัจจุบันของ PHP
- "ถึงกำหนด" คำนวณฝั่ง SQL: `(next_run_at IS NOT NULL AND next_run_at <= NOW()) AS is_due`
- การกันซ้อนใช้ `TIMESTAMPDIFF(SECOND, started_at, NOW()) < CRON_STUCK_SECONDS` ใน WHERE ไม่คำนวณใน PHP
- `jobState()` อ่าน `TIMESTAMPDIFF(SECOND, started_at, NOW()) AS age_seconds` ที่ `mergeLastRun()` ดึงมาให้ แทน `time() - strtotime()`

เลือกวิธีนี้แทนการตั้ง `date_default_timezone_set()` ทั่วแอป เพราะการเปลี่ยนเขตเวลา PHP ทั้งระบบกระทบทุก `date()` ในทุก endpoint — เป็น refactor คนละขนาดกับ change นี้ (patch ไม่ refactor) และผลข้างเคียงประเมินไม่ได้ในขอบเขตนี้

## Risks / Trade-offs

- **เปิดตัวตั้งเวลาแล้วงานที่เงียบ 2.5 เดือนทำงานพร้อมกัน** — `notification-dispatch` ส่ง LINE/Telegram, `billing-reminders` ส่งอีเมล, `recurring-tasks` สร้าง task → **Mitigation:** `next_run_at IS NULL` ไม่รันในรอบแรก (D2) และขั้นตอนตรวจใน tasks.md เปิดทีละงานโดยเริ่มจาก `publish-scheduler` และ `content-metrics-sync` ก่อน งานที่ส่งออกภายนอกให้ตรวจแยกก่อนปล่อย
- **PHP fatal error ในไฟล์งานหนึ่งทำให้ tick ทั้งรอบตาย** เพราะ `type='include'` รันในโปรเซสเดียวกัน `try/catch Throwable` จับ fatal ไม่ได้ทุกชนิด → **Mitigation:** งานถูก `include` เรียงกันหลังบันทึก `cron_runs` แล้ว งานที่ตายจะเหลือแถวเปิดค้างให้เห็นในหน้าแอดมิน และรอบถัดไป (1 นาที) จะเริ่มใหม่ ทางแก้ที่แข็งกว่าคือ spawn โปรเซสแยกต่องาน — อยู่นอกขอบเขต change นี้ (patch ไม่ refactor)
- **ชื่อฟังก์ชันซ้อนกันระหว่างไฟล์งานที่ include ในรอบเดียว** จะทำให้ fatal `Cannot redeclare` — ตรวจแล้วปัจจุบันไม่ซ้ำ (`isCancelled` ใน publish-scheduler, `metricsSyncCancelled` ใน content-metrics-sync, `sendReminderEmail` ใน billing-reminders, ai-digest ไม่ประกาศฟังก์ชัน) → **Mitigation:** เพิ่มข้อตกลงว่าไฟล์งานใหม่ต้องตั้งชื่อฟังก์ชันมี prefix ของงานตัวเอง และบันทึกความเสี่ยงนี้ไว้ใน `cron-runner.php`
- **ตัวจับคู่ cron ที่เขียนเองอาจแปลผลผิด** → **Mitigation:** validate เข้มและปฏิเสธไวยากรณ์ที่ไม่รองรับ (422) พร้อมทดสอบ `cron_next_run()` กับทั้ง 7 expression ที่ migration เติมให้ ว่าได้เวลาที่ตรงกับความหมายของ `interval_label` เดิม
- **`preg_match` อ่าน `"N entries"`/`"N error"` จาก output ยังหยาบ** — งานที่พิมพ์ข้อความไม่ตรงรูปแบบจะรายงาน `records_processed=0` แม้ทำงานจริง → **Trade-off:** ยอมรับตามเดิม เพราะเป็นพฤติกรรมที่มีอยู่ก่อนและการแก้จะกระทบทุกไฟล์งาน อยู่นอกขอบเขต
- **ต้องรัน `scripts/register-cron-task.bat` ด้วยสิทธิ์ Administrator หนึ่งครั้ง** ถ้าไม่ทำ ทุกอย่างใน change นี้จะยังไม่ทำงานอัตโนมัติ → **Mitigation:** ระบุเป็น task ที่ต้องยืนยันด้วย `schtasks /query` และให้หน้าแอดมินแสดงสถานะที่มองออกว่างานไม่ได้ถูกเรียกตามเวลา
- **เขตเวลา PHP กับ MariaDB ยังต่างกัน 5 ชั่วโมงหลัง change นี้** — D10 แก้เฉพาะเส้นทาง cron ให้ยึดนาฬิกา DB ส่วนโค้ดอื่นยังใช้ `date()` ของ PHP อยู่ ที่พบชัดคือ `api/content-publish.php:162` เขียน `scheduled_at = date('Y-m-d H:i:s')` (เวลา Berlin) ขณะที่ `sent_at = NOW()` เป็นเวลา DB ในแถวเดียวกัน และไฟล์งานพิมพ์ log ด้วยเวลา Berlin (`[09:20:07]` ขณะเวลาจริง 14:20:07) → **Trade-off:** ไม่แก้ใน change นี้เพราะอยู่ในตรรกะการเผยแพร่ที่ Non-Goals กันไว้ และไม่กระทบ DoD (ข) เพราะ `created_at`/`sent_at` ที่ใช้วัดต่างเขียนด้วย `NOW()` ทั้งคู่ ต้องเปิดเป็นงานแยกให้ทั้งแอปใช้นาฬิกาเดียว

## Migration Plan

1. Migration `ALTER TABLE cron_jobs` เพิ่ม `cron_expression VARCHAR(100) NULL`, `last_run_at DATETIME NULL`, `next_run_at DATETIME NULL`
2. `UPDATE` เติม `cron_expression` 7 แถวตาม `interval_label` เดิม และตั้ง `enabled=0` ให้ `cron-publish` — `next_run_at` ปล่อย NULL โดยเจตนา
3. ตรวจด้วย `SHOW COLUMNS FROM cron_jobs` และ `SELECT key, interval_label, cron_expression, enabled FROM cron_jobs`
4. เพิ่ม `CRON_SECRET` ใน `.env`
5. เพิ่ม `api/lib/cron-runner.php`, แก้ `api/cron-manager.php` และ `api/cron-publish.php`, เพิ่ม `api/cron/tick.php`
6. รัน `php api/cron/tick.php` ครั้งที่ 1 → ต้องได้ initialize `next_run_at` และไม่มีงานใดรัน
7. รัน `php api/cron/tick.php` ครั้งที่ 2 (หลังผ่านนาที) → ต้องเห็นแถว `cron_runs` ของ `publish-scheduler`
8. ลงทะเบียน Windows Task Scheduler ด้วย `scripts/register-cron-task.bat` แล้วยืนยันด้วย `schtasks /query`
9. แก้ `src/components/admin/CronJobsPanel.tsx` แล้ว `pnpm lint` + `pnpm build`

**Rollback:** ปิด/ลบ task ใน Task Scheduler (ตัวตั้งเวลาหยุดทันที ไม่มีโปรเซสค้าง) คอลัมน์ที่เพิ่มเป็น NULL ได้ทั้งหมดและไม่มีโค้ดเดิมอ่าน จึงปล่อยไว้ได้ไม่ต้อง DROP ถ้าต้องย้อนโค้ด ให้คืน `runJob()` กลับเข้า `cron-manager.php` — ปุ่มรันมือของแอดมินจะกลับไปทำงานเหมือนก่อน change นี้ทุกประการ

## Open Questions

- ควรเปิด `notification-dispatch`, `billing-reminders`, `recurring-tasks` ให้ทำงานอัตโนมัติเลย หรือปิดไว้ (`enabled=0`) จนตรวจเนื้อหาที่ส่งออกเสร็จก่อน — change นี้ไม่แตะ `enabled` ของสามงานนี้ ต้องตัดสินใจก่อนขั้นลงทะเบียน OS task
- เพดานเวลา "ค้าง" 600 วินาทีเหมาะกับงานรอบ 1 นาทีหรือไม่ — งานที่ค้างจะกินเวลา 10 นาทีก่อนถูกเริ่มใหม่ ยังไม่มีข้อมูลเวลารันจริงเพราะไม่เคยรันตามรอบ ควรวัดจากประวัติ `cron_runs` หลังเปิดใช้แล้วค่อยปรับ
