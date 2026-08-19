## Context

เส้นทางเผยแพร่คอนเทนต์มีสามชั้น: UI (`SchedulePublishDialog.tsx`, `ContentDashboardPage.tsx`) → API (`api/content-publish.php` action `send_now`/`schedule`) → ชั้น dispatch (`api/lib/publish-dispatch.php`) และมี cron แยก (`api/cron/publish-scheduler.php`) กินคิว `pending`

เหตุการณ์ 19 ส.ค. 2026 12:30: มี 16 request เข้า `send_now` ภายใน 11 วินาที POST คอนเทนต์ชิ้นเดียวไป Lotus Domino production 16 ครั้ง ทุกแถวได้ `sent` และคอนเทนต์กลายเป็น `published` ทั้งที่ยังไม่อนุมัติ (`approved_at IS NULL`) ต้นตอมาจากสามจุดที่แยกกันแต่ทับซ้อนกัน:

1. **ชั้น dispatch โกหก** — `_dispatch_post()` (บรรทัด 99-108) ตรวจ HTTP status ถูกต้องอยู่แล้ว แต่ `dispatch_lotusdomino()` (บรรทัด 464-471) พลิก `success=false` กลับเป็น `true` เมื่อมี `http_code` ใด ๆ และไม่เก็บ response body ทำให้ `sent` ไม่มีค่าเป็นหลักฐาน
2. **ไม่มี idempotency** — `send_now` (บรรทัด 87-156) สร้างแถวคิวใหม่ทุกครั้งที่ถูกเรียก ไม่ตรวจว่าคู่ `(content_id, channel_id)` เพิ่งถูกส่งไปหรือยัง
3. **ไม่มี approval gate** — บรรทัด 96 คอมเมนต์ว่า "allow any status" จงใจข้ามการตรวจอนุมัติ

จุดที่ 4 (frontend ยิง 16 request) เป็นงานวินิจฉัยอ่านโค้ดอย่างเดียว บันทึกไว้เป็นหลักฐานว่าทำไม guard ฝั่ง server จึงจำเป็น (ไม่พึ่ง UI)

ข้อจำกัดจากสภาพจริงของฐานข้อมูล (`SHOW CREATE TABLE content_publish_queue`): `status` เป็น ENUM('pending','processing','sent','failed') — **ไม่มี 'skipped'**; ไม่มี composite index บน `(content_id, channel_id, status)`; `error_msg` เป็น varchar(500)

## Goals / Non-Goals

**Goals:**
- `status='sent'` ต้องพิสูจน์ได้ว่าปลายทางรับจริง (ไม่มี cURL error **และ** HTTP < 400 **และ** เก็บ response body ไว้ตรวจย้อนหลัง)
- คู่ `(content_id, channel_id)` เดียวกันที่ถูกยิงซ้ำในกรอบเวลาสั้น ๆ ต้อง dispatch แค่ครั้งเดียว ทนต่อ race ของ request ที่เข้าพร้อมกัน
- คอนเทนต์ที่ยังไม่อนุมัติต้องกดส่งไม่ได้ผ่าน `send_now` โดยไม่มี request รั่วออกไปเลย
- UI รายงานผลรายช่องทางตามจริง (สำเร็จ/ข้าม/ล้มเหลว) เลิกขึ้น "ส่งสำเร็จ!" แบบเหมารวม
- ทดสอบทั้งหมดได้ด้วย local mock ไม่มี traffic ไป production

