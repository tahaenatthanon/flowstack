## 1. เพิ่ม lotusdomino เข้า dispatch_content (งาน 0.5)

- [x] 1.1 สกัด logic จาก `api/brand-content.php` inline handler (บรรทัด 2276, 2550, 3178) ออกมาเป็น `dispatch_lotusdomino(array $channel, array $creds, string $title, string $body, string $excerpt, string $imgUrl, array $seo = []): array` ใน `api/lib/publish-dispatch.php`
- [x] 1.2 ฟังก์ชันโพสต์ JSON ไป `channel.endpoint_url` (POST, header `Content-Type: application/json`, `CURLOPT_SSL_VERIFYPEER => false`) ด้วย payload ฟิลด์ `Date`, `Title`, `Body`, `Excerpt`, `Slug`, `SEOTitle`, `MetaDescription`, `Tags`, `AttachPhoto` และคืน `success=false` เมื่อ `endpoint_url` ว่าง
- [x] 1.3 คงพฤติกรรม "assume ok เมื่อไม่มี curl error" (คืน `success=true` ถ้าไม่มี curl error) และคืน error เมื่อ curl error
- [x] 1.4 เพิ่ม arm `'lotusdomino' => dispatch_lotusdomino($channel, $creds, $title, $body, $excerpt, $imgUrl)` ใน `match($platform)` ของ `dispatch_content()`
      หมายเหตุ: arm ส่ง `$seo` เพิ่มด้วย (`dispatch_lotusdomino(..., $imgUrl, $seo)`) โดย `dispatch_content()` สกัด `date/slug/seo_title/meta_description/tags` จาก `article_content` JSON แล้ว fallback ไปคอลัมน์ `content_items` — ตามลำดับ fallback ของ inline handler เดิม ถ้าไม่ส่ง ฟิลด์ SEO ใน payload จะว่างเปล่าเสมอ ซึ่งเป็น regression จากพฤติกรรมเดิม
- [x] 1.5 เติม credentials หรือตั้ง `is_active = 0` ให้ channel `Lotus Notes (KTNBS)` (`c920cabb-…`) ที่ `credentials_encrypted = NULL`
      สรุป: **ไม่ต้องทำทั้งสองอย่าง** — `dispatch_lotusdomino()` ไม่อ่าน `$creds` เลย (ตรงกับ inline handler เดิมที่ไม่ใช้ creds สำหรับ lotusdomino) และ probe endpoint `https://www.ktnbs.com/transform.nsf/ParseJSONString` ได้ HTTP 200 โดยไม่ต้อง auth → `credentials_encrypted = NULL` ไม่ใช่ blocker ความเสี่ยงที่ design.md ประเมินไว้ ("error จะเปลี่ยนเป็น missing credentials") ไม่เกิดขึ้น การปิด `is_active` จะทำให้ DoD เส้นทาง cron ไม่ผ่านโดยไม่มีเหตุผล
- [x] 1.6 ตรวจว่าเสร็จ: ไม่มี error ใหม่ `Unknown platform: lotusdomino` (query `content_publish_queue` หา error นี้)
      พิสูจน์ระดับฟังก์ชันแล้วด้วย local mock endpoint (ครบทุก scenario ใน spec): endpoint ว่าง → `Lotus Domino endpoint_url missing` (ไม่ใช่ `Unknown platform`) / mock ตอบ 200 → `success=true` + `platform_post_id` / curl error → `success=false` / payload ได้ครบ 9 ฟิลด์ `Date,Title,Body,Excerpt,Slug,SEOTitle,MetaDescription,Tags,AttachPhoto`
      **พิสูจน์ระดับ queue ด้วยข้อมูลจริงแล้ว (19 ส.ค. 2026):** `SELECT MIN/MAX(created_at), MAX(updated_at) FROM content_publish_queue WHERE error_msg LIKE '%Unknown platform%'` = 16 แถว ช่วง 14 มิ.ย. – **18 ส.ค. 16:16:47** และ `updated_at` ล่าสุดก็ 18 ส.ค. → ทุกแถวเกิด**ก่อน**แก้โค้ด ไม่มี error ใหม่เลย
      หลักฐานฝั่งบวก: มีการ dispatch lotusdomino จริง 16 ครั้งวันที่ 19 ส.ค. 12:30:09-12:30:20 (ผ่าน `send_now`) ได้ `status='sent'` + `platform_post_id = lotusdomino_…` ทั้ง 16 แถว ไม่มีแถวใดคืน `Unknown platform` → arm ใน `match()` ทำงานจริงบนเส้นทางแอป ไม่ใช่แค่ mock

