## Context

`content_items` มีฟิลด์ SEO ครบแล้ว: `seo_title`, `slug`, `meta_description`, `meta_keywords`, `structured_data`, `og_image` และ `article_content` (JSON `{title, html, excerpt}`) — ไม่ต้องเพิ่มคอลัมน์ที่ `content_items` สำหรับเฟสนี้

เส้นทางการเผยแพร่มี 4 เส้นทางที่เพิ่ง patch ในเฟส 0:
1. `send_now` (`api/content-publish.php`) → `dispatch_content()`
2. cron `api/cron/publish-scheduler.php` → `dispatch_content()`
3. `?action=publish` (`api/brand-content.php`) → inline curl
4. `?action=cron-publish` (`api/brand-content.php`) → inline curl

`content_global_settings` ไม่มี PK ประกาศ (`tenant_id` เป็นคีย์โลจิก) ปัจจุบันอ่าน/เขียนใน `api/brand-content.php` หลายจุด

`ArticleEditor.tsx` มี collapsible `seoOpen` อยู่แล้ว (บรรทัด ~562) พร้อม `seoFields`/`onSeoChange`; `ContentApprovalTab.tsx` มี flow อนุมัติ (`status='approved'`)

## Goals / Non-Goals

**Goals:**
- ฟังก์ชัน `seo_evaluate()` บริสุทธิ์ ใช้ซ้ำได้ทั้ง endpoint และเส้นทางเผยแพร่
- เกตเลือกเปิด (`seo_gate_enabled`) default ปิด — ไม่กระทบ flow เดิม
- UI แสดง checklist สดใน editor + บล็อกการเผยแพร่พร้อมข้อความไทย
- ข้อความผู้ใช้ทั้งหมดภาษาไทย

**Non-Goals:**
- ไม่ refactor เส้นทาง publish รวมโค้ด (ต่อจากเฟส 0)
- ไม่เพิ่ม `lotusdomino` เข้า dispatcher
- ไม่ซิงก์คะแนน/อันดับภายนอก (GSC, FB insights) — เป็นเฟส 1–2
- ไม่เพิ่มตารางใหม่ (ใช้ `content_global_settings` เดิม)

## Decisions

### 1. seo_evaluate เป็นฟังก์ชันบริสุทธิ์ในไฟล์ใหม่
- `api/lib/seo-checklist.php` ประกาศ `seo_evaluate(array $item): array` — ไม่แตะ DB ไม่เรียก network
- รับ array ที่มีฟิลด์: `seo_title`, `slug`, `meta_description`, `meta_keywords`, `structured_data`, `og_image`, `article_content` (string JSON หรือ array), `title`
- **Rationale**: pure function ทดสอบได้ เรียกจากทั้ง endpoint และ gate; ตรง pattern `api/lib/*` ที่มีอยู่ (`publish-dispatch.php`)
- **Alternative considered**: ใส่ logic ใน `brand-content.php` โดยตรง — ปฏิเสธ เพราะต้องเรียกซ้ำ 3 ไฟล์ และยากต่อ unit test

### 2. รูปแบบผลลัพธ์ + ระดับกฎ
- คืน `['score' => int (0–100), 'rules' => [ ['key','level','message'] ]]`
- `level`: `pass`/`warn`/`fail`/`skip`
  - `fail` = บล็อกได้ (ละเมิดเกณฑ์)
  - `warn` = แจ้งเตือนไม่บล็อก (เช่น `og_image` ว่าง, `meta_keywords` ว่าง)
  - `skip` = ไม่ประเมิน (ไม่มีเนื้อหาบทความ)
- คะแนน = 100 − (คะแนนหักต่อ fail/warn) คำนวณแบบโปร่งใส
- **Rationale**: แยก "บล็อกได้" (`fail`) ออกจาก "เตือน" (`warn`) เพื่อให้เกตไม่เข้มเกินไปสำหรับโพสต์โซเชียล

### 3. กฎที่ขึ้นกับเนื้อหาบทความถูก `skip` เมื่อไม่มี body
- `has_h2`, `no_h1`, `word_count`, `keyword_in_headings`, `internal_link` ใช้ HTML จาก `article_content`
- ถ้าไม่มี HTML (caption ล้วน) → `level='skip'` ไม่นับเป็น fail
- **Rationale**: โพสต์โซเชียล (facebook/lineoa) เป็น caption สั้น การบังคับ 500 คำ/h2 จะ block โพสต์โซเชียลทั้งหมด — ไม่ใช่เจตนา; SEO gate มุ่งเป้าบทความ (wordpress/wix/custom/website)
- **Alternative considered**: block ทุก platform เสมอ — ปฏิเสธ (ทำโพสต์โซเชียลเผยแพร่ไม่ได้)

