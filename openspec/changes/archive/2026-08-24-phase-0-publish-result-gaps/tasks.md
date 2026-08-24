## 1. Database Migrations

- [x] 1.1 สร้าง `database/migrations/2026_08_24_HHMMSS_backfill_publish_status_and_platform.sql` — backfill `status='published'` ให้ 4 แถวที่มี `published_at` และมีแถว `sent` ใน queue (`4196ca2b`, `a0309d33`, `d698c9f2`, `fd93d7fb`) โดยไม่แตะ `approved_at`
- [x] 1.2 ในไฟล์เดียวกัน backfill `a0309d33.platform` จาก `youtube` → `facebook` พร้อม comment ที่มาและ `-- Rollback:` statement
- [x] 1.3 สร้าง `database/migrations/2026_08_24_HHMMSS_cancel_stale_inactive_wordpress_queue.sql` — ตั้ง 4 แถว `pending` ที่ชี้ channel `351b7173` (`is_active=0`) เป็น `failed` + `error_msg` ระบุเหตุผล (ตามแบบ `2026_08_19_151500_cancel_stale_lineoa_queue_rows.sql`)
- [x] 1.4 รันทั้ง 2 migration ผ่าน `mysql -u root flowstack < ...` แล้ว verify ด้วย `SELECT status, platform FROM content_items WHERE published_at IS NOT NULL` และ `SELECT status, error_msg FROM content_publish_queue WHERE id IN (...)`

## 2. Status Regression Guard (API)

- [x] 2.1 ใน `api/content-items.php` PUT — ก่อนสร้าง UPDATE ให้ `SELECT published_at FROM content_items WHERE id=? AND tenant_id=?` แถวเดิม
- [x] 2.2 ถ้า `published_at IS NOT NULL` และ `$body['status']` อยู่ในเซตก่อนเผยแพร่ (`draft`, `pending_approval`, `approved`, `revision`, `rejected`) ตอบ `jsonError(..., 422)` ข้อความไทยบอกเวลาเผยแพร่
- [x] 2.3 กัน `published` ซ้ำไม่ถูกปฏิเสธ และไม่กระทบการอัปเดตฟิลด์อื่น (title/caption/...) โดยไม่อิง status

## 3. Write platform on publish (4 paths)

- [x] 3.1 `api/content-publish.php` `send_now` — เพิ่ม `platform=?` ใน UPDATE ที่ตั้ง `status='published'` โดยใช้ `$channel['platform']` (lowercase)
- [x] 3.2 `api/cron/publish-scheduler.php` — เพิ่ม `platform=?` โดยใช้ `$entry['platform']`
- [x] 3.3 `api/brand-content.php` `?action=publish` (บรรทัด 2418) — เพิ่ม `platform=?` โดยใช้ `$platform`
- [x] 3.4 `api/brand-content.php` `?action=cron-publish` (บรรทัด 2652) — เพิ่ม `platform=?` โดยใช้ `$sc['platform']` ใน UPDATE เดิม (คง derived-table subquery ไว้)

## 4. Facebook permalink lookup

- [x] 4.1 ใน `api/lib/publish-dispatch.php` เพิ่ม helper `_dispatch_get(string $url): array` (GET, timeout เดิม, คืน `['success'=>..., 'data'=>...]` สไตล์เดียวกับ `_dispatch_post`)
- [x] 4.2 ใน `dispatch_facebook()` หลัง POST สำเร็จและได้ `platform_post_id` ยิง GET `https://graph.facebook.com/v19.0/{post_id}?fields=permalink_url&access_token=...` แล้วใส่ `$result['published_url']`
- [x] 4.3 ใน `extract_publish_meta()` อ่าน `$result['published_url']` เป็นลำดับแรก (ก่อน branch `wordpress`) โดยไม่เปลี่ยน signature

## 5. Frontend error display

- [x] 5.1 `src/components/content/views/ContentDetailView.tsx` — `applyDecision()`/`handleRequestApproval()` แสดง error message จาก API 422 ผ่าน `toast` (มีอยู่แล้ว ตรวจให้แสดง description จาก `e.message`)
- [x] 5.2 `src/components/content/tabs/ContentApprovalTab.tsx` — แสดง error 422 จากการเปลี่ยนสถานะ (approve/revision/reject) ผ่าน `toast`

## 6. Verification

- [x] 6.1 รัน `pnpm lint` และ `pnpm build` ให้ผ่าน
- [x] 6.2 เทส manual: เปิดคอนเทนต์ที่ `published_at IS NOT NULL` แล้วลองตั้งกลับ `draft` ผ่าน UI → ต้องเห็น error ไทยและสถานะไม่เปลี่ยน
- [x] 6.3 เทส manual: `send_now` ไป facebook → `content_items.platform` กลายเป็น `facebook` และ `published_url` มี `permalink_url` (หรือ null ถ้า token ไม่มีสิทธิ์ แต่ status ยัง `published`)
- [x] 6.4 verify `analytics-recalculate` เห็นแถว `status='published'` และ group by platform ถูกต้องหลัง backfill
