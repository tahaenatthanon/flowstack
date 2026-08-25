## 1. Database Migrations

- [x] 1.1 สร้าง `database/migrations/YYYY_MM_DD_HHMMSS_add_cron_schedule_columns.sql` — `ALTER TABLE cron_jobs` เพิ่ม `cron_expression VARCHAR(100) NULL`, `last_run_at DATETIME NULL`, `next_run_at DATETIME NULL` (ทั้งสามคอลัมน์ต้อง NULL ได้ เพื่อให้ rollback ไม่ต้อง DROP)
- [x] 1.2 ใน migration เดียวกัน `UPDATE cron_jobs` เติม `cron_expression` ทั้ง 7 แถวให้ตรงกับ `interval_label` เดิม: `cron-publish`/`publish-scheduler` → `* * * * *`, `notification-dispatch` → `*/15 * * * *`, `recurring-tasks` → `0 0 * * *`, `ai-digest` → `30 7 * * *`, `billing-reminders` → `0 9 * * *`, `content-metrics-sync` → `0 */6 * * *` — ปล่อย `next_run_at` เป็น NULL โดยเจตนา (D2)
- [x] 1.3 ใน migration เดียวกัน ``UPDATE cron_jobs SET enabled=0 WHERE `key`='cron-publish'`` พร้อมคอมเมนต์เหตุผลตาม D8 (ไปป์ไลน์เก่าอ่าน `content_schedules` ซ้อนกับ `publish-scheduler`)
- [x] 1.4 รัน migration ด้วย `/c/xampp/mysql/bin/mysql.exe -u root flowstack < database/migrations/<filename>.sql` แล้วยืนยันด้วย `SHOW COLUMNS FROM cron_jobs` และ ``SELECT `key`, interval_label, cron_expression, enabled, next_run_at FROM cron_jobs`` — ต้องได้ `cron_expression` ไม่เป็น NULL ทุกแถว, `next_run_at` เป็น NULL ทุกแถว, `cron-publish` มี `enabled=0`, `publish-scheduler` ยังมี `enabled=1`

## 2. Shared Cron Runner

- [x] 2.1 สร้าง `api/lib/cron-runner.php` แล้วย้าย `runJob()` จาก `api/cron-manager.php` มาแบบยกทั้งฟังก์ชัน ไม่แก้พฤติกรรมภายใน (รวม `preg_match` อ่าน `"N entries"`/`"N error"`)
- [x] 2.2 เพิ่มค่าคงที่เพดานเวลา "ค้าง" (600 วินาที ตามที่ `jobState()` ใช้อยู่) ใน `api/lib/cron-runner.php` เพื่อให้ tick และหน้าแอดมินอ่านค่าเดียวกัน (D5)
- [x] 2.3 เพิ่ม `cron_secret()` ที่อ่านตามลำดับ `getenv('CRON_SECRET')` → `$_ENV['CRON_SECRET']` → `'flowstack-cron-2026'` พร้อมคอมเมนต์ระบุว่า literal ชั้นสุดท้ายคือจุดอ่อนที่มีอยู่ก่อนและควรถอดออกเป็นงานแยก (D7)
- [x] 2.4 เพิ่ม `cron_expr_validate(string $expr): bool` รับเฉพาะ 5 ฟิลด์และไวยากรณ์ `*`, `N`, `*/N`, `A-B`, `A,B,C` — ปฏิเสธ `L`, `W`, `#`, `?`, ชื่อเดือน/วัน และจำนวนฟิลด์ที่ไม่เท่ากับ 5 (D3)
- [x] 2.5 เพิ่ม `cron_expr_matches(string $expr, int $ts): bool` จับคู่นาที/ชั่วโมง/วันที่/เดือน/วันในสัปดาห์
- [x] 2.6 เพิ่ม `cron_next_run(string $expr, int $fromTs): ?string` เดินหน้าทีละนาทีจากนาทีถัดไปจนเจอนาทีที่ match พร้อมเพดานการค้นหา (คืน `null` เมื่อเกินเพดาน เพื่อไม่ให้ expression ที่ match ไม่ได้วนไม่จบ)
- [x] 2.7 เพิ่มคอมเมนต์ข้อตกลงใน `api/lib/cron-runner.php` ว่าไฟล์งานแบบ `type='include'` ต้องตั้งชื่อฟังก์ชันโดยมี prefix ของงานตัวเอง เพราะทุกงานถูก include ในโปรเซสเดียวกัน (ชื่อซ้ำ = fatal `Cannot redeclare`)
- [x] 2.8 ใน `runJob()` หลัง `include` เสร็จ เรียก `$db = getDB();` ใหม่ และเก็บ `$runId`/job key ในตัวแปรที่ตั้งชื่อกันชน เพื่อไม่ให้ไฟล์งานที่ตั้ง `$db` ที่ global scope ทับตัวแปรในฟังก์ชัน (D9)
- [x] 2.9 แก้ `api/cron-manager.php` ให้ `require_once __DIR__ . '/lib/cron-runner.php'` และลบ `runJob()` เดิมออก — ยืนยันว่าไม่มี `include` ไฟล์งานหรือ `curl_init` ไปยัง endpoint งานเหลืออยู่ในไฟล์นี้อีก
- [x] 2.10 แก้ `jobState()` ใน `api/cron-manager.php` ให้ใช้ค่าคงที่เพดานเวลาจาก `cron-runner.php` แทนเลข 600 ที่ฝังไว้