## 2. แก้ credentials WordPress channel (งาน 0.6)

- [x] 2.1 กรอก WordPress Application Password ให้ channel `351b7173-…` โดย creds ที่ถอดรหัสแล้วมี key `username` และ `app_password` ครบ (ตรง `publish-dispatch.php:346`)
      ผลตรวจ: creds มี key `username` (19 ตัว) และ `app_password` (7 ตัว) **ครบอยู่แล้ว** → เกณฑ์ตามตัวอักษรของ proposal บรรทัด 8 ("ถอดรหัสแล้วมี key `username` และ `app_password` ครบ") ผ่าน; blocker ตัวจริงคือ `endpoint_url` เป็นค่าว่าง และ `app_password` 7 ตัวสั้นกว่า WP Application Password ปกติ (~24-29 ตัว) จนน่าจะไม่ใช่ค่าจริง
      ประวัติการตัดสินใจ: ปิด `is_active = 0` (19 ส.ค.) → เจ้าของระบบสั่งเปิดกลับ → เจ้าของระบบเลือก **"ปิด `is_active` ไว้ก่อน"** อีกครั้งผ่าน interactive dialog หลังเห็นผลกระทบครบ (migration `2026_08_19_150000_deactivate_wordpress_youtube_channels_again.sql`)
      หลักฐานว่า blocker หมดฤทธิ์: `is_active = 0` + scheduler กรอง `pc.is_active = 1` แล้ว → รัน `php api/cron/publish-scheduler.php` ขณะมี pending 4 แถวที่ due และชี้ channel นี้ ได้ผล `No pending entries.` ไม่เกิดแถว failed ใหม่ (failed คงที่ 25 แถว)
- [ ] 2.2 ตรวจว่าเสร็จ: เรียก `?action=test-channel` ผ่าน
      **เลื่อนออกไป (deferred) — ไม่ใช่ blocker ของ DoD แล้ว** ยังไม่ได้เรียก `test-channel` และจะเรียกไม่ผ่านแน่นอนเพราะ `endpoint_url` ว่าง จึงไม่ติ๊กเสร็จ
      ทำได้เมื่อเจ้าของระบบส่ง URL เว็บ WordPress + Application Password จริงมาให้ (กรอกแล้วเปิด `is_active` กลับ แล้วเรียก `?action=test-channel` ให้ผ่าน)

## 3. แก้ platform ว่างของ Youtube channel (งาน 0.7)

- [x] 3.1 ตั้ง `platform` ให้ถูกต้อง หรือตั้ง `is_active = 0` ให้ channel `Youtube` (`6e77f494-…`) ที่ `platform = ''`
      ประวัติการตัดสินใจ: ปิด `is_active = 0` (19 ส.ค.) → เจ้าของระบบสั่งเปิดกลับ → เจ้าของระบบเลือก **"ปิด `is_active`"** อีกครั้งผ่าน interactive dialog (migration `2026_08_19_150000_deactivate_wordpress_youtube_channels_again.sql`) ตรงกับทางเลือกที่ proposal บรรทัด 9 อนุญาตไว้ ("ตั้ง platform ถูกต้อง หรือปิด `is_active = 0`")
      ทางเลือกที่ไม่เลือก: เพิ่ม `youtube` เข้า ENUM + เขียน `dispatch_youtube()` + ต่อ YouTube Data API → นอก scope change นี้ (design ระบุ non-goal ว่าไม่แก้ ENUM) / ลบ channel ทิ้ง
- [x] 3.2 ตรวจว่าเสร็จ: ไม่มี channel ที่ `is_active=1 AND platform=''` (query `publish_channels`)
      หลักฐาน: `SELECT COUNT(*) FROM publish_channels WHERE is_active=1 AND platform=''` = **0**

## 4. Re-queue รายการ failed ที่ยังควรเผยแพร่ (งาน 0.8)