**Non-Goals:**
- `dispatch_custom()` (บรรทัด 499-502) ที่ตั้ง `success=true` แบบไม่มีเงื่อนไข — บั๊กตระกูลเดียวกันแต่คนละ platform ไว้ change ถัดไป
- dedupe การ์ด "รายการที่ล้มเหลว" ใน `content-analytics.php` (`LIMIT 8` ไม่ dedupe) — เมื่อมี idempotency guard การกดซ้ำจะถูกข้าม ความเสียหายหมดไป เหลือแค่ความสวยงาม UI
- approval gate บนเส้นทาง `schedule` และ cron — จะทำให้แถวที่เข้าคิวไว้ก่อนหยุดทันทีตอน deploy ต้องประเมินแยก
- เพิ่มค่า `'skipped'` เข้า ENUM ของ `status` — สถานะ skipped เป็นผลตอบรายช่องทางใน API response เท่านั้น ไม่เขียนลงคอลัมน์ `status`
- WordPress `test-channel` / `published_url` (งาน 2.2/5.1 ที่ archive) — ติด credentials จริง

## Decisions

### D1 — ลบบล็อกพลิกค่าใน dispatch_lotusdomino ไม่แตะ _dispatch_post
ลบบรรทัด 464-471 ทิ้ง ปล่อยให้ผลจาก `_dispatch_post()` ไหลออกตามจริง แล้วตั้ง `platform_post_id` เฉพาะเมื่อ `success` เป็นจริงเท่านั้น `_dispatch_post()` คืน `http_code` และ `response` มาอยู่แล้ว (บรรทัด 105-106) จึงไม่ต้องแก้ตัวมันเลย

**ทางเลือกที่ไม่เลือก:** เพิ่ม flag ให้ Domino ยอมรับ 2xx อย่างเดียวแบบ configurable — เกินความจำเป็น ปัญหาคือการพลิกค่า ไม่ใช่ช่วง status ที่ยอมรับ

### D2 — เก็บ response ที่คอลัมน์ใหม่ response_snippet TEXT NULL
ผู้เรียก (`send_now` และ cron) อ่าน `$result['response']` (เมื่อสำเร็จอ่าน `$result['data']`) แปลงเป็นสตริง (`json_encode` ถ้าเป็น array) ตัดด้วย `mb_substr(..., 0, 2000)` แล้วเขียนลง `response_snippet` ทั้งเส้นทางสำเร็จและล้มเหลว

เลือก `TEXT NULL` ไม่ใช่ `varchar` เพราะ response ยาวไม่แน่นอน และไม่ยัดลง `error_msg` (varchar(500)) เพราะสองคอลัมน์นี้ตอบคนละคำถาม: `error_msg` = "ทำไมถือว่าล้มเหลว", `response_snippet` = "ปลายทางพูดว่าอะไรจริง ๆ"

**ทางเลือกที่ไม่เลือก:** ตารางแยก `content_publish_dispatch_log` — เกินขอบเขต phase นี้ คอลัมน์เดียวพอพิสูจน์เหตุการณ์ 19 ส.ค.

### D3 — idempotency: advisory lock + หน้าต่างเวลา 10 นาที
ต่อคู่ `(content_id, channel_id)` ก่อน dispatch:
1. `GET_LOCK(CONCAT('sn:', MD5(CONCAT(content_id, ':', channel_id))), 5)` — ชื่อ lock ยาว 35 ตัวอักษร อยู่ใต้เพดาน 64 ตัวของ MariaDB (คู่ raw uuid+uuid = 76 ตัว เกิน)
2. ในเขตล็อก: นับแถวที่ `content_id=? AND channel_id=? AND status IN ('processing','sent') AND created_at >= NOW() - INTERVAL 10 MINUTE` ถ้าพบ → คืน `skipped` ไม่ dispatch
3. ถ้าไม่พบ → INSERT แถว `processing` แล้ว dispatch
4. `RELEASE_LOCK(...)` ใน `finally` เสมอ
5. ถ้า `GET_LOCK` คืน 0 (มีคนถืออยู่) → คืน `skipped` ไม่ใช่ error

**ทำไมไม่ใช้ `SELECT ... FOR UPDATE`:** ไม่มี composite index บน `(content_id, channel_id, status)` → InnoDB จะ lock ช่วงกว้าง (gap lock) หรือทั้งตาราง เสี่ยงกว่าเดิม การเพิ่ม index เพื่อรองรับ FOR UPDATE เป็นการเปลี่ยน schema ที่ใหญ่กว่า advisory lock ที่ไม่แตะ index เลย

