## 1. สำรวจก่อนแก้ (กันของที่ชดเชยความคลาดไว้เงียบ ๆ)

- [x] 1.1 grep หา offset ที่ hardcode ไว้ทั้ง repo (`18000`, `5 * 3600`, `INTERVAL 5 HOUR`, `+ 5 hours`, `-5 hours`) เพื่อยืนยันว่าไม่มีโค้ดใดชดเชยความคลาด 5 ชั่วโมงไว้เอง — ถ้าเจอ ต้องแก้พร้อมกันในข้อ 3 ไม่งั้นจะกลายเป็นคลาด 10 ชั่วโมง
  - **ผล: ไม่มีโค้ดชดเชย** — `18000` และ `Europe/Berlin` พบเฉพาะใน**คอมเมนต์**ที่ `api/lib/cron-runner.php:52,56` ซึ่งอธิบายเหตุผลของกฎ "ห้ามใช้ `time()` ในเส้น cron" ไม่ใช่การบวกลบชดเชย ส่วน `5*3600`, `INTERVAL 5 HOUR`, `CONVERT_TZ` ไม่พบเลยในโค้ด (`api/`, `src/`, `scripts/`, `database/migrations/`)
  - คอมเมนต์นั้นจะกลายเป็นข้อความที่ไม่ตรงความจริงหลังแก้ → ต้องเพิ่มหมายเหตุว่ารากถูกแก้แล้วแต่กฎยังคงอยู่ (ทำในข้อ 2.5)
- [x] 1.2 ตรวจ `agent_api_keys` และตาราง subscription ว่ามีแถวที่ `expires_at` อยู่ในกรอบ 5 ชั่วโมงข้างหน้าหรือไม่ (แถวเหล่านี้จะถูกตัดสิทธิ์ทันทีเมื่อนาฬิกาถูกต้อง) — ถ้ามี บันทึกรายการไว้แจ้งเจ้าของระบบ ห้ามเลื่อนวันหมดอายุให้เอง
  - **ผล: ไม่มีใครถูกตัดกลางทาง** — `agent_api_keys` ว่างเปล่า (0 แถว); `subscriptions` มี 3 แถว โดย 2 แถว `trial` หมดอายุไปแล้วตั้งแต่ 2026-07-10 และ 2026-07-14 (เกิน 6 สัปดาห์ ไม่ได้อยู่ในกรอบ 5 ชั่วโมง จึงไม่มีการเปลี่ยนพฤติกรรม) และอีก 1 แถว `pro` มี `expires_at IS NULL`
  - หมายเหตุแยกเรื่อง (ไม่อยู่ในขอบเขต change นี้): 2 แถว `trial` ที่หมดอายุแล้วยังมี `status='active'` ในฐานข้อมูล — `api/billing/status.php:26` คำนวณตอนอ่านแต่ไม่เขียนกลับ
- [x] 1.3 บันทึกค่าตั้งต้นไว้เทียบผลทีหลัง: `curl -s http://localhost/flowstack/api/health.php` (คาดว่า `minutes_ago` ติดลบ), `php -r "echo date('Y-m-d H:i:s');"` และ `SELECT NOW()`
  - **BASELINE 2026-08-25 09:56:01 (นาฬิกาฐานข้อมูล):** PHP `date()` = `2026-08-25 04:56:01` (`tz=Europe/Berlin`) / DB `NOW()` = `2026-08-25 09:56:01` → คลาด 5 ชั่วโมงพอดี
  - `health.php`: `minutes_ago: -299`, `cron_last_run.status: "ok"` (ทั้งที่ค่าติดลบ), `timestamp: "2026-08-25T04:56:01+02:00"`

## 2. bootstrap เขตเวลา

- [x] 2.1 เพิ่มคีย์ `APP_TIMEZONE=Asia/Bangkok` ลง `.env` (ไฟล์นี้ gitignore อยู่ — เครื่องอื่นได้ค่าเดียวกันจาก fallback)
  - สำรองไว้ที่ `.env.bak-clocktz` ซึ่ง `.gitignore:7` (`.env.*`) ครอบอยู่ — ยืนยันด้วย `git check-ignore -v` แล้วว่า secret ไม่รั่วเข้า git