## 3. Cron Secret

- [x] 3.1 เพิ่ม `CRON_SECRET=<ค่าสุ่ม>` ใน `.env` (และเพิ่มคีย์นี้ใน `.env.example` ถ้าไฟล์นั้นมีอยู่) — ไม่มี `.env.example` ในโปรเจกต์นี้ จึงเพิ่มเฉพาะ `.env` (gitignored, untracked)
- [x] 3.2 แก้ `api/cron-publish.php` ให้ใช้ `cron_secret()` แทนการอ่าน `getenv('CRON_SECRET') ?: ($_ENV['CRON_SECRET'] ?? '')` แล้วตอบ 500 — ต้องไม่ตอบ `CRON_SECRET is not set` อีกเมื่อ `.env` มีคีย์แล้ว
- [x] 3.3 แก้ `api/cron-manager.php` ให้ใช้ `cron_secret()` แทน literal `'flowstack-cron-2026'` ที่ฝังไว้ใน `runJob()`
- [x] 3.4 ยืนยันว่า token ผิดยังถูกปฏิเสธด้วย 403: เรียก `GET /api/cron-publish.php?token=wrong` แล้วต้องได้ 403 ไม่ใช่ 500

## 4. Tick Entry Point

- [x] 4.1 สร้าง `api/cron/tick.php` ที่รันได้ทั้ง CLI และ HTTP — ตรวจ `php_sapi_name() === 'cli'` ตามแบบ `api/cron-publish.php` และฝั่ง HTTP ต้องยืนยัน token กับ `cron_secret()` มิฉะนั้นตอบ 403 (D6)
- [x] 4.2 ใน tick เลือกงานจาก `cron_jobs WHERE enabled=1` แล้วแยกเป็นสามกรณี: `next_run_at IS NULL` → คำนวณและเขียน `next_run_at` แต่ **ไม่รัน**; `next_run_at <= NOW()` → ถึงกำหนด; อื่น ๆ → ข้าม (D2)
- [x] 4.3 ใน tick ข้ามงานที่มีแถว `cron_runs` ที่ `finished_at IS NULL` และ `started_at` ยังไม่เกินเพดานเวลา พร้อมรายงานว่าข้ามเพราะกำลังทำงานอยู่ (D5)
- [x] 4.4 หลังรันงานสำเร็จหรือล้มเหลว อัปเดต `cron_jobs.last_run_at = NOW()` และ `next_run_at = cron_next_run(cron_expression, time())` — ถ้า `cron_next_run()` คืน `null` ให้บันทึกเป็น error ของงานนั้นและไม่ทำให้ tick รอบนั้นล้ม
- [x] 4.5 ให้ tick พิมพ์สรุปที่ระบุจำนวนงานที่ถึงกำหนด จำนวนที่รันสำเร็จ และจำนวนที่ล้มเหลว
- [x] 4.6 เพิ่มคอมเมนต์หัวไฟล์ระบุวิธีเรียกทั้งสองทาง (`php api/cron/tick.php` และ `GET /api/cron/tick.php?token=<CRON_SECRET>`) ตามแบบไฟล์ cron อื่นในโปรเจกต์

