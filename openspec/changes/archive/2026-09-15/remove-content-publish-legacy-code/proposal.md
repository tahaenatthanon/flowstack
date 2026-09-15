## Why

`api/content-publish.php` และ `api/brand-content.php` มี 3 legacy action (`send_now-legacy`, `publish-legacy`, `cron-publish-legacy`) ที่ถูกปิดใช้งานไปแล้วตั้งแต่ commit `41baacf` (centralize content type and publish flows) — แต่ละ action ขึ้นต้นด้วย `jsonError(..., 410)` ซึ่งเรียก `exit` ทันที ([config.php](../../../api/config.php)) ทำให้โค้ดที่ตามมาทั้งหมด **unreachable 100%** รวม ~738 บรรทัด ยืนยันแล้วว่าไม่มี frontend หรือ endpoint อื่นใดเรียกชื่อ action ทั้ง 3 นี้อีก (ถูกแทนที่ด้วย `publish_via_central_flow` ทั้งหมด) การปล่อยไว้เสี่ยงให้แก้บั๊กผิดจุดในอนาคตเพราะดูเหมือนเป็นโค้ดที่ยังทำงานอยู่

## What Changes

- ลบ action `send_now-legacy` ทั้งก้อนใน `api/content-publish.php` (บรรทัด 227–410, 184 บรรทัด) รวมทั้ง `jsonError(410)` guard บรรทัดแรก
- ลบ action `publish-legacy` ทั้งก้อนใน `api/brand-content.php` (บรรทัด 3074–3369, 296 บรรทัด)
- ลบ action `cron-publish-legacy` ทั้งก้อนใน `api/brand-content.php` (บรรทัด 3469–3726, 258 บรรทัด)
- ไม่แก้ไข behavior ที่ผู้ใช้เห็นได้ — ทั้ง 3 action ตอบ HTTP 410 อยู่แล้วในปัจจุบัน การลบเป็นเพียงการนำโค้ดที่ execute ไม่ถึง (dead code) ออก

## Capabilities

### New Capabilities
- `legacy-publish-endpoints-retired`: formalize เป็น requirement ว่า 3 legacy action (`send_now-legacy`, `publish-legacy`, `cron-publish-legacy`) SHALL ตอบ HTTP 410 เท่านั้นและ SHALL ไม่มีโค้ด logic อื่นใดอยู่หลัง response — ป้องกันไม่ให้มีใครเผลอเพิ่มโค้ดกลับเข้าไปหลัง `jsonError()` ในอนาคต (ก่อนหน้านี้พฤติกรรมนี้เป็นจริงโดยบังเอิญเพราะ `exit` ใน `jsonError()`เท่านั้น ไม่มี spec ใดยืนยันไว้)

### Modified Capabilities
_ไม่มี_ — ไม่มี requirement หรือ behavior ระดับ spec ที่มีอยู่แล้วเปลี่ยนแปลง (endpoint ทั้ง 3 ตอบ 410 เหมือนเดิมทุกประการ ทั้งก่อนและหลังการลบ) ยืนยันแล้วว่าไม่มี spec ใดใน `openspec/specs/` อ้างอิงชื่อ action `send_now-legacy`, `publish-legacy`, หรือ `cron-publish-legacy` โดยตรง (spec ที่เกี่ยวข้อง เช่น `publish-approval-gate` อ้างอิงเฉพาะ action ที่ใช้งานจริงคือ `send_now`, `schedule`/`schedules`, `publish`, `cron publish`)

## Impact

- **Affected files**: `api/content-publish.php`, `api/brand-content.php`
- **Affected APIs**: ไม่มี — ไม่มี endpoint ที่ยังใช้งานได้ถูกกระทบ (3 action ที่ลบตอบ 410 อยู่แล้ว)
- **Risk**: ต่ำมาก — ยืนยันด้วย grep ทั้ง repo (`src/`, `*.php`) แล้วว่าไม่มีที่ใดเรียกชื่อ action ทั้ง 3 นี้อีก
- **Testing**: รัน `pnpm lint` / `pnpm build` (frontend ไม่ถูกกระทบ) และตรวจ syntax ของไฟล์ PHP ที่แก้ไข (`php -l`) หลังลบ เพื่อยืนยันว่าโครงสร้าง `if/elseif` ของ dispatcher ยังถูกต้อง