- [x] 2.2 เพิ่ม `date_default_timezone_set()` ใน `api/config.php` หลังบล็อกโหลด `.env` (บรรทัด 15-31) และก่อน `define('DB_HOST', ...)` — อ่านจาก `getenv('APP_TIMEZONE') ?: ($_ENV['APP_TIMEZONE'] ?? 'Asia/Bangkok')` ตรวจด้วย `new DateTimeZone()` ใน `try/catch` แล้วถอยไป `'Asia/Bangkok'` ตามแบบ `api/capacity.php:53-60` พร้อมคอมเมนต์อธิบายว่าทำไมไม่พึ่ง `php.ini`
  - `api/config.php:34-56` — คอมเมนต์ครอบทั้งสองอาการ (เขียนผิด/อ่านผิด) และเหตุผลที่ไม่พึ่ง `php.ini`
- [x] 2.3 ยืนยันว่า `date('Y-m-d H:i:s')` หลังโหลด `config.php` ต่างจาก `SELECT NOW()` ไม่เกิน 2 วินาที
  - **ผล: `gap = 0s` PASS** — `tz=Asia/Bangkok`, php `2026-08-25 09:58:26`, db `2026-08-25 09:58:26`
- [x] 2.4 ยืนยันว่า `APP_TIMEZONE` ที่ผิดรูปแบบ (เช่น `Mars/Olympus`) ยังได้ `Asia/Bangkok` และ endpoint ไม่ตอบ 500
  - **ผล: PASS ทั้งสองทาง** — CLI ด้วย `APP_TIMEZONE=Mars/Olympus` ได้ `Asia/Bangkok`; ตั้งค่าผิดใน `.env` จริงแล้วยิง `GET /api/projects.php` ได้ HTTP **401** `{"error":"Unauthorized"}` ไม่ใช่ 500 → คืน `.env` กลับเป็น `Asia/Bangkok` และยืนยันแล้ว
- [x] 2.5 อัปเดตคอมเมนต์ `api/lib/cron-runner.php:50-58` (พบในข้อ 1.1) — ระบุว่ารากของความคลาดถูกแก้ที่ `api/config.php` แล้ว แต่กฎ "ในเส้น cron เวลาต้องมาจากฐานข้อมูล" ยังคงอยู่เพราะไม่ควรขึ้นกับการตั้งค่า runtime — ไม่แก้ตรรกะใด ๆ ในไฟล์นั้น
  - `api/lib/cron-runner.php:50-63` — เพิ่มย่อหน้าว่ารากถูกแก้แล้วและกฎยังคงอยู่ เพราะเส้น cron ไม่ควรพังได้ด้วยการแก้ค่าตั้งค่าเพียงบรรทัดเดียว

## 3. เส้นเผยแพร่ใช้นาฬิกาฐานข้อมูล

- [x] 3.1 `api/content-publish.php:161-166` — ลบ `$now = date('Y-m-d H:i:s')` แล้วเปลี่ยน INSERT เป็น `VALUES (?,?,?,?,NOW(),?)` ตัด `$now` ออกจาก array ที่ส่งเข้า `execute()` พร้อมคอมเมนต์ว่าคอลัมน์นี้ถูกเทียบด้วย `NOW()` ใน `publish-scheduler.php:30`
  - `api/content-publish.php:161-171` — คอมเมนต์อ้างทั้งจุดที่เทียบ (`publish-scheduler.php:30`) และจุดที่เขียนทับตอน retry (`DATE_ADD(NOW(), INTERVAL 5 MINUTE)` บรรทัด 131) เพื่อให้เห็นว่าคอลัมน์นี้ต้องเป็นนาฬิกาเดียว
