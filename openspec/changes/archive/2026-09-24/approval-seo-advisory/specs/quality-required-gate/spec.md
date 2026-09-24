## REMOVED Requirements

### Requirement: Quality Gate กลางใช้ร่วมกันที่ Generate, ขออนุมัติ และเผยแพร่
**Reason**: SEO/AEO Quality Gate ไม่ใช้ตัดสิน block/allow ที่ขั้นขออนุมัติและเผยแพร่อีกต่อไป (ดู requirement ใหม่ "Quality Gate กลางใช้ที่ Generate เท่านั้น") — manager เป็นผู้ตัดสินใจเองจากผลที่เห็นในหน้ารายละเอียด ไม่ใช่ระบบบล็อกอัตโนมัติ
**Migration**: `quality_required_gate()`/`content_quality_gate_check()` ยังอยู่ในโค้ด ไม่ถูกลบ เพียงแต่เลิกถูกเรียกจาก `api/approvals.php`, `PUT api/content-items.php`, `final_publish_gate_check()` และ `api/cron/publish-scheduler.php` — ยังใช้ที่ Generate เหมือนเดิม

### Requirement: Approval และ Publish ประเมินใหม่จากข้อมูลที่บันทึกล่าสุดทุกครั้ง
**Reason**: requirement นี้อธิบายพฤติกรรมของ marker gate (`quality_checked_at`) ที่ขออนุมัติ/เผยแพร่ ซึ่งมีไว้รองรับ SEO/AEO Quality Gate ที่จุดนั้น — เมื่อ Quality Gate ถูกตัดออกจากขออนุมัติ/เผยแพร่ทั้งหมด marker gate ที่จุดเดียวกันก็ไม่มีความหมายอีกต่อไป
**Migration**: ไม่มีการย้ายข้อมูล — `article_content.quality_checked_at` ยังถูกเขียนตอน Generate เหมือนเดิม (ใช้แสดงผลใน UI) เพียงแต่ไม่มีจุดใดอ่านค่านี้เพื่อบล็อกอีกต่อไป

### Requirement: seo_gate_enabled เป็นสวิตช์รวมระดับ tenant
**Reason**: requirement นี้อธิบายว่า `seo_gate_enabled` ควบคุมการบล็อกที่ขออนุมัติ/เผยแพร่ — เมื่อ Quality Gate ไม่ถูกเรียกจากสองเส้นทางนี้อีกต่อไป ค่านี้จึงไม่มีผลต่อการอนุมัติ/เผยแพร่จริง (Generate ก็ไม่เคยอ่านค่านี้อยู่แล้ว)
**Migration**: คอลัมน์ `content_global_settings.seo_gate_enabled`/`seo_gate_min_score` และหน้าตั้งค่าที่เกี่ยวข้องยังอยู่ในระบบ (ไม่ลบ) แต่ไม่มีผลเชิงพฤติกรรมกับ Quality Gate อีกต่อไป

## ADDED Requirements

### Requirement: Quality Gate กลางใช้ที่ Generate เท่านั้น
ระบบ SHALL มีฟังก์ชัน `quality_required_gate(PDO $db, string $tenantId, array $content, ?array $brief, bool $requireMarker = true): array` ใน `api/lib/publish-dispatch.php` ตัดสินผลด้วย `quality_required_status()` — เส้นทาง Generate SHALL ใช้ `quality_required_status()` ตัวเดียวกันเพื่อประเมิน AI repair (สูงสุด 1 รอบ) และบันทึก `quality_checked_at`

`content_quality_gate_check()` และ `quality_required_gate()` SHALL ไม่ถูกเรียกจากเส้นทางขออนุมัติ (`api/approvals.php`, `PUT api/content-items.php` ที่ตั้ง `status=pending_approval`) และเส้นทางเผยแพร่ (`final_publish_gate_check()`, `api/cron/publish-scheduler.php`) อีกต่อไป — ผล SEO/AEO ไม่มีผลต่อการอนุมัติหรือเผยแพร่ เป็นเพียงข้อมูลแสดงผลให้ผู้อนุมัติเห็นประกอบการตัดสินใจ (ดู capability `approval-detail-quality-display`)

ฟังก์ชันเหล่านี้ยังคงอยู่ในโค้ด (ไม่ถูกลบ) เพราะยังมีการทดสอบยืนยันพฤติกรรมโดยตรง และเป็น building block ที่อาจใช้ที่อื่นในอนาคตโดยไม่บล็อก

#### Scenario: ขออนุมัติไม่ถูกบล็อกด้วย SEO/AEO ไม่ว่าผลจะเป็นอย่างไร
- **WHEN** คอนเทนต์ที่เลือก wordpress มี Required rule ของ SEO เป็น `failed`
- **THEN** การขออนุมัติ (`api/approvals.php` หรือ `PUT content-items.php` ตั้ง `status=pending_approval`) ไม่ถูกบล็อกด้วยเหตุผล Quality — สถานะเปลี่ยนเป็น `pending_approval` ได้ปกติ

#### Scenario: เผยแพร่ไม่ถูกบล็อกด้วย SEO/AEO ไม่ว่าผลจะเป็นอย่างไร
- **WHEN** คอนเทนต์ที่ได้รับอนุมัติแล้วและเลือก wordpress มี Required rule ของ SEO หรือ AEO เป็น `failed`
- **THEN** `final_publish_gate_check()` คืน `blocked=false` (ตราบใดที่ผ่าน Approval gate และ Platform gate) — เผยแพร่ไปยัง wordpress ได้ทันที

#### Scenario: cron ไม่บล็อกด้วย SEO/AEO
- **WHEN** cron `publish-scheduler.php` กำลังจะ dispatch รายการตั้งเวลาไป platform เว็บที่มี Required failed
- **THEN** รายการนั้นไม่ถูกบล็อกด้วย Quality — dispatch ตามปกติ

#### Scenario: seo_gate_enabled ไม่มีผลต่อการอนุมัติ/เผยแพร่อีกต่อไป
- **WHEN** `content_global_settings.seo_gate_enabled = 1` และคอนเทนต์มี Required failed
- **THEN** การขออนุมัติและการเผยแพร่ยังไม่ถูกบล็อก (ค่านี้ไม่ถูกอ่านจากเส้นทางขออนุมัติ/เผยแพร่อีกต่อไป — มีผลเฉพาะฟังก์ชันที่ไม่ถูกเรียกในเส้นทางเหล่านี้แล้ว)