**ทำไม 10 นาที:** ยาวพอกันดับเบิลคลิก/รีเทิร์นซ้ำ/หลาย tab แต่สั้นพอให้ตั้งใจส่งใหม่ได้ ค่านี้เป็นค่าคงที่ในโค้ด (ดู Open Questions — เจ้าของระบบอาจขอ "ห้ามซ้ำถาวรเมื่อ sent แล้ว")

**ทำไม `failed` ไม่นับ:** ปุ่ม "ลองส่งใหม่" ต้องทำงานทันทีหลังล้มเหลว

### D4 — approval gate ก่อน SEO gate ใช้ approved_at ไม่ใช่ status
`send_now` โหลด content ด้วย `SELECT *` อยู่แล้ว (บรรทัด 96-100) ดังนั้น `$content['approved_at']` มีในมือ ไม่ต้อง query เพิ่ม ตรวจ `if (empty($content['approved_at'])) jsonError('...ต้องอนุมัติก่อน...', 422);` วางไว้ **ก่อน** SEO gate (บรรทัด 103) เพราะถูกกว่าและเป็นเงื่อนไขที่เด็ดขาดกว่า

ใช้ `approved_at` ไม่ใช่ `status='approved'` เพราะ `approved_at` เป็นหลักฐานเวลาที่อนุมัติจริง และตรงกับถ้อยคำที่ผู้ใช้สั่ง ("บล็อกเมื่อ `approved_at IS NULL`")

**ทางเลือกที่ไม่เลือก:** ตรวจในชั้น dispatch — สายเกินไป แถวคิวถูกสร้างแล้ว เจตนาคือ "ไม่มี request ออกเลย"

### D5 — รายงานผลรายช่องทาง 3 สถานะ ทั้ง API และ UI
`send_now` คืน `results[]` ที่แต่ละรายการมี `{channel_id, status: 'success'|'skipped'|'failed', ...}` อยู่แล้วบางส่วน เพิ่ม `skipped` เข้าไป ฝั่ง UI:
- `SchedulePublishDialog.handleSubmit` เลิก toast "ส่งสำเร็จ!" แบบไม่มีเงื่อนไข → อ่าน `results[]` นับสำเร็จ/ข้าม/ล้มเหลว แล้วเลือกข้อความ+variant ตามจริง ปิด dialog เฉพาะเมื่อไม่มีล้มเหลว (หรือปิดเสมอแต่โชว์ผลตามจริง — ดู tasks)
- `useContent.ts` (`useSendNow`) ส่งต่อ `results[]` ให้ผู้เรียกได้

**ทางเลือกที่ไม่เลือก:** ให้ API ตอบ non-200 เมื่อมีช่องล้มเหลว — พังสัญญาเดิมของ endpoint (batch ที่บางช่องสำเร็จ) และทำให้ React Query เข้า onError ทั้งก้อน ตัดสินใจคง 200 + ให้ UI อ่าน `results[]`

### D6 — root cause ฝั่ง frontend (งานอ่านโค้ด บันทึกที่นี่)
16 request มาจากการที่ผู้ใช้กดปุ่ม "ลองส่งใหม่" ซ้ำ ๆ บนการ์ดที่ไม่หายไป กลไก:
- `content-analytics.php:84-96` ดึงแถว `failed` แบบ **ไม่ dedupe** (`LIMIT 8`) → 16 แถว failed กลายเป็นการ์ดซ้ำหลายใบ
- แต่ละใบมีปุ่มเดียวกันเรียก `handleRetry(content_id, channel_id)` → `sendNow.mutate(...)` (`ContentDashboardPage.tsx:88-101`)
- `send_now` สร้างแถว **ใหม่** ไม่ได้อัปเดตแถว failed เดิม → `refetchBi()` ยังเห็นการ์ดแดงเดิม ผู้ใช้เข้าใจว่ายังไม่ส่ง กดใบถัดไป
- `disabled={sendNow.isPending}` กันเฉพาะระหว่าง request บิน กดข้ามการ์ด/หลัง settle ยังยิงได้
- ผลตรงข้ามที่พบเพิ่ม: dialog ขึ้น "ส่งสำเร็จ!" แม้ทุกช่องล้มเหลว เพราะ API คืน 200

