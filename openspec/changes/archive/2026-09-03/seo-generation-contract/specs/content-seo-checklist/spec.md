## MODIFIED Requirements

### Requirement: seo_evaluate เป็นฟังก์ชันบริสุทธิ์ที่คืนคะแนนและกฎ
ระบบ SHALL มีฟังก์ชัน `seo_evaluate(array $item): array` ใน `api/lib/seo-checklist.php` ที่ไม่พึ่ง I/O ภายนอก และคืนผลลัพธ์รูป `['score' => int, 'rules' => array<array{key:string, level:string, status:string, tier:string, weight:int, score:int, critical:bool, message:string}>]` โดยรับชนิดคอนเทนต์จาก `$item['type']` และใช้เลือก ruleset โดย `score` (รวม) คำนวณแบบ weighted (0–100)

#### Scenario: ผลลัพธ์มี score และ rules พร้อม tier
- **WHEN** `seo_evaluate()` ถูกเรียกด้วย array ของฟิลด์คอนเทนต์
- **THEN** ผลลัพธ์มีคีย์ `score` (จำนวนเต็ม 0–100) และ `rules` (array ของ rule object)
- **AND** แต่ละ rule object มี `key`, `level`, `status`, `tier`, `weight`, `score`, `critical`, และ `message`
- **AND** `tier` มีค่าใน `required`, `optional` หรือ `informational`
- **AND** `status` มีค่าใน `passed`, `needs_improvement`, `failed`, `n/a`, `pending` หรือ `skip`

#### Scenario: ไม่ระบุชนิดให้ใช้ article เป็นค่าเริ่มต้น
- **WHEN** `seo_evaluate()` ถูกเรียกโดยไม่มี `type`
- **THEN** ระบบใช้ ruleset ของ article เพื่อรักษาความเข้ากันได้กับผู้เรียกเดิม

### Requirement: Required rule ที่ข้อมูลจำเป็นหายไปต้องเป็น failed
Required rule ที่ข้อมูลจำเป็นหายไป (เช่น `seo_title` ว่าง, `meta_description` ว่าง, `structured_data` ว่าง, `primary_keyword_placement` ไม่มี keyword, `content_length`/`heading_structure` ไม่มีเนื้อหา) SHALL มี `status = 'failed'` และ SHALL ไม่ใช้ `pending` เพื่อเลี่ยงการ block

#### Scenario: structured_data ว่างเป็น failed
- **WHEN** content เป็น article และ `structured_data` ว่าง
- **THEN** กฎ `structured_data` มี `status = 'failed'` (ไม่ใช่ `pending`)

#### Scenario: seo_title ว่างเป็น failed
- **WHEN** content เป็น article และ `seo_title` ว่าง
- **THEN** กฎ `seo_title` มี `status = 'failed'`

#### Scenario: ไม่มี primary keyword เป็น failed
- **WHEN** content เป็น article และไม่มี primary keyword (meta_keywords ว่าง)
- **THEN** กฎ `primary_keyword_placement` มี `status = 'failed'`

### Requirement: Research rules เป็น n/a เมื่อปิด research และตรวจจริงเมื่อเปิด
Research rules (`search_intent`, `related_keywords`, `topic_coverage`, `paa_questions`, `content_gap`) SHALL มี `status = 'n/a'` (not applicable, ไม่นับเป็น failure) เมื่อไม่ใช้ research และ SHALL ถูกตรวจกับข้อมูล research จริง (ไม่ใช่ `pending`) เมื่อใช้ research

#### Scenario: ปิด research เป็น n/a
- **WHEN** content ถูกสร้างโดยไม่ใช้ research
- **THEN** กฎ research ทั้ง 5 ข้อมี `status = 'n/a'`
- **AND** กฎ `n/a` ไม่ถูกนับเป็น failure และไม่หักคะแนน

#### Scenario: เปิด research แล้วตรวจจริง
- **WHEN** content ถูกสร้างโดยใช้ research และ brief มีข้อมูลครบ
- **THEN** กฎ research ทั้ง 5 ข้อถูกประเมินกับข้อมูล research จริง (passed/needs_improvement/failed)
- **AND** ไม่มี rule ใดใช้ `pending` เพื่อหลีกเลี่ยงการตรวจ

### Requirement: seo_generation_requirements เป็น generation contract
`seo_generation_requirements(string $type): array` SHALL คืนข้อกำหนดภาษาไทยที่ AI ต้องปฏิบัติตามครบ โดยแต่ละข้อระบุ `key`, `tier`, `requirement` (สิ่งที่ต้องมี), `min`/`max` (ค่าเกณฑ์), และ `pass_condition` (เงื่อนไขที่ถือว่าผ่าน) โดยใช้ threshold เดียวกับ `seo_evaluate()`

#### Scenario: ข้อกำหนดมีเกณฑ์ครบ
- **WHEN** `seo_generation_requirements('article')` ถูกเรียก
- **THEN** ผลลัพธ์แต่ละข้อมี `key`, `tier`, `requirement` และ `pass_condition` (และ `min`/`max` เมื่อเกี่ยวข้อง)
- **AND** ข้อกำหนดภาษาไทยอ้างอิงค่า threshold เดียวกับที่ `seo_evaluate()` ใช้ตรวจ

#### Scenario: requirement กับ evaluator ใช้เกณฑ์เดียวกัน
- **WHEN** rule `content_length` มี `min = 500` ใน requirements
- **THEN** `seo_evaluate()` ตรวจ `content_length` ด้วย threshold 500 เดียวกัน