- [x] 4.1 ตรวจรายแถว `content_publish_queue` ที่ `status='failed'` (23 แถว) ว่าแถวไหน `scheduled_at` ยังไม่ผ่านไปนานจนไม่ควรโพสต์ย้อนหลัง
      ผลตรวจ: **23 แถวมาจากคอนเทนต์แค่ 2 ชิ้น** ทุกแถว `retry_count = 0` → เป็นการสร้าง queue entry ซ้ำจากการกดส่งหลายรอบ (`scheduled_at` ต่างกันระดับวินาที) ไม่ใช่ retry ของ cron
      - `d698c9f2-…` (Duckkit AI Portal) → channel `c920cabb` lotusdomino: **16 แถว**, `scheduled_at` 14 มิ.ย. 2 แถว (เก่า 66 วัน) และ 18 ส.ค. 14 แถว (เก่า 1 วัน); `content_items.status='draft'`, `approved_at=NULL`
      - `a0309d33-…` (DocTracking KTNBS) → channel `351b7173` wordpress: **7 แถว**, `scheduled_at` 17–18 ส.ค. (เก่า 1–2 วัน); `content_items.status='draft'`, `approved_at='2026-08-17 17:25:02'`
      ข้อสรุป: re-queue ได้อย่างมาก **1 แถวต่อคอนเทนต์-ต่อ channel** (รวม 2 แถว) — re-queue ทั้งก้อนจะโพสต์คอนเทนต์เดียวกันซ้ำ 16 ครั้งไปยัง Domino production ของ KTNBS; 2 แถวของ 14 มิ.ย. เก่าเกินไป ไม่ควรโพสต์ย้อนหลัง
- [ ] 4.2 re-queue เฉพาะแถวที่ยังควรเผยแพร่กลับเป็น `status='pending'` (ห้าม reset ทั้งก้อน)
      **ค้าง — รอเจ้าของระบบ approve คอนเทนต์ `d698c9f2` ก่อน** (ยัง `status='draft'`, `approved_at=NULL`) เมื่อ approve แล้วจะ re-queue **1 แถว** ของ lotusdomino (เลือกแถวที่ `scheduled_at` ใหม่สุด: `838b0f3b-…` 18 ส.ค. 11:16:47) — ส่วนของ wordpress ไม่ re-queue เพราะ channel ปิดอยู่และไม่มี `endpoint_url` (ดูงาน 2.1)
      แถวซ้ำที่เหลือ (15 lotusdomino + 6 wordpress): เจ้าของระบบเลือก **คงเป็น `failed` ไว้** เป็นประวัติ ไม่แก้ไข ไม่ลบ
- [ ] 4.3 ตรวจว่าเสร็จ: จำนวน failed ลดลง และมีแถวกลับเป็น `pending` เท่าที่ตั้งใจ
      **ค้างตาม 4.2** — ฐานปัจจุบัน (หลังยกเลิกคิว Line OA 2 แถวในงาน 5.2): failed **25** แถว, pending **4** แถว → เป้าหมายหลัง re-queue: failed 25 → **24**, pending 4 → **5**

## 5. ยืนยันเกณฑ์เสร็จเฟส 0 (งาน 0.9)

- [ ] 5.1 เส้นทาง `send_now`: เผยแพร่ผ่าน WordPress channel จริง แล้ว `SELECT status, published_at, published_url, external_post_id FROM content_items WHERE id='…'` ได้ค่าครบทั้ง 4 คอลัมน์
      **ค้าง — ทำตามตัวอักษรไม่ได้** WordPress channel ปิดอยู่ (`is_active=0`) และไม่มี `endpoint_url` / Application Password จริง ต้องเลือกทางใดทางหนึ่ง:
      (ก) กรอก `endpoint_url` + Application Password จริง แล้วเปิด channel กลับ → ทำ 5.1 ตามเดิม (`published_url` จะมีค่าเพราะ `extract_publish_meta()` อ่าน `data.link` ของ WordPress)
      (ข) เปลี่ยนไปใช้ Domino channel ผ่าน `send_now` → ได้ `status/published_at/external_post_id` ครบ แต่ `published_url` จะเป็น NULL เพราะ `extract_publish_meta()` คืน URL ให้เฉพาะ platform `wordpress` (`api/lib/publish-dispatch.php:64`) → เกณฑ์ "ครบทั้ง 4 คอลัมน์" ไม่ผ่าน (ต้องแก้เกณฑ์ในสเปกให้ยอมรับ)
