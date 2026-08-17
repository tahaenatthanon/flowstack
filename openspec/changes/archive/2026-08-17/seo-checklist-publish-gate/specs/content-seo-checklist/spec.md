# content-seo-checklist Specification

## Purpose

กำหนดการประเมิน SEO ของคอนเทนต์ก่อนเผยแพร่ — ฟังก์ชัน `seo_evaluate()` ที่คืนคะแนนและผลตรวจแต่ละกฎ, การตั้งค่าเกตใน `content_global_settings`, endpoint `seo-checklist` สำหรับ UI, และเกตบล็อกการเผยแพร่เมื่อเปิดใช้งาน

## ADDED Requirements

### Requirement: seo_evaluate เป็นฟังก์ชันบริสุทธิ์ที่คืนคะแนนและกฎ
ระบบ SHALL มีฟังก์ชัน `seo_evaluate(array $item): array` ใน `api/lib/seo-checklist.php` ที่ไม่พึ่ง I/O ภายนอก และคืนผลลัพธ์รูป `['score' => int, 'rules' => array<array{key:string, level:string, message:string}>]`

#### Scenario: ผลลัพธ์มี score และ rules
- **WHEN** `seo_evaluate()` ถูกเรียกด้วย array ของฟิลด์คอนเทนต์
- **THEN** ผลลัพธ์มีคีย์ `score` (จำนวนเต็ม) และ `rules` (array ของ rule object ที่มี `key`, `level`, `message`)
- **AND** `level` มีค่าใน `pass`, `warn`, `fail`, หรือ `skip`

### Requirement: กฎ SEO ครบชุด
ระบบ SHALL ประเมินกฎ SEO อย่างน้อยดังนี้ โดย `level` เป็น `fail` เมื่อละเมิดเกณฑ์ และ `pass` เมื่อผ่าน

- `seo_title` ความยาว 1–60 ตัวอักษร
- `meta_description` ความยาว 120–160 ตัวอักษร
- `slug` เป็นตัวพิมพ์เล็กและคั่นด้วยขีด (`[a-z0-9-]`)
- มี `h2` อย่างน้อย 1 ในเนื้อหา
- ไม่มี `h1` ในเนื้อหาบทความ
- จำนวนคำในเนื้อหา ≥ 500 คำ
- คีย์เวิร์ดหลัก (คำแรกของ `meta_keywords`) ปรากฏใน title, ย่อหน้าแรก และหัวข้อ
- `structured_data` เป็น JSON ที่ parse ได้และมี `@context` และ `@type`
- `og_image` ถูกตั้งค่า
- มีลิงก์ภายใน (internal link) อย่างน้อย 1

#### Scenario: seo_title ว่างเป็น fail
- **WHEN** `seo_title` ว่างหรือยาวเกิน 60 ตัวอักษร
- **THEN** กฎ `seo_title` มี `level = 'fail'`

#### Scenario: meta_description ไม่อยู่ในช่วง
- **WHEN** `meta_description` ว่าง สั้นกว่า 120 หรือยาวกว่า 160 ตัวอักษร
- **THEN** กฎ `meta_description` มี `level = 'fail'`

#### Scenario: เนื้อหาที่ไม่มี h2 เป็น fail
- **WHEN** เนื้อหาบทความ (article content HTML) ไม่มีแท็ก `h2`
- **THEN** กฎ `has_h2` มี `level = 'fail'`

#### Scenario: เนื้อหามี h1 เป็น fail
- **WHEN** เนื้อหาบทความมีแท็ก `h1`
- **THEN** กฎ `no_h1` มี `level = 'fail'`

#### Scenario: structured_data ไม่ถูกต้องเป็น fail
- **WHEN** `structured_data` ไม่ว่างแต่ไม่ใช่ JSON ที่ parse ได้ หรือไม่มี `@context`/`@type`
- **THEN** กฎ `structured_data` มี `level = 'fail'`

#### Scenario: กฎที่ขึ้นกับเนื้อหาถูกข้ามเมื่อไม่มีบทความ
- **WHEN** คอนเทนต์ไม่มีเนื้อหาบทความ HTML (เช่น caption โซเชียลล้วน ๆ)
- **THEN** กฎที่ต้องใช้เนื้อหา (`has_h2`, `no_h1`, `word_count`, `keyword_in_headings`, `internal_link`) มี `level = 'skip'` และไม่ถูกนับเป็น fail

### Requirement: ตั้งค่าเกตใน content_global_settings
ฐานข้อมูล SHALL มีคอลัมน์ `seo_gate_enabled TINYINT(1) DEFAULT 0` และ `seo_gate_min_score TINYINT UNSIGNED DEFAULT 0` ในตาราง `content_global_settings` โดยค่า default ปิดเกต

#### Scenario: default ปิดเกต
- **WHEN** แถว `content_global_settings` ถูกสร้างใหม่โดยไม่ระบุค่า
- **THEN** `seo_gate_enabled = 0` และ `seo_gate_min_score = 0`

### Requirement: endpoint seo-checklist
ระบบ SHALL มี endpoint `GET /brand-content.php?action=seo-checklist&item_id={id}` ที่คืนผลการประเมิน SEO ของคอนเทนต์นั้น

#### Scenario: ดึงผลประเมินสด
- **WHEN** ผู้ใช้เรียก `?action=seo-checklist&item_id={id}` ด้วย id ที่ถูกต้องและเป็นของ tenant
- **THEN** ระบบคืน `score`, `rules`, และสถานะเกต (`seo_gate_enabled`, `seo_gate_min_score`) โดยเรียก `seo_evaluate()` ตัวเดียวกับที่ใช้ในเส้นทางเผยแพร่

### Requirement: เกตบล็อกการเผยแพร่เมื่อเปิดใช้งาน
เมื่อ `seo_gate_enabled = 1` ระบบ SHALL บล็อกการเผยแพร่ (publish / send_now / cron scheduler) หากผล `seo_evaluate()` มีกฎ `level = 'fail'` หรือคะแนนต่ำกว่า `seo_gate_min_score`

#### Scenario: เปิดเกตและมีกฎ fail ถูกบล็อก
- **WHEN** `seo_gate_enabled = 1` และ `seo_evaluate()` คืนกฎที่มี `fail`
- **THEN** การเผยแพร่ถูกปฏิเสธพร้อมข้อความภาษาไทยที่ระบุกฎที่ติด
- **AND** ไม่มีการ dispatch ไปยัง platform

#### Scenario: เปิดเกตแต่ผ่านทั้งหมด ไม่ถูกบล็อก
- **WHEN** `seo_gate_enabled = 1` และไม่มีกฎ `fail` และคะแนน ≥ `seo_gate_min_score`
- **THEN** การเผยแพร่ดำเนินต่อไปตามปกติ

#### Scenario: ปิดเกตไม่บล็อก
- **WHEN** `seo_gate_enabled = 0` (default)
- **THEN** การเผยแพร่ดำเนินต่อไปตามปกติไม่ว่าคะแนน/กฎจะเป็นอย่างไร