- [x] 3.2 `api/lib/publish-dispatch.php:516` — เปลี่ยน fallback ของ `'Date'` จาก `date('Y-m-d H:i:s')` เป็นค่าที่อ่านจากฐานข้อมูลผ่าน `getDB()` (PDO เป็น `static` ใน `config.php:112-124` จึงใช้ connection เดิมซ้ำ)
  - เพิ่ม helper กลาง `dbNow(?PDO $db = null): string` ที่ `api/config.php:148-170` — คืน `SELECT NOW()` ของฐานข้อมูล, รับ `$db` ที่มีอยู่แล้วได้, ถอยไป `date()` พร้อม `error_log` ถ้า query ล้ม (ไม่โยน exception เพราะจะทำให้การเผยแพร่ล้มทั้งรายการด้วยเรื่องเวลาอย่างเดียว)
  - `api/lib/publish-dispatch.php:514-519` — `'Date' => !empty($seo['date']) ? $seo['date'] : dbNow()` คงลำดับความสำคัญเดิม
  - ยืนยันรันจริง: `dbNow()`, `dbNow($db)` และ `SELECT NOW()` ให้ค่าเดียวกัน `2026-08-25 10:08:06` → `gap = 0s`
- [x] 3.3 `api/brand-content.php:2316` และ `:2590` — เปลี่ยน fallback ของ `$publishDate`/`$scDate` แบบเดียวกับ 3.2 คงลำดับความสำคัญเดิมไว้ (ค่าที่ตั้งไว้มาก่อนเสมอ)
  - ใช้ `dbNow($db)` ทั้งสองจุด (ไฟล์นี้ `require` `publish-dispatch.php` แบบ lazy ที่บรรทัด 3260/3272 ซึ่งอยู่ **หลัง** จุดเผยแพร่ทั้งสอง → helper ต้องอยู่ใน `config.php` ไม่ใช่ `publish-dispatch.php`) ยืนยันแล้วว่า `$db` อยู่ใน scope ทั้งสองจุด (global scope, ไม่มี `function` ครอบระหว่างบรรทัด 2184-2424 และ 2461-2663)
- [x] 3.4 grep ยืนยันว่าไม่มี `date('Y-m-d H:i:s')` เหลือใน `api/content-publish.php`, `api/lib/publish-dispatch.php` และจุดเผยแพร่ของ `api/brand-content.php`
  - **ผล: ไม่เหลือเลยทั้ง 3 ไฟล์** (ตรวจ `api/cron/publish-scheduler.php` เพิ่มด้วย — ก็ไม่มี) และ `php -l` ผ่านทั้ง 4 ไฟล์ที่แก้

## 4. health check

- [x] 4.1 `api/health.php:60-78` — เปลี่ยนการคำนวณอายุจาก `time() - strtotime($row['finished_at'])` เป็น `TIMESTAMPDIFF(MINUTE, finished_at, NOW())` ใน SQL query เดิม
  - `api/health.php:69-97` — เพิ่มคอลัมน์ `minutes_ago` ใน query เดิม (ไม่เพิ่ม query ใหม่) และตัด `strtotime()` ออก คอมเมนต์อ้างเหตุการณ์คืน 24 ส.ค. 2026 ที่ cron ตาย 15 ชม. แต่ไม่มีเตือน
  - พิสูจน์ว่าเพดาน STALE ยิงได้จริงแล้ว: แถวเก่าสุดใน `cron_runs` (`2026-06-08 06:02:45`) ได้ `minutes_ago = 112568` → `would_report = STALE` (ก่อนแก้ ค่าติดลบเสมอจึงไม่เคยถึงเพดาน)
- [x] 4.2 `api/health.php` — เพิ่ม `date_default_timezone_set()` ในไฟล์ (ใช้ค่าจาก `.env` ที่โหลดเองอยู่แล้วที่บรรทัด 9-21) เพื่อให้ `date('c')` ที่บรรทัด 96 รายงาน offset ถูก — คงเจตนาเดิมที่ไฟล์นี้ไม่ require `config.php` ไว้ พร้อมคอมเมนต์ว่าทำไมจึงยอมให้ตรรกะซ้ำ
  - `api/health.php:22-37` — คอมเมนต์ระบุเหตุผลชัด: `config.php` `exit` 500 ทันทีถ้า `JWT_SECRET` หาย ตัวตรวจสุขภาพที่ตายพร้อมระบบที่มันต้องตรวจนั้นไร้ประโยชน์ จึงยอมแลกความซ้ำ 6 บรรทัดกับความเป็นอิสระ
