## 1. Migration ฐานข้อมูล

- [x] 1.1 สร้าง `database/migrations/YYYY_MM_DD_HHMMSS_create_ops_alerts.sql` — ตาราง `ops_alerts` (`id CHAR(36) PK`, `alert_key VARCHAR(191)`, `tenant_id CHAR(36)`, `first_seen_at DATETIME`, `last_sent_at DATETIME NULL`, `send_count INT NOT NULL DEFAULT 0`, `resolved_at DATETIME NULL`, UNIQUE (`alert_key`,`tenant_id`)) แล้วรันด้วย `/c/xampp/mysql/bin/mysql.exe -u root flowstack < <file>` และยืนยันด้วย `SHOW COLUMNS FROM ops_alerts` + `SHOW INDEX FROM ops_alerts`
- [x] 1.2 สร้าง `database/migrations/YYYY_MM_DD_HHMMSS_add_publish_channel_token_expiry.sql` — เพิ่ม `token_expires_at DATETIME NULL`, `data_access_expires_at DATETIME NULL`, `token_checked_at DATETIME NULL`, `token_status VARCHAR(20) NULL`, `token_error VARCHAR(500) NULL` ใน `publish_channels` แล้วรันและยืนยันด้วย `SHOW COLUMNS FROM publish_channels` พร้อมตรวจว่าทั้ง 10 แถวเดิมมี `token_status` เป็น NULL
- [x] 1.3 สร้าง `database/migrations/YYYY_MM_DD_HHMMSS_disable_broken_channels_and_line_key.sql` — `UPDATE publish_channels SET is_active=0 WHERE platform IN ('instagram','tiktok','linkedin')` + INSERT settings key `ops_alert_line_targets` เป็นค่าว่าง พร้อมคอมเมนต์ในไฟล์ระบุคำสั่งย้อนกลับ (`UPDATE publish_channels SET is_active=1 WHERE platform IN (...)`) แล้วรันและยืนยันด้วย `SELECT platform, is_active FROM publish_channels` ว่า `facebook`/`lotusdomino` ยัง `is_active=1` และ `twitter`/`wix` ไม่ถูกแตะ

## 2. ตัวแจ้งเตือนกลาง `api/lib/ops-alert.php`

- [x] 2.1 สร้างไฟล์ใหม่พร้อมฟังก์ชัน `ops_alert(PDO $db, ?string $tenantId, string $key, string $title, string $body, bool $urgent = false): void` — ห่อ try/catch ทั้งก้อน รายงานความล้มเหลวด้วย `error_log()` เท่านั้น ไม่โยน exception และตั้งชื่อฟังก์ชัน/ค่าคงที่ทุกตัวด้วยคำนำหน้า `ops_` (include-mode ทำให้ชื่อ global ชนกันแล้ว fatal)
- [x] 2.2 `ops_alert_recipients(PDO $db, string $tenantId): array` — `SELECT tu.user_id, tu.tenant_id, u.email, u.display_name FROM tenant_users tu JOIN users u ON u.id = tu.user_id WHERE tu.is_admin = 1 AND u.is_active = 1 AND tu.tenant_id = ?` ห้าม join `notification_settings` และห้ามใช้ `users.is_admin`
- [x] 2.3 `ops_alert_tenants_with_active_channels(PDO $db): array` — คืน tenant ที่มี `publish_channels.is_active=1` อย่างน้อยหนึ่งแถว ใช้เมื่อ `$tenantId` เป็น null (ความล้มเหลวระดับ cron job) ห้ามฝัง tenant id ในโค้ด
- [x] 2.4 ตรรกะเพดาน + ปิดเรื่อง: UPSERT `ops_alerts` ตาม (`alert_key`,`tenant_id`) · ข้ามการส่งเมื่อ `TIMESTAMPDIFF(MINUTE, last_sent_at, NOW()) < 60` · เมื่อแถวมี `resolved_at` ไม่เป็น NULL ให้ล้างเป็น NULL แล้วส่งทันทีโดยไม่ติดเพดานของรอบก่อน · เพิ่ม `send_count` และตั้ง `last_sent_at` เฉพาะครั้งที่ส่งจริง · เวลาทั้งหมดมาจาก `NOW()`/`TIMESTAMPDIFF` ของฐานข้อมูล ห้ามใช้ `time()`/`date()` ของ PHP
- [x] 2.5 `ops_alert_resolve(PDO $db, ?string $tenantId, string $key, string $title, string $body): void` — ตั้ง `resolved_at` และส่งข้อความ "กลับมาปกติ" หนึ่งครั้ง เฉพาะเมื่อมีแถวที่ `resolved_at IS NULL` อยู่จริง (ไม่มีแถว = ไม่เคยแจ้ง = ไม่ต้องส่งอะไร)
- [x] 2.6 ส่ง in-app: INSERT `ai_notifications` (`type='custom'`) หนึ่งแถวต่อผู้รับ โดยใส่ `tenant_id` ของผู้รับคนนั้นเอง ตามแบบ `api/cron/ai-digest.php` — ห้ามแก้ enum ของคอลัมน์ `type`
- [x] 2.7 ส่งอีเมลเมื่อ `$urgent === true` โดยเรียกตัวส่งอีเมลที่มีอยู่ใน `api/notification-utils.php` ส่งถึง `users.email` ของผู้รับแต่ละคน
- [x] 2.8 เดินสาย LINE: อ่านปลายทางจาก settings key `ops_alert_line_targets` — ค่าว่างแปลว่าไม่มี request ออกไปยัง LINE Messaging API เลย และห้ามอ่าน key `line_targets` เดิม
- [x] 2.9 บันทึก `notification_log` ทุกครั้งที่มีการส่งจริง หนึ่งแถวต่อ (ผู้รับ × ช่องทาง) พร้อม `status` และ `error` เมื่อล้มเหลว
- [x] 2.10 ตรวจข้อความทุกอันที่ไฟล์นี้อาจพิมพ์ออก stdout ว่าไม่มีตัวเลขติดกับคำ `error` หรือ `entries` (จะทำให้ `preg_match` ใน `cron-runner.php` อ่าน `records_processed`/`errors` ผิด)

