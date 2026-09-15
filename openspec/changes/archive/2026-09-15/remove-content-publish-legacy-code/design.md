## Context

`api/content-publish.php` และ `api/brand-content.php` เป็น PHP dispatcher แบบ `if ($action === '...')` ต่อกันเป็นชุด (ไม่มี framework/router) ตาม dispatch pattern ที่ระบุใน `CLAUDE.md` สามช่วงต่อไปนี้เป็น dead code เพราะทุกช่วงขึ้นต้นด้วย `jsonError(..., 410)` ที่เรียก `exit` ทันที ([api/config.php](../../../api/config.php)):

- `send_now-legacy` — `api/content-publish.php:227-410`
- `publish-legacy` — `api/brand-content.php:3074-3369`
- `cron-publish-legacy` — `api/brand-content.php:3469-3726`

ทั้งสามถูกแทนที่ด้วย `publish_via_central_flow` ตาม commit `41baacf` (centralize content type and publish flows) — ยืนยันแล้วว่าไม่มี frontend (`src/`) หรือ endpoint อื่นเรียกชื่อ action ทั้ง 3 นี้อีก

## Goals / Non-Goals

**Goals:**
- ลบโค้ดที่ execute ไม่ถึง (unreachable) ทั้ง 3 ช่วงออกจาก `api/content-publish.php` และ `api/brand-content.php`
- คงพฤติกรรม HTTP response เดิมทุกประการ (ทั้ง 3 action ยังตอบ 410 เหมือนเดิม — เพียงแต่ตัด dead code ส่วนที่ตามหลัง `jsonError()` ออก)

**Non-Goals:**
- ไม่แตะ action ที่ยังทำงานจริง (`send_now`, `schedule`/`schedules`, `publish`, `cron-publish`, `publish_via_central_flow`)
- ไม่เปลี่ยน error message หรือ status code ของ 3 action ที่ลบ (ยังคงตอบ `410 Legacy ... flow disabled` เหมือนเดิม เพียงลบแค่โค้ดที่ตามหลังบรรทัด `jsonError()`)
- ไม่ลบ endpoint หรือ route ระดับ dispatcher ทั้งหมด (`if ($action === 'send_now-legacy')` ยังคงอยู่พร้อม `jsonError(410)` บรรทัดเดียว เพื่อให้ caller เก่าที่หลงเหลือยังได้ error message ที่ชัดเจนแทนที่จะเจอ "unknown action")

## Decisions

**คงบล็อก `if` ไว้พร้อม `jsonError(410)` บรรทัดเดียว แทนที่จะลบทั้ง `if` block**
เหตุผล: ถ้ามี caller ภายนอกที่ยังไม่ทราบ (เช่น cron ภายนอกที่ตั้งไว้นานแล้ว, integration ที่ลืมอัปเดต) ยิง action เหล่านี้เข้ามา ระบบควรตอบ error message ที่สื่อความหมาย ("Legacy ... flow disabled — use the central publish flow") ต่อไป แทนที่จะตกไปที่ else/fallback ทั่วไปที่อาจตอบ error คลุมเครือกว่า
ทางเลือกที่พิจารณา: ลบทั้ง `if` block ออกทั้งหมด — ปฏิเสธเพราะเพิ่มความเสี่ยงโดยไม่มีประโยชน์เพิ่ม (ไฟล์เล็กลงแค่ 3 บรรทัด) และทำให้ error message เดิมหายไป

**ลบเฉพาะโค้ดหลัง `jsonError()` ในแต่ละ action โดยไม่แตะโครงสร้าง `if/elseif` โดยรวมของไฟล์**
เหตุผล: ลด diff ให้เล็กที่สุดเท่าที่จำเป็น ตรงตามกฎ SCOPE DRIFT ใน `CLAUDE.md` — ไม่ refactor ส่วนอื่นของ dispatcher ที่ไม่เกี่ยวข้อง

## Risks / Trade-offs

- **[Risk]** ลบโค้ดผิดขอบเขต ทำให้ action ที่ยังทำงานอยู่ (`cancel` ต่อจาก `send_now-legacy`, `all-schedules`/`cron-publish` ต่อจาก `publish-legacy`/`cron-publish-legacy`) เสียหาย → **Mitigation**: ยืนยันขอบเขตบรรทัดด้วย `grep -n "^    if (\$action ===" ` ก่อนลบทุกครั้ง และรัน `php -l` กับไฟล์ทั้งสองหลังแก้ไขทันที เพื่อเช็ค syntax
- **[Risk]** มี caller ที่ไม่รู้จัก (นอก repo) ยังยิง action เหล่านี้อยู่ → **Mitigation**: คง `if` + `jsonError(410)` ไว้ (ดู Decisions) ผู้เรียกยังได้ error message เดิมทุกประการ ไม่มี behavior เปลี่ยน
- **[Trade-off]** ไม่ได้ทำ automated test coverage ใหม่สำหรับ 3 action นี้เพราะเป็นการลบเฉยๆ ไม่ใช่ฟีเจอร์ใหม่ — การ verify ใช้ `php -l` + manual curl smoke test แทน

## Migration Plan

1. Backup: `git diff` ของทั้งสองไฟล์ก่อน commit (ปกติอยู่ใน git history อยู่แล้ว จึง rollback ได้ด้วย `git revert`)
2. แก้ไขทีละไฟล์ ทีละ action เริ่มจาก `content-publish.php` (`send_now-legacy`) ก่อน แล้วค่อย `brand-content.php` (`publish-legacy`, `cron-publish-legacy`)
3. รัน `php -l api/content-publish.php` และ `php -l api/brand-content.php` หลังแก้แต่ละไฟล์
4. Smoke test ด้วย curl ยิง action ที่ยังทำงานอยู่ใกล้เคียงกับจุดที่ลบ (เช่น `cancel`, `all-schedules`, `cron-publish`) เพื่อยืนยันว่า dispatcher ไม่พัง
5. Rollback strategy: `git revert` commit นี้ได้ทันทีถ้าพบปัญหา เพราะเป็นการลบ dead code ล้วนๆ ไม่มี migration ฐานข้อมูลเกี่ยวข้อง

## Open Questions

- ไม่มี — ขอบเขตชัดเจนและยืนยันแล้วว่าไม่มี caller ที่ยังใช้ action ทั้ง 3 นี้
