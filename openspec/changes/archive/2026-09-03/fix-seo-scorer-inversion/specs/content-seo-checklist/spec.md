## MODIFIED Requirements

### Requirement: กฎ SEO ครบชุด 15 ข้อ น้ำหนักรวม 100 ไม่ Skip ตาม Content Type
ระบบ SHALL ประเมินกฎ SEO ครบ 15 ข้อดังนี้ โดย `status` เป็น `failed` เมื่อละเมิดเกณฑ์, `passed` เมื่อผ่าน, `needs_improvement` เมื่อผ่านบางส่วน/ควรปรับปรุง, `pending` เมื่อข้อมูลที่ต้องใช้ยังว่าง (เช่น ไม่มี research brief หรือ field ของ brief นั้นว่าง) และ SHALL ไม่ตั้งกฎใดเป็น `skip` เพียงเพราะเป็น Article หรือ Video — ทุก content type ต้องมีผลตรวจครบทั้ง 15 ข้อ โดยใช้วิธีวัดผลต่างกันตามลักษณะ content

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

### Requirement: search_intent ตรวจความสอดคล้องจริงด้วย heuristic
เมื่อมี research brief ที่มี `intent` ระบบ SHALL ประเมิน `search_intent` โดยเทียบ signal terms ของ intent กับ content (hybrid: heuristic deterministic ตัดสิน) โดยคืน `passed` เมื่อ content สอดคล้องกับ intent, `failed` เมื่อ content ขัดกับ intent อย่างชัดเจน, `needs_improvement` เมื่อไม่ชัดเจน (uncertain) และ `pending` เมื่อไม่มี brief/intent

#### Scenario: content สอดคล้องกับ intent
- **WHEN** brief มี `intent = 'informational'` และ content มี signal ของ informational (เช่น วิธี/คือ/ทำไม) พร้อม primary keyword
- **THEN** กฎ `search_intent` มี `status = 'passed'`

#### Scenario: content ขัดกับ intent
- **WHEN** brief มี `intent = 'informational'` แต่ content มีแต่ signal ของ transactional (ซื้อ/ราคา/สั่งซื้อ) เด่นกว่า
- **THEN** กฎ `search_intent` มี `status = 'failed'`

#### Scenario: intent ไม่ชัดเจน
- **WHEN** brief มี `intent` แต่ content ไม่มี signal ของ intent ใดชัดเจน
- **THEN** กฎ `search_intent` มี `status = 'needs_improvement'`
- **AND** ระบบส่ง feedback ให้ AI ปรับเนื้อหาให้สอดคล้องกับ intent

#### Scenario: ไม่มี intent เป็น pending
- **WHEN** ไม่มี research brief หรือ brief ไม่มี `intent`
- **THEN** กฎ `search_intent` มี `status = 'pending'`

### Requirement: related_keywords ต้องครอบคลุม keyword จาก research ตามเกณฑ์
เมื่อมี `secondary_keywords` จาก research ระบบ SHALL ประเมิน `related_keywords` ตาม coverage โดยครอบคลุม ≥ 0.6 → `passed`, ครอบคลุม 0 → `failed`, ระหว่างนั้น → `needs_improvement` และไม่มี keyword ให้ตรวจ → `pending`

#### Scenario: ครอบคลุม 0 เป็น failed
- **WHEN** brief มี secondary keywords แต่ content ไม่พบ keyword รองเลย
- **THEN** กฎ `related_keywords` มี `status = 'failed'`

#### Scenario: ครอบคลุมบางส่วน
- **WHEN** content ครอบคลุม keyword รองต่ำกว่า 60%
- **THEN** กฎ `related_keywords` มี `status = 'needs_improvement'`

#### Scenario: ครอบคลุมครบเกณฑ์
- **WHEN** content ครอบคลุม keyword รอง ≥ 60%
- **THEN** กฎ `related_keywords` มี `status = 'passed'`

### Requirement: topic_coverage ต้องครอบคลุมหัวข้อสำคัญจาก research ตามเกณฑ์
เมื่อมี `outline` จาก research ระบบ SHALL ประเมิน `topic_coverage` ตาม coverage โดยครอบคลุม ≥ 0.7 → `passed`, < 0.3 → `failed`, ระหว่างนั้น → `needs_improvement` และไม่มี outline → `pending`

#### Scenario: ไม่ครอบคลุม outline เป็น failed
- **WHEN** brief มี outline แต่ content ครอบคลุมหัวข้อต่ำกว่า 30%
- **THEN** กฎ `topic_coverage` มี `status = 'failed'`

#### Scenario: ครอบคลุมบางส่วน
- **WHEN** content ครอบคลุม outline ระหว่าง 30–70%
- **THEN** กฎ `topic_coverage` มี `status = 'needs_improvement'`

#### Scenario: ครอบคลุมครบเกณฑ์
- **WHEN** content ครอบคลุม outline ≥ 70%
- **THEN** กฎ `topic_coverage` มี `status = 'passed'`

### Requirement: paa_questions ต้องตอบคำถามที่ research พบตามเกณฑ์
เมื่อมีคำถาม PAA จาก research ระบบ SHALL ประเมิน `paa_questions` โดยตอบ ≥ 0.5 → `passed`, ตอบ 0 → `failed`, ระหว่างนั้น → `needs_improvement` และไม่มี PAA → `pending`

#### Scenario: ตอบ 0 เป็น failed
- **WHEN** brief มีคำถาม PAA แต่ content ไม่ตอบคำถามใดเลย
- **THEN** กฎ `paa_questions` มี `status = 'failed'`

#### Scenario: ตอบบางส่วน
- **WHEN** content ตอบคำถาม PAA ต่ำกว่า 50%
- **THEN** กฎ `paa_questions` มี `status = 'needs_improvement'`

#### Scenario: ตอบครบเกณฑ์
- **WHEN** content ตอบคำถาม PAA ≥ 50%
- **THEN** กฎ `paa_questions` มี `status = 'passed'`

### Requirement: content_gap ต้องครอบคลุม gap ที่ค้นพบตามเกณฑ์
เมื่อมี content gaps จาก research ระบบ SHALL ประเมิน `content_gap` โดยเติม ≥ 0.5 → `passed`, เติม 0 → `failed`, ระหว่างนั้น → `needs_improvement` และไม่มี gap → `pending`

#### Scenario: เติม 0 เป็น failed
- **WHEN** brief มี content gaps แต่ content ไม่เติม gap ใดเลย
- **THEN** กฎ `content_gap` มี `status = 'failed'`

#### Scenario: เติมบางส่วน
- **WHEN** content เติม gap ต่ำกว่า 50%
- **THEN** กฎ `content_gap` มี `status = 'needs_improvement'`

#### Scenario: เติมครบเกณฑ์
- **WHEN** content เติม gap ≥ 50%
- **THEN** กฎ `content_gap` มี `status = 'passed'`