## 3. เสียบจุดแจ้งเตือน

- [x] 3.1 `api/lib/cron-runner.php` — ใน `runJob()` เรียก `ops_alert()` ด้วยคีย์ `cron_fail:{job}` เมื่อผลรันไม่สำเร็จ และเมื่อแถวค้างถูกปิดด้วย `notes = 'Force-restarted after timeout'` · เรียก `ops_alert_resolve()` เมื่อรันสำเร็จ · ยกระดับเป็น `$urgent = true` เมื่อล้มติดกันตั้งแต่ 3 รอบ (นับจาก `cron_runs` ของงานเดียวกันด้วย SQL) · `require_once` แบบไม่ทำให้ include ซ้ำ fatal · ต้องอยู่ใน `runJob()` ไม่ใช่ `tick.php` เพื่อให้ปุ่มรันมือของแอดมินได้พฤติกรรมเดียวกัน
- [x] 3.2 `api/cron/publish-scheduler.php:136` (สาขาล้มเหลวถาวร) — เรียก `ops_alert()` คีย์ `publish_fail:{platform}` ด้วย `$entry['tenant_id']` ระบุ platform, ชื่อคอนเทนต์ และ `error_msg` · ไม่ใส่ในสาขา retry ที่ `:127` · ไม่ทำ allowlist ของ platform (`pc.is_active = 1` ที่ `:31` กรองให้แล้ว)
- [x] 3.3 `api/cron/publish-scheduler.php` — ตรวจข้อความ error ว่าเป็นเรื่อง token/สิทธิ์หรือไม่ ถ้าใช่เรียก `ops_alert()` คีย์ `publish_auth:{platform}` แบบ `$urgent = true` **ทันทีในความล้มเหลวครั้งแรก** โดยไม่รอครบ retry และแถวคิวยังถูกตั้งกลับเป็น `pending` ตามพฤติกรรมเดิม
- [x] 3.4 `api/cron/content-metrics-sync.php` — เมื่อจบรอบและ `$errors > 0` เรียก `ops_alert()` คีย์ `metrics_sync_fail` (หนึ่งเรื่องต่อรอบรัน ไม่ใช่ต่อโพสต์) พร้อมจำนวนและตัวอย่างข้อความ error · เรียก `ops_alert_resolve()` เมื่อ `$errors === 0`

## 4. อายุ credentials ของช่องทาง

