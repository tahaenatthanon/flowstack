## MODIFIED Requirements

### Requirement: seo_evaluate เป็นฟังก์ชันบริสุทธิ์ที่คืนคะแนนและกฎ
ระบบ SHALL มีฟังก์ชัน `seo_evaluate(array $item): array` ใน `api/lib/seo-checklist.php` ที่ไม่พึ่ง I/O ภายนอก และคืนผลลัพธ์รูป `['score' => int, 'rules' => array<array{key:string, level:string, status:string, tier:string, weight:int, score:int, critical:bool, message:string}>]` โดยรับชนิดคอนเทนต์จาก `$item['type']` และใช้เลือก ruleset โดย `score` (รวม) คำนวณแบบ weighted (0–100)

#### Scenario: ผลลัพธ์มี score และ rules พร้อม tier
- **WHEN** `seo_evaluate()` ถูกเรียกด้วย array ของฟิลด์คอนเทนต์
- **THEN** ผลลัพธ์มีคีย์ `score` (จำนวนเต็ม 0–100) และ `rules` (array ของ rule object)
- **AND** แต่ละ rule object มี `key`, `level`, `status`, `tier`, `weight`, `score`, `critical`, และ `message`
- **AND** `tier` มีค่าใน `required`, `recommended` หรือ `informational`
- **AND** `status` มีค่าใน `passed`, `needs_improvement`, `failed`, `n/a`, `pending` หรือ `skip`

#### Scenario: คะแนนรวมสะท้อนน้ำหนักจริง
- **WHEN** กฎที่มีน้ำหนักสูง (เช่น primary_keyword_placement = 8) เป็น `failed`
- **THEN** คะแนนรวมลดลงตามน้ำหนักของกฎนั้น ไม่ใช่ค่าคงที่เท่ากันทุกกฎ

#### Scenario: คะแนนรายข้ออยู่ในช่วง 0 ถึงน้ำหนัก
- **WHEN** `seo_evaluate()` คืนผล
- **THEN** ทุก rule มี `score` ระหว่าง 0 ถึง `weight` ของข้อนั้น

#### Scenario: ไม่ระบุชนิดให้ใช้ article เป็นค่าเริ่มต้น
- **WHEN** `seo_evaluate()` ถูกเรียกโดยไม่มี `type`
- **THEN** ระบบใช้ ruleset ของ article เพื่อรักษาความเข้ากันได้กับผู้เรียกเดิม

### Requirement: endpoint seo-checklist
ระบบ SHALL มี endpoint `GET /brand-content.php?action=seo-checklist&item_id={id}` ที่คืนผลการประเมิน SEO ของคอนเทนต์นั้น
- ส่ง `content_items.type` ให้ `seo_evaluate()` และคืนสถานะ `pending` ได้
- `gate` ที่คืนมาตัดสินจาก Required rule ตามกฎเดียวกับ Quality Gate กลาง
- คืน `seo_gate_enabled` ด้วย
- `seo_gate_min_score` SHALL ไม่ถูกใช้ตัดสินผล

#### Scenario: ดึงผลประเมินสด
- **WHEN** ผู้ใช้เรียก `?action=seo-checklist&item_id={id}` ด้วย id ที่ถูกต้องและเป็นของ tenant
- **THEN** ระบบคืน `score`, `rules`, `gate` และ `seo_gate_enabled` โดยเรียก `seo_evaluate()` ตัวเดียวกับที่ใช้ในเส้นทางเผยแพร่

### Requirement: เกตบล็อกการเผยแพร่เมื่อเปิดใช้งาน
เมื่อ `seo_gate_enabled = 1` ระบบ SHALL บล็อกการเผยแพร่ไป platform เว็บ/CMS (publish / send_now / cron scheduler) ผ่าน Quality Gate กลาง (`quality_required_gate()`) หากมี Required rule ของ SEO หรือ AEO ที่ `failed`
- คะแนนรวม, `seo_gate_min_score`, `pending`, `needs_improvement` และ Recommended rule SHALL ไม่เป็นเหตุบล็อก
- คอนเทนต์ `type = 'video'` SHALL ไม่ถูกบล็อกด้วยเกตนี้

