## Context

เฟส 0 (`phase-0-publish-result-tracking` + `phase-0-publish-dispatch-blockers`) ทำให้ทั้ง 4 เส้นทางเผยแพร่ (`send_now`, cron queue, `?action=publish`, `?action=cron-publish`) เขียนผลเผยแพร่กลับ `content_items` ได้แล้ว (คอลัมน์ `published_at`, `published_url`, `external_post_id` จาก migration `2026_08_17_160529_add_publish_result_columns.sql`)

แต่ข้อมูลจริงหลังใช้งานเผยให้เห็น 4 จุดที่ทำให้ผลเผยแพร่ยัง **เชื่อถือไม่ได้**:

1. คอนเทนต์ที่เผยแพร่แล้วถอยสถานะกลับเป็น `draft` ได้เงียบ ๆ ผ่าน `PUT /api/content-items.php` — `published_at`/`external_post_id` ค้างอยู่กับแถวที่สถานะบอกว่า "ยังไม่เผยแพร่" จนหลุดจากทุก query ที่กรอง `status='published'` (รวมเกตของ `analytics-recalculate`)
2. `content_items.platform` ไม่เคยถูกเขียนกลับตาม channel ที่โพสต์จริง — `analytics-recalculate` จัดกลุ่มด้วยคอลัมน์นี้ จึงแจกแจงแพลตฟอร์มผิด
3. `published_url` เป็น NULL ทุกแถว เพราะ `extract_publish_meta()` คืน URL ให้เฉพาะ `wordpress`
4. คิว `pending` 4 แถวชี้ channel WordPress ที่ `is_active=0` — scheduler กรองออกแต่ไม่มีใครล้าง

## Goals / Non-Goals

**Goals:**
- ปิดช่องที่ทำให้ผลเผยแพร่ถอยกลับ/ไม่สมบูรณ์ ทั้งหมดที่จุดเดียว (API + dispatch + migration) โดยไม่เปลี่ยน schema (ไม่มี ALTER TABLE)
- กันไม่ให้ข้อมูลผลเผยแพร่ค้างอยู่กับแถวที่สถานะบอกว่า "ยังไม่เผยแพร่"
- ทำให้ `content_items.platform` สะท้อน platform ของ channel ที่โพสต์จริง
- ทำให้ `published_url` มีค่าจริงสำหรับ facebook (ลิงก์ที่ผู้ใช้กดดูได้ + เป็นคีย์ join ของเฟส 1 GSC)

**Non-Goals:**
- ไม่กรอก credentials WordPress / ไม่เรียก `?action=test-channel` (รอเจ้าของระบบ)
- ไม่ re-queue `d698c9f2` ไป Domino (รอ approve + อนุมัติยิง production)
- ไม่ลบแถว `failed` 48 แถว (เจ้าของระบบสั่งคงไว้เป็นประวัติ)
- ไม่แก้ FB/IG token (งานเฟส 2)
- ไม่เปลี่ยนพฤติกรรม scheduler ที่กรอง `pc.is_active=1` แบบเงียบ ๆ

## Decisions

### 1. เกตกันถอยสถานะที่ API layer (`PUT /api/content-items.php`)

ก่อนอัปเดต ให้ `SELECT published_at FROM content_items WHERE id=? AND tenant_id=?` แถวเดิม แล้วถ้า `published_at IS NOT NULL` และสถานะเป้าหมายอยู่ในเซตก่อนเผยแพร่ (`draft`, `pending_approval`, `approved`, `revision`, `rejected`) ให้ตอบ `422` พร้อมข้อความไทยบอกว่าเผยแพร่แล้วเมื่อไหร่

- **Why here:** ทุกเส้นทางเปลี่ยนสถานะใน frontend (approval, detail, edit) ล้วนวิ่งผ่าน `PUT /content-items.php` จุดเดียว — ป้องกันที่จุดเดียวครอบคลุมทุก UI
- **Alternatives considered:**
  - *DB trigger* → ตรวจจับได้ทุกช่องทางแต่ error ทึบ ตรวจย้อน/เทสยาก และต้อง ALTER (ขัด non-goal)
  - *frontend-only guard* → ถูก bypass ได้ด้วย API ตรง ๆ และไม่กันเส้นทางอื่น
  - *enum ใหม่* → ขัด non-goal "ไม่แตะ schema"

### 2. เขียน `content_items.platform` พร้อม `status='published'` ทั้ง 4 เส้นทาง + backfill

- `send_now` (`api/content-publish.php`), `publish-scheduler.php`, `?action=publish` (บรรทัด 2418), `?action=cron-publish` (บรรทัด 2652): เพิ่ม `platform=?` ใน UPDATE ที่ตั้ง `status='published'` โดยใช้ `$channel['platform']` / `$entry['platform']` / `$platform` / `$sc['platform']` ตามบริบท (lowercase ตามที่เก็บใน `publish_channels`)
- Backfill `a0309d33` จาก `youtube` → `facebook` (โพสต์จริงไป facebook)

- **Why:** `analytics-recalculate` group by `content_items.platform` — ถ้าคอลัมน์ไม่ตรงกับโพสต์จริง ตัวเลข engagement แยกตาม platform จะผิด

