## Why

ระบบมี cron job ลงทะเบียนไว้ 7 งานใน `cron_jobs` และ `enabled=1` ทุกงาน แต่**ไม่มีสิ่งใดในระบบเรียกงานเหล่านั้นตามเวลาเลย** — `api/cron-manager.php` รันงานได้เฉพาะเมื่อแอดมินกดปุ่มเองผ่าน `POST ?action=run&job=<key>` เท่านั้น ผลคือ `cron_runs` มีประวัติเพียง 3 งานจาก 7 งาน และการรันครั้งสุดท้ายของทั้งระบบคือ **2026-06-09 16:10:52** (ห่างจากวันนี้ ~2.5 เดือน) ส่วน `content-metrics-sync`, `ai-digest`, `billing-reminders`, `recurring-tasks` ไม่เคยรันแม้แต่ครั้งเดียว

ต้นเหตุเดียวนี้ทำให้งานสองเฟสค้างพร้อมกัน:
- **เฟส 0 DoD (ข)** ไม่ผ่าน — คิว `content_publish_queue` ยังไม่เคยผลิตแถว `status='sent'` จากเส้นทาง cron เลยในประวัติระบบ แถว `sent` ทั้ง 24 แถวมี `TIMESTAMPDIFF(MINUTE, created_at, sent_at) = 0` ทุกแถว คือมาจาก `send_now` ทั้งหมด
- **เฟส 2** ไม่มีข้อมูล — ตาราง `content_post_metrics` มี 0 แถว เพราะ `api/cron/content-metrics-sync.php` ไม่เคยถูกเรียก

## What Changes

- เพิ่มตัวเรียกงานตามเวลา `api/cron/tick.php` (รันได้ทั้ง CLI และ HTTP พร้อม secret) ทำหน้าที่เลือกงานที่ถึงกำหนดจาก `cron_jobs` แล้วสั่งรัน — เป็น entry point เดียวที่ตัวตั้งเวลาระดับ OS ต้องเรียกทุกนาที
- เพิ่มคอลัมน์ตารางเวลาที่เครื่องอ่านได้ให้ `cron_jobs`: `cron_expression` (5 ฟิลด์แบบ crontab), `last_run_at`, `next_run_at` — เดิม `interval_label` เป็นข้อความไทยสำหรับแสดงผลเท่านั้น เครื่องอ่านไม่ได้ (`ทุก 6 ชั่วโมง`, `ทุกวัน 07:30`) migration จะเติม `cron_expression` ให้ทั้ง 7 งานให้ตรงกับ label เดิม
- แยกฟังก์ชัน `runJob()` ออกจาก `api/cron-manager.php` ไปเป็น `api/lib/cron-runner.php` เพื่อให้ปุ่ม "รันเดี๋ยวนี้" ของแอดมินและ `tick.php` ใช้โค้ดเส้นเดียวกัน ไม่แตกเป็นสองพฤติกรรม
- กันงานทับซ้อน: ข้ามงานที่ยังมีแถว `cron_runs` เปิดค้างอยู่ (`finished_at IS NULL`) และยังไม่เกินเพดานเวลา — งาน `ทุก 1 นาที` ที่รันนานกว่า 1 นาทีจะไม่ถูกยิงซ้อน
- แก้ค่า fallback ของ `CRON_SECRET` ที่ไม่ตรงกัน: `api/cron-manager.php` ใช้ `'flowstack-cron-2026'` แต่ `api/cron-publish.php` ใช้ค่าว่างแล้วตอบ HTTP 500 — และ `.env` ไม่มีคีย์ `CRON_SECRET` เลย ทำให้งาน `type='http'` ที่ชี้ไป `cron-publish.php` พังแม้กดรันมือ
- ปิดงาน `cron-publish` (`enabled=0`) เพราะเป็นไปป์ไลน์เก่าที่อ่านตาราง `content_schedules` (มีแค่ 2 แถว, pending = 0) ซ้อนกับ `publish-scheduler` ที่อ่าน `content_publish_queue` ซึ่งเป็นคิวที่ใช้จริง — ถ้าเปิดตัวเรียกเวลาโดยไม่ปิดงานนี้ จะได้แถว `cron_runs` เปล่า 1,440 แถว/วัน และเสี่ยงเผยแพร่ซ้ำถ้าอนาคตมีแถวใน `content_schedules`
- เพิ่ม `scripts/register-cron-task.bat` สำหรับลงทะเบียน Windows Task Scheduler ให้เรียก `tick.php` ทุกนาที (ครั้งเดียว) — ตรวจแล้วว่าเครื่องนี้**ไม่มี** task ใดอ้างถึง flowstack/xampp/php
- แสดงและแก้ `cron_expression` ได้จากหน้าแอดมิน `src/components/admin/CronJobsPanel.tsx` พร้อมแสดงเวลารันรอบถัดไป

## Capabilities

### New Capabilities
- `cron-job-dispatch`: ตารางเวลาที่เครื่องอ่านได้บน `cron_jobs`, ตัวเรียกงานตามเวลา (`tick.php`), การกันงานทับซ้อน, การใช้ตัวรันงานร่วมกันระหว่างแอดมินกับตัวตั้งเวลา และการยืนยัน secret ของงานแบบ `type='http'`

### Modified Capabilities
<!-- ไม่มี — requirement ของ post-metrics-sync และ content-publish-result-tracking ไม่เปลี่ยน เปลี่ยนแค่ "ใครเรียก" ซึ่งเป็นความสามารถใหม่ -->

## Impact

- **Database:** `ALTER TABLE cron_jobs` เพิ่ม `cron_expression`, `last_run_at`, `next_run_at`; `UPDATE cron_jobs` เติม expression 7 แถว และ `enabled=0` ให้ `cron-publish`
- **New files:** `api/cron/tick.php`, `api/lib/cron-runner.php`, `scripts/register-cron-task.bat`
- **Modified files:** `api/cron-manager.php` (ใช้ runner ร่วม + รับ/คืนฟิลด์ใหม่), `api/cron-publish.php` (fallback secret), `.env` (`CRON_SECRET`), `src/components/admin/CronJobsPanel.tsx`
- **Unblocks:** เฟส 0 DoD (ข) — คิวจะมีโอกาสผลิต `status='sent'` จากเส้น cron จริง; เฟส 2 — `content_post_metrics` จะเริ่มมีข้อมูล time-series
- **Side effects ที่ต้องรู้:** เมื่อเปิดตัวเรียกเวลา งานที่เคยเงียบ 2.5 เดือนจะเริ่มทำงานจริงพร้อมกัน — `notification-dispatch` จะเริ่มส่งแจ้งเตือน LINE/Telegram, `billing-reminders` จะเริ่มส่งอีเมล, `recurring-tasks` จะเริ่มสร้าง task ตามรอบ ต้องตรวจงานเหล่านี้ก่อนเปิด
- **Out of scope:** การล้างประวัติ `cron_runs` ตามอายุ (retention), การแจ้งเตือนเมื่อ cron ล้มเหลว, การจัดการ token หมดอายุของ channel — ทั้งสามข้อเป็นความเสี่ยงข้ามเฟสที่ยังไม่มีเจ้าภาพ
- **Dependency ภายนอก:** ต้องรัน `scripts/register-cron-task.bat` ด้วยสิทธิ์ Administrator หนึ่งครั้ง งานทั้งหมดจะยังไม่ทำงานอัตโนมัติจนกว่าจะทำขั้นนี้
