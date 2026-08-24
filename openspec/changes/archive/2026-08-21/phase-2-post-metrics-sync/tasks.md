## 1. Migration ตาราง content_post_metrics (งาน 2.1)

- [x] 1.1 สร้าง `database/migrations/YYYY_MM_DD_HHMMSS_create_content_post_metrics.sql` — ตาราง time-series ที่มีคอลัมน์ `id CHAR(36)`, `tenant_id`, `content_item_id`, `channel_id`, `platform`, `views INT`, `likes INT`, `fetched_at DATETIME`, `created_at DATETIME` + FK `ON DELETE CASCADE`/`SET NULL`
- [x] 1.2 รัน migration ด้วย `/c/xampp/mysql/bin/mysql.exe -u root flowstack < <file>` แล้วยืนยันด้วย `SHOW COLUMNS FROM content_post_metrics`

## 2. insights-fetch (งาน 2.2)

- [x] 2.1 สร้าง `api/lib/insights-fetch.php` — ฟังก์ชัน fetch แยก platform ด้วย `match()` (facebook/instagram) ตามแบบ `dispatch_content()`
- [x] 2.2 ฝั่ง facebook: เรียก Graph API `/{post_id}/insights` ด้วย Page token จาก creds `{ page_id, access_token }` โดยใช้ `content_publish_queue.platform_post_id` เป็นคีย์; map metrics (reactions → likes, `post_video_views` → views) พร้อม comment ระบุที่มา + ทางถอยยิง metric แยกทีละตัวเมื่อ Graph API ปฏิเสธชื่อ metric (code 100)
- [x] 2.3 ฝั่ง instagram: ใช้ creds `{ ig_user_id, access_token }` ดึง engagement ของ media
- [x] 2.4 platform อื่นคืนผล "ไม่รองรับในเฟสนี้" (ไม่ error 500)

## 3. cron ซิงก์ metrics (งาน 2.3)

- [x] 3.1 สร้าง `api/cron/content-metrics-sync.php` — select แถว `content_publish_queue` ที่ `status='sent'` และ `platform_post_id` ไม่ NULL join `publish_channels` (เอา platform/creds) และ `content_items` (เอา tenant) — ข้ามแถวที่ไม่มี `platform_post_id` และ platform ที่ไม่รองรับอย่างเงียบ ๆ
- [x] 3.2 เรียก fetch แล้ว INSERT แถวใหม่ลง `content_post_metrics` (พร้อม `channel_id`) ทุกครั้งที่รัน และเขียน **ผลรวมทุกช่องทาง** ลง `content_items.views`/`likes`
- [x] 3.3 ลงทะเบียนใน `cron_jobs` (`type='include'`, `file_path='api/cron/content-metrics-sync.php'`, คอลัมน์ `` `key` `` เป็น reserved word ต้อง backtick) และให้ stdout ตรงรูปแบบที่ `cron-manager.php:114-115` ใช้ regex ดึง `records_processed`/`errors`

## 4. แก้ analytics-recalculate (งาน 2.4)

- [x] 4.1 แก้ `api/brand-content.php` `analytics-recalculate` — เปลี่ยน `DAYOFWEEK(created_at)`/`HOUR(created_at)` เป็น `DAYOFWEEK(published_at)`/`HOUR(published_at)`
- [x] 4.2 แก้เกต ≥10 published — เปลี่ยนข้อความอังกฤษ `'Need at least 10 published posts to calculate'` (บรรทัด 2821) เป็นภาษาไทยตามกฎ CLAUDE.md และระบุจำนวนที่ยังขาด (เช่น "ขาดอีก N รายการ")
- [x] 4.3 บันทึกที่มาของน้ำหนัก `likes × 2` เป็น comment ในโค้ด (คงค่าเดิม ไม่ refactor)

## 5. UI (งาน 2.5)

- [x] 5.1 เติมข้อมูลจริงลง `src/components/content/AnalyticsSocialTab.tsx` — การ์ด "Engagement รวม" ดึงจาก views/likes จริง (TanStack React Query) พร้อม label "เฉพาะ Facebook/Instagram"
- [x] 5.2 คงการ์ด "ผู้ติดตามรวม"/"Reach รวม"/"Engagement Rate" เป็น "—" พร้อม hint และไม่ใส่ mock data
- [x] 5.3 ปรับ notice card ให้อธิบายขอบเขตแพลตฟอร์ม (Facebook/Instagram) ข้อความภาษาไทย

## 6. งานจัดหา credentials (งาน 2.0 — ไม่ใช่โค้ด · BLOCKED รอเจ้าของเพจ)

