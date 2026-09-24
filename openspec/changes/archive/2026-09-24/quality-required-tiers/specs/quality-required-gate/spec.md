## ADDED Requirements

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

### Requirement: Quality Gate กลางใช้ร่วมกันที่ Generate, ขออนุมัติ และเผยแพร่
ระบบ SHALL มีฟังก์ชัน `quality_required_gate(PDO $db, string $tenantId, array $content, ?array $brief, bool $requireMarker = true): array` ใน `api/lib/publish-dispatch.php`
- ตัดสินผลด้วย `quality_required_status()`
- ถูกเรียกจาก `content_quality_gate_check()` (ขออนุมัติ ทั้ง `api/approvals.php` และ `PUT api/content-items.php` ที่ตั้ง `status=pending_approval`), `final_publish_gate_check()` (เผยแพร่ทันที/ตั้งเวลา) และ `api/cron/publish-scheduler.php` (cron)
- เส้นทาง Generate SHALL ใช้ `quality_required_status()` ตัวเดียวกัน
- ไม่มีจุดใดใช้เกณฑ์ต่างจากนี้
- การเลือก platform ที่ต้องผ่าน gate คงเดิม: ใช้กับ platform เว็บ/CMS ส่วน platform โซเชียลไม่มี Quality gate

#### Scenario: ขออนุมัติและเผยแพร่ให้ผลเดียวกัน
- **WHEN** คอนเทนต์ที่เลือก wordpress มี Required ทุกข้อผ่าน แต่คะแนน SEO เท่ากับ 65
- **THEN** การขออนุมัติไม่ถูกบล็อกด้วย Quality
- **AND** หลังอนุมัติแล้ว การเผยแพร่ไป wordpress ไม่ถูกบล็อกด้วย Quality

#### Scenario: ขออนุมัติจากปุ่มใน dialog ผ่าน gate กลาง
- **WHEN** ผู้ใช้กด "ขออนุมัติ" ใน `ContentCardDialog` (ส่ง `PUT content-items.php` ด้วย `status=pending_approval`) โดยคอนเทนต์ที่เลือก wordpress ยังไม่มี `quality_checked_at`
- **THEN** ระบบตอบ 422 พร้อมเหตุผลจาก gate กลาง และสถานะไม่เปลี่ยนเป็น `pending_approval`

#### Scenario: cron ใช้ gate กลาง
- **WHEN** cron กำลังจะ dispatch รายการตั้งเวลาไป platform เว็บ และคอนเทนต์มี Required failed
- **THEN** รายการนั้นถูกบล็อกด้วยเหตุผลจาก gate กลาง และไม่ถูก dispatch

### Requirement: Approval และ Publish ประเมินใหม่จากข้อมูลที่บันทึกล่าสุดทุกครั้ง
`quality_required_gate()` SHALL เรียก `seo_evaluate()` และ `aeo_evaluate()` ใหม่ทุกครั้งกับข้อมูล `content_items` ที่อ่านจาก DB ในคำขอนั้น พร้อม research brief ล่าสุด และ SHALL ไม่ใช้คะแนนหรือผลตรวจที่เก็บไว้ (`seo_score`, `aeo_score`, ผล recheck เดิม) เป็นตัวตัดสิน

เมื่อ `requireMarker = true` ระบบ SHALL บล็อกด้วยข้อความภาษาไทยถ้า `article_content.quality_checked_at` ว่าง ข้อความต้องแจ้งให้บันทึกแล้วกด "ตรวจ SEO/AEO ใหม่" ถ้ามี marker แต่ผลประเมินใหม่ไม่ผ่าน ระบบ SHALL ยังบล็อก

#### Scenario: มี marker แต่เนื้อหาปัจจุบันไม่ผ่าน
- **WHEN** `quality_checked_at` มีค่า แต่การประเมินใหม่พบ `seo_title` ยาว 72 ตัวอักษร
- **THEN** การขออนุมัติถูกบล็อก พร้อมข้อความระบุ `seo_title`

#### Scenario: ไม่มี marker
- **WHEN** ผู้ใช้แก้บทความแล้วบันทึก ทำให้ `quality_checked_at` ถูกล้าง และยังไม่ได้กดตรวจใหม่
- **THEN** การขออนุมัติถูกบล็อกด้วยข้อความให้กด "ตรวจ SEO/AEO ใหม่"

### Requirement: seo_gate_enabled เป็นสวิตช์รวมระดับ tenant
ระบบ SHALL อ่าน `content_global_settings.seo_gate_enabled` ใน `quality_required_gate()` เพียงจุดเดียว และให้มีผลเหมือนกันทุกจุดที่เรียก gate
- `seo_gate_enabled = 0`: gate SHALL ไม่บล็อกด้วยผล SEO/AEO แต่ยังเช็ค marker ตาม `requireMarker`
- `seo_gate_min_score` SHALL ไม่ถูกใช้ตัดสินผลอีก (คอลัมน์ยังอยู่)

#### Scenario: ปิดสวิตช์แล้วไม่บล็อกด้วยผลตรวจ
- **WHEN** `seo_gate_enabled = 0` และคอนเทนต์มี Required failed แต่มี `quality_checked_at`
- **THEN** ทั้งการขออนุมัติและการเผยแพร่ไม่ถูกบล็อกด้วย SEO/AEO

#### Scenario: min_score ไม่มีผล
- **WHEN** `seo_gate_min_score = 90` และคอนเทนต์ได้คะแนน 70 โดยไม่มี Required failed
- **THEN** gate ไม่บล็อก

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
