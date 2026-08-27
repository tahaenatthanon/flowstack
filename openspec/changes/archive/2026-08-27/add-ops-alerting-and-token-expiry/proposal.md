## Why

ระบบล้มเหลวแบบเงียบ — ไม่มีเส้นทางใดที่แจ้งให้ใครรู้เมื่อ cron ล้ม เผยแพร่ไม่ผ่าน หรือ credentials ปลายทางหมดอายุ `api/cron/publish-scheduler.php` และ `api/cron/content-metrics-sync.php` มีโค้ดแจ้งเตือน 0 บรรทัด (เขียน `status='failed'` / `errors` แล้วจบ) และ `api/health.php` ไม่มีอะไรเรียกเลยนอกจาก test script ผลจริงที่วัดได้: Facebook token หมดอายุ **3 ครั้ง** (21, 24, 26 ส.ค. 2026) ไม่มีใครรู้ทั้งสามครั้ง · `content_publish_queue` สะสม failed **60 แถว** ตั้งแต่ 14 มิ.ย. · `content-metrics-sync` ล้มเงียบ 4 รอบติด · cron ตายทั้งตัว 15 ชั่วโมงคืน 24 ส.ค. — ทุกเรื่องถูกพบด้วยการเปิดฐานข้อมูลดูเอง ไม่ใช่ถูกแจ้ง

ยิ่งกว่านั้นคือมีเดดไลน์ที่รออยู่และไม่มีอะไรจับไว้: `data_access_expires_at` ของ Facebook token คือ **24 พ.ย. 2026** ถึงวันนั้น insights จะเริ่มล้มแม้ token ยัง valid ตาราง `publish_channels` มีแค่ `credentials_encrypted` ไม่มีคอลัมน์เก็บวันหมดอายุ ทั้งที่ Graph API `debug_token` บอกวันหมดอายุได้ตรง ๆ

## What Changes

- **เพิ่มกลไกแจ้งเตือนความล้มเหลวระดับปฏิบัติการ (ops alert)** — ตาราง `ops_alerts` สำหรับกันการแจ้งซ้ำ และฟังก์ชันกลางที่ส่ง**แจ้งเตือนในแอป**ทุกกรณี (`ai_notifications` → badge ใน `ChatWidget`) พร้อม**อีเมล**เฉพาะเรื่องด่วน บันทึกทุกการส่งลง `notification_log`
- **เสียบจุดแจ้งเตือน 4 จุด** — `runJob()` (ครอบทุก cron job), การเผยแพร่ล้มเหลวถาวร, error ประเภท token/auth ของการเผยแพร่ (แจ้งทันทีไม่รอครบ retry), และรอบซิงก์ metrics ที่มี error
- **เก็บวันหมดอายุ credentials ลงฐานข้อมูล** — เพิ่มคอลัมน์อายุ token ใน `publish_channels` และเช็คด้วย Graph API `debug_token` ทุกรอบของ `content-metrics-sync` พร้อมแจ้งเตือนล่วงหน้าก่อนหมดอายุ และแสดงวันหมดอายุในหน้าจัดการช่องทาง
- **`api/health.php` รายงานสถานะ cron** — รอบล่าสุดและงานที่เลยกำหนด เพื่อให้ uptime monitor ภายนอกตรวจกรณี "cron ไม่ถูกเรียกเลย" ซึ่งเป็นกรณีที่ alert ในตัว cron ตรวจตัวเองไม่ได้
- **ปิดช่องทางที่พิสูจน์แล้วว่าส่งไม่ได้** — `instagram` (creds ถอดรหัสได้เป็น JSON ที่ไม่มี key), `tiktok` (ส่ง `PULL_FROM_URL` โดยไม่มี `video_url`), `linkedin` (ส่ง path ในเครื่องเป็น `originalUrl`) ตั้ง `is_active=0` เพื่อไม่ให้มีคนตั้งเวลาโพสต์ไปช่องทางที่ไม่มีทางสำเร็จ
- ไม่ใช้ LINE/Telegram ในรอบนี้ — LINE เตรียม settings key แยกไว้ให้เปิดทีหลังได้โดยไม่แก้โค้ด, Telegram ไม่มี bot token

## Capabilities

