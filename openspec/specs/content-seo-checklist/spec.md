# content-seo-checklist Specification

## Purpose

กำหนดการประเมิน SEO ของคอนเทนต์ก่อนเผยแพร่ — ฟังก์ชัน `seo_evaluate()` ที่คืนคะแนนและผลตรวจแต่ละกฎ, การตั้งค่าเกตใน `content_global_settings`, endpoint `seo-checklist` สำหรับ UI, และเกตบล็อกการเผยแพร่เมื่อเปิดใช้งาน

## Requirements

### Requirement: seo_evaluate เป็นฟังก์ชันบริสุทธิ์ที่คืนคะแนนและกฎ
ระบบ SHALL มีฟังก์ชัน `seo_evaluate(array $item): array` ใน `api/lib/seo-checklist.php` ที่ไม่พึ่ง I/O ภายนอก และคืนผลลัพธ์รูป `['score' => int, 'rules' => array<array{key:string, level:string, status:string, tier:string, weight:int, score:int, critical:bool, message:string}>]` โดยรับชนิดคอนเทนต์จาก `$item['type']` และใช้เลือก ruleset โดย `score` (รวม) คำนวณแบบ weighted (0–100)

#### Scenario: ผลลัพธ์มี score และ rules พร้อม tier
- **WHEN** `seo_evaluate()` ถูกเรียกด้วย array ของฟิลด์คอนเทนต์
- **THEN** ผลลัพธ์มีคีย์ `score` (จำนวนเต็ม 0–100) และ `rules` (array ของ rule object)
- **AND** แต่ละ rule object มี `key`, `level`, `status`, `tier`, `weight`, `score`, `critical`, และ `message`
- **AND** `tier` มีค่าใน `required`, `optional` หรือ `informational`
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

### Requirement: ตั้งค่าเกตใน content_global_settings
ฐานข้อมูล SHALL มีคอลัมน์ `seo_gate_enabled TINYINT(1) DEFAULT 0` และ `seo_gate_min_score TINYINT UNSIGNED DEFAULT 0` ในตาราง `content_global_settings` โดยค่า default ปิดเกต

#### Scenario: default ปิดเกต
- **WHEN** แถว `content_global_settings` ถูกสร้างใหม่โดยไม่ระบุค่า
- **THEN** `seo_gate_enabled = 0` และ `seo_gate_min_score = 0`

### Requirement: endpoint seo-checklist
ระบบ SHALL มี endpoint `GET /brand-content.php?action=seo-checklist&item_id={id}` ที่คืนผลการประเมิน SEO ของคอนเทนต์นั้น โดยส่ง `content_items.type` ให้ `seo_evaluate()` และคืนสถานะ `pending` ได้

#### Scenario: ดึงผลประเมินสด
- **WHEN** ผู้ใช้เรียก `?action=seo-checklist&item_id={id}` ด้วย id ที่ถูกต้องและเป็นของ tenant
- **THEN** ระบบคืน `score`, `rules`, และสถานะเกต (`seo_gate_enabled`, `seo_gate_min_score`) โดยเรียก `seo_evaluate()` ตัวเดียวกับที่ใช้ในเส้นทางเผยแพร่

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

### Requirement: หน้า SEO/AEO รองรับสถานะ pending
หน้า SEO/AEO Metadata SHALL รองรับ rule level `pending` ที่ส่งจาก endpoint และแสดงผลเป็นสถานะข้อมูลที่ยังไม่ได้กำหนด โดยไม่ทำให้หน้า Page เกิด runtime error

#### Scenario: เปิดแผง SEO ที่มี pending
- **GIVEN** endpoint คืน rule ที่มี `level = 'pending'`
- **WHEN** ผู้ใช้เปิดแผง "SEO / AEO Metadata"
- **THEN** หน้าแสดงรายการ rule พร้อมไอคอนและรูปแบบของสถานะ pending
- **AND** ไม่แสดงข้อผิดพลาดจาก ErrorBoundary ของ Page

#### Scenario: แสดงสถานะ pending เป็นภาษาไทย
- **GIVEN** rule มี `level = 'pending'` และข้อความจาก API ระบุว่ายังไม่ได้กรอกหรือยังไม่ได้กำหนด
- **WHEN** รายการ rule ถูก render
- **THEN** ผู้ใช้เห็นข้อความภาษาไทยตามข้อมูลจาก API
- **AND** pending ไม่ถูกแสดงเป็น fail หรือ warn

### Requirement: หน้า SEO/AEO ป้องกันข้อมูลสถานะที่ไม่รู้จักทำให้ล้ม
ตัวแสดงผล SEO/AEO SHALL มี fallback สำหรับ rule level ที่ frontend ยังไม่รู้จัก เพื่อให้รายการยังแสดงได้และไม่ทำให้ component หลักหยุดทำงาน

#### Scenario: API ส่ง level ใหม่ที่ frontend ยังไม่มี
- **GIVEN** endpoint คืน rule ที่มี level ซึ่งไม่มีใน mapping ปัจจุบัน
- **WHEN** หน้า render รายการ rule
- **THEN** ระบบใช้รูปแบบ fallback ที่ปลอดภัย
- **AND** หน้า SEO/AEO และหน้า Page ยังคงทำงานต่อได้
