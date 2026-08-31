# content-seo-checklist Specification

## Purpose

กำหนดการประเมิน SEO ของคอนเทนต์ก่อนเผยแพร่ — ฟังก์ชัน `seo_evaluate()` ที่คืนคะแนนและผลตรวจแต่ละกฎ, การตั้งค่าเกตใน `content_global_settings`, endpoint `seo-checklist` สำหรับ UI, และเกตบล็อกการเผยแพร่เมื่อเปิดใช้งาน

## Requirements

### Requirement: seo_evaluate เป็นฟังก์ชันบริสุทธิ์ที่คืนคะแนนและกฎ
ระบบ SHALL มีฟังก์ชัน `seo_evaluate(array $item): array` ใน `api/lib/seo-checklist.php` ที่ไม่พึ่ง I/O ภายนอก และคืนผลลัพธ์รูป `['score' => int, 'rules' => array<array{key:string, level:string, message:string}>]` โดยรับชนิดคอนเทนต์จาก `$item['type']` และใช้เลือก ruleset

#### Scenario: ผลลัพธ์มี score และ rules
- **WHEN** `seo_evaluate()` ถูกเรียกด้วย array ของฟิลด์คอนเทนต์
- **THEN** ผลลัพธ์มีคีย์ `score` (จำนวนเต็ม) และ `rules` (array ของ rule object ที่มี `key`, `level`, `message`)
- **AND** `level` มีค่าใน `pass`, `warn`, `fail`, `pending` หรือ `skip`

#### Scenario: ไม่ระบุชนิดให้ใช้ article เป็นค่าเริ่มต้น
- **WHEN** `seo_evaluate()` ถูกเรียกโดยไม่มี `type`
- **THEN** ระบบใช้ ruleset ของ article เพื่อรักษาความเข้ากันได้กับผู้เรียกเดิม

### Requirement: กฎ SEO ครบชุดตามชนิดคอนเทนต์
ระบบ SHALL ประเมินกฎ SEO อย่างน้อยดังนี้ โดย `level` เป็น `fail` เมื่อละเมิดเกณฑ์, `pass` เมื่อผ่าน, `pending` เมื่อข้อมูลที่ต้องใช้ยังว่าง, และ `skip` เมื่อกฎไม่เกี่ยวข้องกับชนิดคอนเทนต์

- `seo_title` ความยาว 1–60 ตัวอักษร
- `meta_description` ความยาว 120–160 ตัวอักษร
- `slug` เป็นตัวพิมพ์เล็กและคั่นด้วยขีด (`[a-z0-9-]`)
- บทความมี `h2` อย่างน้อย 1 ในเนื้อหา
- บทความมี h1 ได้ไม่เกิน 1 ตัว
- บทความมีจำนวนคำ ≥ 500 คำ
- คีย์เวิร์ดหลักปรากฏใน title, ย่อหน้าแรก และหัวข้อเมื่อมี keyword ให้ตรวจ
- `structured_data` เป็น JSON ที่ parse ได้และมี `@context` และ `@type`
- `og_image` ถูกตั้งค่าเป็นคำเตือนเมื่อว่าง
- บทความมีลิงก์ภายในอย่างน้อย 1
- วิดีโอตรวจ metadata และ hashtags ที่เกี่ยวข้อง แต่ `has_h2`, `word_count`, `internal_link` และกฎที่ต้องใช้โครงสร้างบทความเป็น `skip`

#### Scenario: h1 แรกที่เป็นชื่อบทความผ่าน
- **WHEN** เนื้อหาบทความมีแท็ก `h1` เพียงหนึ่งตัว
- **THEN** กฎ `no_h1` มี `level = 'pass'`

#### Scenario: h1 ซ้ำเป็น fail
- **WHEN** เนื้อหาบทความมีแท็ก `h1` ตั้งแต่สองตัวขึ้นไป
- **THEN** กฎ `no_h1` มี `level = 'fail'`