สรุป: server-side idempotency guard (D3) คือทางแก้ที่ถูกต้อง เพราะแก้ที่เหตุ (ยิงซ้ำ) ไม่ใช่ที่ผล (การ์ดซ้ำ) — เวลาคลิกเป๊ะ ๆ กู้จากโค้ดไม่ได้ ต้องดู Apache access log ถ้าต้องการ timeline จริง

## Risks / Trade-offs

- **ตัวเลข `failed` จะเพิ่มขึ้นหลัง deploy** → นี่คือการเปิดเผยความล้มเหลวที่เคยถูกกลบ ไม่ใช่ regression สื่อสารกับเจ้าของระบบก่อน และใช้ `response_snippet` ประกอบการวินิจฉัย
- **advisory lock ค้างถ้า connection ตายกลางคัน** → MariaDB ปล่อย lock อัตโนมัติเมื่อ session จบ และ timeout ที่ 5 วินาที จึงไม่ค้างถาวร
- **หน้าต่าง 10 นาทีอาจบล็อกการส่งใหม่ที่ตั้งใจ** → `failed` ไม่ถูกบล็อกอยู่แล้ว กรณีที่โดนคือ "sent สำเร็จจริงแต่อยากส่งซ้ำใน 10 นาที" ซึ่งพบยากและ workaround ได้ด้วยการรอ
- **คอนเทนต์ที่กำลังใช้งานตอนนี้ (`d698c9f2`) มี `approved_at IS NULL`** → หลัง deploy จะกดส่งไม่ได้จนกว่าจะ approve เป็นพฤติกรรมที่ตั้งใจ ต้องแจ้งผู้ใช้
- **`response_snippet` อาจมีข้อมูลอ่อนไหวจากปลายทาง** → ตัดที่ 2000 ตัวอักษรและเก็บใน DB เดียวกับ error เดิม ระดับความเสี่ยงเท่าของเดิม

## Migration Plan

1. Migration `database/migrations/YYYY_MM_DD_HHMMSS_add_response_snippet_to_publish_queue.sql`: `ALTER TABLE content_publish_queue ADD COLUMN response_snippet TEXT NULL AFTER error_msg;`
2. รันทันทีด้วย `/c/xampp/mysql/bin/mysql.exe -u root flowstack < <file>` แล้วยืนยันด้วย `SHOW COLUMNS FROM content_publish_queue` (forward-only ตามกฎ repo)
3. แก้โค้ด PHP (D1–D4) → แก้ frontend (D5) → เขียน mock test สำหรับ D1/D3
4. **Rollback:** โค้ดย้อนด้วย git; คอลัมน์ `response_snippet` เป็น NULL ปล่อยทิ้งได้ ไม่มี migration ถอย (repo เป็น forward-only) การมีคอลัมน์ที่ไม่ถูกใช้ไม่กระทบระบบ

## Open Questions

- **หน้าต่าง idempotency: 10 นาที หรือ "ห้ามซ้ำถาวรเมื่อ sent แล้ว"?** — ค่าเริ่มต้น 10 นาที เจ้าของระบบเลือกเปลี่ยนเป็นถาวรได้ (ตัด `created_at >= ...` ออกจากเงื่อนไข ให้เหลือแค่ `status='sent'`)
- **จะ backfill สถานะ `sent` เดิมที่พิสูจน์ไม่ได้อย่างไร?** — ข้อเสนอ: ไม่แตะข้อมูลเดิม ถือว่าเป็น unverified โดยปริยาย (แถวก่อน change นี้ไม่มี `response_snippet`)
- **ต้องการ timeline คลิกจริงของเหตุการณ์ 19 ส.ค. หรือไม่?** — ถ้าต้องการ ต้องดึงจาก Apache access log แยกต่างหาก อยู่นอกขอบเขต change นี้

