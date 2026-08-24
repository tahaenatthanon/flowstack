## Why

เฟส 0 (`phase-0-publish-result-tracking` + `phase-0-publish-dispatch-blockers`) ทำให้ระบบเขียนผลเผยแพร่กลับ `content_items` ได้แล้ว — ตอนนี้ `content_publish_queue` มี `sent` 22 แถว และ `content_items` มี `published_at` ไม่ NULL 4 แถว (จากเดิม 0 ทั้งคู่) แต่การใช้งานจริงหลังจากนั้นเปิดรู 4 จุดที่ทำให้ข้อมูลผลเผยแพร่ยัง **เชื่อถือไม่ได้**:

1. คอนเทนต์ที่เผยแพร่แล้วถอยสถานะกลับเป็น `draft` ได้เงียบ ๆ ทิ้ง `published_at`/`external_post_id` ค้างไว้ — ตอนนี้ **ทั้ง 4 แถวที่มี `published_at` ถูกตั้งเป็น `draft` หมดแล้ว** (`status='published'` เหลือ 0 จาก 35 แถว; `updated_at` ของ 3 แถวคือ 24 ส.ค. 10:18–10:19) จึงหลุดจากทุก query ที่กรอง `status='published'` — รวมถึงเกตของ `analytics-recalculate`
2. `content_items.platform` ไม่เคยถูกเขียนกลับตาม channel ที่ใช้โพสต์จริง — `a0309d33` เก็บ `platform='youtube'` แต่โพสต์ไป facebook (queue `251f2e50`, `sent_at` = `published_at` = `15:29:08`) ทำให้ `analytics-recalculate` ที่จัดกลุ่มด้วยคอลัมน์นี้แจกแจงแพลตฟอร์มผิด
3. `published_url` เป็น NULL ทั้ง 4 แถว (และทั้ง 22 แถวใน queue) เพราะ `extract_publish_meta()` คืน URL ให้เฉพาะ `wordpress` — แม้โพสต์ facebook สำเร็จก็ไม่มีลิงก์ให้ผู้ใช้กดดู และเฟส 1 (GSC) ที่ต้อง join ด้วย URL ก็ไม่มีคีย์
4. คิว `pending` 4 แถวชี้ Wordpress channel `351b7173` ที่ `is_active=0` (เก่าสุด 22 มิ.ย.) — scheduler กรองออกทุกรอบแต่ไม่มีใครล้าง จึงค้างในรายการตารางเวลาไปตลอด

## What Changes

- **BREAKING** `PUT /api/content-items.php?id=` ปฏิเสธ 422 เมื่อพยายามเปลี่ยนสถานะของคอนเทนต์ที่ `published_at IS NOT NULL` ไปเป็นสถานะก่อนเผยแพร่ (`draft`, `pending_approval`, `approved`, `revision`, `rejected`) พร้อมข้อความไทยอธิบายว่าเผยแพร่แล้วเมื่อไหร่
- Backfill `status='published'` ให้ 4 แถวที่มี `published_at` และมีแถว `sent` ใน queue จริง (`4196ca2b`, `a0309d33`, `d698c9f2`, `fd93d7fb`) ด้วย migration — ไม่แตะ `approved_at` (`d698c9f2` เผยแพร่ก่อนมี approval gate จริง ๆ การเติม `approved_at` จะเป็นการกุหลักฐาน)
- เขียน `content_items.platform = <platform ของ channel ที่ใช้โพสต์>` พร้อมกับ `status='published'` ในทั้ง 4 เส้นทางเผยแพร่ และ backfill `a0309d33` จาก `youtube` เป็น `facebook`
- `dispatch_facebook()` ยิง `GET /{post_id}?fields=permalink_url` ต่อจาก POST สำเร็จ แล้วใส่ผลลง `$result['published_url']`; `extract_publish_meta()` อ่านคีย์นี้เป็นลำดับแรก (เก็บ branch `wordpress` เดิมไว้) — ถ้า GET ไม่สำเร็จ (token หมดอายุ/สิทธิ์ไม่พอ) `published_url` เป็น `null` เหมือนเดิม และการเผยแพร่ที่สำเร็จแล้ว **ไม่** กลายเป็นล้มเหลว
- ยกเลิกคิว `pending` 4 แถวที่ชี้ channel ปิด ด้วย migration ตั้งเป็น `failed` + `error_msg` ระบุเหตุผล (ตามแบบ `2026_08_19_151500_cancel_stale_lineoa_queue_rows.sql`)

## Capabilities

### New Capabilities

- `content-published-status-guard`: ห้ามถอยสถานะคอนเทนต์ที่เผยแพร่แล้วกลับไปเป็นสถานะก่อนเผยแพร่ผ่าน API — กันข้อมูลผลเผยแพร่ (`published_at`, `published_url`, `external_post_id`) ค้างอยู่กับแถวที่สถานะบอกว่ายังไม่เผยแพร่

### Modified Capabilities

- `content-publish-result-tracking`: เพิ่ม requirement 2 ข้อ — (ก) การเผยแพร่สำเร็จต้องเขียน `content_items.platform` ให้ตรงกับ platform ของ channel ที่ใช้โพสต์จริง (ข) `published_url` ของ facebook ต้องมาจาก `permalink_url` ที่ Graph API คืน ไม่ใช่ NULL

## Impact

- `api/content-items.php` — PUT เพิ่มเกตกันถอยสถานะ (อ่าน `published_at` ของแถวเดิมก่อนอัปเดต)
- `api/lib/publish-dispatch.php` — `dispatch_facebook()` ยิง permalink lookup เพิ่ม, เพิ่ม helper `_dispatch_get()`, `extract_publish_meta()` อ่าน `$result['published_url']` ก่อน (signature เดิม ไม่กระทบ 4 call sites)
- `api/content-publish.php` (`send_now`), `api/cron/publish-scheduler.php`, `api/brand-content.php` (`?action=publish` บรรทัด 2418, `?action=cron-publish` บรรทัด 2652) — เพิ่ม `platform=?` ใน UPDATE ที่ตั้ง `status='published'`
- `database/migrations/` — migration ใหม่ 2 ไฟล์ (backfill `content_items` 4 แถว + platform 1 แถว, ยกเลิกคิว 4 แถวใน `content_publish_queue`)
- Frontend — ส่วนที่เรียก PUT เปลี่ยนสถานะต้องแสดง error 422 ที่ได้จาก API (`ContentDetailView.tsx` `applyDecision()`/`ContentApprovalTab.tsx`)
- ไม่กระทบ schema (ไม่มี ALTER TABLE)

## Non-Goals

- ไม่กรอก credentials WordPress / ไม่เรียก `?action=test-channel` (งาน 2.2 ของ `phase-0-publish-dispatch-blockers` — รอเจ้าของระบบส่ง URL + Application Password จริง)
- ไม่ re-queue คอนเทนต์ `d698c9f2` ไป Domino (งาน 4.2/4.3 — รอ approve และรออนุมัติยิง production)
- ไม่ลบแถว `failed` 48 แถว (เจ้าของระบบสั่งคงไว้เป็นประวัติ + กำลังใช้ debug FB token อยู่)
- ไม่แก้ FB/IG token (เป็นงานเฟส 2 งาน 6.1)
- ไม่เปลี่ยนพฤติกรรม scheduler ที่กรอง `pc.is_active=1` แบบเงียบ ๆ (ล้างข้อมูลครั้งนี้เท่านั้น)