## 4b. Clock Alignment (พบตอน implement — D10)

- [x] 4b.1 เพิ่ม `cron_now(PDO $db): int` (`SELECT UNIX_TIMESTAMP()`), `cron_timezone(PDO $db): DateTimeZone` (อ่าน offset จริงจาก `TIMEDIFF(NOW(), UTC_TIMESTAMP())` เป็น offset คงที่ ไม่ hardcode ชื่อเขตเวลา) และ `cron_format(int $ts, DateTimeZone $tz): string` ใน `api/lib/cron-runner.php` พร้อมคอมเมนต์ข้อตกลงว่าเส้นทาง cron ห้ามใช้ `time()`/`date()` ของ PHP
- [x] 4b.2 แก้ `cron_expr_matches()` และ `cron_next_run()` ให้รับ `?DateTimeZone` แล้วตีความ timestamp ผ่าน `DateTimeImmutable::setTimezone()` แทน `date()` ที่พึ่งเขตเวลาปัจจุบันของ PHP
- [x] 4b.3 ใน tick คำนวณ "ถึงกำหนด" ฝั่ง SQL ด้วย `(next_run_at IS NOT NULL AND next_run_at <= NOW()) AS is_due` และกันซ้อนด้วย `TIMESTAMPDIFF(SECOND, started_at, NOW()) < CRON_STUCK_SECONDS` ใน WHERE แทนการเทียบใน PHP
- [x] 4b.4 แก้ `jobState()` + `mergeLastRun()` ใน `api/cron-manager.php` ให้ใช้ `TIMESTAMPDIFF(SECOND, started_at, NOW()) AS age_seconds` แทน `time() - strtotime()` — เดิมผลติดลบ ~18000 เสมอ ทำให้หน้าแอดมินไม่เคยแสดง `stuck`
- [x] 4b.5 ล้าง `next_run_at` ที่คำนวณด้วยเวลา PHP ออกทั้งหมด (`UPDATE cron_jobs SET next_run_at=NULL`) แล้วให้ tick ตั้งใหม่ในกรอบเวลาฐานข้อมูล — ยืนยันว่า `billing-reminders` ได้ `2026-08-25 09:00` ไม่ใช่เวลาในอดีต
- [x] 4b.6 ยืนยันว่า `cron_now($db)` ตรงกับ `UTC_TIMESTAMP()` ของ MySQL ต่างกัน 0 วินาที และ `cron_timezone()` คืน `+07:00`

## 5. OS Scheduler Registration

- [x] 5.1 สร้าง `scripts/register-cron-task.bat` ที่เรียก `schtasks /create` ให้รัน `php <repo>\api\cron\tick.php` ทุก 1 นาที พร้อมข้อความแจ้งว่าต้องรันด้วยสิทธิ์ Administrator — ใช้ `/SC MINUTE /MO 1 /RU SYSTEM /F`, หา repo root จาก `%~dp0..` (ไม่ hardcode), preflight 3 ชั้น (สิทธิ์ admin ด้วย `net session`, มี `php.exe`, มี `tick.php`) และแจ้งเมื่อจะแทนที่ task เดิม — ทดสอบรันแบบไม่มีสิทธิ์: หยุดที่ preflight พร้อมข้อความบอกให้คลิกขวา "Run as administrator" และ path ที่ resolve ได้ถูกต้อง (`C:\xampp\htdocs\flowstack\api\cron\tick.php`) ไม่มีการสร้าง task ใด ๆ (ข้อความในไฟล์ .bat เป็นภาษาอังกฤษตามสไตล์ `scripts/backup-mariadb.bat` เดิม เพราะ console ของ Windows ใช้ codepage 874/437 ซึ่งแสดงภาษาไทยเพี้ยน)
- [x] 5.2 ตัดสินใจและบันทึกไว้ว่าจะเปิด `notification-dispatch`, `billing-reminders`, `recurring-tasks` ให้ทำงานอัตโนมัติเลยหรือปิดไว้ก่อน (Open Question ใน design.md) — ต้องตัดสินก่อนลงทะเบียน task

  **การตัดสินใจ (เจ้าของระบบ, 2026-08-24): ปิดทั้งสามงานไว้ก่อน** — บันทึกเป็น migration `database/migrations/2026_08_24_171500_disable_outbound_cron_jobs.sql` (รันแล้ว) พร้อมเหตุผลและวิธีเปิดกลับในหัวไฟล์ ยืนยันด้วย `SELECT key, enabled FROM cron_jobs`: `notification-dispatch`/`billing-reminders`/`recurring-tasks` = 0, `publish-scheduler`/`content-metrics-sync`/`ai-digest` = 1, `cron-publish` = 0 (จากข้อ 1.3)
  - เหตุผล: ทั้งสามงานส่งของออกไปหาลูกค้าและทีมจริง (LINE/Telegram, อีเมลแจ้งหนี้, สร้าง task ชุดใหม่) หลังเงียบมา 2.5 เดือน ต้องมีคนตรวจเนื้อหาที่ค้างอยู่ก่อน — เปิดตัวตั้งเวลาโดยเหลือเฉพาะ `publish-scheduler` (ปลดล็อก DoD ข) และ `content-metrics-sync` (ปลดล็อกเฟส 2) ที่ไม่ส่งอะไรออกภายนอก
  - `ai-digest` ปล่อย `enabled=1` ไว้ตามเดิม — ตรวจ `api/cron/ai-digest.php` แล้วพบว่ามีแต่ `INSERT INTO ai_notifications` (แจ้งเตือนในแอป) ไม่มี LINE/Telegram/อีเมล/curl ออกภายนอก จึงไม่เข้าเงื่อนไขของการตัดสินใจนี้ (จะเริ่มสร้าง digest ให้ทุก user รอบแรก 2026-08-25 07:30)
