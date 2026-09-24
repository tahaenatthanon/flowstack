# quality-required-gate Specification

## Purpose

กำหนด Quality Gate ที่ตัดสินผ่าน/ไม่ผ่านของ SEO/AEO จาก Required rule ที่ `failed` เท่านั้น (`quality_required_status`) — ใช้ที่ Generate เท่านั้น (ประเมิน + AI repair สูงสุด 1 รอบ), ยกเว้นวิดีโอจาก SEO/AEO gate, และการแสดงผลแยก Required/Recommended บนหน้าจอ ผล SEO/AEO เป็นข้อมูลประกอบการตัดสินใจของผู้อนุมัติเท่านั้น ไม่บล็อกขออนุมัติหรือเผยแพร่ — ที่มา: change `quality-required-tiers`, ปรับ scope ของ gate ใน change `approval-seo-advisory`

## Requirements

### Requirement: Quality Gate ตัดสินผ่าน/ไม่ผ่านจาก Required rule ที่ failed เท่านั้น
ระบบ SHALL มีฟังก์ชัน pure `quality_required_status(array $seoEval, array $aeoEval): array` คืนค่า `['status' => 'passed'|'failed', 'failed_required' => list]`
- ผลเป็น `failed` เมื่อมี rule ใดของ SEO หรือ AEO ที่ `tier = 'required'` และ `status = 'failed'`
- กรณีอื่นทั้งหมด ผลเป็น `passed`
- `needs_improvement`, `pending` และ `n/a` ของ Required rule นับว่าผ่าน
- Recommended rule ในทุกสถานะ SHALL ไม่ทำให้ผลเป็น `failed`
- คะแนนรวม (0–100) และ flag `critical` SHALL ไม่ถูกใช้ตัดสิน

`failed_required` แต่ละรายการมี `quality` (`SEO`/`AEO`), `key`, `message` และ `expected`

#### Scenario: คะแนนต่ำแต่ไม่มี Required failed ถือว่าผ่าน
- **WHEN** คะแนน SEO เท่ากับ 62 และ Required ทุกข้อมีสถานะ `passed` หรือ `needs_improvement`
- **THEN** `quality_required_status()` คืน `status = 'passed'`

#### Scenario: Recommended failed ไม่บล็อก
- **WHEN** `content_gap` (Recommended) เป็น `failed` และ Required ทุกข้อไม่ `failed`
- **THEN** ผลเป็น `passed`

#### Scenario: Required ของ AEO failed บล็อก
- **WHEN** AEO `direct_answer` (Required) เป็น `failed` แม้ SEO ผ่านทุกข้อ
- **THEN** ผลเป็น `failed`
- **AND** `failed_required` มีรายการ `quality = 'AEO'`, `key = 'direct_answer'`

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

### Requirement: วิดีโอไม่ผ่าน SEO/AEO gate
เมื่อ `content_items.type = 'video'` ระบบ SHALL:
- ให้ `quality_required_gate()` คืน `blocked = false` ทันที โดยไม่เช็ค `quality_checked_at` และไม่ evaluate
- ข้าม SEO/AEO repair ในเส้นทาง Generate
- ไม่ตั้ง `status = 'revision'` เพราะผล SEO/AEO

วิดีโอยังต้องผ่าน Approval gate และ Platform gate ตามเดิม

#### Scenario: วิดีโอขออนุมัติได้โดยไม่ต้องตรวจ SEO/AEO
- **WHEN** คอนเทนต์วิดีโอที่ไม่มี `quality_checked_at` ถูกขออนุมัติ
- **THEN** ระบบไม่บล็อกด้วยเหตุผล Quality

#### Scenario: วิดีโอยังต้องอนุมัติก่อนเผยแพร่
- **WHEN** คอนเทนต์วิดีโอที่ยังไม่อนุมัติถูกสั่งเผยแพร่
- **THEN** ระบบบล็อกด้วย Approval gate ตามเดิม

#### Scenario: generate วิดีโอไม่เรียก repair
- **WHEN** generate คอนเทนต์วิดีโอ แล้วผล SEO มี Required failed
- **THEN** ระบบไม่เรียก AI repair และไม่ตั้ง `status = 'revision'` ด้วยเหตุผล SEO/AEO

### Requirement: แสดงผล SEO/AEO แยก Required และ Recommended
UI ที่แสดงผลตรวจ SEO/AEO (แผงผลตรวจในหน้าคอนเทนต์และหน้าอนุมัติ) SHALL แสดง:
- สองกลุ่ม "ข้อบังคับ (Required)" และ "ข้อแนะนำ (Recommended)"
- สถานะรายข้อ: ผ่าน / ควรปรับปรุง / ไม่ผ่าน / ไม่เกี่ยวข้อง พร้อมข้อความของข้อนั้น
- ผลรวม "ผ่าน" หรือ "ไม่ผ่าน (ติดข้อบังคับ N ข้อ)" ตาม `quality_required_status`
- คะแนน 0–100 เป็นข้อมูลรอง
- ค่า tier `optional` จากข้อมูลเดิมแสดงเป็นข้อแนะนำ

#### Scenario: แยกกลุ่มชัดเจน
- **WHEN** ผลตรวจมี `seo_title` (Required) ผ่าน และ `content_gap` (Recommended) ไม่ผ่าน
- **THEN** `seo_title` อยู่กลุ่มข้อบังคับพร้อมสถานะผ่าน
- **AND** `content_gap` อยู่กลุ่มข้อแนะนำพร้อมสถานะไม่ผ่าน
- **AND** ผลรวมแสดง "ผ่าน"