- [x] 4.3 ยืนยันด้วย `curl -s http://localhost/flowstack/api/health.php` ว่า `minutes_ago` เป็นบวก และ `timestamp` ลงท้าย `+07:00`
  - **ผล: PASS** — HTTP 200, `minutes_ago: 0` (cron เพิ่งจบไป 5 วินาที ไม่ติดลบแล้ว), `finished_at: "2026-08-25 10:11:02"`, `timestamp: "2026-08-25T10:11:07+07:00"`, `errors: 0`

## 5. สคริปต์ตรวจ

- [x] 5.1 สร้าง `scripts/test-app-clock-timezone.php` ตามรูปแบบ `scripts/test-publish-dispatch-hardening.php` (กัน non-CLI ด้วย `PHP_SAPI !== 'cli'`, require `api/config.php`, ฟังก์ชัน `check()` นับ PASS/FAIL, สรุปท้ายไฟล์, `exit(1)` เมื่อมี FAIL)
  - อ่านอย่างเดียว ไม่แก้ข้อมูลใด ๆ จึงไม่ต้องมีส่วน cleanup (ต่างจากสคริปต์ hardening ที่สร้าง channel/content จริง)
- [x] 5.2 ครอบคลุมอย่างน้อย: PHP เทียบ DB ไม่เกิน 2 วินาที, `date_default_timezone_get()` ตรงกับที่ตั้งไว้, `strtotime()` ของค่าจากคอลัมน์ DATETIME เทียบกับ `time()` ได้ผลต่างเป็นบวกและสมเหตุสมผล, `api/health.php` คืน `minutes_ago` เป็นบวก
  - 15 ข้อใน 7 กลุ่ม: C1 bootstrap, C2 offset PHP เท่ากับ offset ฐานข้อมูลพอดี, C3 ฝั่งเขียน, C4 `dbNow()`, C5 ฝั่งอ่าน (อายุ 1 นาทีต้องได้ 55-65 วินาที), C6 การตัดสินหมดอายุทั้งสองทาง (รูปแบบเดียวกับ `agent-auth.php:94` / `billing/status.php:26`), C7 `health.php`
- [x] 5.3 รัน `php scripts/test-app-clock-timezone.php` ให้ผ่านทุกข้อและ exit code เป็น 0
  - **ผล: PASS 15 / FAIL 0, exit=0**
  - **ตรวจย้อนว่าสคริปต์จับ regression ได้จริง** — ตั้ง `APP_TIMEZONE=Europe/Berlin` ใน `.env` ชั่วคราวแล้วรันซ้ำ ได้ **FAIL 6, exit=1** พร้อมลายเซ็นของบั๊กเดิมครบ: `gap=18000s`, `age=-17940s`, C6 ตัดสินว่ากุญแจที่หมดอายุไปแล้ว 1 ชม. ยังใช้ได้, `timestamp` ลงท้าย `+02:00` → คืน `.env` กลับและรันซ้ำได้ PASS 15 / FAIL 0
  - หลักฐานว่า D4/D5 ได้ผลตามเจตนา: ในรอบที่ตั้งค่าผิดนั้น **C4 (`dbNow()`) และ C7 (`minutes_ago`) ยัง PASS** เพราะสองจุดนั้นถูกต้องโดยโครงสร้าง (นาฬิกาฐานข้อมูล/`TIMESTAMPDIFF`) ไม่ใช่โดยการตั้งค่า

## 6. ตรวจงานรวม

- [x] 6.1 ทดสอบเส้นเผยแพร่ด้วย mock ที่มีอยู่: `php scripts/test-publish-dispatch-hardening.php` ต้องยังผ่านเท่าเดิม (ไม่มี traffic ออก production)
  - **ผล: PASS 32 / FAIL 0, exit=0** เท่าเดิม (U1-U4, E1-E5) — ปลายทางเป็น mock ในเครื่องทั้งหมด
