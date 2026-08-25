## ADDED Requirements

### Requirement: cron_jobs มีตารางเวลาที่เครื่องอ่านได้
ตาราง `cron_jobs` SHALL มีคอลัมน์ `cron_expression` (crontab 5 ฟิลด์: นาที ชั่วโมง วันที่ เดือน วันในสัปดาห์), `last_run_at` และ `next_run_at` เพื่อให้ตัวเรียกงานคำนวณได้ว่างานใดถึงกำหนด — คอลัมน์ `interval_label` เดิม SHALL คงไว้เป็นข้อความไทยสำหรับแสดงผลเท่านั้น ไม่ใช้ตัดสินใจเรื่องเวลา

#### Scenario: migration เพิ่มคอลัมน์สำเร็จ
- **WHEN** migration ของ change นี้รันสำเร็จ
- **THEN** `SHOW COLUMNS FROM cron_jobs` มีคอลัมน์ `cron_expression`, `last_run_at`, `next_run_at` ครบ

#### Scenario: งานเดิมทั้ง 7 งานได้ cron_expression ตรงกับ label เดิม
- **WHEN** migration รันสำเร็จ
- **THEN** `cron_jobs` ทุกแถวมี `cron_expression` ไม่เป็น NULL และค่าตรงกับความหมายของ `interval_label` เดิม (`ทุก 1 นาที` → `* * * * *`, `ทุก 15 นาที` → `*/15 * * * *`, `ทุก 6 ชั่วโมง` → `0 */6 * * *`, `ทุกวัน 07:30` → `30 7 * * *`, `ทุกวัน 09:00` → `0 9 * * *`, `ทุกวัน เที่ยงคืน` → `0 0 * * *`)

#### Scenario: สร้างงานใหม่ต้องระบุ cron_expression
- **WHEN** เรียก `POST /api/cron-manager.php?action=create` โดยไม่ส่ง `cron_expression`
- **THEN** ตอบ 422 พร้อมข้อความภาษาไทยว่าต้องระบุตารางเวลา และไม่มีแถวใหม่ใน `cron_jobs`

### Requirement: ตัวเรียกงานตามเวลา tick รันงานที่ถึงกำหนด
`api/cron/tick.php` SHALL เป็น entry point เดียวที่ตัวตั้งเวลาระดับ OS เรียก โดยเลือกงานจาก `cron_jobs` ที่ `enabled=1` และถึงกำหนดตาม `cron_expression` แล้วสั่งรัน จากนั้นอัปเดต `last_run_at` และ `next_run_at` ของงานนั้น — ต้องรันได้ทั้งจาก CLI และจาก HTTP ที่ยืนยัน secret ถูกต้อง

#### Scenario: รันจาก CLI แล้วงานที่ถึงกำหนดถูกรัน
- **WHEN** รัน `php api/cron/tick.php` ในนาทีที่ `cron_expression` ของงานหนึ่งตรงกับเวลาปัจจุบัน
- **THEN** งานนั้นถูกรัน มีแถวใหม่ใน `cron_runs` ที่ `job_name` ตรงกับ `cron_jobs.key` และ `finished_at` ไม่เป็น NULL เมื่อจบ

#### Scenario: งานที่ยังไม่ถึงกำหนดไม่ถูกรัน
- **WHEN** tick รันในนาทีที่ `cron_expression` ของงานหนึ่งไม่ตรง
- **THEN** ไม่มีแถวใหม่ใน `cron_runs` ของงานนั้น และ `last_run_at` ไม่เปลี่ยน

#### Scenario: งานที่ปิดอยู่ไม่ถูกรัน
- **WHEN** tick รันขณะที่งานหนึ่งมี `enabled=0` แม้ `cron_expression` จะตรงกับเวลาปัจจุบัน
- **THEN** งานนั้นไม่ถูกรันและไม่มีแถวใหม่ใน `cron_runs`

#### Scenario: เรียกผ่าน HTTP โดยไม่มี secret ถูกปฏิเสธ
- **WHEN** เรียก `GET /api/cron/tick.php` โดยไม่ส่ง token หรือส่งค่าผิด
- **THEN** ตอบ 403 และไม่มีงานใดถูกรัน

#### Scenario: tick สรุปผลเป็นข้อความที่นับจำนวนงานได้
- **WHEN** tick รันจบ
- **THEN** พิมพ์สรุปที่ระบุจำนวนงานที่ถึงกำหนดและจำนวนงานที่รันสำเร็จ/ล้มเหลว

### Requirement: กันงานทับซ้อน
ตัวเรียกงาน SHALL ข้ามงานที่ยังมีแถว `cron_runs` ค้างเปิดอยู่ (`finished_at IS NULL`) และเริ่มมาไม่เกินเพดานเวลาที่ถือว่า "ค้าง" เพื่อไม่ให้งานรอบ 1 นาทีที่ใช้เวลานานกว่า 1 นาทีถูกยิงซ้อนกัน

