## MODIFIED Requirements

### Requirement: SEO Quality Gate กำหนดสถานะจากคะแนนรวมและ critical rules
ระบบ SHALL มีฟังก์ชัน `seo_gate_status(array $eval): string` และ `aeo_gate_status(array $eval): string` ที่คืน `passed` หรือ `failed`
- ผลเป็น `failed` เมื่อมี rule ที่ `tier = 'required'` และ `status = 'failed'`
- กรณีอื่นผลเป็น `passed`
- คะแนนรวม (0–100) และ flag `critical` SHALL ไม่ถูกใช้ตัดสิน คะแนนใช้แสดงคุณภาพรวมเท่านั้น
- เกณฑ์คะแนน 80/70 เดิม SHALL ไม่ถูกใช้อีก

#### Scenario: required failed แม้คะแนนสูงเป็น failed
- **WHEN** คะแนนรวม ≥ 90 แต่มี required rule `failed`
- **THEN** `seo_gate_status()` คืน `failed` และ generation ไม่ถือเป็น success

#### Scenario: คะแนนต่ำแต่ไม่มี required failed เป็น passed
- **WHEN** คะแนนรวม 60 และไม่มี required rule `failed`
- **THEN** `seo_gate_status()` คืน `passed`

#### Scenario: n/a ไม่ทำให้ gate failed
- **WHEN** research rules มี `status = 'n/a'` (ปิด research) และไม่มี required rule อื่น `failed`
- **THEN** gate ไม่เป็น `failed` เพียงเพราะ research rules เป็น `n/a`

#### Scenario: recommended rule ไม่ block
- **WHEN** recommended rule เป็น `needs_improvement`/`failed` แต่ required rules ไม่ `failed`
- **THEN** gate เป็น `passed` (recommended แนะนำเท่านั้น)

### Requirement: Rule tier กำหนดว่า rule ใด block generation
ระบบ SHALL กำหนด tier ของแต่ละ rule ผ่าน weight catalog (`SEO_WEIGHTS`, `AEO_WEIGHTS`) เป็น 3 ค่า:
- `required`: `failed` แล้วบล็อก
- `recommended`: แนะนำเท่านั้น
- `informational`: แสดงคุณภาพเท่านั้น

`seo_gate_status()`, `aeo_gate_status()` และ UI SHALL อ้างอิงชุดเดียวกัน โดยแบ่งดังนี้:
- **SEO required:** `seo_title`, `meta_description`, `slug`, `h1`, `content_length`, `primary_keyword_placement`, `keyword_stuffing`, `structured_data`
- **SEO recommended:** `heading_structure`, `search_intent`, `related_keywords`, `topic_coverage`, `paa_questions`, `content_gap`, `internal_linking`
- **AEO required:** `direct_answer`, `structured_data`
- **AEO recommended:** `search_intent`, `qa_structure`, `heading_questions`, `snippet_readiness`, `paa_coverage`, `entity_clarity`

#### Scenario: tier อ่านได้จาก weight catalog
- **WHEN** ผู้เรียกอ่าน weight catalog ของระบบ
- **THEN** แต่ละ rule มี `tier` เป็น `required`, `recommended` หรือ `informational`
- **AND** ไม่มี rule ใดใช้ค่า `optional`

#### Scenario: research rules เป็น recommended
- **WHEN** อ่าน tier ของ `topic_coverage`, `paa_questions` และ `content_gap`
- **THEN** ทั้งสามข้อเป็น `recommended`

### Requirement: AI Repair loop ตรวจใหม่ครบทั้ง 15 ข้อ
เมื่อ `quality_required_status()` ของผลหลังสร้างเป็น `failed` ระบบ SHALL เรียก AI repair **1 รอบรวม SEO และ AEO** ส่ง feedback เฉพาะ Required rule ที่ `failed` ของทั้งสองชุด แล้ว SHALL ประเมินใหม่ครบทุกข้อทั้ง SEO และ AEO แล้วตัดสินผลครั้งเดียว

ระบบ SHALL ไม่ repair ในกรณีต่อไปนี้:
- มีแค่ `needs_improvement` หรือ Recommended ที่ไม่ผ่าน
- คอนเทนต์เป็นวิดีโอ

#### Scenario: repair แล้วตรวจใหม่ทั้งชุด
- **WHEN** ผลหลังสร้างมี Required `seo_title` failed และ AEO Required `direct_answer` failed
- **THEN** ระบบเรียก AI repair 1 ครั้ง feedback มีทั้งสองข้อ
- **AND** หลัง repair ประเมินใหม่ครบทุกข้อทั้ง SEO และ AEO

#### Scenario: ครบ 1 รอบแล้วยังไม่ passed
- **WHEN** หลัง repair 1 รอบยังมี Required failed
- **THEN** ระบบไม่เรียก AI เพิ่ม และคืนผลประเมินล่าสุดพร้อม `seo_passed = false`

#### Scenario: มีแค่ recommended ไม่ผ่านไม่ repair
- **WHEN** ผลหลังสร้างมีแค่ `content_gap` failed และ `internal_linking` needs_improvement
- **THEN** ระบบไม่เรียก AI repair

### Requirement: แสดงผล SEO Score และคะแนนรายข้อ
ผลลัพธ์ SHALL แสดง:
- คะแนนรวม (0–100) เป็นข้อมูล และคะแนนของแต่ละ checklist
- `tier` และสถานะรายข้อ Passed/Needs Improvement/Failed
- รายละเอียดข้อที่ไม่ผ่าน
- สถานะสุดท้าย `passed`/`failed` ซึ่งตัดสินจาก Required rule

#### Scenario: response คืนคะแนนรวมและคะแนนรายข้อ
- **WHEN** `generate-article`, `?action=seo-checklist` หรือ `?action=quality-recheck` คืนผล
- **THEN** response มี `score` (รวม) และ `rules` ที่แต่ละข้อมี `tier`, `weight` และ `score` ของตัวเอง
- **AND** response มีสถานะ gate (`passed`/`failed`)

#### Scenario: แสดงรายละเอียดข้อที่ไม่ผ่าน
- **WHEN** มีกฎที่มี `status = 'failed'` หรือ `needs_improvement`
- **THEN** response คืน message ภาษาไทยของแต่ละข้อที่ติด เพื่อให้ผู้ใช้เห็นรายละเอียด