- [x] 4.1 `api/lib/insights-fetch.php` — เพิ่ม `fetch_channel_token_health(string $platform, array $channel): array` เรียก Graph API `debug_token` สำหรับ `facebook`/`instagram` คืน `expires_at`/`data_access_expires_at`/`is_valid`/error · platform อื่นคืนสถานะ `unsupported` โดยไม่ยิง request · creds ไม่ครบคืนความล้มเหลวไม่โยน exception (ตามแบบ `fetch_post_insights()`)
- [x] 4.2 แปลงค่าและเขียนผลลง `publish_channels`: `expires_at = 0` → `token_expires_at = NULL` (0 = ไม่มีวันหมดอายุ ไม่ใช่ปี 1970) · เก็บ `data_access_expires_at` แยกเป็นเดดไลน์ของตัวเอง · อัปเดต `token_checked_at` ทุกครั้งที่ตรวจไม่ว่าผลเป็นอย่างไร · `token_status` ∈ {`valid`,`expiring`,`expired`,`invalid`,`unsupported`}
- [x] 4.3 `api/cron/content-metrics-sync.php` — วาง pre-pass ตรวจอายุ token **ก่อนบรรทัดที่ query แถวคิว (`:34`)** เพื่อให้ทำงานในรอบที่คิวว่างด้วย (ไฟล์ `return` ออกที่ `:58`) · ห่อ try/catch ให้การตรวจที่ล้มไม่หยุดการซิงก์ · เก็บผลไว้ใน buffer ยังไม่พิมพ์
- [x] 4.4 พิมพ์ผล pre-pass **หลังบรรทัดสรุป** ในทั้งสองทางออก — ทางออกคิวว่างที่ `:56-58` และทางออกปกติที่ `:155-164` · จำนวนช่องทาง `unsupported` ไม่ถูกนับใน `errors` ของรอบรัน · ยืนยันด้วยการรันงานจริงแล้วเทียบ `cron_runs.records_processed`/`errors`/`notes` กับบรรทัดสรุป
- [x] 4.5 แจ้งเตือนอายุ credentials: `ops_alert()` คีย์ `token_expiring:{channel_id}` แบบ `$urgent = true` เมื่อเหลือน้อยกว่า 7 วันของ `token_expires_at` **หรือ** `data_access_expires_at` หรือเมื่อ `token_status` เป็น `invalid`/`expired` · เกณฑ์ 7 วันเป็นค่าคงที่จุดเดียว · เทียบเวลาด้วย `TIMESTAMPDIFF` เทียบ `NOW()` ของฐานข้อมูล
- [x] 4.6 `api/brand-content.php:1758` (`?action=channels`) — เพิ่ม `token_expires_at`, `data_access_expires_at`, `token_checked_at`, `token_status`, `token_error` ใน SELECT (ปัจจุบันระบุคอลัมน์แบบเจาะจง คอลัมน์ใหม่จึงไม่ถึง frontend เอง)
- [x] 4.7 `src/hooks/useContent.ts` — เพิ่มฟิลด์ใหม่ใน interface `PublishChannel` (interface อยู่จริงที่ `src/components/content/types.ts:102` — `useContent.ts` เพียง import มาใช้)
- [x] 4.8 `src/components/content/tabs/ChannelManagementSection.tsx` — แสดงวันหมดอายุและป้ายสถานะภาษาไทย · `unsupported` → "ตรวจสอบอายุไม่ได้" · `token_status` เป็น NULL → "ยังไม่เคยตรวจ" · ห้ามแสดงสองกรณีนี้เป็นสถานะปกติ

## 5. `api/health.php` รายงานสถานะ cron

- [x] 5.1 เพิ่มการรายงานเวลารันล่าสุดของ cron และรายชื่องานที่ `enabled=1` แต่เลยกำหนดเกิน `CRON_OVERDUE_SECONDS` จาก `api/lib/cron-runner.php` พร้อมระยะเวลาที่เลยมา ในรูปแบบที่เครื่องอ่านได้และแยก "ปกติ" ออกจาก "งานเลยกำหนด" ได้ (ค่าคงที่ย้ายไป `api/lib/cron-constants.php` ซึ่งไม่มี dependency — `health.php` จึงอ่านค่าเดียวกันได้โดยไม่ต้อง require `config.php`)
- [x] 5.2 ยืนยันด้วยการเรียก endpoint จริงสองกรณี: ตอน cron ทำงานปกติ และตอนจำลองว่าไม่มีแถว `cron_runs` ใหม่ (ต้องไม่ตอบว่าปกติ)

## 6. ทดสอบและตรวจก่อนปิดงาน

- [x] 6.1 สร้าง `scripts/test-ops-alert.php` — เรียก `ops_alert()` ตรง ๆ เพื่อพิสูจน์เส้นทางส่ง in-app + email, รายงานผลแต่ละช่องทาง, และเรียกคีย์เดิมสองครั้งติดกันเพื่อพิสูจน์ว่าครั้งที่สองถูกกลืนเพราะเพดาน (เส้นทาง email อยู่หลังธง `--email=<ที่อยู่>` เพราะ SMTP ของเครื่องนี้ตั้งค่าไว้จริง การรันแบบ urgent กับผู้รับจริงจะส่งอีเมลถึงแอดมิน 5 คนซึ่งถอนคืนไม่ได้)
- [x] 6.2 รัน `php scripts/test-ops-alert.php` ด้วย `/c/xampp/php/php.exe` (php บน PATH ไม่มี `pdo_mysql`) แล้วยืนยันแถวจริงใน `ai_notifications`, `notification_log`, `ops_alerts` และตรวจว่าแอดมินของ tenant อื่นไม่ได้รับแถว
- [x] 6.3 รันงาน cron ทั้งสองงานจริง (`publish-scheduler`, `content-metrics-sync`) แล้วยืนยันว่า `cron_runs.records_processed`/`errors`/`notes` ยังตรงกับบรรทัดสรุป ไม่ถูกข้อความแจ้งเตือนแทรก
- [x] 6.4 `pnpm lint` และ `pnpm build` ผ่าน
- [x] 6.5 ยืนยันทั้ง 3 migration ด้วย `SHOW COLUMNS` / `SELECT` อีกครั้งหลังแก้โค้ดเสร็จ
- [x] 6.6 รายงานให้ผู้ใช้ทราบชัดเจนว่าช่องว่าง "ตัวตั้งเวลาไม่เรียก `tick.php` เลย" ยังไม่ถูกปิด จนกว่าจะมี uptime monitor ภายนอกเรียก `api/health.php` — งานนี้ทำให้ตรวจได้ แต่ไม่มีตัวเรียก