#### Scenario: งานที่กำลังรันอยู่ไม่ถูกยิงซ้อน
- **WHEN** tick รันขณะที่งานหนึ่งมีแถว `cron_runs` ที่ `finished_at IS NULL` และเริ่มมาไม่ถึงเพดานเวลา
- **THEN** ข้ามงานนั้น ไม่สร้างแถว `cron_runs` ใหม่ และรายงานว่าข้ามเพราะกำลังทำงานอยู่

#### Scenario: งานที่ค้างเกินเพดานถูกปิดแล้วรันใหม่
- **WHEN** tick รันขณะที่งานหนึ่งมีแถว `cron_runs` ที่ `finished_at IS NULL` และเริ่มมานานเกินเพดานเวลา
- **THEN** แถวค้างนั้นถูกปิดพร้อมบันทึกเหตุผลว่าค้าง และงานถูกรันใหม่

### Requirement: แอดมินและตัวตั้งเวลาใช้ตัวรันงานร่วมกัน
ตรรกะการรันงานหนึ่งงาน (สร้างแถว `cron_runs`, แยก `type='include'` กับ `type='http'`, อ่านจำนวนที่ประมวลผลและจำนวน error จาก output, ปิดแถวด้วย `notes`) SHALL อยู่ในไฟล์เดียวคือ `api/lib/cron-runner.php` และถูกเรียกจากทั้ง `api/cron-manager.php` (ปุ่มรันเดี๋ยวนี้ของแอดมิน) และ `api/cron/tick.php` เพื่อไม่ให้พฤติกรรมสองทางแตกต่างกัน

#### Scenario: ปุ่มรันเดี๋ยวนี้ให้ผลเหมือนเดิม
- **WHEN** แอดมินเรียก `POST /api/cron-manager.php?action=run&job=<key>` หลังการแยกไฟล์
- **THEN** ยังได้ผลลัพธ์รูปแบบเดิม (`success`, `output`, `processed`, `errors`) และมีแถว `cron_runs` ที่ปิดสมบูรณ์

#### Scenario: cron-manager ไม่มีตรรกะรันงานซ้ำอีกชุด
- **WHEN** ตรวจ `api/cron-manager.php` หลังแก้
- **THEN** ไม่มีคำสั่ง `include` ไฟล์งานหรือ `curl_init` ไปยัง endpoint งานอยู่ในไฟล์นั้นอีก มีแต่การเรียกฟังก์ชันจาก `api/lib/cron-runner.php`

### Requirement: secret ของงานแบบ http ตรงกันทุกฝั่ง
ทุกจุดที่ยืนยัน secret ของ cron (`api/cron-manager.php`, `api/cron-publish.php`, `api/notification-dispatch.php`, `api/cron/tick.php`) SHALL อ่านค่าจาก `CRON_SECRET` ด้วยลำดับ fallback เดียวกัน และ `.env` SHALL มีคีย์ `CRON_SECRET` — เดิม `cron-manager.php` fallback เป็น `'flowstack-cron-2026'` แต่ `cron-publish.php` fallback เป็นค่าว่างแล้วตอบ 500 ทำให้งาน `type='http'` พังแม้กดรันมือ

#### Scenario: งาน type=http รันผ่านโดยไม่ติด 500
- **WHEN** ตัวรันงานเรียก endpoint ของงาน `type='http'` ด้วย token จาก `CRON_SECRET`
- **THEN** ปลายทางยืนยันผ่าน ไม่ตอบ 500 ว่า `CRON_SECRET is not set`

#### Scenario: token ผิดยังถูกปฏิเสธ
- **WHEN** เรียก endpoint ของงาน `type='http'` ด้วย token ที่ไม่ตรงกับ `CRON_SECRET`
- **THEN** ปลายทางตอบ 403

### Requirement: ปิดไปป์ไลน์เผยแพร่เก่าก่อนเปิดตัวตั้งเวลา
งาน `cron-publish` SHALL ถูกตั้งเป็น `enabled=0` เพราะอ่านตาราง `content_schedules` ซึ่งเป็นไปป์ไลน์เก่าที่ไม่มีแถว pending แล้ว และซ้อนหน้าที่กับ `publish-scheduler` ที่อ่าน `content_publish_queue` ซึ่งเป็นคิวที่ใช้จริง — ถ้าเปิดไว้จะสร้างแถว `cron_runs` เปล่าทุกนาทีและเสี่ยงเผยแพร่ซ้ำ

#### Scenario: cron-publish ถูกปิดหลัง migration
- **WHEN** migration ของ change นี้รันสำเร็จ
- **THEN** `cron_jobs` แถว `key='cron-publish'` มี `enabled=0`