## ผลทดสอบ (หลักฐาน)

รัน `php scripts/test-publish-dispatch-hardening.php` (19 ส.ค. 2026) → **PASS 32 / FAIL 0**
ปลายทางทุกเคสเป็น local mock `scripts/dev-mocks/publish-mock.php` — **ไม่มี traffic ไป `ktnbs.com` เลย** ทั้ง 32 การตรวจ

เครื่องมือ:
- `scripts/dev-mocks/publish-mock.php` — คุม HTTP status ด้วย `?code=`, บันทึก hit log ต่อ `?tag=` ที่ `sys_get_temp_dir()/flowstack-publish-mock-hits.log` เพื่อ **พิสูจน์เชิงประจักษ์ว่า "มี/ไม่มี request ออกไปจริง"** ไม่ใช่ดูจากโค้ด
- `scripts/test-publish-dispatch-hardening.php` — สร้าง channel/content ชั่วคราวเอง และลบทิ้งครบท้ายสคริปต์ (รอบนี้ลบ queue 3 / content 3 / channel 2)

| กลุ่ม | ครอบคลุม | ผล |
|---|---|---|
| U1–U4 | `dispatch_lotusdomino()`: 500 → `success=false` + error มีเลข 500 + ไม่มี `platform_post_id`; 404 → ล้มเหลว; 200 → สำเร็จ + มี `platform_post_id`; cURL error (พอร์ตปิด) → ล้มเหลวและระบุว่าเป็น cURL error | PASS (D1) |
| E1 | `approved_at IS NULL` → HTTP 422 ข้อความพูดเรื่องอนุมัติ, **0 แถวคิว**, hit log ไม่ขยับ (ไม่มี request ออกเลย) | PASS (D4) |
| E2 | ปลายทาง 500 end-to-end → แถว `failed`, `error_msg` มีเลข 500, `response_snippet` ไม่ NULL, content **ไม่กลายเป็น `published`** | PASS (D1+D2) |
| E3 | ปลายทาง 200 end-to-end → แถว `sent`, `platform_post_id` = `lotusdomino_…`, `response_snippet` ไม่ NULL (path สำเร็จเดิมไม่ regress) | PASS (D1+D2) |
| E4 | ยิงคู่ `(content_id, channel_id)` เดิมซ้ำทันที → `results[0].status='skipped'` มีเหตุผลภาษาไทย, **ไม่มีแถวใหม่**, hit log ไม่ขยับ | PASS (D3) |
| E5 | คู่ที่แถวล่าสุดเป็น `failed` → ไม่ถูกข้าม มีแถวใหม่ และ hit log เพิ่มขึ้นจริง | PASS (D3) |

หมายเหตุ envelope: `jsonResponse()` ห่อ payload ไว้ใต้ key `data` (`api/config.php:163`) และ `apiFetch` unwrap ให้ (`src/lib/api.ts:179`) — harness จึงอ่าน `body.data.results[]` ให้ตรงกับที่ frontend เห็น

ปิดช่องว่างของงาน 5.2 ที่ archive ไว้: การรายงานผล `send_now` ตามจริงถูกพิสูจน์ด้วย E2/E4/E5 แล้ว (ล้มเหลวไม่ถูกรายงานว่าสำเร็จอีก)

ยังพิสูจน์ไม่ได้ในรอบนี้ (ต้องมี credential จริง): WordPress path ของงาน 2.2/5.1 ที่ archive ไว้ และการยิงจริงไป Domino production ซึ่ง **ยังไม่ได้รับอนุมัติ**