- [x] 6.2 ตรวจว่า `scheduled_at` ของแถวที่สร้างจาก `send_now` ในการทดสอบข้างต้น ต่างจาก `NOW()` ไม่เกิน 2 วินาที
  - **ผล: drift = 0s PASS** — ยิง `send_now` จริงผ่าน HTTP (channel ชี้ mock 200) ได้ HTTP 200 / `status=sent` และในแถวเดียวกัน `scheduled_at` = `created_at` = `sent_at` = `2026-08-25 10:20:50` = `NOW()` ทุกค่า (ก่อนแก้ `scheduled_at` จะเป็น 05:20:50 ขัดกับ `created_at` 10:20:50 ในแถวเดียวกัน) — ลบข้อมูลทดสอบทิ้งแล้ว
- [x] 6.3 ตรวจว่า cron ยังเดินปกติหลังแก้ — มีแถว `cron_runs` ใหม่ภายใน 2 นาที และ `errors=0`
  - **ผล: PASS** — `publish-scheduler` เดินติดกันทุก 1 นาที (10:16:02 → 10:21:02), `errors=0` ทุกแถว, ช่วง 2 นาทีล่าสุดมี 2 รอบ / 0 error
- [x] 6.4 `pnpm lint` และ `pnpm build` ผ่าน (change นี้ไม่แตะฝั่ง frontend แต่ต้องยืนยันว่าไม่มีอะไรพังตามกฎ VERIFY BEFORE DONE)
  - `pnpm lint`: **0 errors**, 46 warnings — เป็น `react-hooks/exhaustive-deps` ของหน้าเดิมทั้งหมด มีอยู่ก่อน change นี้และไม่เกี่ยวกับไฟล์ที่แก้ (change นี้แตะ PHP เท่านั้น)
  - `pnpm build`: **✓ built in 15.67s** สร้าง `dist/` ครบ (PWA precache 111 entries) คำเตือน chunk > 600 kB เป็นของเดิม
  - `php -l` ผ่านทั้ง 5 ไฟล์ที่แก้ (`config.php`, `content-publish.php`, `lib/publish-dispatch.php`, `brand-content.php`, `health.php`)
- [x] 6.5 บันทึกผลเทียบก่อน/หลังของข้อ 1.3 ลงในไฟล์นี้เป็นหลักฐาน

### ผลเทียบก่อน/หลัง

| สิ่งที่วัด | ก่อนแก้ (baseline 09:56) | หลังแก้ (10:11-10:21) |
|---|---|---|
| `date_default_timezone_get()` | `Europe/Berlin` (จาก `php.ini:1996`) | `Asia/Bangkok` (จาก `APP_TIMEZONE`) |
| PHP `date()` vs DB `NOW()` | `04:56:01` vs `09:56:01` → คลาด **18000 วินาที** | ตรงกันทุกครั้ง → **gap 0s** |
| `health.php` → `minutes_ago` | **-299** (ติดลบ) | **0** (ไม่ติดลบ) |
| `health.php` → `cron_last_run.status` | `"ok"` ทั้งที่ค่าติดลบ — เพดาน STALE ยิงไม่ได้เลย | `"ok"` เพราะ cron เพิ่งจบจริง และพิสูจน์แล้วว่าแถวเก่า (`2026-06-08`) ได้ `112568` นาที → `STALE` |
| `health.php` → `timestamp` | `2026-08-25T04:56:01+02:00` | `2026-08-25T10:11:07+07:00` |
| `content_publish_queue.scheduled_at` จาก `send_now` | เขียนด้วย `date()` → ตามหลัง `created_at` 5 ชม. ในแถวเดียวกัน | เขียนด้วย `NOW()` → `scheduled_at` = `created_at` = `sent_at` = `NOW()` |
| ฟิลด์ `Date` ที่ส่งให้ Lotus Domino | `date()` ของ PHP | `dbNow()` — ถูกต้องแม้ตั้ง `APP_TIMEZONE` ผิด (พิสูจน์ในข้อ 5.3) |
| การตัดสินหมดอายุ (`strtotime($exp) < time()`) | กุญแจ/แพ็กเกจที่หมดอายุแล้วยังใช้ได้ต่ออีก 5 ชม. | ตัดสินถูกทั้งสองทาง (C6) |