- [ ] 5.2 เส้นทาง cron queue: รัน `php api/cron/publish-scheduler.php` แล้วได้ `content_publish_queue.status='sent'` ครั้งแรก พร้อม `platform_post_id` มีค่า
      **ค้าง — รอ approve คอนเทนต์ `d698c9f2` และรออนุมัติให้ยิง Domino production**
      ✅ **แก้แล้ว: `publish-scheduler.php` กรอง `pc.is_active = 1`** (บรรทัด 21-33) — เจ้าของระบบเลือก "แก้ 1 บรรทัดเลย" ผ่าน interactive dialog เดิม query มีแค่ `q.status='pending' AND q.scheduled_at <= NOW()` ทำให้การปิด channel ไม่กัน cron
      หลักฐาน: รัน scheduler ขณะมี pending 4 แถวที่ due ทั้งหมด (ชี้ WordPress channel ที่ `is_active=0`) → `No pending entries.` ไม่ dispatch ไม่มีแถว failed ใหม่
      ✅ **แก้แล้ว: คิวเก่าของ Line OA** — 2 แถว (`fb943d02-…` 22 มิ.ย., `e883d364-…` 23 มิ.ย.) ตั้งเป็น `status='failed'` + `error_msg` ระบุว่ายกเลิกโดยเจ้าของระบบ (migration `2026_08_19_151500_cancel_stale_lineoa_queue_rows.sql`) → ไม่มีความเสี่ยง broadcast คอนเทนต์อายุ ~2 เดือนอีก
      สถานะคิวหลังจัดการ: pending 4 แถว (WordPress ที่ปิดแล้ว ทั้ง 4 แถวถูก guard กรองออก), failed 25 แถว, sent 0 แถว
- [x] 5.3 เส้นทาง approve: approve 1 item → `content_items.approved_at` ไม่ NULL (ผ่านแล้ว ยืนยันซ้ำเพื่อบันทึกหลักฐาน)
      หลักฐาน (19 ส.ค. 2026): `SELECT COUNT(*) FROM content_items WHERE approved_at IS NOT NULL` = **1** → `a0309d33-e693-4671-b5d0-2f5fc2780b57`, `approved_at = '2026-08-17 17:25:02'` (status ยัง `draft` เพราะยังเผยแพร่ไม่สำเร็จ)
      อ้างอิงเปรียบเทียบ: `SELECT COUNT(*) FROM content_items WHERE published_at IS NOT NULL` = **0** → เกณฑ์ 5.1/5.2 ยังไม่ผ่าน

## สถานะการหยุด (19 ส.ค. 2026)

**ความคืบหน้า: 11/16 งาน** — เสร็จ 1.1-1.6, 2.1, 3.1, 3.2, 4.1, 5.3 / ค้าง 2.2 (เลื่อน), 4.2, 4.3, 5.1, 5.2

**เหตุการณ์ 19 ส.ค. 12:30 (เวลาไทย) — มีการเผยแพร่จริงจากหน้าแอป ไม่ใช่จาก session นี้:**
มี 16 request เข้า `send_now` (`api/content-publish.php:117-146`) ภายใน 11 วินาที สร้าง queue 16 แถวใหม่และ POST คอนเทนต์ `d698c9f2` ไป `https://www.ktnbs.com/transform.nsf/ParseJSONString` ทั้ง 16 ครั้ง ทุกแถวได้ `status='sent'` + `platform_post_id=lotusdomino_…`; `content_items.d698c9f2` กลายเป็น `status='published'`, `published_at='2026-08-19 12:30:20'`, `external_post_id='lotusdomino_1787117420'`, `published_url=NULL`
- ยืนยันว่าไม่ใช่ cron และไม่ใช่คำสั่งใน session นี้: scheduler ที่รันเวลา 12:29:53 ได้ `No pending entries.` (ก่อนเหตุการณ์ 16 วินาที) และ `cron_runs` แถวล่าสุดยังเป็น 9 มิ.ย. 2026
- สาเหตุที่ได้ 16 แถว: `send_now` ทำ `array_unique(channel_ids)` (บรรทัด 89) → 1 request สร้างได้แถวเดียวต่อ channel ดังนั้น 16 แถว = **16 request แยกกัน** (มี 5 request ในวินาทีเดียว) — รูปแบบเดียวกับ 16 แถว failed ของ 18 ส.ค.
- ⚠️ **`sent` ไม่พิสูจน์ว่าโพสต์ขึ้นจริง**: `dispatch_lotusdomino()` ถือว่าสำเร็จเมื่อไม่มี cURL error (พฤติกรรมตามสเปก) แม้ Domino ตอบ 4xx/5xx และระบบไม่เก็บ response body; ตรวจ www.ktnbs.com แล้วข่าวใหม่สุดคือ 22 ก.ค. 2026 ไม่มีบทความนี้ และบทความบนเว็บนั้นไม่มีอยู่ใน DB ระบบนี้เลย (อัปเดตจาก workflow อื่นของ KTNBS) → ต้องเปิดดูใน Domino หรือถาม KTNBS จึงจะยืนยันได้
- ⚠️ `send_now` ตั้งใจข้าม approve (บรรทัด 96 "allow any status") → คอนเทนต์นี้ `approved_at IS NULL` แต่ `status='published'` แล้ว

