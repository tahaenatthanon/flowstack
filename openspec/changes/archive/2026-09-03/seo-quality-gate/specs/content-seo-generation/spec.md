## MODIFIED Requirements

### Requirement: สร้างใหม่พร้อม feedback จนกว่า SEO Quality Gate ผ่าน
เมื่อผล `seo_evaluate()` มี gate status ไม่ใช่ `pass` (มีกฎ `failed`/`warning` หรือ critical rule ล้ม) ระบบ SHALL สร้างเนื้อหาใหม่อีกครั้งโดยเพิ่ม feedback (ข้อความภาษาไทยของกฎที่ติด เรียงตามน้ำหนักมากไปน้อย) เข้าในคำขอ AI และ SHALL ประเมินใหม่ครบทั้ง 15 ข้อทุกครั้ง แล้วทำซ้ำจน gate status เป็น `pass` หรือถึงเพดานที่กำหนด

#### Scenario: meta_description นอกช่วงถูกสร้างใหม่
- **WHEN** ผลประเมินมีกฎ `meta_description` เป็น `failed`
- **THEN** ระบบสร้างเนื้อหาใหม่อีกครั้งพร้อม feedback ที่ระบุว่าคำอธิบาย meta ต้องยาว 120–160 ตัวอักษร
- **AND** รอบถัดไปประเมินใหม่ครบทั้ง 15 ข้อ

#### Scenario: เนื้อหาไม่มี H2 ถูกสร้างใหม่
- **WHEN** ผลประเมินมีกฎ `heading_structure` เป็น `failed`
- **THEN** ระบบสร้างใหม่อีกครั้งพร้อม feedback ให้เพิ่มหัวข้อ H2 ในเนื้อหา

#### Scenario: critical rule ล้มถูกสร้างใหม่แม้คะแนนถึงเกณฑ์
- **WHEN** คะแนน ≥ 90 แต่ critical rule `structured_data` เป็น `failed`
- **THEN** ระบบสร้างใหม่อีกครั้งพร้อม feedback ระบุ structured_data ต้องมี @context และ @type

### Requirement: pending skip ไม่กระตุ้นการสร้างใหม่
กฎ `pending` และ `skip` SHALL ไม่กระตุ้นการสร้างเนื้อหาใหม่ และ SHALL ไม่ถูกนับเป็นเหตุให้ `seo_passed = false` ส่วน `warning` และ `failed` SHALL กระตุ้นการสร้างใหม่เมื่อ gate status ยังไม่ใช่ `pass`

#### Scenario: research ยังไม่มี (pending) ไม่สร้างใหม่
- **WHEN** ผลประเมินมีกฎ `search_intent` เป็น `pending` และไม่มีกฎ `failed`/`warning` อื่นที่ทำให้ gate ไม่ผ่าน
- **THEN** ระบบคืนเนื้อหาให้ผู้ใช้ทันทีโดยไม่สร้างใหม่
- **AND** `seo_passed = true`

#### Scenario: คีย์เวิร์ดรองไม่ปรากฏ (warning) ถูกสร้างใหม่
- **WHEN** ผลประเมินมีกฎ `related_keywords` เป็น `warning` ที่ทำให้ gate status ไม่ใช่ `pass`
- **THEN** ระบบสร้างใหม่อีกครั้งพร้อม feedback ระบุคีย์เวิร์ดรองที่ควรเพิ่ม

### Requirement: คืนผลประเมิน SEO ใน response ของ generate-article
`generate-article` SHALL คืน `seo` (มี `score`, `gate`, และ `rules`) และ `seo_passed` (boolean) ควบคู่กับ `article` โดย `seo_passed = true` เมื่อ `seo_gate_status()` คืน `pass` และ `false` เมื่อคืน `warning` หรือ `failed`

#### Scenario: คืนผลประเมินพร้อมเนื้อหาและสถานะ gate
- **WHEN** `generate-article` สร้างเนื้อหาเสร็จ
- **THEN** response มี `article`, `seo` (`score` + `gate` + `rules`), และ `seo_passed`

#### Scenario: seo_passed สะท้อน gate status
- **WHEN** `seo_gate_status()` คืน `failed` หรือ `warning`
- **THEN** `seo_passed = false`

#### Scenario: seo_passed เป็น true เมื่อ gate ผ่าน
- **WHEN** `seo_gate_status()` คืน `pass`
- **THEN** `seo_passed = true`
