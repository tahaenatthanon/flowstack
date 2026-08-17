## 1. Database migration

- [x] 1.1 สร้าง `database/migrations/2026_08_17_HHMMSS_add_seo_gate_settings.sql` เพิ่ม `seo_gate_enabled TINYINT(1) DEFAULT 0` และ `seo_gate_min_score TINYINT UNSIGNED DEFAULT 0` ใน `content_global_settings`
- [x] 1.2 รัน migration ผ่าน `/c/xampp/mysql/bin/mysql.exe -u root flowstack < database/migrations/<file>.sql`
- [x] 1.3 ยืนยัน `SHOW COLUMNS FROM content_global_settings;` มี 2 คอลัมน์ใหม่

## 2. ฟังก์ชัน seo_evaluate (api/lib/seo-checklist.php)

- [x] 2.1 สร้าง `api/lib/seo-checklist.php` ประกาศ `seo_evaluate(array $item): array` คืน `['score'=>int, 'rules'=>array]`
- [x] 2.2 implement กฎ: `seo_title` 1–60, `meta_description` 120–160, slug lowercase-hyphen, `has_h2` ≥1, `no_h1`, `word_count` ≥500, `keyword_in_title/first_para/headings`, `structured_data` JSON + `@context`/`@type`, `og_image`, `internal_link` ≥1
- [x] 2.3 ใช้ `level` = `pass`/`warn`/`fail`/`skip` และ `skip` กฎที่ขึ้นกับเนื้อหาเมื่อไม่มี article HTML

## 3. Helper เกต (seo_gate_check)

- [x] 3.1 เพิ่ม `seo_gate_check(PDO $db, string $tenantId, array $item): array` คืน `['blocked'=>bool, 'reason'=>string|null]` — อ่าน `seo_gate_enabled`/`seo_gate_min_score` จาก `content_global_settings` แล้วเรียก `seo_evaluate()`

## 4. Endpoint seo-checklist

- [x] 4.1 ใน `api/brand-content.php` เพิ่ม `?action=seo-checklist&item_id=` (GET) — โหลด item ตรวจ tenant แล้วคืน `score`, `rules`, `seo_gate_enabled`, `seo_gate_min_score`

## 5. เกตในเส้นทางเผยแพร่

- [x] 5.1 `api/content-publish.php` `send_now` — เรียก `seo_gate_check()` ก่อน dispatch; ถ้า blocked → `jsonError` ข้อความไทยระบุกฎที่ติด
- [x] 5.2 `api/cron/publish-scheduler.php` — เรียก `seo_gate_check()`; ถ้า blocked → ตั้ง queue `failed` + reason (ไม่ dispatch)
- [x] 5.3 `api/brand-content.php` `?action=publish` — เรียก `seo_gate_check()`; ถ้า blocked → `jsonError` ข้อความไทย
- [x] 5.4 `api/brand-content.php` `?action=cron-publish` — เรียก `seo_gate_check()`; ถ้า blocked → ตั้ง schedule `failed` + reason

## 6. UI — แผง checklist ใน ArticleEditor

- [x] 6.1 ใน `src/components/content/ArticleEditor.tsx` เปิดใช้ prop `contentItemId` (ปัจจุบันเป็น `_contentItemId`) และ fetch `?action=seo-checklist&item_id=` เมื่อมี id
- [x] 6.2 แสดงรายการกฎ (pass/warn/fail/skip) + คะแนน ภายใน collapsible `seoOpen` (ข้อความไทย)

## 7. UI — ข้อความบล็อกใน ContentApprovalTab

- [x] 7.1 ใน `src/components/content/tabs/ContentApprovalTab.tsx` เมื่อเปิดเกตและมีกฎ fail แสดงข้อความไทยบล็อกการอนุมัติ/เผยแพร่พร้อมรายการกฎที่ติด

## 8. Verify

- [x] 8.1 `php -l` กับไฟล์ที่แก้ (`seo-checklist.php`, `brand-content.php`, `content-publish.php`, `publish-scheduler.php`) ไม่มี syntax error
- [x] 8.2 `pnpm lint` + `pnpm build` ผ่าน
- [x] 8.3 item ที่ SEO ว่าง → `seo_evaluate()` มีกฎ `fail`; ตั้ง `seo_gate_enabled=1` → publish ถูกบล็อกพร้อมข้อความไทย; ตั้ง 0 → ผ่าน
- [x] 8.4 โพสต์โซเชียล (ไม่มี article body) → กฎ body-dependent เป็น `skip` ไม่ block
