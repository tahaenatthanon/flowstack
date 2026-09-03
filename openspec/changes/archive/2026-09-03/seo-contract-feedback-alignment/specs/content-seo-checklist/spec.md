## MODIFIED Requirements

### Requirement: seo_generation_requirements เป็น generation contract
`seo_generation_requirements(string $type): array` SHALL คืนข้อกำหนดภาษาไทยที่ AI ต้องปฏิบัติตามครบ โดยแต่ละข้อระบุ `key`, `tier`, `requirement` (สิ่งที่ต้องมี), `min`/`max` (ค่าเกณฑ์), และ `pass_condition` (เงื่อนไขที่ถือว่าผ่าน) โดยใช้ threshold เดียวกับ `seo_evaluate()`

#### Scenario: ข้อกำหนดมีเกณฑ์ครบ
- **WHEN** `seo_generation_requirements('article')` ถูกเรียก
- **THEN** ผลลัพธ์แต่ละข้อมี `key`, `tier`, `requirement` และ `pass_condition` (และ `min`/`max` เมื่อเกี่ยวข้อง)
- **AND** ข้อกำหนดภาษาไทยอ้างอิงค่า threshold เดียวกับที่ `seo_evaluate()` ใช้ตรวจ

#### Scenario: requirement กับ evaluator ใช้เกณฑ์เดียวกัน
- **WHEN** rule `content_length` มี `min = 500` ใน requirements
- **THEN** `seo_evaluate()` ตรวจ `content_length` ด้วย threshold 500 เดียวกัน

### Requirement: prompt ใช้ contract เป็น source of truth (ไม่ duplicate threshold)
ระบบ SHALL มี helper `seo_contract_hints(string $type): string` ที่คืน field hints ภาษาไทยซึ่ง derive จาก `seo_generation_requirements()` (requirement + pass_condition + min/max) และ SHALL ใช้ hint นี้ใน `generate-article` prompt แทนการ hardcode ค่าเกณฑ์ซ้ำ เพื่อไม่ให้ prompt กับ evaluator ใช้ threshold ต่างกัน

#### Scenario: prompt ไม่ hardcode ค่าเกณฑ์ซ้ำ
- **WHEN** `generate-article` สร้าง `$jsonSchema`/`$mainSys`
- **THEN** field description เช่น meta_description, content_length, slug derive จาก `seo_contract_hints()` ไม่ใช่ hardcode
- **AND** meta_description ปรากฏเป็น 120–160 (เดียวกับ evaluator) ไม่ใช่ค่าอื่นเช่น 150–160

### Requirement: seo_evaluate ข้อที่ fail ระบุ actual value
`seo_evaluate()` SHALL ระบุค่าที่วัดได้จริง (actual) ใน `message` ของ rule ที่ `failed`/`needs_improvement` อย่างสม่ำเสมอ เมื่อมีค่าให้วัดได้ (เช่น จำนวนตัวอักษร, จำนวนคำ, coverage ratio, จำนวน keyword ที่พบ)

#### Scenario: ข้อที่ fail มีค่า actual
- **WHEN** rule `meta_description` เป็น `failed` เพราะสั้นเกิน
- **THEN** `message` ระบุความยาวจริง (เช่น "ปัจจุบัน 100 ตัวอักษร") และเกณฑ์ (120–160)
