## ADDED Requirements

### Requirement: SEO Quality Gate กำหนดสถานะจากคะแนนรวมและ critical rules
ระบบ SHALL มีฟังก์ชัน `seo_gate_status(array $eval): string` ที่คืนสถานะ `pass`, `warning`, หรือ `failed` จากคะแนนรวมและ critical rules โดยสถานะ `failed` เมื่อคะแนน < 80 หรือมี critical rule ใดมี `status = 'failed'`, `warning` เมื่อคะแนน 80–89 และไม่มี critical failed, และ `pass` เมื่อคะแนน ≥ 90 และไม่มี critical failed

#### Scenario: คะแนน ≥ 90 ไม่มี critical failed เป็น pass
- **WHEN** คะแนนรวม = 92 และไม่มี critical rule ที่ `failed`
- **THEN** `seo_gate_status()` คืน `pass`

#### Scenario: คะแนน 80–89 เป็น warning
- **WHEN** คะแนนรวม = 85 และไม่มี critical rule ที่ `failed`
- **THEN** `seo_gate_status()` คืน `warning`

#### Scenario: คะแนน < 80 เป็น failed
- **WHEN** คะแนนรวม = 74
- **THEN** `seo_gate_status()` คืน `failed`

#### Scenario: critical rule ล้มแม้คะแนนถึงเกณฑ์เป็น failed
- **WHEN** คะแนนรวม = 93 แต่มี critical rule `seo_title` เป็น `failed`
- **THEN** `seo_gate_status()` คืน `failed`

### Requirement: critical rules มีชุดที่กำหนดแน่นอน
ระบบ SHALL กำหนด critical rules เป็น {`seo_title`, `meta_description`, `h1`, `content_length`, `primary_keyword_placement`, `structured_data`} และ SHALL เปิดเผยชุดนี้ผ่านรายการน้ำหนัก (weight catalog) เพื่อให้ `seo_gate_status()` และ UI อ้างอิงชุดเดียวกัน

#### Scenario: critical flags อ่านได้จาก weight catalog
- **WHEN** ผู้เรียกอ่าน weight catalog ของระบบ
- **THEN** แต่ละข้อมี flag ระบุว่าเป็น critical หรือไม่ และชุด critical ประกอบด้วย 6 ข้อที่กำหนด

### Requirement: บังคับตรวจครบ 15 ข้อและห้ามข้าม
เมื่อสร้าง Content ระบบ SHALL ประเมินครบทั้ง 15 ข้อทุกครั้ง โดย SHALL ไม่ข้าม checklist และ SHALL ไม่ให้ AI เลือกตรวจเฉพาะบางข้อ

#### Scenario: ผลประเมินมี 15 rule object
- **WHEN** `seo_evaluate()` ถูกเรียกด้วย content ที่เป็นบทความ
- **THEN** ผลลัพธ์ `rules` มีครบทั้ง 15 key (seo_title, meta_description, slug, h1, heading_structure, content_length, search_intent, primary_keyword_placement, keyword_stuffing, related_keywords, topic_coverage, paa_questions, content_gap, structured_data, internal_linking)

### Requirement: AI Repair loop ตรวจใหม่ครบทั้ง 15 ข้อ
เมื่อมีข้อไม่ผ่าน (`failed` หรือ gate status ไม่ใช่ `pass`) ระบบ SHALL ส่งกลับให้ AI ปรับปรุง แล้ว SHALL ประเมินใหม่ครบทั้ง 15 ข้อ (ไม่ตรวจเฉพาะข้อที่ติด) และ SHALL ทำซ้ำจน gate status เป็น `pass` หรือถึงจำนวน retry ที่กำหนด

#### Scenario: repair แล้วตรวจใหม่ทั้งชุด
- **WHEN** รอบแรกมี `failed` และยังไม่ถึง retry cap
- **THEN** ระบบเรียก AI repair พร้อม feedback ของข้อที่ติด
- **AND** รอบถัดไปประเมินใหม่ครบทั้ง 15 ข้อ

#### Scenario: ถึง retry cap แล้วยังไม่ pass
- **WHEN** ระบบ repair จนครบ retry cap แล้ว gate status ยังไม่ใช่ `pass`
- **THEN** ระบบคืน content ที่ดีที่สุดพร้อม `seo_passed = false` และผลประเมินล่าสุด

### Requirement: แสดงผล SEO Score และคะแนนรายข้อ
ผลลัพธ์ SHALL แสดงคะแนนรวม (0–100) คะแนนของแต่ละ checklist สถานะ Passed/Warning/Failed รายละเอียดข้อที่ไม่ผ่าน ผลหลัง AI repair และสถานะสุดท้ายว่า Content ผ่านหรือไม่ผ่าน Quality Gate

#### Scenario: response คืนคะแนนรวมและคะแนนรายข้อ
- **WHEN** `generate-article` หรือ `?action=seo-checklist` คืนผล
- **THEN** response มี `score` (รวม) และ `rules` ที่แต่ละข้อมี `weight` และ `score` ของตัวเอง
- **AND** response มีสถานะ gate (pass/warning/failed)

#### Scenario: แสดงรายละเอียดข้อที่ไม่ผ่าน
- **WHEN** มีกฎที่มี `status = 'failed'`
- **THEN** response คืน message ภาษาไทยของแต่ละข้อที่ `failed` เพื่อให้ผู้ใช้เห็นรายละเอียด