**เจ้าของระบบแจ้งว่ายังไม่ต้องการเผยแพร่** → หยุดงาน 1.6 (ส่วน query หลังรัน scheduler), 4.2, 4.3, 5.1, 5.2 ไว้ ไม่มีการยิงคอนเทนต์ออกไปยังระบบภายนอกใด ๆ ในเซสชันนี้ (การทดสอบทั้งหมดใช้ local mock endpoint และ HEAD probe เท่านั้น)

**การตัดสินใจ 4 ข้อผ่าน interactive dialog (19 ส.ค. 2026) — ลงมือแล้วทั้งหมด:**
1. WordPress channel → **ปิด `is_active`** ไว้ก่อนจนได้ URL + Application Password จริง (งาน 2.1)
2. Youtube channel → **ปิด `is_active`** (งาน 3.1, 3.2)
3. คิว Line OA 2 แถวที่เก่า ~2 เดือน → **ตั้งเป็น `failed`** + `error_msg` ระบุเหตุผล (งาน 5.2)
4. `publish-scheduler.php` → **เติม `AND pc.is_active = 1`** ในบรรทัด WHERE (งาน 5.2)

ผลรวม: ตอนนี้ **การปิด channel กัน cron ได้จริง** และไม่มีคิวที่ due ค้างอยู่กับ channel ที่เปิด → รัน scheduler ได้อย่างปลอดภัย (พิสูจน์แล้ว: `No pending entries.`)

**ตรวจแล้วว่าไม่มีความเสี่ยงว่าคิวจะยิงเอง:** `cron_jobs` มี `publish-scheduler` `enabled=1` (interval "ทุก 1 นาที") แต่เป็นแค่ config — ต้องมีตัวเรียกภายนอก และ `cron_runs` แถวล่าสุดของ job นี้คือ **9 มิ.ย. 2026 16:07** (ไม่รันมา ~2 เดือน) ทั้งไม่มี Windows Scheduled Task ที่ชี้มาที่โปรเจกต์นี้

**สิ่งที่ต้องทำเมื่อพร้อมเผยแพร่ (ตามลำดับ):**
1. approve คอนเทนต์ `d698c9f2-0674-4ddf-8316-8c571d31b6c5` (Duckkit AI Portal) — ตอนนี้ `status='draft'`, `approved_at=NULL`
2. อนุมัติให้ยิง Domino production (`https://www.ktnbs.com/transform.nsf/ParseJSONString`)
3. re-queue 1 แถว (`838b0f3b-…`) แล้วรัน `php api/cron/publish-scheduler.php` → ปิดงาน 4.2, 4.3, 5.2, 1.6
4. เรื่อง WordPress (ปลดล็อกงาน 2.2 และ 5.1 ทาง ก): ส่ง URL เว็บ WordPress + Application Password จริง แล้วเปิด `is_active` กลับ
   หรือเลือกทาง (ข) ของงาน 5.1 = ยอมรับว่า `published_url` เป็น NULL เมื่อเผยแพร่ผ่าน Domino (ต้องแก้เกณฑ์ในสเปก)