#### Scenario: seo_title ที่ยาวเกินกำหนดเป็น fail
- **WHEN** `seo_title` ว่างหรือยาวเกิน 60 ตัวอักษร
- **THEN** กฎ `seo_title` มี `level = 'fail'`

#### Scenario: meta_description ที่อยู่นอกช่วงเป็น fail
- **WHEN** `meta_description` สั้นกว่า 120 หรือยาวกว่า 160 ตัวอักษร
- **THEN** กฎ `meta_description` มี `level = 'fail'`

#### Scenario: เนื้อหาบทความไม่มี h2 เป็น fail
- **WHEN** เป็นบทความและ HTML ไม่มีแท็ก `h2`
- **THEN** กฎ `has_h2` มี `level = 'fail'`

#### Scenario: structured_data ที่มีค่าแต่รูปแบบผิดเป็น fail
- **WHEN** `structured_data` ไม่ว่างแต่ไม่ใช่ JSON ที่ parse ได้ หรือไม่มี `@context`/`@type`
- **THEN** กฎ `structured_data` มี `level = 'fail'`

#### Scenario: กฎที่ขึ้นกับเนื้อหาถูกข้ามเมื่อไม่มี HTML
- **WHEN** คอนเทนต์ไม่มีเนื้อหาบทความ HTML
- **THEN** กฎ `has_h2`, `no_h1`, `word_count`, `keyword_in_headings` และ `internal_link` มี `level = 'skip'`
- **AND** กฎเหล่านั้นไม่ถูกนับเป็น fail

#### Scenario: ข้อมูล metadata ว่างเป็น pending
- **WHEN** `seo_title`, `slug`, `meta_description`, `meta_keywords`, `og_image` หรือ `structured_data` ยังไม่มีค่า
- **THEN** กฎที่เกี่ยวข้องมี `level = 'pending'` หรือ `warn` ตามความรุนแรงของกฎเดิม
- **AND** ข้อมูลว่างไม่ถูกจัดเป็น `fail` เพียงเพราะว่าง

#### Scenario: วิดีโอข้ามกฎบทความ
- **WHEN** `type = 'video'`
- **THEN** กฎ `has_h2`, `word_count` และ `internal_link` มี `level = 'skip'`
- **AND** ระบบยังตรวจ metadata และ hashtags ตามข้อมูลที่เกี่ยวข้องกับวิดีโอ

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
เมื่อ `seo_gate_enabled = 1` ระบบ SHALL บล็อกการเผยแพร่ (publish / send_now / cron scheduler) หากผล `seo_evaluate()` มีกฎ `level = 'fail'` หรือคะแนนต่ำกว่า `seo_gate_min_score` โดย `pending`, `warn` และ `skip` ไม่เป็นเหตุบล็อกเมื่อ `seo_gate_min_score = 0`

#### Scenario: เปิดเกตและมีกฎ fail ถูกบล็อก
- **WHEN** `seo_gate_enabled = 1` และ `seo_evaluate()` คืนกฎที่มี `fail`
- **THEN** การเผยแพร่ถูกปฏิเสธพร้อมข้อความภาษาไทยที่ระบุกฎที่ติด
- **AND** ไม่มีการ dispatch ไปยัง platform

#### Scenario: เปิดเกตแต่มี pending โดยไม่มี fail ไม่ถูกบล็อก
- **WHEN** `seo_gate_enabled = 1`, `seo_gate_min_score = 0` และผลมี `pending` แต่ไม่มี `fail`
- **THEN** การเผยแพร่ดำเนินต่อไปตามปกติ

#### Scenario: เปิดเกตและคะแนนต่ำกว่าเกณฑ์ถูกบล็อก
- **WHEN** `seo_gate_enabled = 1` และคะแนนต่ำกว่า `seo_gate_min_score`
- **THEN** การเผยแพร่ถูกปฏิเสธแม้ไม่มี rule ระดับ `fail`
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
