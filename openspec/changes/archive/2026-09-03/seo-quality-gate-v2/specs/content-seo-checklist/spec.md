## MODIFIED Requirements

### Requirement: seo_evaluate เป็นฟังก์ชันบริสุทธิ์ที่คืนคะแนนและกฎ
ระบบ SHALL มีฟังก์ชัน `seo_evaluate(array $item): array` ใน `api/lib/seo-checklist.php` ที่ไม่พึ่ง I/O ภายนอก และคืนผลลัพธ์รูป `['score' => int, 'gate' => string, 'rules' => array<array{key:string, level:string, status:string, weight:int, score:int, critical:bool, message:string}>]` โดยรับชนิดคอนเทนต์จาก `$item['type']` และใช้เลือก ruleset โดย `score` (รวม) คำนวณแบบ weighted จากน้ำหนักจริงของแต่ละกฎ (0–100)

#### Scenario: ผลลัพธ์มี score และ rules พร้อมน้ำหนัก
- **WHEN** `seo_evaluate()` ถูกเรียกด้วย array ของฟิลด์คอนเทนต์
- **THEN** ผลลัพธ์มีคีย์ `score` (จำนวนเต็ม 0–100) และ `rules` (array ของ rule object)
- **AND** แต่ละ rule object มี `key`, `level`, `status`, `weight`, `score`, `critical`, และ `message`
- **AND** `status` มีค่าใน `passed`, `needs_improvement`, `failed`, `pending` หรือ `skip`
- **AND** `level` (alias) มีค่าใน `pass`, `warn`, `fail`, `pending` หรือ `skip`

#### Scenario: คะแนนรวมสะท้อนน้ำหนักจริง
- **WHEN** กฎที่มีน้ำหนักสูง (เช่น search_intent = 8) เป็น `failed`
- **THEN** คะแนนรวมลดลงตามน้ำหนักของกฎนั้น ไม่ใช่ค่าคงที่เท่ากันทุกกฎ

#### Scenario: คะแนนรายข้ออยู่ในช่วง 0 ถึงน้ำหนัก
- **WHEN** `seo_evaluate()` คืนผล
- **THEN** ทุก rule มี `score` ระหว่าง 0 ถึง `weight` ของข้อนั้น

#### Scenario: ไม่ระบุชนิดให้ใช้ article เป็นค่าเริ่มต้น
- **WHEN** `seo_evaluate()` ถูกเรียกโดยไม่มี `type`
- **THEN** ระบบใช้ ruleset ของ article เพื่อรักษาความเข้ากันได้กับผู้เรียกเดิม

### Requirement: กฎ SEO ครบชุด 15 ข้อ น้ำหนักรวม 100 ไม่ Skip ตาม Content Type
ระบบ SHALL ประเมินกฎ SEO ครบ 15 ข้อดังนี้ โดย `status` เป็น `failed` เมื่อละเมิดเกณฑ์, `passed` เมื่อผ่าน, `needs_improvement` เมื่อผ่านบางส่วน/ควรปรับปรุง, `pending` เมื่อข้อมูลที่ต้องใช้ยังว่าง (เช่น ไม่มี research brief หรือ video ไม่มี source นั้น) และ SHALL ไม่ตั้งกฎใดเป็น `skip` เพียงเพราะเป็น Article หรือ Video — ทุก content type ต้องมีผลตรวจครบทั้ง 15 ข้อ โดยใช้วิธีวัดผลต่างกันตามลักษณะ content

น้ำหนัก (รวม = 100):
1. `seo_title` 8 (critical)
2. `meta_description` 8 (critical)
3. `slug` 6
4. `h1` 6 (critical)
5. `heading_structure` 7
6. `content_length` 8 (critical)
7. `search_intent` 8
8. `primary_keyword_placement` 8 (critical)
9. `keyword_stuffing` 7
10. `related_keywords` 6
11. `topic_coverage` 8
12. `paa_questions` 6
13. `content_gap` 6
14. `structured_data` 5 (critical)
15. `internal_linking` 3

#### Scenario: ผลประเมินมีครบ 15 rule object ทั้ง article และ video
- **WHEN** `seo_evaluate()` ถูกเรียกด้วย content ที่เป็น article หรือ video
- **THEN** `rules` มีครบทั้ง 15 key ข้างต้น
- **AND** ไม่มี rule ใดมี `status = 'skip'`

#### Scenario: video วัด content_length จาก script
- **WHEN** content type เป็น `video` และมี script (scripts) ใน `article_content`
- **THEN** กฎ `content_length` ประเมินจากจำนวนคำของ script ไม่ใช่ `skip`
- **AND** ถ้า video ไม่มี script/description ที่จะวัด → `status = 'pending'`

#### Scenario: video วัด structured_data จาก Video schema
- **WHEN** content type เป็น `video` และมี `structured_data` เป็น VideoObject schema
- **THEN** กฎ `structured_data` มี `status = 'passed'`
- **AND** ถ้า `structured_data` ไม่มี `@type` เป็น VideoObject → `status = 'failed'` หรือ `pending` ตามกรณี

#### Scenario: research rules ตรวจทั้ง article และ video
- **WHEN** content มี research brief และเป็น article หรือ video
- **THEN** กฎ `search_intent`, `related_keywords`, `topic_coverage`, `paa_questions` และ `content_gap` ถูกประเมินด้วยข้อมูล research (เทียบกับ title/script/description) ไม่ใช่ `skip`
- **AND** ถ้าไม่มี research brief → `status = 'pending'` และไม่หักคะแนน

#### Scenario: h1 แรกที่เป็นชื่อบทความผ่าน
- **WHEN** เนื้อหาบทความมีแท็ก `h1` เพียงหนึ่งตัว
- **THEN** กฎ `h1` มี `status = 'passed'`

#### Scenario: seo_title ที่ยาวเกินกำหนดเป็น failed
- **WHEN** `seo_title` ว่างหรือยาวเกิน 60 ตัวอักษร
- **THEN** กฎ `seo_title` มี `status = 'failed'`

### Requirement: เกตบล็อกการเผยแพร่เมื่อเปิดใช้งาน
เมื่อ `seo_gate_enabled = 1` ระบบ SHALL บล็อกการเผยแพร่ (publish / send_now / cron scheduler) หาก `seo_gate_status()` คืน `failed` (คะแนน < 80 หรือมี critical rule `failed`) หรือคะแนนต่ำกว่า `seo_gate_min_score` โดย `pending` และ `needs_improvement` ไม่เป็นเหตุบล็อกเมื่อ `seo_gate_min_score = 0`

#### Scenario: เปิดเกตและ gate status failed ถูกบล็อก
- **WHEN** `seo_gate_enabled = 1` และ `seo_gate_status()` คืน `failed`
- **THEN** การเผยแพร่ถูกปฏิเสธพร้อมข้อความภาษาไทยที่ระบุกฎที่ติด
- **AND** ไม่มีการ dispatch ไปยัง platform

#### Scenario: เปิดเกตและมี critical rule failed แม้คะแนนถึงเกณฑ์ถูกบล็อก
- **WHEN** `seo_gate_enabled = 1` คะแนน ≥ 90 แต่มี critical rule `seo_title` เป็น `failed`
- **THEN** การเผยแพร่ถูกปฏิเสธ
- **AND** ไม่มีการ dispatch ไปยัง platform

#### Scenario: ปิดเกตไม่บล็อก
- **WHEN** `seo_gate_enabled = 0` (default)
- **THEN** การเผยแพร่ดำเนินต่อไปตามปกติไม่ว่าคะแนน/กฎจะเป็นอย่างไร