- [x] 5.3 รัน `scripts/register-cron-task.bat` ด้วยสิทธิ์ Administrator แล้วยืนยันด้วย `schtasks /query` ว่ามี task ชี้ไป `api/cron/tick.php` และรอบเรียกทุก 1 นาที

  **ผล (2026-08-24 17:25–17:28): ลงทะเบียนสำเร็จและถูกเรียกจริง**
  - `schtasks /query /tn "Flowstack Cron Tick" /fo list /v` (รันแบบยกสิทธิ์) คืน: `Task To Run: "C:\xampp\php\php.exe" "C:\xampp\htdocs\flowstack\api\cron\tick.php"`, `Schedule Type: One Time Only, Minute`, `Repeat: Every: 0 Hour(s), 1 Minute(s)`, `Run As User: SYSTEM`, `Scheduled Task State: Enabled`, `Last Result: 0`
  - ยืนยันจากฝั่งฐานข้อมูลว่าถูกเรียกจริงไม่ใช่แค่มี task: `cron_runs` มีแถวของ `publish-scheduler` ต่อเนื่องทุกนาทีไม่ขาด (id 22–27 = 17:23:01, 17:24:01, 17:25:01, 17:26:01, 17:27:01, 17:28:01) ทุกแถว `finished_at` ไม่เป็น NULL และ `errors=0`
  - `cron_jobs.last_run_at` ของ `publish-scheduler` ขยับตามทุกนาที และ `next_run_at` ถูกเลื่อนไปนาทีถัดไปทุกครั้ง (17:28:00 → รอบถัดไป 17:29:00) — งานที่ `enabled=0` และงานที่ยังไม่ถึงกำหนด (`ai-digest`, `content-metrics-sync`) ยังไม่ถูกเรียก ตรงตามข้อ 7.4/7.5
  - หมายเหตุ: ตอนตรวจครั้งแรกด้วย `schtasks /query` แบบไม่ยกสิทธิ์ได้ `ERROR: Access is denied.` ซึ่ง**ไม่ได้แปลว่า task ไม่มี** — task ถูกสร้างด้วย `/RU SYSTEM` จึงต้องยกสิทธิ์ถึงจะอ่านได้ (แถว `cron_runs` id 22 ที่ 17:23:01 พิสูจน์ว่ามันทำงานอยู่แล้วตั้งแต่การลงทะเบียนครั้งแรก)
  - พบเพิ่ม (ไม่กระทบการตั้งเวลา): ข้อความใน `cron_runs.notes` ประทับเวลาเป็น `[2026-08-24 12:28:01]` ขณะที่ `started_at` เป็น `17:28:01` — เป็นนาฬิกา PHP (Europe/Berlin) ตาม D10 ที่โผล่ในข้อความ log เท่านั้น ตัวตัดสินใจว่า "ถึงกำหนดหรือยัง" ใช้นาฬิกาฐานข้อมูลล้วนอยู่แล้ว จึงไม่แก้ใน change นี้

  **พบตอนตรวจก่อน archive (2026-08-25 09:05) — task หยุดเงียบ 15 ชั่วโมง แก้แล้ว**
  - อาการ: `cron_runs` แถวสุดท้ายคือ `2026-08-24 17:44:01` แล้วเงียบไปถึง `2026-08-25 09:07:01` — `ai-digest` ที่ครบกำหนด 07:30 ไม่รันตามเวลา ทั้งที่ `schtasks` ยังรายงาน `Status: Ready` / `Last Result: 0` และเครื่องไม่ได้รีบูต (up ตั้งแต่ 2026-08-22 20:08)
  - สาเหตุ: `schtasks /create` ตั้งค่า power ให้เสมอโดยไม่มีแฟล็กให้เปลี่ยน — `Export-ScheduledTask` ยืนยัน `<DisallowStartIfOnBatteries>true</DisallowStartIfOnBatteries>` และ `<StopIfGoingOnBatteries>true</StopIfGoingOnBatteries>` เครื่องนี้เป็นโน้ตบุ๊ก (Acer, แบต AP18E8M) พอถอดปลั๊กหรือเครื่องหลับ Windows จะไม่ยิง task และไม่ทิ้งร่องรอย เพราะ log `Microsoft-Windows-TaskScheduler/Operational` ปิดอยู่ (`IsEnabled: False`) — `NumberOfMissedRuns` ก็ยังเป็น 0
  - ตัวรันไม่ผิด: พอ task กลับมา 09:07:01 `tick.php` ตามงานที่ค้างให้เองครบ — `ai-digest` รันแล้ว → `next_run_at` เลื่อนเป็น `2026-08-26 07:30`, `content-metrics-sync` (ค้างจาก 18:00 เมื่อวาน) รันแล้ว → `12:00` วันนี้ (4 errors จาก Facebook token ตามเดิม), `publish-scheduler` กลับมาเดินทุกนาที ยืนยันว่ากติกา "next_run_at อยู่ในอดีต = ถึงกำหนด" ทำให้ระบบกู้ตัวเองได้จริง
  - การแก้: เพิ่มขั้นตอนใน `scripts/register-cron-task.bat` ให้เคลียร์ทั้งสองค่าหลังสร้าง task ด้วย `Set-ScheduledTask -Settings (New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit 72h)` (ระบุ 2 ค่าหลังซ้ำเพราะ `Set-ScheduledTask` แทนที่ settings ทั้งก้อน) พร้อมทางออกแบบ manual ในข้อความ `[WARN]` ถ้า PowerShell ล้มเหลว และเพิ่ม `[NOTE]` ท้ายสคริปต์ว่าเครื่องหลับ/ปิดอยู่ Windows ไม่ยิง task แต่ tick ตามงานให้เองเมื่อเครื่องตื่น (แค่ล่าช้า ไม่หาย)
  - ยืนยันหลังแก้ (รันซ้ำแบบยกสิทธิ์ 09:12): XML เป็น `<DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>` + `<StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>`, `MultipleInstancesPolicy: IgnoreNew` และ trigger ยังเป็น `<Interval>PT1M</Interval>` ชี้ไป `tick.php` เหมือนเดิม — `cron_runs` id 52, 53, 54 ที่ 09:12:01 / 09:13:01 / 09:14:01 ยืนยันว่ายังเดินทุกนาทีหลังสร้าง task ใหม่

