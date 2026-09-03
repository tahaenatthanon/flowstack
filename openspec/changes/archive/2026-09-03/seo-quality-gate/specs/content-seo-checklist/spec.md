## MODIFIED Requirements

### Requirement: seo_evaluate เป็นฟังก์ชันบริสุทธิ์ที่คืนคะแนนและกฎ
ระบบ SHALL มีฟังก์ชัน `seo_evaluate(array $item): array` ใน `api/lib/seo-checklist.php` ที่ไม่พึ่ง I/O ภายนอก และคืนผลลัพธ์รูป `['score' => int, 'rules' => array<array{key:string, level:string, status:string, weight:int, score:int, message:string}>]` โดยรับชนิดคอนเทนต์จาก `$item['type']` และใช้เลือก ruleset โดย `score` (รวม) คำนวณแบบ weighted จากน้ำหนักจริงของแต่ละกฎ (0–100) แทน penalty คงที่

#### Scenario: ผลลัพธ์มี score และ rules พร้อมน้ำหนัก
- **WHEN** `seo_evaluate()` ถูกเรียกด้วย array ของฟิลด์คอนเทนต์
- **THEN** ผลลัพธ์มีคีย์ `score` (จำนวนเต็ม 0–100) และ `rules` (array ของ rule object)
- **AND** แต่ละ rule object มี `key`, `level`, `status`, `weight`, `score`, และ `message`
- **AND** `level` มีค่าใน `pass`, `warn`, `fail`, `pending` หรือ `skip`
- **AND** `status` มีค่าใน `pass`, `warning`, `failed`, `pending` หรือ `skip`

#### Scenario: คะแนนรวมสะท้อนน้ำหนักจริง
- **WHEN** กฎที่มีน้ำหนักสูง (เช่น primary_keyword_placement = 10) เป็น `failed`
- **THEN** คะแนนรวมลดลงตามน้ำหนักของกฎนั้น ไม่ใช่ค่าคงที่เท่ากันทุกกฎ

#### Scenario: คะแนนรายข้ออยู่ในช่วง 0 ถึงน้ำหนัก
- **WHEN** `seo_evaluate()` คืนผล
- **THEN** ทุก rule มี `score` ระหว่าง 0 ถึง `weight` ของข้อนั้น

#### Scenario: ไม่ระบุชนิดให้ใช้ article เป็นค่าเริ่มต้น
- **WHEN** `seo_evaluate()` ถูกเรียกโดยไม่มี `type`
- **THEN** ระบบใช้ ruleset ของ article เพื่อรักษาความเข้ากันได้กับผู้เรียกเดิม

### Requirement: กฎ SEO ครบชุด 15 ข้อตามชนิดคอนเทนต์
ระบบ SHALL ประเมินกฎ SEO ครบ 15 ข้อดังนี้ โดย `status` เป็น `failed` เมื่อละเมิดเกณฑ์, `pass` เมื่อผ่าน, `warning` เมื่อผ่านบางส่วน/ควรปรับปรุง, `pending` เมื่อข้อมูลที่ต้องใช้ยังว่าง (เช่น ไม่มี research brief), และ `skip` เมื่อกฎไม่เกี่ยวข้องกับชนิดคอนเทนต์

1. `seo_title` ความยาว 1–60 ตัวอักษร (critical)
2. `meta_description` ความยาว 120–160 ตัวอักษร (critical)
3. `slug` เป็นตัวพิมพ์เล็กและคั่นด้วยขีด (`[a-z0-9-]`)
4. `h1` มี h1 ของชื่อบทความไม่เกิน 1 ตัว (critical)
5. `heading_structure` มีลำดับหัวข้อ H2/H3 ที่สมเหตุสมผล (มี H2 อย่างน้อย 1 และไม่ข้ามระดับ)
6. `content_length` จำนวนคำ ≥ 500 คำ (critical)
7. `search_intent` เนื้อหาสอดคล้องกับ search intent จาก research brief (pending เมื่อไม่มี brief)
8. `primary_keyword_placement` คีย์เวิร์ดหลักปรากฏใน title, ย่อหน้าแรก และหัวข้อ (critical)
9. `keyword_stuffing` ความถี่คีย์เวิร์ดไม่หนาแน่นเกิน (ไม่ stuff)
10. `related_keywords` คีย์เวิร์ดรองจาก research ปรากฏในเนื้อหา (pending เมื่อไม่มี)
11. `topic_coverage` เนื้อหาครอบคลุม outline หัวข้อจาก research (pending เมื่อไม่มี outline)
12. `paa_questions` เนื้อหาตอบคำถาม PAA จาก research (pending เมื่อไม่มี)
13. `content_gap` เนื้อหาเติมช่องว่าง content_gaps จาก research (pending เมื่อไม่มี)
14. `structured_data` เป็น JSON ที่ parse ได้และมี `@context` และ `@type` (critical)
15. `internal_linking` มีลิงก์ภายในอย่างน้อย 1