#### Scenario: เปิดเกตและมี Required failed ถูกบล็อก
- **WHEN** `seo_gate_enabled = 1` และ `meta_description` ยาว 175 ตัวอักษร (Required failed)
- **THEN** การเผยแพร่ถูกปฏิเสธพร้อมข้อความภาษาไทยที่ระบุกฎที่ติด
- **AND** ไม่มีการ dispatch ไปยัง platform

#### Scenario: เปิดเกตและคะแนนต่ำแต่ Required ผ่านไม่ถูกบล็อก
- **WHEN** `seo_gate_enabled = 1` คะแนน 60 และไม่มี Required rule `failed`
- **THEN** การเผยแพร่ไม่ถูกบล็อกด้วยเกตนี้

#### Scenario: ปิดเกตไม่บล็อก
- **WHEN** `seo_gate_enabled = 0` (default)
- **THEN** การเผยแพร่ดำเนินต่อไปตามปกติไม่ว่าคะแนน/กฎจะเป็นอย่างไร

## ADDED Requirements

### Requirement: เกณฑ์ Required แบบเพดานแข็งและช่วงแนะนำ
`seo_evaluate()` SHALL ใช้ `status` แยกเพดานแข็ง (Required) ออกจากช่วงแนะนำใน rule เดียวกัน ดังนี้:
- `seo_title`: ว่างหรือยาว > 60 ตัวอักษร = `failed`; 1–60 = `passed`
- `meta_description`: ว่างหรือยาว > 160 = `failed`; 1–119 = `needs_improvement`; 120–160 = `passed`
- `content_length` (article): < 300 คำ = `failed`; 300–499 = `needs_improvement`; ≥ 500 = `passed`
- `primary_keyword_placement`: ไม่มี keyword หรืออยู่ 0 ตำแหน่งสำคัญ = `failed`; อยู่ 1 ถึง N−1 ตำแหน่ง = `needs_improvement`; ครบทุกตำแหน่ง = `passed`

`seo_generation_requirements()` SHALL ใช้ threshold ชุดเดียวกันผ่าน named constants โดย `pass_condition` หมายถึงเกณฑ์ Required และเพิ่มฟิลด์ `recommended` สำหรับช่วงที่แนะนำ

#### Scenario: meta สั้นกว่า 120 ผ่านแบบควรปรับปรุง
- **WHEN** `meta_description` ยาว 108 ตัวอักษร
- **THEN** กฎ `meta_description` มี `status = 'needs_improvement'` และไม่บล็อก gate

#### Scenario: meta ยาวเกิน 160 ไม่ผ่าน
- **WHEN** `meta_description` ยาว 162 ตัวอักษร
- **THEN** กฎ `meta_description` มี `status = 'failed'`

#### Scenario: เนื้อหา 450 คำผ่านแบบควรปรับปรุง
- **WHEN** บทความมีประมาณ 450 คำ
- **THEN** กฎ `content_length` มี `status = 'needs_improvement'` และไม่บล็อก gate

#### Scenario: เนื้อหา 250 คำไม่ผ่าน
- **WHEN** บทความมีประมาณ 250 คำ
- **THEN** กฎ `content_length` มี `status = 'failed'`

#### Scenario: keyword อยู่ 1 จาก 3 ตำแหน่งผ่านแบบควรปรับปรุง
- **WHEN** primary keyword อยู่ในตำแหน่งสำคัญ 1 จาก 3 ตำแหน่ง
- **THEN** กฎ `primary_keyword_placement` มี `status = 'needs_improvement'`

#### Scenario: keyword ไม่อยู่ตำแหน่งสำคัญเลยไม่ผ่าน
- **WHEN** primary keyword อยู่ในตำแหน่งสำคัญ 0 จาก 3 ตำแหน่ง
- **THEN** กฎ `primary_keyword_placement` มี `status = 'failed'`