### New Capabilities
- `ops-failure-alerting`: กลไกแจ้งเตือนความล้มเหลวระดับปฏิบัติการ — ตาราง `ops_alerts`, ฟังก์ชันกลางส่งแจ้งเตือนในแอป + อีเมล, การกันแจ้งซ้ำ, การเลือกผู้รับตาม tenant, จุดที่ต้องแจ้งเตือน และการรายงานสถานะ cron ผ่าน `api/health.php`
- `publish-channel-token-health`: การติดตามอายุ credentials ของช่องทางเผยแพร่ — คอลัมน์เก็บวันหมดอายุใน `publish_channels`, การเช็คด้วย `debug_token`, สถานะสำหรับ platform ที่ตรวจไม่ได้ และการแสดงผลในหน้าจัดการช่องทาง

### Modified Capabilities
- `cron-job-dispatch`: `runJob()` ในตัวรันงานร่วม SHALL แจ้งเตือนเมื่องานล้มเหลวหรือถูกปิดเพราะค้างเกินเพดาน — เดิม spec ระบุหน้าที่ของ `runJob()` ไว้ครบ (สร้างแถว `cron_runs`, แยก type, อ่านจำนวนจาก output, ปิดแถวด้วย `notes`) แต่ไม่มีข้อกำหนดว่าต้องแจ้งใคร
- `post-metrics-sync`: cron ซิงก์ metrics SHALL ตรวจอายุ credentials ของช่องทางก่อนเริ่มซิงก์ **ทุกรอบ รวมรอบที่ไม่มีโพสต์ให้ซิงก์** และ SHALL แจ้งเตือนเมื่อรอบรันมี error — เดิมรอบที่คิวว่างจะ `return` ออกก่อนโดยไม่ตรวจอะไร

## Impact

**ฐานข้อมูล** — ตารางใหม่ `ops_alerts` · คอลัมน์ใหม่ใน `publish_channels` (อายุ token) · ข้อมูล: `is_active=0` ของ 3 ช่องทาง (ย้อนกลับได้ด้วย UPDATE เดียว) · เริ่มเขียน `notification_log` ซึ่งปัจจุบันมี 0 แถว

**โค้ดที่แก้** — `api/lib/cron-runner.php` (`runJob()`), `api/cron/publish-scheduler.php` (เส้นทางล้มเหลว), `api/cron/content-metrics-sync.php` (pre-pass ตรวจ token + แจ้ง error), `api/lib/insights-fetch.php` (ฟังก์ชันตรวจ `debug_token`), `api/notification-utils.php` (`_sendEmailActivity()` คืน `bool` แทน `void` เพื่อให้บันทึก `notification_log` ได้ว่าส่งสำเร็จหรือไม่ — ผู้เรียกเดิมไม่ได้ใช้ค่าที่คืน), `api/health.php`, `api/brand-content.php` (`?action=channels` ต้องคืนคอลัมน์ใหม่), `src/hooks/useContent.ts` (type `PublishChannel`), `src/components/content/tabs/ChannelManagementSection.tsx`

**โค้ดใหม่** — `api/lib/ops-alert.php`, `api/lib/cron-constants.php` (ย้ายค่าคงที่ `CRON_STUCK_SECONDS`/`CRON_NEXT_RUN_MAX_MINUTES`/`CRON_OVERDUE_SECONDS` ออกจาก `cron-runner.php` มาไว้ในไฟล์ที่ไม่มี dependency — `api/health.php` ต้องใช้เพดาน "เลยกำหนด" ตัวเดียวกับ `tick.php` แต่ห้าม require `config.php` ซึ่ง `exit 500` เมื่อไม่มี `JWT_SECRET` ทางเลือกอื่นคือคัดลอกเลข 120 ไปไว้สองที่ซึ่งจะเพี้ยนเงียบ ๆ), `scripts/test-ops-alert.php`

**ข้อจำกัดที่ต้องรู้** — งานนี้ปิดกรณี "cron ไม่ถูกเรียกเลย" ไม่ได้ด้วยตัวเอง เพราะ alert ทุกตัวอยู่ในเส้นทาง cron ต้องมี uptime monitor **ภายนอก** เรียก `api/health.php` ซึ่งอยู่นอกขอบเขต change นี้ (ผู้ดูแลระบบต้องตั้งค่า) · แจ้งเตือนในแอปเห็นได้เฉพาะเมื่อมีคนเปิดเว็บ จึงต้องมีอีเมลคู่สำหรับเรื่องที่รอไม่ได้

**ที่ไม่แตะ** — `notification_settings` (admin 4 จาก 5 คนไม่มีแถว การอิงตารางนี้จะทำให้ alert ถึงคนเดียว) และ `api/notification-dispatch.php` (เป็น daily briefing ส่วนบุคคลตาม `briefing_time` คนละเรื่องกับ ops alert)