#### Scenario: publish-scheduler ยังเปิดอยู่
- **WHEN** migration ของ change นี้รันสำเร็จ
- **THEN** `cron_jobs` แถว `key='publish-scheduler'` ยังมี `enabled=1` และ `cron_expression='* * * * *'`

### Requirement: ลงทะเบียนตัวตั้งเวลาระดับ OS ได้ในขั้นตอนเดียว
โครงการ SHALL มีสคริปต์ `scripts/register-cron-task.bat` ที่ลงทะเบียน Windows Task Scheduler ให้เรียก `php <repo>/api/cron/tick.php` ทุก 1 นาที และ SHALL ระบุไว้ชัดเจนว่าต้องรันด้วยสิทธิ์ Administrator หนึ่งครั้ง มิฉะนั้นงานทั้งหมดจะไม่ทำงานอัตโนมัติ — task ที่ลงทะเบียน SHALL ไม่ถูกจำกัดด้วยเงื่อนไขแหล่งจ่ายไฟ เพราะ `schtasks /create` ตั้ง `DisallowStartIfOnBatteries` และ `StopIfGoingOnBatteries` เป็น `true` เสมอโดยไม่มีแฟล็กให้เปลี่ยน ทำให้บนโน้ตบุ๊กงานหยุดเงียบเมื่อถอดปลั๊กโดยที่ `schtasks /query` ยังรายงาน `Status: Ready`

#### Scenario: สคริปต์ลงทะเบียน task สำเร็จ
- **WHEN** รัน `scripts/register-cron-task.bat` ด้วยสิทธิ์ Administrator
- **THEN** `schtasks /query` แสดง task ที่ชี้ไป `api/cron/tick.php` และรอบเรียกทุก 1 นาที

#### Scenario: task ที่ลงทะเบียนไม่หยุดเมื่อใช้แบตเตอรี่
- **WHEN** ตรวจ task ที่สคริปต์สร้างด้วย `Export-ScheduledTask`
- **THEN** ทั้ง `DisallowStartIfOnBatteries` และ `StopIfGoingOnBatteries` เป็น `false`

#### Scenario: งานที่พลาดรอบเพราะเครื่องปิดหรือหลับถูกรันเมื่อเครื่องกลับมา
- **WHEN** ตัวตั้งเวลาไม่ได้เรียก tick เป็นเวลานาน (เครื่องหลับ ปิด หรือ task ถูกระงับ) แล้วกลับมาเรียกอีกครั้ง
- **THEN** งานที่ `next_run_at` อยู่ในอดีตถูกถือว่าถึงกำหนดและถูกรันในรอบ tick แรกหลังกลับมา พร้อมเลื่อน `next_run_at` ไปรอบถัดไปตาม `cron_expression` (งานล่าช้าได้ แต่ต้องไม่ถูกข้ามหายไป)

#### Scenario: ยังไม่ลงทะเบียนแล้วหน้าแอดมินบอกได้
- **WHEN** ยังไม่มีการรันงานอัตโนมัติ (ไม่มีแถว `cron_runs` ใหม่ภายในรอบที่คาดไว้)
- **THEN** หน้าแอดมิน cron แสดงสถานะที่ทำให้เห็นว่างานไม่ได้ถูกเรียกตามเวลา ไม่ใช่แสดงว่าปกติ

### Requirement: หน้าแอดมินแสดงและแก้ตารางเวลาได้
`src/components/admin/CronJobsPanel.tsx` SHALL แสดง `cron_expression` และเวลารันรอบถัดไป (`next_run_at`) ของแต่ละงาน และให้แอดมินแก้ `cron_expression` ได้ โดยข้อความที่ผู้ใช้เห็นทั้งหมดเป็นภาษาไทย

#### Scenario: แสดง cron_expression และรอบถัดไป
- **WHEN** แอดมินเปิดหน้าจัดการ cron
- **THEN** แต่ละงานแสดง `cron_expression` และเวลารันรอบถัดไป

#### Scenario: แก้ตารางเวลาแล้วบันทึกได้
- **WHEN** แอดมินแก้ `cron_expression` ของงานหนึ่งแล้วบันทึก
- **THEN** ค่าใหม่ถูกเขียนลง `cron_jobs` และ `next_run_at` ถูกคำนวณใหม่ตามค่าใหม่

#### Scenario: cron_expression รูปแบบผิดถูกปฏิเสธ
- **WHEN** แอดมินบันทึก `cron_expression` ที่ไม่ใช่ 5 ฟิลด์ที่อ่านได้
- **THEN** ตอบ 422 พร้อมข้อความภาษาไทยและค่าใน `cron_jobs` ไม่เปลี่ยน