#### Scenario: ผลประเมินมีครบ 15 rule object
- **WHEN** `seo_evaluate()` ถูกเรียกด้วยบทความ
- **THEN** `rules` มีครบทั้ง 15 key ข้างต้น

#### Scenario: h1 แรกที่เป็นชื่อบทความผ่าน
- **WHEN** เนื้อหาบทความมีแท็ก `h1` เพียงหนึ่งตัว
- **THEN** กฎ `h1` มี `status = 'pass'`

#### Scenario: h1 ซ้ำเป็น failed
- **WHEN** เนื้อหาบทความมีแท็ก `h1` ตั้งแต่สองตัวขึ้นไป
- **THEN** กฎ `h1` มี `status = 'failed'`

#### Scenario: seo_title ที่ยาวเกินกำหนดเป็น failed
- **WHEN** `seo_title` ว่างหรือยาวเกิน 60 ตัวอักษร
- **THEN** กฎ `seo_title` มี `status = 'failed'`

#### Scenario: meta_description ที่อยู่นอกช่วงเป็น failed
- **WHEN** `meta_description` สั้นกว่า 120 หรือยาวกว่า 160 ตัวอักษร
- **THEN** กฎ `meta_description` มี `status = 'failed'`

#### Scenario: เนื้อหาบทความไม่มี h2 เป็น failed
- **WHEN** เป็นบทความและ HTML ไม่มีแท็ก `h2`
- **THEN** กฎ `heading_structure` มี `status = 'failed'`

#### Scenario: structured_data ที่มีค่าแต่รูปแบบผิดเป็น failed
- **WHEN** `structured_data` ไม่ว่างแต่ไม่ใช่ JSON ที่ parse ได้ หรือไม่มี `@context`/`@type`
- **THEN** กฎ `structured_data` มี `status = 'failed'`

#### Scenario: กฎที่ขึ้นกับ research เป็น pending เมื่อไม่มี brief
- **WHEN** content ไม่มี research brief
- **THEN** กฎ `search_intent`, `related_keywords`, `topic_coverage`, `paa_questions` และ `content_gap` มี `status = 'pending'`
- **AND** กฎ pending ไม่ถูกหักคะแนน (ตัดออกจาก denominator เมื่อ normalize)

#### Scenario: วิดีโอข้ามกฎบทความ
- **WHEN** `type = 'video'`
- **THEN** กฎ `heading_structure`, `content_length`, `internal_linking`, `topic_coverage`, `paa_questions` และ `content_gap` มี `status = 'skip'`
- **AND** ระบบยังตรวจ metadata และ hashtags ตามข้อมูลที่เกี่ยวข้องกับวิดีโอ

### Requirement: เกตบล็อกการเผยแพร่เมื่อเปิดใช้งาน
เมื่อ `seo_gate_enabled = 1` ระบบ SHALL บล็อกการเผยแพร่ (publish / send_now / cron scheduler) หาก `seo_gate_status()` คืน `failed` (คะแนน < 80 หรือมี critical rule `failed`) หรือคะแนนต่ำกว่า `seo_gate_min_score` โดย `pending`, `warning` และ `skip` ไม่เป็นเหตุบล็อกเมื่อ `seo_gate_min_score = 0`

#### Scenario: เปิดเกตและ gate status failed ถูกบล็อก
- **WHEN** `seo_gate_enabled = 1` และ `seo_gate_status()` คืน `failed`
- **THEN** การเผยแพร่ถูกปฏิเสธพร้อมข้อความภาษาไทยที่ระบุกฎที่ติด
- **AND** ไม่มีการ dispatch ไปยัง platform

#### Scenario: เปิดเกตและมี critical rule failed แม้คะแนนถึงเกณฑ์ถูกบล็อก
- **WHEN** `seo_gate_enabled = 1` คะแนน ≥ 90 แต่มี critical rule `seo_title` เป็น `failed`
- **THEN** การเผยแพร่ถูกปฏิเสธ
- **AND** ไม่มีการ dispatch ไปยัง platform

#### Scenario: เปิดเกตและคะแนนต่ำกว่าเกณฑ์ถูกบล็อก
- **WHEN** `seo_gate_enabled = 1` และคะแนนต่ำกว่า `seo_gate_min_score`
- **THEN** การเผยแพร่ถูกปฏิเสธแม้ไม่มี critical rule `failed`
- **AND** ไม่มีการ dispatch ไปยัง platform

#### Scenario: ปิดเกตไม่บล็อก
- **WHEN** `seo_gate_enabled = 0` (default)
- **THEN** การเผยแพร่ดำเนินต่อไปตามปกติไม่ว่าคะแนน/กฎจะเป็นอย่างไร