> ตรวจ creds จริงในฐานข้อมูลแล้วพบว่าเป็นค่า placeholder: FB `page_id=123546` (6 หลัก, จริงต้อง 15–16 หลัก) + `access_token` ยาว 7 ตัวอักษร; IG ถอดรหัสแล้วไม่มีคีย์ `ig_user_id`/`access_token` เลย → ไม่ใช่แค่เพิ่ม scope แต่ต้องขอ token ใหม่ทั้งชุด กลุ่มนี้ไม่ขวางกลุ่ม 1–5 ซึ่งพิสูจน์ด้วย mock ได้
>
> **อัปเดต 21 ส.ค. 2026 (ยิง Graph API จริงตามที่ได้รับอนุมัติ):** FB channel ถูกอัปเดตแล้ว — `page_id=1303486898461006` (16 หลัก ใช้ได้) แต่ `access_token` เป็น hex 32 ตัวอักษร ซึ่งเป็นรูปแบบของ **App Secret ไม่ใช่ Page access token** (ของจริงขึ้นต้น `EAA` ยาว 200+) ผลตรวจ: `GET /me`, `GET /{page_id}`, `GET /{page_id}/posts` ตอบ HTTP 400 `OAuthException code=190 Invalid OAuth access token - Cannot parse access token` ทั้งสามรายการ → ยังยิง `/{post_id}/insights` ไม่ได้ (และระบบยังไม่มีแถว `content_publish_queue` ของ facebook/instagram เลย จึงต้องดึง post id จากเพจ) IG creds ยังว่างเปล่า
>
> ผลพลอยได้: การยิงจริงยืนยันว่า `_insights_get()` ไม่ assume-ok เมื่อ HTTP ≥ 400 — มันคืนข้อความ error จริงของ Graph API ออกมา ไม่ได้เขียน 0 ทับข้อมูล
>
> **อัปเดต 21 ส.ค. 2026 รอบสอง (token ชุดที่สอง):** token ที่กรอกเข้ามาใหม่เป็น **User token** ไม่ใช่ Page token — `/me` ผ่าน แต่ `/{page_id}/posts` ตอบ 190 แลกเป็น Page token ได้จาก `GET /me/accounts` (เพจ "FlowStack Test Page" `page_id=1285427471318346`, fan_count 2, มีโพสต์จริง 5 รายการ) และ Page token นั้นเรียก `/{post_id}/insights` **สำเร็จ HTTP 200** → งาน 6.2 ผ่านแล้ว
>
> **ข้อค้นพบสำคัญ (ตรวจ v19.0–v26.0, v27.0 ยังไม่มี):** metric ตระกูล impressions ถูกยกเลิกหมดแล้ว — `post_impressions`, `post_impressions_unique`, `post_impressions_organic`, `post_views`, `post_views_unique`, `post_engaged_users`, `post_activity` ทุกตัวตอบ `(#100) The value must be a valid insights metric` ที่ยังใช้ได้: `post_video_views` (=0 ในโพสต์ข้อความ), `post_clicks` (=2), `post_reactions_by_type_total` (={"like":1}) → **ไม่มีตัวเลข "คนเห็น" ระดับโพสต์ให้ดึงอีกแล้ว** โค้ดจึง map `views ← post_video_views` (โพสต์ที่ไม่ใช่วิดีโอจะได้ 0 = ไม่มีข้อมูล ไม่ใช่ไม่มีคนเห็น) และเพิ่มทางถอยยิง metric แยกทีละตัวกันกรณี Meta ยกเลิกชื่ออื่นอีก
>
> **ยังค้าง:** (ก) Page token ที่ใช้ทดสอบหมดอายุแล้ว 21 ส.ค. 2026 11:00 น. — ต้องแลก long-lived ด้วย App Secret (`app_id=1303486898461006`) ผ่าน `fb_exchange_token` หรือใช้ System User token ที่ไม่หมดอายุ แล้วบันทึกลง channel (DB ยังเก็บ User token ซึ่งเรียก insights ไม่ได้) (ข) เพจนี้ **ไม่มี `instagram_business_account` ผูกอยู่** → IG creds ยังหามาไม่ได้ ต้องผูก IG business account กับเพจก่อน

- [ ] 6.1 ขอ Page access token ของจริง (page id จริง + long-lived token + scope `read_insights`, `pages_read_engagement`) สำหรับ channel facebook (`7b144d1b-…`) และ creds `{ ig_user_id, access_token }` ของ IG (`64f08913-…`) แล้วอัปเดตผ่านหน้า Channel Management
      — FB: ได้ Page token ที่ใช้งานได้จริงแล้ว แต่เป็น short-lived (หมดอายุแล้ว) · IG: ยังผูกบัญชีไม่ได้
- [x] 6.2 ทดสอบเรียก `/{post_id}/insights` ด้วย token นั้นสำเร็จ (ต้องได้รับอนุมัติให้ยิง traffic ออกไป `graph.facebook.com` ก่อน)
      — ยิงจริงด้วย Page token: HTTP 200 ทั้งโพสต์ข้อความและโพสต์วิดีโอ ได้ `post_reactions_by_type_total` และ `post_video_views` กลับมา

## 7. Verification

- [x] 7.1 รัน `pnpm lint` และ `pnpm build` ผ่าน (กฎ VERIFY BEFORE DONE)
- [x] 7.2 ทดสอบ cron ด้วย mock insights endpoint + seed data (ไม่มี traffic ไป production): `content_items.views > 0` อย่างน้อย 1 แถว + `content_post_metrics` มีแถว time-series เพิ่มขึ้นทุกรอบรัน
- [x] 7.3 ทดสอบ `analytics-recalculate` กับข้อมูล seed: จัดกลุ่มด้วย `published_at` (คอนเทนต์สร้าง 09:00 เผยแพร่ 20:00 ต้องเข้ากลุ่มชั่วโมง 20) และเกตบอกจำนวนขาดเป็นภาษาไทย
- [x] 7.4 `scripts/test-phase2-metrics-sync.php` — 38 assertions ผ่านหมด (M1–M6, S1, A1–A2); mock ปฏิเสธชื่อ metric ที่ Graph API จริงไม่รับอีกแล้ว เพื่อให้ชุดทดสอบจับได้ทันทีถ้าโค้ดกลับไปขอ metric ที่ตายแล้ว