### 3. `dispatch_facebook()` ยิง permalink lookup ต่อจาก POST สำเร็จ

หลัง `_dispatch_post` ไป `/{pageId}/feed` สำเร็จและได้ `platform_post_id` ให้ยิง `GET https://graph.facebook.com/v19.0/{post_id}?fields=permalink_url&access_token=...` ผ่าน helper ใหม่ `_dispatch_get()` แล้วใส่ `$result['published_url'] = permalink_url` จากนั้น `extract_publish_meta()` อ่าน `$result['published_url']` เป็นลำดับแรก (ก่อน branch `wordpress` เดิม)

- **Why additive:** signature ของ `extract_publish_meta(array $result, string $platform, array $channel)` และ `dispatch_facebook()` ไม่เปลี่ยน → ไม่กระทบ 4 call sites ที่เหลือ และ platform อื่นที่ไม่รองรับยังได้ `null` เหมือนเดิม
- **Non-blocking:** ถ้า GET ล้มเหลว (token หมดอายุ / สิทธิ์ `pages_read_engagement` ไม่พอ) `published_url` เป็น `null` และเผยแพร่ที่สำเร็จแล้ว **ไม่** กลายเป็นล้มเหลว
- **Alternatives considered:**
  - *ถือว่า POST ล้มเหลวเมื่อ GET ล้ม* → ปลายทางรับโพสต์ไปแล้วจริง การกลับมาว่า "ล้มเหลว" จะสร้างความสับสนและเสี่ยง publish ซ้ำ
  - *อ่าน URL จาก POST response* → Facebook `feed` endpoint คืนแค่ `id` ไม่มีลิงก์ จึงต้อง GET เพิ่ม

### 4. ยกเลิกคิว `pending` 4 แถวด้วย migration (ไม่แตะ scheduler)

Migration ใหม่ตั้ง `content_publish_queue.status='failed'` + `error_msg` ระบุเหตุผล สำหรับ 4 แถวที่ชี้ channel `351b7173` (`is_active=0`) — ตามแบบอย่าง `2026_08_19_151500_cancel_stale_lineoa_queue_rows.sql`

- **Why migration:** เป็นข้อมูลค้างครั้งเดียว ไม่ใช่พฤติกรรมถาวร — การแก้ scheduler ให้ล้างแถวอัตโนมัติเป็น scope ใหม่และขัด "ล้างข้อมูลครั้งนี้เท่านั้น"

## Risks / Trade-offs

- **[เกต 422 อาจบล็อกโฟลว์ "แก้คอนเทนต์ที่เผยแพร่แล้ว"]** → ข้อความไทยชัดเจนระบุเวลาเผยแพร่ ผู้ใช้เข้าใจว่าต้องสร้างคอนเทนต์ใหม่ ไม่ใช่ถอยสถานะ; ไม่มีเส้นทาง legitimate ที่ต้องถอยจาก `published` กลับ `draft`
- **[permalink GET ต้องใช้สิทธิ์เพิ่มของ Graph API]** → ออกแบบ non-blocking — ถ้าไม่ได้ลิงก์ก็ยังได้ `status='sent'` + `platform_post_id` เหมือนเดิม มีเพียง `published_url` ที่เป็น null
- **[backfill อิง hardcoded UUID]** → ระบุ id ชัดเจนพร้อม comment ที่มา + rollback statement ในไฟล์ migration เพื่อตรวจย้อนได้
- **[?action=cron-publish อัปเดตผ่าน subquery]** → แก้แบบเติม `platform=?` ลงใน UPDATE เดิม โดยเก็บ derived-table เดิมไว้ (เลี่ยง MariaDB error 1093) ไม่เปลี่ยนโครงสร้าง subquery

## Migration Plan

1. สร้าง 2 ไฟล์ใน `database/migrations/`:
   - `2026_08_24_HHMMSS_backfill_publish_status_and_platform.sql` — backfill `status='published'` 4 แถว (`4196ca2b`, `a0309d33`, `d698c9f2`, `fd93d7fb`) ที่มี `published_at` และมีแถว `sent` ใน queue; backfill `a0309d33.platform` `youtube`→`facebook` (ไม่แตะ `approved_at` — `d698c9f2` เผยแพร่ก่อนมี approval gate)
   - `2026_08_24_HHMMSS_cancel_stale_inactive_wordpress_queue.sql` — ตั้ง 4 แถว `pending` เป็น `failed` + `error_msg`
2. รันผ่าน `mysql -u root flowstack < database/migrations/<file>.sql` แล้ว verify ด้วย `SELECT`
3. Rollback: แต่ละไฟล์มี `-- Rollback:` comment ระบุ statement ตรงข้าม

## Open Questions

- ไม่มี open question ที่บล็อก implementation — ค่า `published_url` ของ facebook ขึ้นกับว่าตอนนี้ Graph token มีสิทธิ์อ่าน `permalink_url` หรือไม่ ซึ่งเป็นข้อเท็จจริงที่ตรวจตอนรันจริง ไม่ใช่ decision ที่ต้องตัดล่วงหน้า