### 4. คีย์เวิร์ดหลักมาจาก meta_keywords
- primary keyword = token แรกของ `meta_keywords` (แยกด้วย comma)
- ตรวจปรากฏใน `seo_title` (หรือ `title`), ย่อหน้าแรกของ HTML, และใน tag heading (`h2`/`h3`)
- ถ้า `meta_keywords` ว่าง → `warn` (เตือนว่ายังไม่มีคีย์เวิร์ด แต่ไม่ block)
- **Rationale**: ไม่ต้องพึ่ง Research Agent (เฟส 3 ยังไม่ทำ); ใช้ฟิลด์ที่มีแล้ว

### 5. เกตตรวจ centralized ผ่าน helper
- เพิ่ม `seo_gate_check(PDO $db, string $tenantId, array $item): array` (ในไฟล์เดียวกัน หรือ `brand-content.php`) คืน `['blocked'=>bool, 'reason'=>string|null]`
- อ่าน `seo_gate_enabled`/`seo_gate_min_score` จาก `content_global_settings` แล้วเรียก `seo_evaluate()`
- `send_now`, `publish-scheduler.php`, `?action=publish`, `?action=cron-publish` เรียก helper ตัวเดียวกันก่อน dispatch
- **Rationale**: single source of truth สำหรับ gate; ป้องกัน divergence ระหว่าง 4 เส้นทาง
- **Alternative considered**: inline ตรวจในแต่ละไฟล์ — ปฏิเสธ (ซ้ำ 4 แห่ง)

### 6. เกต default ปิด (NO MAGIC)
- migration ใช้ `DEFAULT 0`; ไม่มี auto-enable
- **Rationale**: ตรงกติกา "NO MAGIC" ของ CLAUDE.md — flow เดิมไม่พังจนกว่า admin เปิดเกตเอง

### 7. Endpoint + UI
- `?action=seo-checklist&item_id=` (GET) — โหลด item ตรวจ tenant แล้วเรียก `seo_evaluate()` + คืน `seo_gate_enabled`/`seo_gate_min_score`
- `ArticleEditor.tsx` เพิ่มแผง checklist ภายใน `seoOpen` — fetch `seo-checklist` เมื่อมี `contentItemId` (prop `contentItemId` ปัจจุบันถูก destructure เป็น `_contentItemId` — จะเปิดใช้งาน)
- `ContentApprovalTab.tsx` — ก่อน approve/เผยแพร่ เมื่อเปิดเกตและมี fail แสดงข้อความไทยบล็อกพร้อมรายการกฎที่ติด
- **Rationale**: checklist สดไม่ต้องบันทึกใน DB; gate บล็อกที่ server เป็น source of truth จริง

### 8. เกณฑ์ตัวเลข
- `seo_title`: 1–60; `meta_description`: 120–160; คำ ≥500; slug regex `^[a-z0-9]+(-[a-z0-9]+)*$`
- internal link = `<a href` ที่ไม่ขึ้นต้นด้วย `http` (relative) หรือชี้ไป domain เดียวกัน (best-effort: นับ anchor ที่ไม่ใช่ external ตาม endpoint_url)
- **Rationale**: ตรง roadmap; ตัวเลขปรับได้ภายหลัง

## Risks / Trade-offs

- [เกตเข้มเกินไปอาจ block คอนเทนต์จริงโดยไม่ตั้งใจ] → default ปิด + `fail` แยกจาก `warn` + `skip` สำหรับ non-article; ตรวจย้อนได้จาก `seo_gate_enabled`
- [cron scheduler เป็น cron ไม่มี UI] → block ด้วย `echo` + ตั้ง queue เป็น `failed`/`pending` พร้อม reason (ไม่ silent)
- [internal link ตรวจจับยาก] → best-effort; ถ้าไม่แน่ใจให้ `pass`/`skip` แทน `fail` เพื่อไม่ block ผิด
- [`seo_gate_check` ต้องอ่าน setting ทุกครั้ง] → query `content_global_settings` 1 แถว (tenant เป็น key) — cost ต่ำมาก

## Migration Plan

1. สร้าง `database/migrations/2026_08_17_HHMMSS_add_seo_gate_settings.sql` เพิ่ม 2 คอลัมน์ใน `content_global_settings`
2. รัน `/c/xampp/mysql/bin/mysql.exe -u root flowstack < database/migrations/<file>.sql`
3. ยืนยัน `SHOW COLUMNS FROM content_global_settings;`
4. Rollback: `ALTER TABLE content_global_settings DROP COLUMN seo_gate_enabled, DROP COLUMN seo_gate_min_score;`

## Open Questions

- ไม่มี — ขอบเขตชัดเจนจาก roadmap (เฟส 4); การรวม publish เป็น dispatcher กลางยังเป็น task แยกเช่นเดิม