## 6. Admin UI

- [x] 6.1 แก้ `api/cron-manager.php` `?action=create` ให้ต้องมี `cron_expression` ที่ผ่าน `cron_expr_validate()` มิฉะนั้นตอบ 422 พร้อมข้อความภาษาไทย และให้ INSERT เขียนคอลัมน์ใหม่ด้วย — ยืนยันด้วย endpoint จริง: ไม่ส่งมา → 422 "ต้องระบุตารางเวลา…", `0 0 L * *` → 422 "ตารางเวลาไม่ถูกต้อง…", `*/10 * * * *` → 201 พร้อม `cron_expression` ถูกเขียนและ `next_run_at` เป็น NULL (D2)
- [x] 6.2 แก้ `api/cron-manager.php` `PUT ?action=update` ให้รับ `cron_expression` ใน allowed fields, validate ก่อนเขียน (ผิด → 422 ภาษาไทย ค่าเดิมไม่เปลี่ยน) และคำนวณ `next_run_at` ใหม่เมื่อ `cron_expression` เปลี่ยน — ยืนยัน: `0 0 * * MON` → 422 และแถวเดิมยังเป็น `*/10 * * * *`/`next_run_at` NULL, `"  "` → 422, `0 9 * * 1-5` (จันทร์ 14:55) → 200 พร้อม `next_run_at`=`2026-08-25 09:00:00`, ส่งเฉพาะ `enabled` → `next_run_at` ไม่ขยับ
- [x] 6.3 แก้ `GET` ของ `api/cron-manager.php` ให้คืน `cron_expression`, `last_run_at`, `next_run_at` มาด้วย — ผ่านอยู่แล้วเพราะ `GET` ใช้ `SELECT *` ยืนยันด้วยการเรียก endpoint จริงว่าคืนทั้งสามคอลัมน์ (พร้อม `last_age_seconds` ที่เพิ่มใน 4b.4)
- [x] 6.4 แก้ `src/components/admin/CronJobsPanel.tsx` ให้แสดง `cron_expression` และเวลารันรอบถัดไปของแต่ละงาน ข้อความที่ผู้ใช้เห็นทั้งหมดเป็นภาษาไทย — ยืนยันในเบราว์เซอร์ (Admin → Cron Jobs): ทุกงานแสดง cron แบบ mono (`* * * * *`, `*/15 * * * *`, `0 */6 * * *`, `30 7 * * *`, `0 9 * * *`, `0 0 * * *`), `interval_label` เปลี่ยนป้ายเป็น "ความถี่ (ข้อความสำหรับแสดงเท่านั้น)" และมีบรรทัด "รอบถัดไป: อีก 7 ชั่วโมง (2026-08-25 …)" / "ตัวตั้งเวลาเรียกล่าสุด: ยังไม่เคย" — ไม่มีการแปลงเขตเวลาฝั่งเบราว์เซอร์ (ค่าจาก DB แสดงตรง ๆ ตาม D10)
- [x] 6.5 แก้ `src/components/admin/CronJobsPanel.tsx` ให้แก้ `cron_expression` ได้ในฟอร์มสร้าง/แก้งาน และแสดงข้อความ error 422 จาก API ให้ผู้ใช้เห็น — ยืนยันในเบราว์เซอร์: กรอก `0 0 L * *` → POST ตอบ 422 และฟอร์ม**ยังเปิด**พร้อมข้อความ `ตารางเวลาไม่ถูกต้อง: "0 0 L * *" — ต้องเป็น 5 ช่อง และใช้ได้เฉพาะ *, ตัวเลข, */N, A-B, A,B,C` โดยค่าที่พิมพ์ไว้ยังอยู่ (`key`=`ui-test-cron`) จากนั้นแก้เป็น `*/30 * * * *` → บันทึกสำเร็จและ dialog ปิด แล้วลบงานทดสอบทิ้งด้วย endpoint จริง (ไม่ทำตัว validate ซ้ำฝั่ง client — เซิร์ฟเวอร์เป็นผู้ตัดสินเดียว)
- [x] 6.6 แก้ `src/components/admin/CronJobsPanel.tsx` ให้แสดงสถานะที่มองออกว่างานไม่ได้ถูกเรียกตามเวลา (เช่น `next_run_at` เลยกำหนดมานานแต่ `last_run_at` ไม่ขยับ) ไม่ใช่แสดงว่าปกติ — ยืนยันในเบราว์เซอร์: แบนเนอร์ "มี 2 งานที่เลยกำหนดแล้วยังไม่ถูกเรียก" พร้อมวิธีแก้ (ชี้ไป `scripts/register-cron-task.bat`) และ `publish-scheduler` แสดง "สำเร็จ" (ผลรันล่าสุด) **พร้อมกับ** ป้าย "ไม่ถูกเรียกตามเวลา" + "รอบถัดไป: เลยกำหนด 1 ชั่วโมง (2026-08-24 14:25:00)" — สองสัญญาณไม่กลบกัน ส่วน `cron-publish` (`enabled=0`) แสดง "ปิดอยู่ ไม่ถูกเรียกตามเวลา" และไม่ถูกนับเป็นเลยกำหนด

## 7. Verification

- [x] 7.1 ทดสอบ `cron_next_run()` กับทั้ง 7 expression ที่ migration เติมให้ ว่าได้เวลาที่ตรงกับความหมายของ `interval_label` เดิม และทดสอบว่า `cron_expr_validate()` ปฏิเสธ `L`, `#`, `?`, ชื่อเดือน/วัน และจำนวนฟิลด์ที่ไม่ใช่ 5 — ผ่าน 26/26 (6 expression ตรงเป๊ะในกรอบ `+07:00`, ปฏิเสธ 12 แบบที่ไม่รองรับ, รับ 7 แบบที่รองรับ, `0 0 30 2 *` คืน NULL)
- [x] 7.2 รัน `php api/cron/tick.php` ครั้งที่ 1 → ต้องเห็นว่า `next_run_at` ถูกเติมครบทุกงานที่ `enabled=1` และ **ไม่มีแถวใหม่ใน `cron_runs`** เลย — ได้ `initialized=6 due=0 ran=0`, `cron_runs` คงที่ 10 แถว, `MAX(started_at)` ยังเป็น `2026-06-09 16:10:52`
- [x] 7.3 รัน `php api/cron/tick.php` ครั้งที่ 2 หลังผ่านนาที → ต้องเห็นแถวใหม่ใน `cron_runs` ของ `publish-scheduler` ที่ `finished_at` ไม่เป็น NULL และ `cron_jobs.last_run_at` ของงานนั้นขยับ — ได้แถว id=11 (`started_at`=`finished_at`=`14:20:07`), `last_run_at` ขยับเป็น `14:20:07`, `next_run_at` → `14:21:00`
- [x] 7.4 ยืนยันว่างานที่ยังไม่ถึงกำหนดไม่ถูกรัน: ตรวจว่า `ai-digest`/`billing-reminders` ไม่มีแถวใน `cron_runs` หลังการทดสอบข้อ 7.3 — `due=1` มีแค่ `publish-scheduler` ทั้งสองงานยัง `state=never` และ `last_run_at` เป็น NULL
- [x] 7.5 ยืนยันว่างานที่ `enabled=0` ไม่ถูกรัน: ตรวจว่า `cron-publish` ไม่มีแถวใหม่ใน `cron_runs` — tick เห็นแค่ 6 งาน `cron-publish` ไม่ถูกเลือกมาเลยและ `next_run_at` ยังเป็น NULL
- [x] 7.6 ทดสอบการกันซ้อน: สร้างแถว `cron_runs` ที่ `finished_at IS NULL` และ `started_at = NOW()` ให้ `publish-scheduler` แล้วรัน tick → ต้องรายงานว่าข้ามและไม่สร้างแถวใหม่ จากนั้นเปลี่ยน `started_at` ให้เกินเพดานแล้วรันอีกครั้ง → แถวค้างต้องถูกปิดและงานถูกรันใหม่ — ได้ `skipped=1 ran=0` ตอนแรก แล้วแถว id=12 ถูกปิดด้วย `Force-restarted after timeout` (`errors=1`) และรันใหม่เป็น id=13
- [x] 7.7 ยืนยันปุ่ม "รันเดี๋ยวนี้" ของแอดมินยังใช้งานได้เหมือนเดิม: เรียก `POST /api/cron-manager.php?action=run&job=content-metrics-sync` แล้วต้องได้ผลรูปแบบเดิม (`success`, `output`, `processed`, `errors`) พร้อมแถว `cron_runs` ที่ปิดสมบูรณ์ — HTTP 200 คืนคีย์ครบทั้งสี่ (งานรันจริงครั้งแรกและรายงาน 4 errors จาก Facebook token หมดอายุ ซึ่งเป็นความเสี่ยงที่บันทึกไว้แล้ว ไม่ใช่ความผิดของตัวเรียก)
- [x] 7.8 ยืนยันว่า HTTP tick ที่ไม่มี token ตอบ 403 — ไม่มี token → 403 `Forbidden`, token ผิด → 403, token ถูก → 200 และ tick ทำงานจริง (ยืนยัน D6 ทั้งสองทาง)
- [x] 7.9 รัน `pnpm lint` และ `pnpm build` ให้ผ่าน — `pnpm lint` 0 error (46 warning ที่มีอยู่ก่อน ไม่มีอันใดอยู่ใน `CronJobsPanel.tsx`), `pnpm build` `✓ built in 16.74s` พร้อม PWA output
- [x] 7.10 บันทึกผลว่าเฟส 0 DoD (ข) ผ่านหรือยัง — ต้องเห็นแถว `content_publish_queue` ที่ `status='sent'` ซึ่ง `TIMESTAMPDIFF(MINUTE, created_at, sent_at) > 0` (คือมาจากเส้น cron ไม่ใช่ `send_now`) และบันทึกว่า `content_post_metrics` เริ่มมีแถวจาก `content-metrics-sync` หรือยัง

  **ผล (วัดเมื่อ DB time 2026-08-24 17:12): DoD (ข) ยังไม่ผ่าน**
  - `content_publish_queue`: `sent` 24 แถว, `failed` 53 แถว, `pending`/`processing` **0 แถว** — แถว `sent` ทั้ง 24 แถวมี `TIMESTAMPDIFF(MINUTE, created_at, sent_at) = 0` ทุกแถว แปลว่ามาจากเส้น `send_now` ทั้งหมด ยังไม่มีแถวใดที่เผยแพร่ผ่านตัวตั้งเวลา
  - เหตุผลไม่ใช่ตัวรัน: `publish-scheduler` ถูก tick เรียกและทำงานสำเร็จจริง (cron_runs id 13, 14 → `No pending entries.` errors=0) แต่**ไม่มีงานให้ทำ** เพราะคิวไม่มีแถว pending เลย DoD (ข) จึงต้องรอสองอย่าง: (1) ลงทะเบียน OS task ตามข้อ 5.3 และ (2) มีการตั้งเวลาโพสต์ใหม่เข้าคิวอย่างน้อยหนึ่งแถว
    - **อัปเดตหลังข้อ 5.3 เสร็จ (17:28):** เงื่อนไข (1) ผ่านแล้ว — ตัวตั้งเวลาเรียก `publish-scheduler` ทุกนาทีจริง (cron_runs id 22–27) เหลือเฉพาะเงื่อนไข (2) ที่รอผู้ใช้ตั้งเวลาโพสต์ใหม่ ซึ่งอยู่นอกขอบเขต change นี้ (เป็นการใช้งานจริง ไม่ใช่โค้ด) พอมีแถว pending เข้าคิว รอบ tick ถัดไปจะหยิบไปเผยแพร่เองโดยไม่ต้องแก้อะไรเพิ่ม
  - `content_post_metrics`: **0 แถว** — `content-metrics-sync` ถูกเรียกจริง 2 ครั้ง (cron_runs id 15, 16) แต่ได้ `Processed 0 entries, 4 errors` ทั้งสองครั้งจาก Facebook token หมดอายุ ซึ่งเป็นความเสี่ยงที่ Non-Goals กันไว้แล้ว (ไม่แก้ใน change นี้) เฟส 2 จะยังไม่มีข้อมูลจนกว่าจะต่อ token ใหม่
  - **พบเพิ่มระหว่างวัด:** แถวในคิวมี `scheduled_at` เร็วกว่า `created_at` 5 ชั่วโมงทุกแถว (เช่น `scheduled_at 2026-08-24 08:05:24` / `created_at 13:05:24`) — ยืนยันบั๊ก `api/content-publish.php:162` ที่ design.md D10 บันทึกไว้ ผลคือโพสต์ที่ผู้ใช้ตั้งเวลาไว้จะถึงกำหนดทันทีและถูกส่งเร็วไป 5 ชั่วโมง ทำให้ DoD (ข) "ผ่าน" ได้ในเชิงตัวเลข (gap > 0) แต่เวลาเผยแพร่ยังผิด — ต้องแก้เป็นงานแยกก่อนถือว่าเส้นตั้งเวลาเชื่อถือได้จริง
